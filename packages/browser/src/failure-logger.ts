import fs from "node:fs";
import path from "node:path";
import type { Page } from "playwright";
import { stopTracing } from "./browser.context";

/**
 * 실패 시 스크린샷/HTML/트레이스/에러 JSON을 logs/screenshots/ 에 저장한다.
 * 트레이스는 startTracing(context)가 사전에 호출된 경우에만 저장된다.
 */
export async function captureFailure(
  page: Page,
  name: string,
  error: unknown,
  dir = "logs/screenshots",
): Promise<void> {
  fs.mkdirSync(dir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const base = path.join(dir, `${name}-${timestamp}`);

  await page.screenshot({ path: `${base}.png`, fullPage: true }).catch(() => undefined);

  const html = await page.content().catch(() => "");
  if (html) {
    fs.writeFileSync(`${base}.html`, html);
  }

  await stopTracing(page.context(), `${base}.trace.zip`).catch(() => undefined);

  const errorInfo = {
    name,
    timestamp,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  };
  fs.writeFileSync(`${base}.error.json`, JSON.stringify(errorInfo, null, 2));
}
