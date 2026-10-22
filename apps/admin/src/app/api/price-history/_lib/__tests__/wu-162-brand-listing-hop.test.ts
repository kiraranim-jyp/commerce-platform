import { describe, expect, it } from "vitest";
import { factsFromProductUrl } from "@commerce/crawler";
import { classifyUrlShape } from "@commerce/crawler/src/comparison-search/url-shape";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 WU-162 — **브랜드 전용 목록 → 1-hop 상세 URL 회수 가능성** (측정 전용)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * CPO 지시(2026-10-22) — 「**1-hop 을 실제 운영 기능으로 만들지 않는다. 먼저 측정만.**」
 * 1차 KPI = 「브랜드 전용 목록에서 **실제 상품 상세 URL 을 안정적으로 회수** 할 수 있느냐」.
 * 🟢 그리고 「B226AC009 가 목록에 없어도 **그것 자체가 실패는 아니다**」(CPO 문장).
 *
 * 🔴 운영 코드 **0** · 1-hop 구현 **0** · adapter **0** · registry **0** · MI **0** ·
 *    Playwright **0** · Gemini **0** · 배포 **0**.
 * 🔴 게이트 `WU_162_PROBE=1` 없으면 SKIP.
 *
 * ── 🔴🔴 robots 가 대상을 «셋에서 둘로» 줄였다(측정 전에 확인했다) ────────────
 * ```
 * 보몽드    `User-agent: * → Disallow: /` **그리고** `ClaudeBot`/`GPTBot` 명시 Disallow
 *           ⟹ 🔴 **제외** — 1-hop 은 「준 URL 을 받는 것」과 달리 **링크를 따라가는**
 *              행위다. WU-154 가 어댑터를 STOP 한 그 근거가 그대로 적용된다
 * 도노키즈  `User-agent: * → Allow: /` · `Disallow: /makeshop/` 뿐   ⟹ 🟢 허용
 * 비스킷    특정 경로만 Disallow(`/skin-` 와일드카드 · `/exec/front/` · `/api` …) ⟹ 🟢 목록·상세 허용
 * ```
 * 🔴 (위에 `/skin-` 뒤의 와일드카드를 **글자로 적지 않는다** — 그 두 글자가 이 블록
 *    주석을 **조기 종료** 시킨다. 1차에 그렇게 써서 파일이 파싱조차 되지 않았다.)
 *
 * 🟢🟢 **그리고 WU-161 의 수수께끼가 풀렸다** — 비스킷 `UNREACHABLE` 2건의 경로가
 *    **`/skin-skin2/`** 였고 그것이 **robots Disallow 경로** 다. 🔴 즉 「비스킷은 읽히지
 *    않는다」가 아니라 **내가 금지 경로 URL 을 넣었다.** 🔴 그 URL 은 **검색이 돌려준
 *    것** 이다 — 검색 색인에 금지 경로가 들어 있다. 🔴 인과를 **단정하지는 않는다**
 *    (서버가 그 경로를 막는지 별개로 확인하지 않았다).
 */
const LIVE = process.env.WU_162_PROBE === "1";
const TARGET_CODE = "b226ac009";

interface Listing {
  shop: string;
  url: string;
  /** 🔴 robots 가 금지한 경로 조각. 링크 집계에서 **뺀다**(우회하지 않는다). */
  disallow: readonly string[];
  /**
   * 🔴🔴 **그 샵의 «관측된» 상품 상세 URL 모양.**
   *
   * 1차에 `classifyUrlShape(u) === "PRODUCT_PAGE"` 만으로 셌고 **그 숫자가 거짓이었다** —
   * 열어 본 8건의 제목이 **「회원 로그인」·「브랜드」·「기획전」·「비스킷 | Biskuit」** 였다.
   * 🔴 그 분류기는 한국 CMS 링크를 **오통과** 한다(WU-073 이 기록한 그 성질)고,
   *    게다가 내가 **문서 순서 앞 8개** 를 열어 **헤더/내비 링크** 를 쟀다.
   * ⟹ 🔴 그 상태의 「가격 0/8」은 **1-hop 불가의 증거가 아니다**(열화된 실행).
   * 🟢 그래서 **검색이 실제로 돌려준 URL 모양**(WU-159/161 관측)으로 좁힌다 —
   *    지어낸 규칙이 아니고, 운영 분류기를 **고치지도 않는다**(이 측정 안에서만 쓴다).
   */
  detailShape: (u: URL) => boolean;
}

const LISTINGS: Listing[] = [
  {
    shop: "도노키즈",
    url: "https://www.donokids.com/shop/shopbrand.html?xcode=058&type=X",
    disallow: ["/makeshop/"],
    /** 관측: `donokids.com/m/product.html?branduid=3362784…` */
    detailShape: (u) => u.pathname.includes("product.html") && u.searchParams.has("branduid"),
  },
  {
    shop: "비스킷",
    url: "https://biskuit.kr/category/bobo-choses/70/",
    disallow: ["/skin-", "/exec/front/", "/api", "/member/", "/myshop/", "/protected/", "/admin"],
    /** 관측: `biskuit.kr/product/<한글 슬러그>-b224ac005/3268/` — 마지막에 **숫자 칸** 이 있다 */
    detailShape: (u) => /\/product\/[^/]+\/\d+/.test(u.pathname),
  },
];

/** 🔴 예의상 상한 — 상세 fetch 를 무한히 하지 않는다. 적용 사실을 **출력한다**. */
const DETAIL_FETCH_CAP = 8;

async function raw(url: string): Promise<{ status: number | null; html: string; error: string | null }> {
  try {
    const res = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; ttaejyo-measure/1.0)" },
      signal: AbortSignal.timeout(30000),
    });
    return { status: res.status, html: await res.text(), error: null };
  } catch (e) {
    return { status: null, html: "", error: e instanceof Error ? `${e.name}: ${e.message}` : String(e) };
  }
}

/** 🔴 `href` 만 읽는다. 새 파서를 만들지 않고 이 측정 안에서만 쓴다. */
function hrefs(html: string, base: string): string[] {
  const out: string[] = [];
  const re = /<a\b[^>]*\bhref\s*=\s*["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const h = m[1].trim();
    if (!h || h.startsWith("#") || /^(javascript|mailto|tel):/i.test(h)) continue;
    try {
      out.push(new URL(h, base).toString());
    } catch {
      /* 무시 */
    }
  }
  return out;
}

describe("WU-162 — 브랜드 목록 1-hop 회수 가능성", () => {
  it.runIf(LIVE)("목록 → 링크 → 상세 URL → Fetch/Extract 를 센다", async () => {
    /* eslint-disable no-console */
    console.log("\n══════ 🔴 WU-162 — 브랜드 전용 목록 1-hop ══════");
    console.log(`  🔴 상세 fetch 상한 = **${DETAIL_FETCH_CAP}**(예의상) · 🔴 보몽드는 robots 로 **제외**`);

    let anyTarget = false;
    for (const L of LISTINGS) {
      const page = await raw(L.url);
      console.log(`\n── ${L.shop} ──\n  ${L.url}`);
      console.log(`  HTTP ${page.status ?? page.error} · ${Math.round(page.html.length / 1024)}KB`);
      if (page.status !== 200 || page.html.length === 0) {
        console.log("  🔴 목록을 받지 못했다 ⟹ 이 샵은 **1-hop 불가**(🔴 판정 ⒞ 후보)");
        continue;
      }

      const all = hrefs(page.html, L.url);
      const sameHost = all.filter((u) => {
        try {
          return new URL(u).hostname.replace(/^www\./, "") === new URL(L.url).hostname.replace(/^www\./, "");
        } catch {
          return false;
        }
      });
      /** 🔴 robots 금지 경로를 **빼고** 센다 — 우회하지 않는다. */
      const allowed = sameHost.filter((u) => !L.disallow.some((d) => new URL(u).pathname.includes(d)));
      const blocked = sameHost.length - allowed.length;
      /** 🔴 **두 숫자를 같이 적는다** — 하나만 적으면 1차처럼 과대 보고가 된다. */
      const byClassifier = [...new Set(allowed.filter((u) => classifyUrlShape(u) === "PRODUCT_PAGE"))];
      const detail = [...new Set(allowed.filter((u) => L.detailShape(new URL(u))))];

      console.log(`  링크 전체 ${all.length} · 같은 호스트 ${sameHost.length} · 🔴 robots 제외 ${blocked}`);
      console.log(`  🔴 classifyUrlShape 기준 ${byClassifier.length}  ← **과대**(내비/기획전/로그인 포함)`);
      console.log(`  🟢 **샵의 관측된 상세 모양 기준 ${detail.length}**  ← 이 숫자를 쓴다`);

      /** 🔴 목표 상품이 목록에 «있는가» — 실패 판정이 아니라 관측이다(CPO 명시). */
      const inHtml = page.html.toLowerCase().includes(TARGET_CODE);
      const inLinks = detail.filter((u) => u.toLowerCase().includes(TARGET_CODE));
      console.log(`  목표 품번 — HTML 안 ${inHtml ? "🟢 있다" : "🔴 없다"} · URL 안 **${inLinks.length}건**`);
      if (inLinks.length > 0) anyTarget = true;

      /** 🔴 상한만큼만 열어 본다. 목표 URL 이 있으면 **그것을 먼저** 넣는다. */
      const probe = [...inLinks, ...detail.filter((u) => !inLinks.includes(u))].slice(0, DETAIL_FETCH_CAP);
      let ok = 0;
      let priced = 0;
      console.log(`  상세 fetch — ${probe.length}건(상한 ${DETAIL_FETCH_CAP})`);
      for (const u of probe) {
        const f = await factsFromProductUrl(u);
        const hasPrice = f.candidate?.price?.amount != null;
        if (f.status === "OK") ok += 1;
        if (hasPrice) priced += 1;
        console.log(
          `    ${String(f.status).padEnd(16)} ${(hasPrice ? `${f.candidate?.price?.currency} ${f.candidate?.price?.amount}` : "-").padEnd(12)}` +
            ` ${String(f.candidate?.title ?? "").slice(0, 40)}`,
        );
      }
      console.log(`  🟢 status OK ${ok}/${probe.length} · 🔴 **가격까지 추출 ${priced}/${probe.length}**`);
    }

    console.log("\n══════ 🔴🔴 1차 KPI ══════");
    console.log("  「브랜드 전용 목록에서 실제 상품 상세 URL 을 안정적으로 회수할 수 있느냐」");
    console.log(`  목표 품번이 URL 로 나온 샵 = ${anyTarget ? "🟢 있다" : "🔴 없다"}`);
    console.log("  🔴 목표 상품이 목록에 없는 것은 **실패가 아니다**(CPO 명시) — 1차 KPI 는 회수 안정성이다.");
    console.log("  🔴 보몽드는 **robots Disallow** 라 분모에 없다(우회하지 않았다).");

    /** 🔴 측정이다 — 숫자를 단언해 고정하지 않는다. */
    expect(LISTINGS.length).toBeGreaterThan(0);
  }, 900_000);
});
