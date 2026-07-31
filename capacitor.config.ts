import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "bond.yukino.app",
  appName: "Yukino",
  webDir: "dist",
  // 允许原生壳内向 yukino.bond 发起 API 请求
  server: {
    androidScheme: "https",
    iosScheme: "capacitor",
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
  ios: {
    contentInset: "always",
  },
};

export default config;
