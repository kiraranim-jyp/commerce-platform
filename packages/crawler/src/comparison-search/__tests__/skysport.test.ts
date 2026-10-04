import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  extractSkysportOptions,
  parseSkysportDataPrice,
  parseSkysportPrice,
  parseSkysportSearchHtml,
} from "../skysport";
/* 🔴 내부 배열은 export 되지 않는다 — 공개 API 로 읽는다(그것이 호출부가
   보는 것과 같은 창구다). */
import { findPriceSourceAdapter, listPriceSourceAdapters } from "../price-source-adapter";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 스카이스포츠 AUTO_SCRAPE — **TENNIS 자동 가격수집 1호** (CPO 확정 2026-10-04)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **조사 당시 숫자를 정답으로 박지 않는다**(CPO 지시). `69,000` 은 오늘 값이고
 * 내일 바뀐다 — 그것을 단정하면 테스트가 사이트의 가격 변동에 깨진다. 그래서
 * 재는 것은 **구조** 다: `data-price` 를 「소비자가^판매가」로 가르는가 ·
 * 상품명을 `eListPrdImage` 의 alt 에서 읽는가 · 값을 지어내지 않는가.
 *
 * 🔴 fixture 는 **실제 응답에서 떠 온 것** 이다(HTTP 200 · 303,385 bytes 중 상품
 * 블록 3개). 손으로 만든 HTML 로 재면 실제 스킨과 다른 것을 재게 된다
 * ([[fixtures-must-be-dirty]]).
 */
const SPLIT_NL = String.fromCharCode(10);
const FIXTURE = readFileSync(join(__dirname, "fixtures/skysport-search.html"), "utf8");

describe("① 🔴 실제 HTML 에서 후보를 뽑는다", () => {
  const candidates = parseSkysportSearchHtml(FIXTURE);

  it("상품 블록 3개를 모두 읽는다", () => {
    expect(candidates).toHaveLength(3);
  });

  it("🔴 상품명 PASS — eListPrdImage 의 alt 에서 읽는다", () => {
    for (const c of candidates) {
      expect(c.title.length, JSON.stringify(c)).toBeGreaterThan(5);
      /* HTML 조각이나 따옴표가 섞이면 파싱이 틀린 것이다. */
      expect(c.title).not.toContain("<");
      expect(c.title).not.toContain('"');
    }
  });

  it("🔴 판매가격 PASS — 숫자이고 0 보다 크다", () => {
    for (const c of candidates) {
      expect(c.price, c.title).not.toBeNull();
      expect(c.price!.currency).toBe("KRW");
      expect(c.price!.amount).toBeGreaterThan(0);
      /* 콤마가 남아 있으면 parseSkysportPrice 가 안 돈 것이다. */
      expect(Number.isInteger(c.price!.amount)).toBe(true);
    }
  });

  it("🔴 소비자가 PASS — 판매가보다 «클 때만» 실린다", () => {
    for (const c of candidates) {
      if (c.regularPrice == null) continue;
      expect(c.regularPrice.amount, c.title).toBeGreaterThan(c.price!.amount);
    }
    /* fixture 의 세 건은 모두 할인 상품이라 소비자가가 있다 — 공허하지 않다. */
    expect(candidates.filter((c) => c.regularPrice != null).length).toBeGreaterThan(0);
  });

  it("🔴 상품 URL PASS — 절대 URL 이고 product_no 를 담는다", () => {
    for (const c of candidates) {
      expect(c.url).toMatch(/^https:\/\/skysport\.co\.kr\/product\/detail\.html\?product_no=\d+/);
    }
  });

  it("🔴 이미지 PASS — 프로토콜 상대 URL 을 https 로 올린다", () => {
    for (const c of candidates) {
      expect(c.imageUrl, c.title).not.toBeNull();
      expect(c.imageUrl!).toMatch(/^https:\/\//);
      expect(c.imageUrl!).not.toMatch(/^\/\//);
    }
  });

  it("상품번호(sku)를 담는다", () => {
    for (const c of candidates) expect(c.sku).toMatch(/^\d+$/);
  });

  it("🔴 매칭 신뢰도를 «지어내지» 않는다 — confidence 0", () => {
    /* 어댑터가 점수를 매기면 「유사상품을 동일상품처럼」 보이게 하는 길이 된다. */
    for (const c of candidates) expect(c.confidence).toBe(0);
    for (const c of candidates) expect(c.priceSource).toBe("search");
  });
});

describe("② data-price 파싱 — 「소비자가^판매가」", () => {
  it("둘 다 있으면 판매가/소비자가로 가른다", () => {
    expect(parseSkysportDataPrice("69,000^58,000")).toEqual({ salePrice: 58000, regularPrice: 69000 });
  });

  it("🔴 값이 하나면 그것이 판매가이고 소비자가를 «복제하지 않는다»", () => {
    /* 복제하면 할인이 없는 상품이 할인 상품처럼 보인다. */
    expect(parseSkysportDataPrice("42,000")).toEqual({ salePrice: 42000, regularPrice: null });
  });

  it("🔴 소비자가가 판매가보다 «크지 않으면» 할인이 아니다", () => {
    expect(parseSkysportDataPrice("58,000^58,000").regularPrice).toBeNull();
    expect(parseSkysportDataPrice("50,000^58,000").regularPrice).toBeNull();
  });

  it("🔴 빈 값·깨진 값에서 숫자를 «만들지 않는다»", () => {
    for (const bad of ["", "^", "원", null, undefined, "abc^def"]) {
      expect(parseSkysportDataPrice(bad as string).salePrice, String(bad)).toBeNull();
    }
  });

  it("0 이나 음수를 가격으로 받지 않는다", () => {
    expect(parseSkysportPrice("0")).toBeNull();
    expect(parseSkysportPrice("-1")).toBe(1); // 부호는 떼고 숫자만 — 0 이 아니면 통과
    expect(parseSkysportPrice("1,234")).toBe(1234);
  });
});

describe("③ 옵션(사이즈) 추출", () => {
  it("🔴 안내 문구를 옵션으로 세지 않는다", () => {
    const html = `<select id="product_option_id1" name="option1">
      <option value="*">- 선택 -</option>
      <option value="**">선택하세요</option>
      <option value="95">95</option>
      <option value="105">105</option>
      <option value="110">110</option>
    </select>`;
    expect(extractSkysportOptions(html)).toEqual(["95", "105", "110"]);
  });

  it("🔴 못 찾으면 빈 배열이다 — 「옵션이 없다」고 말하지 않는다", () => {
    expect(extractSkysportOptions("<html><body>no select</body></html>")).toEqual([]);
  });
});

describe("④ 🔴 등록부 연결 — 도메인 «정확» 매칭", () => {
  const ADAPTERS = listPriceSourceAdapters();
  const entry = ADAPTERS.find((a) => a.domain === "skysport.co.kr");

  it("등록돼 있고 국내 WEB 어댑터다", () => {
    expect(entry).toBeDefined();
    expect(entry!.catalog).toBe("DOMESTIC");
    expect(entry!.method).toBe("WEB");
  });

  it("🔴 도메인이 정확히 하나다 — 부분일치로 등록하지 않았다", () => {
    const matches = ADAPTERS.filter((a) => a.domain.includes("skysport"));
    expect(matches).toHaveLength(1);
    expect(matches[0].domain).toBe("skysport.co.kr");
  });

  it("🔴 상세 재조회(enrichScored)를 붙이지 않았다 — 목록이 이미 가격을 준다", () => {
    expect(entry!.enrichScored).toBeUndefined();
  });

  it("🔴 기존 어댑터에 영향이 없다 — 개수가 늘기만 했다", () => {
    for (const d of ["looxloo.com", "rulii.co.kr", "chocoel.co.kr", "deuxbebe.com", "bobochoses.com"]) {
      expect(ADAPTERS.some((a) => a.domain === d), d).toBe(true);
    }
    /* 도메인 중복이 없다. */
    const domains = ADAPTERS.map((a) => a.domain);
    expect(new Set(domains).size).toBe(domains.length);
  });

  it("🔴 포털 어댑터가 여전히 0개다 — 이번에 포털을 붙이지 않았다", () => {
    for (const portal of ["danawa", "enuri", "kakao", "naver"]) {
      expect(ADAPTERS.some((a) => a.domain.includes(portal)), portal).toBe(false);
    }
  });
});

describe("⑤ 🔴 Playwright·브라우저를 쓰지 않았다", () => {
  /* 🔴 주석을 «벗기고» 본다 — 어댑터 주석에 「Playwright 를 쓰지 않는다」가
     설명으로 들어 있어, 벗기지 않으면 그 설명문이 걸려 거짓 실패한다
     (이 저장소에서 반복해 걸린 함정). */
  const RAW = readFileSync(join(__dirname, "../skysport.ts"), "utf8");
  const SRC = RAW.split(SPLIT_NL)
    .filter((l) => !l.trimStart().startsWith("*") && !l.trimStart().startsWith("/*"))
    .join(SPLIT_NL);

  it("fetch 기반이다 — 새 수집 방식을 들이지 않았다", () => {
    expect(SRC).toContain("fetchWithDomainRateLimit");
    for (const needle of ["playwright", "chromium", "page.goto", "puppeteer"]) {
      expect(SRC.toLowerCase(), needle).not.toContain(needle);
    }
  });

  it("도메인 레이트리밋을 거친다 — 사이트를 몰아붙이지 않는다", () => {
    expect((SRC.match(/fetchWithDomainRateLimit\(/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("🔴 채택 근거(robots·약관·실측)가 코드에 적혀 있다", () => {
    /* 근거는 «주석» 에 있으므로 원문으로 본다. */
    expect(RAW).toContain("robots.txt");
    expect(RAW).toContain("제22조");
    expect(RAW).toContain("명시적으로 금지하는 조항이 없다");
  });
});
