import { chromium, type Browser } from "playwright";
import { loadBrowserConfig } from "./browser.config";

class BrowserService {
  private static instance: BrowserService | null = null;
  private browser: Browser | null = null;

  static getInstance(): BrowserService {
    if (!BrowserService.instance) {
      BrowserService.instance = new BrowserService();
    }
    return BrowserService.instance;
  }

  async launch(): Promise<Browser> {
    if (this.browser?.isConnected()) {
      return this.browser;
    }
    const config = loadBrowserConfig();
    this.browser = await chromium.launch({ headless: config.headless });
    return this.browser;
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

export const browserService = BrowserService.getInstance();
