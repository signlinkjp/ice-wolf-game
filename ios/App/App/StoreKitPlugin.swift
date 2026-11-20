import Foundation
import Capacitor
import StoreKit

/**
 ICE WOLF v1.1.0 — the Pro in-app purchase (StoreKit 2).

 One non-consumable product, `jp.signlink.IceWolf.pro`. The game asks this
 plugin three things and nothing else:

   proStatus()  the product (price / title) and whether Pro is owned right now
   purchase()   buy it (App Store sheet)
   restore()    App Store.sync() and then report the entitlement again

 Every answer is a plain object, so the JS side (game.json, the
 `v1.1.0 Pro 購入・復元UI` group) never has to parse a StoreKit type:

   proStatus  { supported, productId, priceText, productTitle, productDescription, pro, transactionId }
   purchase   { result: "purchased" | "cancelled" | "pending" | "failed", pro, transactionId, message }
   restore    { result: "restored" | "none" | "failed", pro, productIds, message }

 The entitlement is decided only from `Transaction.currentEntitlements` with
 local JWS verification; nothing is stored on the device as proof of purchase
 (the JS layer keeps a cache, but always asks this plugin again).

 Registered in SceneDelegate (IceWolfBridgeViewController.capacitorDidLoad).
 */
@objc(IceWolfStoreKitPlugin)
public class IceWolfStoreKitPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "IceWolfStoreKitPlugin"
    public let jsName = "IceWolfStoreKit"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "proStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restore", returnType: CAPPluginReturnPromise)
    ]

    /// The one product this app sells. App Store Connect must hold it as a
    /// non-consumable (買い切り) with exactly this identifier.
    static let productID = "jp.signlink.IceWolf.pro"

    private var updatesTask: Task<Void, Never>?

    override public func load() {
        // Ask to Buy / purchases finished elsewhere arrive here. Finishing them
        // keeps StoreKit from replaying them forever; the JS side re-reads the
        // entitlement the next time the Pro screen opens.
        updatesTask = Task.detached { [weak self] in
            for await update in Transaction.updates {
                guard case .verified(let transaction) = update else { continue }
                guard transaction.productID == IceWolfStoreKitPlugin.productID else { continue }
                await transaction.finish()
                guard let self = self else { continue }
                await MainActor.run {
                    self.notifyListeners("proChanged", data: [
                        "pro": transaction.revocationDate == nil,
                        "transactionId": String(transaction.id)
                    ])
                }
            }
        }
    }

    deinit {
        updatesTask?.cancel()
    }

    // MARK: - Plugin methods

    @objc func proStatus(_ call: CAPPluginCall) {
        Task {
            let entitlement = await self.currentEntitlement()
            let product = await self.loadProduct()
            var result: [String: Any] = [
                "supported": product != nil,
                "productId": IceWolfStoreKitPlugin.productID,
                "pro": entitlement.owned,
                "transactionId": entitlement.transactionID ?? ""
            ]
            if let product = product {
                result["priceText"] = product.displayPrice
                result["productTitle"] = product.displayName
                result["productDescription"] = product.description
            }
            call.resolve(result)
        }
    }

    @objc func purchase(_ call: CAPPluginCall) {
        let requested = call.getString("productId") ?? IceWolfStoreKitPlugin.productID
        guard requested == IceWolfStoreKitPlugin.productID else {
            call.resolve(["result": "failed", "message": "unknownProduct", "pro": false])
            return
        }
        Task {
            do {
                guard let product = try await Product.products(for: [requested]).first else {
                    // Not set up in App Store Connect (yet), or no network.
                    call.resolve(["result": "failed", "message": "productUnavailable", "pro": false])
                    return
                }
                switch try await product.purchase() {
                case .success(let verification):
                    guard case .verified(let transaction) = verification else {
                        call.resolve(["result": "failed", "message": "unverified", "pro": false])
                        return
                    }
                    await transaction.finish()
                    call.resolve([
                        "result": "purchased",
                        "pro": true,
                        "transactionId": String(transaction.id)
                    ])
                case .userCancelled:
                    call.resolve(["result": "cancelled", "pro": false])
                case .pending:
                    // Ask to Buy: the answer comes through Transaction.updates.
                    call.resolve(["result": "pending", "pro": false])
                @unknown default:
                    call.resolve(["result": "failed", "message": "unknown", "pro": false])
                }
            } catch {
                call.resolve(["result": "failed", "message": error.localizedDescription, "pro": false])
            }
        }
    }

    @objc func restore(_ call: CAPPluginCall) {
        Task {
            do {
                try await AppStore.sync()
            } catch {
                // A cancelled sign-in or an offline phone is not fatal: the
                // entitlement check below still reports what is owned.
            }
            let entitlement = await self.currentEntitlement()
            if entitlement.owned {
                call.resolve([
                    "result": "restored",
                    "pro": true,
                    "productIds": [IceWolfStoreKitPlugin.productID],
                    "transactionId": entitlement.transactionID ?? ""
                ])
            } else {
                call.resolve(["result": "none", "pro": false, "productIds": []])
            }
        }
    }

    // MARK: - StoreKit helpers

    private struct Entitlement {
        let owned: Bool
        let transactionID: String?
    }

    private func currentEntitlement() async -> Entitlement {
        for await result in Transaction.currentEntitlements {
            guard case .verified(let transaction) = result else { continue }
            guard transaction.productID == IceWolfStoreKitPlugin.productID else { continue }
            guard transaction.revocationDate == nil else { continue }
            return Entitlement(owned: true, transactionID: String(transaction.id))
        }
        return Entitlement(owned: false, transactionID: nil)
    }

    private func loadProduct() async -> Product? {
        do {
            return try await Product.products(for: [IceWolfStoreKitPlugin.productID]).first
        } catch {
            return nil
        }
    }
}

/// The Capacitor bridge view controller. Registering the StoreKit plugin here is
/// what puts it into the WebView (`window.Capacitor.Plugins.IceWolfStoreKit`).
final class IceWolfBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(IceWolfStoreKitPlugin())
    }
}
