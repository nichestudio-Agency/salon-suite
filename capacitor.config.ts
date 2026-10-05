import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "it.nichestudio.salonsuite",
  appName: "Salon Suite",
  webDir: "dist",
  backgroundColor: "#eef3f0",
  server: {
    // Firebase Auth nel simulatore comunica con gli emulatori locali via HTTP.
    // Un'origine HTTP evita che WKWebView tratti le chiamate come provenienti
    // dallo schema custom `capacitor://`, che può lasciare il login sospeso.
    iosScheme: "http",
  },
  ios: {
    contentInset: "always",
  },
};

export default config;
