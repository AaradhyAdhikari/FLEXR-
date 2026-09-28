import type { CapacitorConfig } from "@capacitor/cli";

/**
 * The shell loads the deployed Flexr site rather than bundling a copy, so the
 * phone app is always the same version as the web app and the server routes
 * (USDA, Open Food Facts, exercise animations) keep working.
 */
const config: CapacitorConfig = {
  appId: "app.flexr.tracker",
  appName: "Flexr",
  webDir: "www",
  server: {
    url: process.env.FLEXR_URL || "https://flexr-ten.vercel.app",
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
