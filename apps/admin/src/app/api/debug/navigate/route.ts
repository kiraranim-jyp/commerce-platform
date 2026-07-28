import { NextResponse } from "next/server";
import { launchChromium } from "@commerce/crawler";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * 진단 전용 라우트 — 실제 파이프라인/추출 로직은 전혀 건드리지 않는다. 상품
 * 페이지가 실제로 어떤 콘텐츠를 내려주는지(정상 페이지 vs Cloudflare 챌린지 vs
 * 차단 페이지 등)를 production(Vercel)에서 직접 확인하기 위한 임시 디버그
 * 도구다 — universal-extractor.ts와 최대한 같은 네비게이션 로직(UA/locale/
 * timezone/networkidle→domcontentloaded 폴백)을 그대로 재현해서, "왜 이
 * 사이트에서만 4개 전략이 전부 0개를 반환하는지" 원인을 좁힌다.
 *
 * 원인 규명 후 제거할 임시 도구다(제거 예정) — 정식 기능이 아니다.
 */
export async function POST(request: Request) {
  const { url } = (await request.json().catch(() => ({}))) as { url?: string };
  if (!url) {
    return NextResponse.json({ error: "url이 필요합니다." }, { status: 400 });
  }

  const browser = await launchChromium();
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      locale: "en-US",
      timezoneId: "Europe/Amsterdam",
      extraHTTPHeaders: {
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    });

    let navError: string | null = null;
    let response = null;
    let waitStrategy: "networkidle" | "domcontentloaded" = "networkidle";
    try {
      response = await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
    } catch (error) {
      navError = error instanceof Error ? error.message : String(error);
      waitStrategy = "domcontentloaded";
      try {
        response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.waitForTimeout(2000);
        navError = null; // 폴백이 성공했으면 첫 시도 실패는 참고용일 뿐 최종 에러가 아니다.
      } catch (fallbackError) {
        navError = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
      }
    }

    const navigatorInfo = await page.evaluate(() => ({
      userAgent: navigator.userAgent,
      webdriver: navigator.webdriver,
      language: navigator.language,
      languages: navigator.languages,
      platform: navigator.platform,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }));

    const html = await page.content().catch(() => "");
    const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
    const bodyMatch = /<body[^>]*>([\s\S]{0,3000})/i.exec(html);
    const firstScriptMatch = /<script[^>]*>([\s\S]{0,1500})/i.exec(html);

    let screenshotBase64: string | null = null;
    try {
      const buffer = await page.screenshot({ type: "png" });
      screenshotBase64 = buffer.toString("base64");
    } catch (error) {
      screenshotBase64 = null;
      console.warn("[debug/navigate] 스크린샷 실패:", error);
    }

    const responseHeaders = response ? await response.allHeaders() : null;

    return NextResponse.json({
      requestedUrl: url,
      finalUrl: page.url(),
      redirected: page.url() !== url,
      waitStrategy,
      navError,
      httpStatus: response?.status() ?? null,
      httpStatusText: response?.statusText() ?? null,
      responseHeaders,
      contentType: responseHeaders?.["content-type"] ?? null,
      htmlLength: html.length,
      htmlFirst5kb: html.slice(0, 5000),
      title: titleMatch?.[1]?.trim() ?? null,
      bodySnippet: bodyMatch?.[1] ?? null,
      firstScriptSnippet: firstScriptMatch?.[1] ?? null,
      navigatorInfo,
      screenshotBase64,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다." },
      { status: 500 },
    );
  } finally {
    await browser.close();
  }
}
