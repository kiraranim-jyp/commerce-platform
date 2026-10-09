import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveUpdateSellerTags } from "@commerce/listing";
import { classifyOfficialOriginHtml, htmlToText, officialSiteForBrand, originSnippet } from "@commerce/crawler";
import {
  groupForAgent,
  parseRobotsTxt,
  pathDisallowed,
} from "@commerce/crawler/src/utils/robots-gate";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P5.6 P2 최종 2건(CPO 결정, 2026-10-09)
 * ════════════════════════════════════════════════════════════════════════════
 *
 *   ① SmartStore 태그 UPDATE — 보존 정책
 *   ② 원산지 — 브랜드 공식몰 확인
 *
 * 🔴 네트워크를 쓰지 않는다. 사슬의 «판정» 은 전부 순수 함수로 갈라 뒀고
 *    여기서는 그것을 센다 — 실제 HTTP 는 Production 실측의 몫이다.
 */

const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const read = (rel: string) => readFileSync(join(__dirname, "../../../../../../..", rel), "utf8");

describe("① 🔴 태그 UPDATE — 기존 태그를 «지우지» 않는다", () => {
  it("셀러가 안 고쳤으면 채널 태그를 유지하고 우리 태그를 더한다", () => {
    const d = resolveUpdateSellerTags({
      ourTags: ["아동", "수입원피스"],
      channelTags: ["여아원피스", "아동"],
      sellerEditedTags: false,
    });
    expect(d.action).toBe("SEND");
    if (d.action !== "SEND") return;
    /* 🔴 채널이 «앞» 이다 — 셀러가 센터에서 정한 순서를 우리가 밀어내지 않는다. */
    expect(d.tags.map((t) => t.text)).toEqual(["여아원피스", "아동", "수입원피스"]);
    expect(d.preservedFromChannel).toEqual(["여아원피스", "아동"]);
    expect(d.added).toEqual(["수입원피스"]);
  });

  it("🔴 중복은 대소문자를 무시하고 걷는다 — 화면과 payload 가 다른 개수를 말하지 않게", () => {
    const d = resolveUpdateSellerTags({ ourTags: ["Kid"], channelTags: ["kid"], sellerEditedTags: false });
    expect(d.action).toBe("SEND");
    if (d.action !== "SEND") return;
    expect(d.tags).toHaveLength(1);
    expect(d.tags[0].text).toBe("kid");
  });

  it("🔴 셀러가 «명시적으로» 비웠을 때만 삭제 의도다", () => {
    const cleared = resolveUpdateSellerTags({ ourTags: [], channelTags: ["여아원피스"], sellerEditedTags: true });
    expect(cleared.action).toBe("CLEAR");
  });

  it("🔴 셀러가 안 고쳤는데 우리 목록이 비면 «삭제하지 않는다»", () => {
    const d = resolveUpdateSellerTags({ ourTags: [], channelTags: ["여아원피스"], sellerEditedTags: false });
    expect(d.action).toBe("SEND");
    if (d.action !== "SEND") return;
    expect(d.tags.map((t) => t.text)).toEqual(["여아원피스"]);
  });

  it("🔴 셀러가 고쳤으면 그 목록이 최종값이다 — 지운 태그가 되살아나지 않는다", () => {
    const d = resolveUpdateSellerTags({
      ourTags: ["아동"],
      channelTags: ["여아원피스", "아동"],
      sellerEditedTags: true,
    });
    expect(d.action).toBe("SEND");
    if (d.action !== "SEND") return;
    expect(d.tags.map((t) => t.text)).toEqual(["아동"]);
  });

  it("🔴 채널 태그를 «읽지 못했으면» UNKNOWN 이다 — 보내도 지우고 안 보내도 지운다", () => {
    const d = resolveUpdateSellerTags({ ourTags: ["아동"], channelTags: undefined, sellerEditedTags: false });
    expect(d.action).toBe("UNKNOWN");
    expect(d.reason).toContain("조회하지 못했습니다");
  });

  it("🔴 «읽었는데 없었다»(빈 배열)와 «못 읽었다»(undefined)를 가른다", () => {
    const empty = resolveUpdateSellerTags({ ourTags: ["아동"], channelTags: [], sellerEditedTags: false });
    expect(empty.action).toBe("SEND");
    const unknown = resolveUpdateSellerTags({ ourTags: ["아동"], channelTags: undefined, sellerEditedTags: false });
    expect(unknown.action).toBe("UNKNOWN");
  });

  it("🔴 code 를 «만들지 않는다» — 불일치는 요청 전체를 실패시킨다", () => {
    const d = resolveUpdateSellerTags({ ourTags: ["아동"], channelTags: ["여아"], sellerEditedTags: false });
    if (d.action !== "SEND") throw new Error("SEND 가 아니다");
    for (const tag of d.tags) expect(Object.keys(tag)).toEqual(["text"]);
  });

  it("🔴 중복 규칙을 두 벌로 만들지 않았다 — keywordDedupeKey 하나를 쓴다", () => {
    const src = strip(read("packages/listing/src/naver/seller-tags-update.ts"));
    expect(src).toContain('from "@commerce/content"');
    expect(src).toContain("keywordDedupeKey");
  });

  it("🔴 보존 경로가 그 판정을 payload 에 «반영» 한다 — 선언만 하지 않았다", () => {
    const src = strip(read("packages/listing/src/naver/preserve-registered-values.ts"));
    expect(src).toContain("resolveUpdateSellerTags({");
    expect(src).toContain("nextAttr.seoInfo = { ...nextAttr.seoInfo, sellerTags: sellerTags.tags }");
    expect(src).toContain("sellerTags };");
  });

  it("🔴 PRESERVABLE_UPDATE_FIELDS 에 태그를 «섞지 않았다» — 단순 복원 축이 아니다", () => {
    const src = strip(read("packages/listing/src/naver/preserve-registered-values.ts"));
    expect(src).toContain(
      'export const PRESERVABLE_UPDATE_FIELDS = ["name", "salePrice", "stockQuantity", "detailContent"] as const;',
    );
  });

  it("🔴 GET 이 채널 태그를 읽는다 — `?? []` 로 메우지 않는다", () => {
    const src = strip(read("apps/admin/src/app/api/smartstore/_lib/update-product.ts"));
    expect(src).toContain("seoInfo?: { sellerTags?: { code?: number; text?: string }[] }");
    expect(src).toContain("sellerTags: origin.detailAttribute?.seoInfo?.sellerTags");
    const at = src.indexOf("sellerTags: origin.detailAttribute");
    expect(src.slice(at, at + 160), "없는 것을 빈 배열로 메웠다").not.toContain("?? []");
  });
});

describe("② 🔴 robots 를 «먼저» 본다", () => {
  it("Disallow 가 경로를 막으면 막힌다", () => {
    const g = groupForAgent(parseRobotsTxt("User-agent: *\nDisallow: /admin/"), "ttaejyo-bot");
    expect(g).not.toBeNull();
    expect(pathDisallowed(g!, "/admin/x").blocked).toBe(true);
    expect(pathDisallowed(g!, "/products/x").blocked).toBe(false);
  });

  it("🔴 더 긴 Allow 가 이긴다 — 없으면 Disallow:/ 사이트가 전부 막힌다", () => {
    const g = groupForAgent(parseRobotsTxt("User-agent: *\nDisallow: /\nAllow: /products/"), "ttaejyo-bot");
    expect(pathDisallowed(g!, "/products/a").blocked).toBe(false);
    expect(pathDisallowed(g!, "/cart").blocked).toBe(true);
  });

  it("🔴 빈 Disallow 는 「전체 차단」이 아니다", () => {
    const g = groupForAgent(parseRobotsTxt("User-agent: *\nDisallow:"), "ttaejyo-bot");
    expect(pathDisallowed(g!, "/anything").blocked).toBe(false);
  });

  it("Crawl-delay 를 버리지 않는다 — 호출부가 쓴다", () => {
    const g = groupForAgent(parseRobotsTxt("User-agent: *\nCrawl-delay: 5\nDisallow: /x"), "ttaejyo-bot");
    expect(g?.crawlDelay).toBe(5);
  });

  it("$ 종단 패턴을 다룬다", () => {
    const g = groupForAgent(parseRobotsTxt("User-agent: *\nDisallow: /*.json$"), "ttaejyo-bot");
    expect(pathDisallowed(g!, "/a/b.json").blocked).toBe(true);
    expect(pathDisallowed(g!, "/a/b.json?x=1").blocked).toBe(false);
  });

  it("🔴 못 읽었을 때 「허용」으로 읽지 않는다 — 코드가 그렇게 적혀 있다", () => {
    const src = strip(read("packages/crawler/src/utils/robots-gate.ts"));
    expect(src).toContain('state: "UNKNOWN"');
    /* 5xx 는 허용이 아니다. */
    expect(src).toContain("res.status >= 500");
  });

  it("🔴 우회 코드가 없다 — UA 를 바꿔 재시도하지 않는다", () => {
    const src = strip(read("packages/crawler/src/utils/robots-gate.ts"));
    for (const bad of ["retry", "Googlebot", "bypass"]) {
      expect(src, `우회 흔적(${bad})이 있다`).not.toContain(bad);
    }
  });
});

describe("② 🔴 공식몰 제조국 — «확인된 것» 만 쓴다", () => {
  it("관측해 둔 브랜드만 공식몰을 안다", () => {
    expect(officialSiteForBrand("Bobo Choses")).toBe("bobochoses.com");
    expect(officialSiteForBrand("bobo  choses")).toBe("bobochoses.com");
  });

  it("🔴 모르는 브랜드는 도메인을 «추측하지 않는다»", () => {
    expect(officialSiteForBrand("Sergio Tacchini")).toBeNull();
    expect(officialSiteForBrand("Main Story")).toBeNull();
    expect(officialSiteForBrand("")).toBeNull();
  });

  it("🔴 브랜드명 → 도메인 «생성» 규칙이 코드에 없다 — main-story 사례", () => {
    const src = strip(read("packages/crawler/src/official-site-origin.ts"));
    for (const bad of ['+ ".com"', "`${", "replace(/ /g"]) {
      expect(src, `도메인 조립 규칙(${bad})이 생겼다`).not.toContain(bad);
    }
  });

  it("HTML 에서 텍스트만 벗긴다 — 의미를 해석하지 않는다", () => {
    expect(htmlToText("<p>SS26 <b>Made in Italy</b>.</p><script>x()</script>")).toBe("SS26 Made in Italy .");
  });

  it("🔴 근거 조각을 남긴다 — 요약하지 않는다", () => {
    const snip = originSnippet("Composition 100% cotton. Made in Italy. Care: wash cold.", "Italy");
    expect(snip).toContain("Made in Italy");
  });

  it("🔴 LLM 호출이 없다 — AI 추정으로 제조국을 만들지 않는다", () => {
    const src = strip(read("packages/crawler/src/official-site-origin.ts"));
    for (const bad of ["gemini", "openai", "generativelanguage", "prompt"]) {
      expect(src.toLowerCase(), `AI 경로(${bad})가 생겼다`).not.toContain(bad);
    }
  });

  it("🔴 추출기를 새로 만들지 않았다 — 수집이 쓰는 그 순수 함수다", () => {
    const src = strip(read("packages/crawler/src/official-site-origin.ts"));
    expect(src).toContain('import { extractCountryOfOrigin } from "./description-facts"');
  });

  it("🔴 네 상태를 갈라 돌려준다 — 「확인 못 함」을 「해당 없음」으로 뭉개지 않는다", () => {
    const src = strip(read("packages/crawler/src/official-site-origin.ts"));
    for (const state of ["VERIFIED", "UNVERIFIED", "BLOCKED", "NO_OFFICIAL_SITE"]) {
      expect(src).toContain(state);
    }
  });

  /* ══ 🔴 음성 대조 U10 이 «통과했다» — 그래서 이 블록이 생겼다 ═══════════
     판정이 네트워크 함수 안에 있어서, 「확인 못 했는데 VERIFIED + 지어낸 값」으로
     바꿔도 한 건도 실패하지 않았다. 소스 문자열 검사는 「그 줄이 있다」만 말하고
     「그렇게 동작한다」는 말하지 못한다. 판정을 순수 함수로 꺼내 전수로 잰다. */
  it("🔴 제조국 표기가 «있으면» VERIFIED 이고 값과 근거가 따라온다", () => {
    const e = classifyOfficialOriginHtml("<p>100% cotton. Made in Italy.</p>", "https://x.com/p");
    expect(e.state).toBe("VERIFIED");
    expect(e.manufacturingCountry).toBe("Italy");
    expect(e.sourceUrl).toBe("https://x.com/p");
    expect(e.snippet).toContain("Made in Italy");
  });

  it("🔴🔴 표기가 «없으면» UNVERIFIED 이고 값이 null 이다 — 지어내지 않는다", () => {
    const e = classifyOfficialOriginHtml("<p>100% cotton. Wash cold.</p>", "https://x.com/p");
    expect(e.state).toBe("UNVERIFIED");
    expect(e.manufacturingCountry).toBeNull();
    expect(e.reason).toContain("추측하지 않고");
  });

  it.each([
    ["빈 문서", ""],
    ["브랜드 국가만 적힌 문서", "<p>An Italian brand since 1966.</p>"],
    ["배송 국가만 적힌 문서", "<p>Ships from Spain to Korea.</p>"],
  ])("🔴 %s 에서도 제조국을 만들지 않는다", (_name, html) => {
    const e = classifyOfficialOriginHtml(html, "https://x.com/p");
    expect(e.state).toBe("UNVERIFIED");
    expect(e.manufacturingCountry).toBeNull();
  });

  it("한국어 「제조국:」 표기도 읽는다", () => {
    const e = classifyOfficialOriginHtml("<p>제조국: 중국</p>", "https://x.com/p");
    expect(e.state).toBe("VERIFIED");
    expect(e.manufacturingCountry).toBe("중국");
  });

  it("🔴 VERIFIED 가 아니면 값이 null 이다 — 미확인이다", () => {
    const src = strip(read("packages/crawler/src/official-site-origin.ts"));
    expect(src).toContain("manufacturingCountry: null");
  });

  it("🔴 공식몰을 모르면 HTTP 를 «한 번도» 쓰지 않는다", () => {
    const src = strip(read("packages/crawler/src/official-site-origin.ts"));
    const at = src.indexOf("export async function verifyOriginForBrand");
    const body = src.slice(at, src.indexOf("verifyOriginFromOfficialPage(`https://", at));
    expect(body).toContain('state: "NO_OFFICIAL_SITE"');
    expect(body, "도메인을 모르는데 fetch 가 먼저 나간다").not.toContain("fetchHtmlDirect");
  });

  it("🔴 사이트를 «돌지» 않는다 — 페이지 한 장이다", () => {
    const src = strip(read("packages/crawler/src/official-site-origin.ts"));
    expect((src.match(/fetchHtmlDirect\(/g) ?? []).length, "fetch 가 둘 이상이다").toBe(1);
    for (const bad of ["for (const path", "while ("]) {
      expect(src, `순회(${bad})가 생겼다`).not.toContain(bad);
    }
  });
});

describe("② 🔴 화면·라우트가 «확정하지 않는다»", () => {
  const ROUTE = strip(read("apps/admin/src/app/api/origin/verify/route.ts"));
  const PV = strip(read("apps/admin/src/app/pipeline/commerce/PlatformPreview.tsx"));

  it("라우트가 값을 저장하지 않는다 — 판정과 근거만 돌려준다", () => {
    expect(ROUTE).toContain("verifyOriginForBrand(brand, pagePath)");
    for (const bad of ["saveSnapshot", "update(", "insert(", "supabase"]) {
      expect(ROUTE, `저장 경로(${bad})가 생겼다`).not.toContain(bad);
    }
  });

  it("🔴 경로를 우리가 지어내지 않는다 — 셀러/화면이 준 것만 쓴다", () => {
    expect(ROUTE).toContain('body.pagePath === "string" && body.pagePath.startsWith("/")');
  });

  it("화면 버튼이 «눌러야» 돈다 — 렌더마다 HTTP 가 나가지 않는다", () => {
    expect(PV).toContain("공식몰에서 제조국 확인");
    expect(PV).toContain("onClick={() => void run()}");
    const at = PV.indexOf("function OfficialOriginCheck");
    const body = PV.slice(at, at + 2600);
    expect(body, "자동 호출(useEffect)이 생겼다").not.toContain("useEffect");
  });

  it("🔴 확인된 값도 셀러가 눌러야 들어간다", () => {
    expect(PV).toContain("을 원산지로 넣기");
    expect(PV).toContain('evidence.state === "VERIFIED" && evidence.manufacturingCountry');
  });

  it("🔴 근거를 보여준다 — URL 과 원문 조각", () => {
    expect(PV).toContain("근거: {evidence.sourceUrl}");
    expect(PV).toContain("evidence.snippet");
  });

  it("🔴 브랜드가 없으면 버튼 자체를 그리지 않는다", () => {
    expect(PV).toContain("if (!brand.trim()) return null;");
  });
});

describe("🔴 기존 경계는 그대로다", () => {
  it("common 계층에 MANUFACTURING_COUNTRY concept 를 만들지 «않았다»", () => {
    for (const f of ["origin.ts", "manufacturer.ts", "logistics.ts"]) {
      expect(strip(read(`packages/listing/src/common/${f}`))).not.toContain("MANUFACTURING_COUNTRY");
    }
  });

  it("🔴 CanonicalProduct 에 제조국 필드를 더하지 «않았다» — 근거 객체로 분리했다", () => {
    expect(strip(read("packages/shared/src/product-types.ts"))).not.toContain("manufacturingCountry");
  });

  it("원산지 폴백 사다리를 건드리지 않았다", () => {
    const src = strip(read("packages/listing/src/common/origin.ts"));
    expect(src).toContain('allowedSources: ["USER_CONFIRMED", "COMMON_PRODUCT", "SELLER_SETTINGS"],');
    expect(src).toContain("defaultAllowed: false,");
  });
});
