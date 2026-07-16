import type { BrowserConfig } from "./types";

export function loadBrowserConfig(): BrowserConfig {
  return {
    headless: process.env.BROWSER_HEADLESS !== "false",
    storageStateDir: process.env.BROWSER_STORAGE_DIR ?? "storage/sessions",
    naver: {
      loginId: process.env.NAVER_LOGIN_ID,
      password: process.env.NAVER_LOGIN_PASSWORD,
      loginUrl: "https://nid.naver.com/nidlogin.login",
      sellerCenterUrl: "https://sell.smartstore.naver.com",
    },
  };
}
