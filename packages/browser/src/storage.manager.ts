import fs from "node:fs";
import path from "node:path";
import type { BrowserContext } from "playwright";
import { loadBrowserConfig } from "./browser.config";

export class StorageManager {
  private readonly dir: string;

  constructor(dir: string = loadBrowserConfig().storageStateDir) {
    this.dir = dir;
    fs.mkdirSync(this.dir, { recursive: true });
  }

  path(name: string): string {
    return path.join(this.dir, `${name}.json`);
  }

  has(name: string): boolean {
    return fs.existsSync(this.path(name));
  }

  async save(context: BrowserContext, name: string): Promise<string> {
    const file = this.path(name);
    await context.storageState({ path: file });
    return file;
  }

  remove(name: string): void {
    const file = this.path(name);
    if (fs.existsSync(file)) {
      fs.rmSync(file);
    }
  }
}
