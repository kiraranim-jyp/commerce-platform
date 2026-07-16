import type { Browser } from "playwright-core";

/**
 * 로컬 개발 환경에서는 playwright가 설치한 Chromium을 그대로 쓰고,
 * Vercel/Lambda 같은 서버리스 환경에서는 @sparticuz/chromium이 제공하는
 * 서버리스용 바이너리로 playwright-core를 띄운다.
 */
export async function launchChromium(): Promise<Browser> {
  const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_VERSION);

  if (isServerless) {
    const [{ default: chromiumBinary }, { chromium }] = await Promise.all([
      import("@sparticuz/chromium"),
      import("playwright-core"),
    ]);

    return chromium.launch({
      executablePath: await chromiumBinary.executablePath(),
      args: chromiumBinary.args,
      headless: true,
    });
  }

  const { chromium } = await import("playwright");
  return chromium.launch({ headless: true });
}
