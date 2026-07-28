import { NextResponse } from "next/server";
import { launchChromium } from "@commerce/crawler";

export const runtime = "nodejs";
export const maxDuration = 60;

const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/**
 * 진단 전용 라우트 — 실제 파이프라인/추출 로직은 전혀 건드리지 않는다. 상품
 * 페이지가 실제로 어떤 콘텐츠를 내려주는지(정상 페이지 vs Cloudflare 429/챌린지
 * 등)를 production(Vercel)에서 직접 확인하기 위한 임시 디버그 도구다.
 *
 * 운영 노출 방지: DEBUG_NAVIGATE_TOKEN 환경변수가 설정돼 있고, 요청 헤더
 * x-debug-token이 그 값과 정확히 일치할 때만 동작한다. 토큰이 설정 안 돼 있으면
 * (기본 상태) 이 라우트는 존재 자체를 드러내지 않도록 404만 반환한다.
 */
function isAuthorized(request: Request): boolean {
  const expected = process.env.DEBUG_NAVIGATE_TOKEN;
  if (!expected) return false;
  return request.headers.get("x-debug-token") === expected;
}

/** Shopify 상품 URL에서 handle(마지막 /products/{handle} 세그먼트)을 뽑는다 —
 * .json/.js 프로브에 필요하다. Shopify가 아니거나 형식이 다르면 null. */
function extractShopifyHandle(url: string): string | null {
  const match = /\/products\/([a-z0-9-]+)/i.exec(url);
  return match?.[1] ?? null;
}

interface ProbeResult {
  label: string;
  url: string;
  status: number | null;
  ok: boolean | null;
  contentType: string | null;
  bytesReceived: number | null;
  bodySnippet: string | null;
  error: string | null;
}

async function probe(label: string, url: string, userAgent?: string): Promise<ProbeResult> {
  try {
    const res = await fetch(url, {
      headers: userAgent ? { "User-Agent": userAgent } : {},
      signal: AbortSignal.timeout(15000),
    });
    const text = await res.text();
    return {
      label,
      url,
      status: res.status,
      ok: res.ok,
      contentType: res.headers.get("content-type"),
      bytesReceived: text.length,
      bodySnippet: text.slice(0, 300),
      error: null,
    };
  } catch (error) {
    return {
      label,
      url,
      status: null,
      ok: null,
      contentType: null,
      bytesReceived: null,
      bodySnippet: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Experiment B/D/E — Vercel 자체 egress에서 plain fetch(브라우저/서브리소스 없이
 * HTML 문서 하나만 요청)로 HTML/.json/.js를 각각 찔러본다. Playwright 결과와
 * 나란히 비교하면 "Playwright만 막히는지 vs 이 도메인으로 가는 모든 요청이
 * 막히는지"를 바로 구분할 수 있다. */
async function runProbes(url: string): Promise<ProbeResult[]> {
  const handle = extractShopifyHandle(url);
  const origin = new URL(url).origin;
  const probes = [
    probe("fetch-html (with UA)", url, CHROME_UA),
    probe("fetch-html (no UA)", url),
  ];
  if (handle) {
    probes.push(
      probe("fetch-product.json", `${origin}/products/${handle}.json`, CHROME_UA),
      probe("fetch-product.js", `${origin}/products/${handle}.js`, CHROME_UA),
    );
  }
  return Promise.all(probes);
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { url, skipPlaywright } = (await request.json().catch(() => ({}))) as {
    url?: string;
    skipPlaywright?: boolean;
  };
  if (!url) {
    return NextResponse.json({ error: "url이 필요합니다." }, { status: 400 });
  }

  const probeResults = await runProbes(url);

  if (skipPlaywright) {
    return NextResponse.json({ requestedUrl: url, probes: probeResults });
  }

  const browser = await launchChromium();
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
      userAgent: CHROME_UA,
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
      probes: probeResults,
      playwright: {
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
      },
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
