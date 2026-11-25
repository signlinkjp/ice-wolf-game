import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor configuration for the ICE WOLF iOS shell.
 *
 * `webDir` points at `www/`, the output of `npm run build` (Three.js ES modules
 * plus the hand-drawn assets). The build is produced by
 * `scripts/ios/build-and-upload-testflight.sh` or by
 * `docs/ios-testflight-threejs.yml`, and is copied into `ios/App/App/public/`
 * by `npx cap sync ios`.
 *
 * There is no `server.url`: the game ships entirely offline inside the app
 * bundle, so the game never needs App Transport Security exceptions.
 */
const config: CapacitorConfig = {
  appId: "jp.signlink.IceWolf",
  appName: "ICE WOLF",
  webDir: "www",
  ios: {
    // The game draws edge to edge; any content inset would letterbox the canvas.
    contentInset: "never",
    // Same near-black as LaunchScreen / the splash art, so rotation and the
    // first WebView paint never flash white.
    backgroundColor: "#0A0F1A",
    scrollEnabled: false,
  },
};

export default config;
