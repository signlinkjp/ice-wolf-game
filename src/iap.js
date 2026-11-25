/**
 * ICE WOLF PRO through the existing native StoreKit 2 plugin
 * (`IceWolfStoreKit`, registered by SceneDelegate.swift since v1.1.0).
 *
 * The product id never changes: jp.signlink.IceWolf.pro. When the plugin is not
 * there (Safari, a plain browser, a screenshot run) the app reports "not
 * supported" and the PRO screen still opens, so layout can be checked.
 */
import { APP, STORAGE } from './config.js';

function plugin() {
  const cap = typeof window !== 'undefined' ? window.Capacitor : undefined;
  return cap && cap.Plugins ? cap.Plugins.IceWolfStoreKit : null;
}

export const iap = {
  pro: false,
  priceText: '',
  supported: false,
  cached: false,

  remember(owned) {
    this.pro = Boolean(owned);
    try {
      localStorage.setItem(STORAGE.pro, owned ? '1' : '0');
    } catch {
      /* private mode */
    }
  },

  restoreLocal() {
    try {
      this.pro = localStorage.getItem(STORAGE.pro) === '1';
    } catch {
      this.pro = false;
    }
    return this.pro;
  },

  async status() {
    const p = plugin();
    if (!p) {
      this.supported = false;
      this.restoreLocal();
      return { supported: false, pro: this.pro, priceText: '' };
    }
    try {
      const res = await p.proStatus();
      this.supported = Boolean(res && res.supported);
      this.priceText = (res && res.priceText) || '';
      this.remember(res && res.pro);
      this.cached = true;
      return { supported: true, pro: this.pro, priceText: this.priceText };
    } catch {
      this.supported = false;
      this.restoreLocal();
      return { supported: false, pro: this.pro, priceText: '' };
    }
  },

  async purchase() {
    const p = plugin();
    if (!p) return { result: 'unsupported', pro: false };
    try {
      const res = await p.purchase({ productId: APP.productId });
      if (res && res.pro) this.remember(true);
      return res || { result: 'failed', pro: false };
    } catch (err) {
      return { result: 'failed', pro: false, message: String(err) };
    }
  },

  async restore() {
    const p = plugin();
    if (!p) {
      this.restoreLocal();
      return { result: this.pro ? 'restored' : 'none', pro: this.pro };
    }
    try {
      const res = await p.restore();
      this.remember(res && res.pro);
      return res || { result: 'none', pro: false };
    } catch (err) {
      return { result: 'failed', pro: this.pro, message: String(err) };
    }
  },
};
