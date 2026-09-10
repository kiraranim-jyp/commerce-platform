import { request as httpsRequest } from "node:https";
import { request as httpRequest } from "node:http";

/**
 * OVERSEAS-PRICE-ORIGINAL-FALLBACK-1(CPO 지시, 2026-09-10) — Playwright가 차단당했을
 * 때만 쓰는 HTML 폴백.
 *
 * 실측(smallable.com): headless Chromium으로 열면 CloudFront가 **403**을 돌려주고
 * 본문이 923자짜리 오류 페이지라 상품 정보가 하나도 없다. 반면 같은 URL을 평범한
 * 브라우저 User-Agent로 HTTP 요청하면 200에 668KB 본문이 오고, 그 안의 JSON-LD에
 * 상품명·브랜드·가격·SKU가 전부 들어 있다. 즉 파서 문제가 아니라 **HTML을 못
 * 가져오는 문제**였다.
 *
 * node:https를 쓰는 이유는 fetch()로는 이 사이트를 받을 수 없기 때문이다 —
 * smallable의 Content-Security-Policy 헤더 하나가 17KB라 응답 헤더 총량이 19KB가
 * 되는데, undici(fetch)의 기본 상한은 16KB라 HeadersOverflowError로 죽는다.
 * node:https는 maxHeaderSize를 요청 단위로 올릴 수 있다.
 *
 * 이 함수는 절대 throw하지 않는다 — 폴백이 실패하면 null을 주고 호출부는 기존
 * 동작을 그대로 유지한다.
 */
const MAX_HEADER_SIZE = 64 * 1024;
const TIMEOUT_MS = 20_000;
/** 본문 상한 — 상품 페이지는 1MB를 넘지 않는다(실측 smallable 668KB). 무한정
 * 받아서 메모리를 쓰지 않도록 넘으면 그 시점까지만 쓰고 끊는다. */
const MAX_BODY_BYTES = 4 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export interface DirectHtmlResult {
  status: number;
  html: string;
  /** 리다이렉트를 따라간 최종 URL — 호출부가 상대경로를 풀 때 쓴다. */
  finalUrl: string;
}

export async function fetchHtmlDirect(url: string, redirectsLeft = MAX_REDIRECTS): Promise<DirectHtmlResult | null> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  const req = parsed.protocol === "https:" ? httpsRequest : httpRequest;

  return new Promise<DirectHtmlResult | null>((resolve) => {
    let settled = false;
    const done = (v: DirectHtmlResult | null) => {
      if (!settled) {
        settled = true;
        resolve(v);
      }
    };
    try {
      const r = req(
        url,
        {
          method: "GET",
          maxHeaderSize: MAX_HEADER_SIZE,
          headers: {
            "User-Agent": CHROME_UA,
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
          },
        },
        (res) => {
          const status = res.statusCode ?? 0;
          const location = res.headers.location;
          if (status >= 300 && status < 400 && location && redirectsLeft > 0) {
            res.resume();
            let next: string;
            try {
              next = new URL(location, url).toString();
            } catch {
              done(null);
              return;
            }
            void fetchHtmlDirect(next, redirectsLeft - 1).then(done);
            return;
          }
          let body = "";
          let bytes = 0;
          res.setEncoding("utf8");
          res.on("data", (chunk: string) => {
            bytes += Buffer.byteLength(chunk, "utf8");
            if (bytes <= MAX_BODY_BYTES) body += chunk;
            else res.destroy();
          });
          res.on("end", () => done({ status, html: body, finalUrl: url }));
          res.on("error", () => done(null));
        },
      );
      r.on("error", () => done(null));
      r.setTimeout(TIMEOUT_MS, () => r.destroy());
      r.end();
    } catch {
      done(null);
    }
  });
}
