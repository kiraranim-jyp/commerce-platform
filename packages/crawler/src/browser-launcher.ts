import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Browser } from "playwright-core";

/**
 * Vercel(AWS Lambda) 서버리스 함수는 같은 "warm" 컨테이너를 여러 요청에 걸쳐
 * 재사용하는데, 그때 /tmp 디스크 상태가 요청 간에 그대로 유지된다. Playwright는
 * launch()할 때마다 /tmp에 무작위 이름의 profile 디렉터리
 * (playwright_chromiumdev_profile-*)를 새로 만드는데, browser.close()가 프로세스는
 * 정리해도 이 디렉터리는 안 지운다 — 그래서 같은 컨테이너가 반복 재사용되면
 * /tmp가 서서히 가득 차고, 결국 "FILE_ERROR_NO_SPACE"로 Chromium 자체가
 * 실행조차 안 되는 상태에 빠진다(원인 추적하기 전엔 마치 사이트가 다 막아버린
 * 것처럼 보여서 헷갈리기 쉽다). 매번 새로 launch하기 전에 이전 프로필 잔여물을
 * 지운다 — 이미 close()된 브라우저의 것이므로 지워도 안전하다.
 */
function pruneStalePlaywrightProfiles(): void {
  const tmpDir = os.tmpdir();
  let entries: string[];
  try {
    entries = fs.readdirSync(tmpDir);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.startsWith("playwright_") || !entry.includes("profile-")) continue;
    try {
      fs.rmSync(path.join(tmpDir, entry), { recursive: true, force: true });
    } catch {
      // 다른 프로세스가 아직 쓰고 있을 수도 있다 — 실패해도 다음 요청에서 다시 시도한다.
    }
  }
}

/**
 * 로컬 개발 환경에서는 playwright가 설치한 Chromium을 그대로 쓰고,
 * Vercel/Lambda 같은 서버리스 환경에서는 @sparticuz/chromium이 제공하는
 * 서버리스용 바이너리로 playwright-core를 띄운다.
 */
export async function launchChromium(): Promise<Browser> {
  const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_VERSION);
  pruneStalePlaywrightProfiles();

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
