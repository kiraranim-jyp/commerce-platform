import { describe, expect, it } from "vitest";
import { factsFromProductUrl } from "@commerce/crawler";
import { classifyUrlShape } from "@commerce/crawler/src/comparison-search/url-shape";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 WU-160 — **국내 주요 채널 상세 URL 의 `Fetch → Extract` 성공률** (측정 전용)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * CPO 지시(2026-10-22) — 「**검색을 더 만지지 않고 추출 가능성만** 측정한다.
 * 「AI Search → URL 확보」와 「우리 시스템 → URL 분석」은 이제 **별개의 병목** 이다」.
 *
 * 🟢🟢 **그래서 목표 상품이 필요 없다** — 그 채널의 **실제 상세 URL 아무것이든** 된다.
 *    🔴 그 구분을 지키는 것이 이 WU 의 전부다(섞으면 검색 병목이 추출 병목으로 읽힌다).
 *
 * 🔴 Playwright **0** · adapter **0** · registry **0** · robots 우회 **0** · MI **0** ·
 *    검색어 변경 **0** · `maxUrls` **0** · Gemini **0** · 배포 **0** · 운영 코드 **0**.
 * 🔴 게이트 `WU_160_PROBE=1` 없으면 SKIP.
 *
 * ── 🔴 판정 기준(CPO §판정) ─────────────────────────────────────────────────
 * ```
 * ① HTML 에 상품정보가 **있는데** 우리 Extractor 만 못 읽음  → 추출기 문제
 * ② JS 렌더링 없이는 상품정보가 **아예 안 내려옴**           → 「현 Fetch 로는 불가」 확정
 * ③ 채널별 혼재                                            → 채널별 별도 판단
 * ```
 * 🔴 그래서 **운영 추출 결과** 와 **날것 HTML 의 내용** 을 **같이** 본다 —
 *    하나만 보면 ①과 ②를 가를 수 없다.
 *
 * ── 🔴 상세 URL 을 확보하지 «못한» 채널은 분모에서 뺀다 ─────────────────────
 * ```
 * 🔴 롯데ON   `site:lotteon.com` 이 **검색 페이지만** 돌려줬다 ⟹ **상세 URL 미확보**
 * 🔴 신세계   CPO 목록에도 `emart.ssg.com/search.ssg?query=` (검색) 뿐이었다 ⟹ **미확보**
 * ⟹ 🔴 둘을 「추출 실패」로 세지 않는다. **URL 을 지어내지 않았다.**
 * ```
 */
const LIVE = process.env.WU_160_PROBE === "1";

interface Target {
  channel: string;
  url: string;
  /** 🔴 그 페이지에 있어야 «할» 브랜드 토큰. 없으면 null — 지어내지 않는다. */
  expectBrandToken: string | null;
}

/** 🔴 전부 **실제로 확보된** URL 이다(WU-155 CPO 목록 · WU-159 2차 회수 · WU-160 site: 질의). */
const TARGETS: Target[] = [
  { channel: "쿠팡", url: "https://www.coupang.com/vp/products/8039018268?itemId=22500188394&vendorItemId=90224398222", expectBrandToken: null },
  { channel: "롯데홈쇼핑", url: "https://m.lotteimall.com/goods/viewGoodsDetail.lotte?goods_no=1287736300", expectBrandToken: null },
  { channel: "LF몰", url: "https://www.lfmall.co.kr/app/product/EFUIXX00168", expectBrandToken: "BOBO" },
  { channel: "LF몰", url: "https://www.lfmall.co.kr/app/product/EFUIXX00313", expectBrandToken: "BOBO" },
  { channel: "LF몰", url: "https://www.lfmall.co.kr/app/product/FH50XX00533", expectBrandToken: null },
  { channel: "도노키즈", url: "http://www.donokids.com/m/product.html?branduid=668374&mcode=001&special=3&xcode=058", expectBrandToken: "보보쇼즈" },
  { channel: "도노키즈", url: "https://donokids.com/m/product.html?branduid=3362015", expectBrandToken: "보보쇼즈" },
  { channel: "도노키즈", url: "http://donokids.com/m/product.html?branduid=3362784&xcode=058&mcode=003&special=3", expectBrandToken: "보보쇼즈" },
  /** 🟢 CONTROL — WU-150/158/159 가 SAME 까지 확인한 채널(추출이 되는 쪽의 기준선). */
  { channel: "보몽드(CONTROL)", url: "https://www.beaumonde.co.kr/goods/goods_view.php?goodsNo=1000014022", expectBrandToken: "보보쇼즈" },
];

/** 🔴 날것 HTML 조사 — **읽기만** 한다. 운영 fetcher 와 헤더가 다를 수 있다(그대로 적는다). */
async function rawHtml(url: string): Promise<{ status: number | null; html: string; error: string | null }> {
  try {
    const res = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; ttaejyo-measure/1.0)" },
      signal: AbortSignal.timeout(30000),
    });
    const html = await res.text();
    return { status: res.status, html, error: null };
  } catch (e) {
    return { status: null, html: "", error: e instanceof Error ? `${e.name}: ${e.message}` : String(e) };
  }
}

describe("WU-160 — 국내 채널 Fetch → Extract 성공률", () => {
  it.runIf(LIVE)("채널별로 ①추출기 문제 / ②JS 렌더 를 가른다", async () => {
    /* eslint-disable no-console */
    console.log("\n══════ 🔴 WU-160 — 운영 추출 결과 ↔ 날것 HTML ══════");
    console.log(
      `  ${"채널".padEnd(16)} ${"shape".padEnd(13)} ${"운영 status".padEnd(18)} ${"path".padEnd(13)} ` +
        `${"HTML".padStart(8)} ${"ld+json".padStart(8)} ${"og:t".padStart(5)} ${"브랜드".padStart(7)} ${"원".padStart(5)}`,
    );

    let extractOk = 0;
    let htmlHasInfo = 0;
    const perChannel = new Map<string, { n: number; ok: number; htmlInfo: number }>();

    for (const t of TARGETS) {
      const facts = await factsFromProductUrl(t.url);
      const raw = await rawHtml(t.url);
      const html = raw.html;
      /** 🔴 「상품정보가 HTML 에 있는가」를 **네 축** 으로 본다 — 하나만 보면 오판한다. */
      const hasLd = /<script[^>]+application\/ld\+json/i.test(html);
      const hasOgTitle = /<meta[^>]+property=["']og:title["']/i.test(html);
      const hasBrand = t.expectBrandToken ? html.toUpperCase().includes(t.expectBrandToken.toUpperCase()) : false;
      const hasWon = /[0-9]{2,3}(,[0-9]{3})+\s*원/.test(html.replace(/<[^>]*>/g, " "));
      const info = hasLd || hasOgTitle || hasBrand || hasWon;

      /**
       * 🔴🔴 **1차에 `status === "OK"` 를 「추출 성공」으로 썼고 그것이 틀렸다.**
       *    LF몰 3건이 `OK` 인데 title 이 **「나를 나답게 LFmall.com」**(사이트 슬로건)이고
       *    롯데홈쇼핑은 **기획전 배너** 였다 ⟹ 내 판정식이 둘 다 **「🟢 추출 정상」** 으로
       *    찍었다. 🔴 그대로 보고했으면 「LF몰·롯데홈쇼핑은 읽힌다」는 **거짓 결론** 이다.
       *    🔴 이것이 WU-074 가 기록한 그 함정이다 — `<title>` 이 있으면 `OK` 가 된다.
       * 🟢 그래서 기준을 **「상품정보가 실제로 나왔는가」** 로 바꾼다. 사이트별 규칙을
       *    만들지 않고 **가격** 하나로 본다(가격 축이 이 트랙의 목적이기도 하다).
       */
      const ok = facts.status === "OK" && facts.candidate?.price?.amount != null;
      if (ok) extractOk += 1;
      if (info) htmlHasInfo += 1;
      const agg = perChannel.get(t.channel) ?? { n: 0, ok: 0, htmlInfo: 0 };
      agg.n += 1;
      if (ok) agg.ok += 1;
      if (info) agg.htmlInfo += 1;
      perChannel.set(t.channel, agg);

      console.log(
        `  ${t.channel.padEnd(16)} ${String(classifyUrlShape(t.url)).padEnd(13)} ` +
          `${String(facts.status).padEnd(18)} ${String(facts.fetchPath ?? "-").padEnd(13)} ` +
          `${String(raw.status ?? raw.error ?? "-").padStart(4)}/${String(Math.round(html.length / 1024) + "KB").padStart(6)} ` +
          `${(hasLd ? "🟢" : "🔴").padStart(6)} ${(hasOgTitle ? "🟢" : "🔴").padStart(4)} ` +
          `${(t.expectBrandToken ? (hasBrand ? "🟢" : "🔴") : "-").padStart(6)} ${(hasWon ? "🟢" : "🔴").padStart(4)}`,
      );
      console.log(
        `     운영 추출 — title=${JSON.stringify(String(facts.candidate?.title ?? "").slice(0, 44))}` +
          ` price=${facts.candidate?.price?.amount != null ? `${facts.candidate.price.currency} ${facts.candidate.price.amount}` : "-"}`,
      );
    }

    console.log("\n══════ 🔴🔴 채널별 판정 ══════");
    console.log(`  ${"채널".padEnd(16)} ${"URL".padStart(4)} ${"추출OK".padStart(7)} ${"HTML에 정보".padStart(11)}  판정`);
    for (const [ch, a] of perChannel) {
      /**
       * 🔴 ①과 ②를 **데이터로** 가른다:
       *    HTML 에 정보가 있는데 추출 0 → **①추출기 문제**
       *    HTML 에 정보가 없다        → **②JS 렌더 · 현 Fetch 로는 불가**
       */
      /**
       * 🔴 「② JS 렌더」로 뭉개지 않는다 — 1차에 그랬고 **부정확했다**:
       *    쿠팡은 날것 fetch 가 **403**(차단)이고 도노키즈 2건은 **0KB 빈 응답** 이다.
       *    둘 다 「JS 렌더」가 아니다. 🟢 그래서 **혼재(③)** 를 별도 등급으로 둔다.
       */
      const verdict =
        a.ok === a.n
          ? "🟢 추출 정상"
          : a.ok > 0
            ? "🟡 **③ 혼재**(같은 채널에서 갈린다)"
            : a.htmlInfo > 0
              ? "🔴 **① 추출기 문제**(HTML 에 정보가 있는데 못 읽는다)"
              : "🔴 **② HTML 에 상품정보가 없다** — 현 Fetch 로 불가";
      console.log(`  ${ch.padEnd(16)} ${String(a.n).padStart(4)} ${String(a.ok).padStart(7)} ${String(a.htmlInfo).padStart(11)}  ${verdict}`);
    }
    console.log(`\n  전체 — URL ${TARGETS.length} · 추출 OK **${extractOk}** · HTML 에 정보 **${htmlHasInfo}**`);
    console.log("  🔴 롯데ON · 신세계 는 **상세 URL 미확보** 라 분모에서 뺐다(추출 실패로 세지 않는다).");
    console.log("  🔴 날것 HTML 은 측정용 fetch 다 — 운영 fetcher 와 헤더가 다를 수 있다.");

    /** 🔴 측정이다 — 숫자를 단언해 고정하지 않는다. */
    expect(TARGETS.length).toBeGreaterThan(0);
  }, 900_000);
});
