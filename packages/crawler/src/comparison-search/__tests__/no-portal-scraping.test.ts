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
 * 조사했고 결론은 **포털은 안 된다** 였다. 다만 «이유» 를 한 번 정정했다.
 *
 * robots.txt 는 둘 다 허용했고(다나와 7경로만 금지 · 에누리 `Allow: /` +
 * `Crawl-delay: 1`) 가격도 실제로 보였다. 처음에 「약관 제24조/제12조가 막는다」로
 * 적었는데 🔴 **그 일반화가 틀렸다** — 그 조항은 공정위 표준 전자상거래 약관
 * 문구이고 테니스스퀘어(제22조)·거의 모든 한국 쇼핑몰에 같이 있다. 그 기준이면
 * **기존 어댑터 여덟이 전부 STOP 대상** 이 된다(030 은 약관이 아니라 robots 로
 * looxloo 를 채택했다).
 *
 * 🔴 통일된 기준(CPO 확정 2026-10-04):
 *     STOP      자동수집/크롤링 금지 «명시» · 상업적 수집·복제 금지 «명시» ·
 *               제휴 없이 이용 제한 «명시» · robots 가 해당 경로 차단
 *     계속 검토  표준 전자상거래 약관 · 일반 저작권 귀속 조항 · robots 허용
 *     애매하면   보류(AUTO 로 만들지 않는다)
 *
 * 🔴 그러면 포털 제외의 근거는 **전략** 이다 — *「가격비교 포털 자동스크래핑은
 * 하지 않는다. 실제 판매처 자동조사를 확보한다」*(CPO). 포털은 「가격 집계」
 * 자체가 상품이고 판매처는 가격이 판매 조건이다. 에누리 제10조(*「서비스를
 * 이용자의 영리 목적으로 활용하는 행위」* 금지)는 표준 조항보다 넓어 독립적인
 * STOP 근거가 된다.
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

  it("🔴 «기준 통일» 이 적혀 있다 — 표준 약관만으로 STOP 하지 않는다", () => {
    expect(ADAPTER).toContain("표준 전자상거래 약관");
    expect(ADAPTER).toContain("그 일반화는");
    /* 기존 여덟과 같은 기준을 쓴다는 것, 그리고 030 의 실제 근거가 robots 였다는 것. */
    expect(ADAPTER).toContain("ClaudeBot도 명시적으로 허용");
    expect(ADAPTER).toContain("애매하면");
  });

  it("🔴 포털 제외의 근거가 «전략» 으로 적혀 있다 — 약관 단독이 아니다", () => {
    expect(ADAPTER).toContain("전략");
    expect(ADAPTER).toContain("실제 판매처 자동조사를");
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
