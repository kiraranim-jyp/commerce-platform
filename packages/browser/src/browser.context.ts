import type { BrowserContext, Page } from "playwright";
import { browserService } from "./browser.service";
import type { ContextOptions } from "./types";

export async function createContext(options: ContextOptions = {}): Promise<BrowserContext> {
  const browser = await browserService.launch();
  return browser.newContext({
    storageState: options.storageStatePath,
    userAgent: options.userAgent,
    viewport: { width: 1280, height: 800 },
  });
}

export async function newPage(context: BrowserContext): Promise<Page> {
  return context.newPage();
}

export async function startTracing(context: BrowserContext): Promise<void> {
  await context.tracing.start({ screenshots: true, snapshots: true });
}

export async function stopTracing(context: BrowserContext, outputPath: string): Promise<void> {
  await context.tracing.stop({ path: outputPath });
}
