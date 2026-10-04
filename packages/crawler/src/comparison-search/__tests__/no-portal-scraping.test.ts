import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P1 조사 결론 — **가격비교 포털을 긁지 않는다** (실측 2026-10-04)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CEO 지시: 「테니스 시장조사에서 최소 1개 국내 소스를 실제 자동 가격수집
 * 가능하게 만들기. 다나와/카카오를 MANUAL 에서 «임의로» AUTO 로 바꾸지 말고
 * 실제 자동수집 가능한 방법을 조사한다.」
 *
 * 조사했고 결론은 **포털은 안 된다** 였다. robots.txt 는 둘 다 허용했지만
 * (다나와 7경로만 금지 · 에누리 `Allow: /` + `Crawl-delay: 1`) **약관이 막는다**:
 *
 *     다나와 제24조   복제·송신·출판·배포를 «영리목적» 으로 이용 금지
 *     에누리 제10조   "서비스를 이용자의 영리 목적으로 활용하는 행위" 금지
 *     에누리 제12조   복제·배포를 영리목적으로 이용 금지
 *
 * 따져는 영리 서비스이고 수집한 가격을 셀러의 판매 판단에 쓴다 — 정확히 그것이다.
 *
 * 🔴 이 테스트는 **그 결론이 조용히 뒤집히는 것을 막는다.** 누군가 다나와
 * 파서를 붙이면 깨진다. 약관이 바뀌거나 제휴가 생기면 그때 이 테스트를 «근거와
 * 함께» 고친다 — 코드만 고치고 지나갈 수 없게 한다.
 */
const HERE = __dirname;
const ADAPTER = readFileSync(join(HERE, "../price-source-adapter.ts"), "utf8");
const INDEX = readFileSync(join(HERE, "../index.ts"), "utf8");
const codeOnly = (src: string) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split(/\r?\n/)
    .map((l) => l.replace(/\/\/.*$/, ""))
    .join("\n");

/** 국내 가격비교 포털 — 「여러 판매처의 값을 모아 보여주는」 곳. */
const PORTAL_DOMAINS = ["danawa.com", "enuri.com", "shoppinghow.kakao.com", "shopping.naver.com"];

describe("① 🔴 포털 파서가 «하나도» 없다", () => {
  const CODE = codeOnly(ADAPTER) + "\n" + codeOnly(INDEX);

  it.each(PORTAL_DOMAINS)("%s 를 수집하는 코드가 없다", (domain) => {
    expect(CODE, domain).not.toContain(domain);
  });

  it.each(["danawa", "enuri", "kakao", "shoppinghow"])("%s 어댑터 import 가 없다", (name) => {
    expect(codeOnly(ADAPTER).toLowerCase(), name).not.toContain(`./${name}`);
  });

  it("🔴 등록된 어댑터는 전부 «판매처» 다 — 포털이 섞이지 않았다", () => {
    const imports = [...codeOnly(ADAPTER).matchAll(/from "\.\/([a-z0-9-]+)"/g)].map((m) => m[1]);
    expect(imports.length).toBeGreaterThan(5);
    for (const name of imports) {
      for (const portal of ["danawa", "enuri", "kakao", "naver"]) {
        expect(name, `${name} 가 포털이다`).not.toContain(portal);
      }
    }
  });
});

describe("② 🔴 판단 근거가 코드에 «적혀» 있다 — 다음 사람이 재조사하지 않게", () => {
  it("약관 조항 번호와 인용이 남아 있다", () => {
    expect(ADAPTER).toContain("제24조");
    expect(ADAPTER).toContain("제10조");
    expect(ADAPTER).toContain("영리목적");
  });

  it("출처 URL 이 남아 있다 — 다시 확인할 수 있게", () => {
    expect(ADAPTER).toContain("https://www.danawa.com/info/provision.html");
    expect(ADAPTER).toContain("https://www.enuri.com/etc/provision.jsp");
  });

  it("🔴 robots 는 «허용» 했다는 사실도 적혀 있다 — 둘을 섞지 않는다", () => {
    expect(ADAPTER).toContain("Crawl-delay: 1");
    expect(ADAPTER).toContain("기술적 접근");
  });

  it("실측 결과(가격이 보였다)가 적혀 있다 — 「접근 불가」로 오해하지 않게", () => {
    expect(ADAPTER).toContain("176,210");
  });

  it("🔴 다음 방향이 적혀 있다 — 포털이 아니라 판매처", () => {
    expect(ADAPTER).toContain("포털이 아니라");
    expect(ADAPTER).toContain("제휴를 신청하지 않는다");
  });
});

describe("③ 🔴 MANUAL 이 실제 수집에서 빠지는 구조는 그대로다", () => {
  it("AUTO 가 아니면 unsupported 로 건너뛴다", () => {
    expect(INDEX).toContain(
      'source.collectionStrategy !== "AUTO_API" && source.collectionStrategy !== "AUTO_SCRAPE"',
    );
  });

  it("🔴 그래서 다나와·카카오가 「조사 대상 2곳」에 세어져도 긁히지 않는다", () => {
    /* 숫자(목록에 있다)와 수집(실제로 읽는다)이 다른 축이라는 그 분리다. */
    expect(INDEX).toContain("collectionStrategy");
  });
});
