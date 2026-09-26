import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { computeSellability } from "@commerce/pricing";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI-6 / P0-2(CPO 결정, 2026-09-26) — **같은 상품에 모순된 판단을 «주장» 하지 않는다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── 무엇이 문제였나 ───────────────────────────────────────────────────────
 * 두 화면이 같은 질문에 답하면서 «다른 가격» 을 근거로 썼고, 그 사실을 어느 쪽도
 * 말하지 않았다:
 *
 *   상품 상세   CASE(국내 «최저가» · 착지원가 + 예상수수료)로 최종 판정을 한 번 더 검사
 *   /today 목록  computeSellability(국내 «평균가» · 해외물류비·수수료 «미포함») 만 본다
 *
 * 평균가 ≥ 최저가 이므로 목록은 «항상 더 낙관적» 이다. 그래서 같은 상품이 목록에서
 * 🟢, 상세로 들어가면 🟡/🔴 가 될 수 있었고 무엇이 최종인지 알 방법이 없었다.
 * 게다가 목록 tooltip 은 평균가를 **「국내 판매가」** 라고 불렀다 — 평균가가 곧
 * 내가 팔 가격인 것처럼 읽힌다.
 *
 * ── 🔴 이 Sprint 가 «하지 않은» 것 ───────────────────────────────────────
 * 평균가를 최저가로 치환하지 않았다. CASE·Sellability 공식도, 문턱도, 레벨 경계도
 * 건드리지 않았다. 대시보드에 CASE 를 새로 계산해 넣지도 않았다(상품 30개마다 환율·
 * 원가를 돌리지 않기로 한 기존 비용 판단이 있다). 바꾼 것은 **무엇을 근거로 한
 * 판단인지 말하는 방식** 뿐이다.
 *
 * 🔴 그래서 이 파일은 두 가지를 «함께» 잠근다 — 문구가 정직해졌다는 것과,
 * 판정이 한 글자도 움직이지 않았다는 것. 뒤쪽이 없으면 다음 사람이 「문구를
 * 고치면서 기준도 슬쩍 옮긴」 변경을 구분할 수 없다.
 */

const TODAY = readFileSync(fileURLToPath(new URL("../page.tsx", import.meta.url)), "utf8").replace(
  /\r\n/g,
  "\n",
);

/** 블록 주석과 줄 주석을 걷어낸 소스 — 이 저장소의 주석은 「예전에는 이랬다」를 적는다. */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
}

const GREEN = computeSellability({ costPriceKrw: 100_000, domestic: { matched: true, averagePriceKrw: 200_000 } });
const RED_LOW = computeSellability({ costPriceKrw: 95_000, domestic: { matched: true, averagePriceKrw: 100_000 } });
const RED_NEG = computeSellability({ costPriceKrw: 300_000, domestic: { matched: true, averagePriceKrw: 200_000 } });
const YELLOW = computeSellability({ costPriceKrw: 100_000, domestic: { matched: false, averagePriceKrw: null } });
const UNKNOWN = computeSellability({ costPriceKrw: null, domestic: { matched: true, averagePriceKrw: 200_000 } });

describe("① 🔴 평균가를 「국내 판매가」라고 부르지 않는다", () => {
  it.each([
    ["GREEN", GREEN],
    ["RED(마진 부족)", RED_LOW],
    ["RED(원가 초과)", RED_NEG],
  ])("%s 문장이 «시장 평균가» 라고 말한다", (_label, result) => {
    expect(result.reason).toContain("시장 평균가");
    /* 🔴 「국내 판매가」는 CASE 가 최저가로 답하는 질문이다. 평균가에 그 이름을
       붙이면 셀러는 평균가를 실제 판매 가능 가격으로 읽는다. */
    expect(result.reason).not.toContain("국내 판매가");
  });

  it("🔴 마진이 «무엇을 빼지 않은» 값인지 말한다", () => {
    /* 상세 화면의 마진은 착지원가+수수료 기준이다. 같은 상품에서 두 숫자가
       다르게 보이는 이유를 문장이 말하지 않으면 그것이 모순으로 읽힌다. */
    for (const result of [GREEN, RED_LOW]) {
      expect(result.reason).toContain("해외물류비");
      expect(result.reason).toContain("수수료");
    }
  });

  it("🔴 「가격 경쟁력이 있습니다」로 단정하지 않는다", () => {
    /* 평균가 ≥ 최저가 이므로 이 판정은 항상 CASE 보다 낙관적이다. P-8 이 고친
       「헤드라인과 본문이 반대 뉘앙스」와 같은 종류의 단정을 되살리지 않는다. */
    expect(GREEN.reason).not.toContain("가격 경쟁력이 있습니다");
  });
});

describe("② 🔴 판정은 한 글자도 움직이지 않았다", () => {
  it("레벨 경계가 예전과 같다", () => {
    expect(GREEN.level).toBe("GREEN");
    expect(RED_LOW.level).toBe("RED");
    expect(RED_NEG.level).toBe("RED");
    expect(YELLOW.level).toBe("YELLOW");
    expect(UNKNOWN.level).toBe("UNKNOWN");
  });

  it("마진 계산식과 제목이 그대로다", () => {
    expect(GREEN.estimatedMarginPercent).toBe(50);
    expect(RED_LOW.estimatedMarginPercent).toBe(5);
    expect(RED_NEG.estimatedMarginPercent).toBe(-50);
    expect(GREEN.title).toBe("판매 추천");
    expect(RED_LOW.title).toBe("판매 비추천");
    expect(YELLOW.title).toBe("국내 동일상품 확인 필요");
    expect(UNKNOWN.title).toBe("원가 확인 필요");
  });

  it("🔴 10% 문턱이 그대로다 — 문구를 고치며 기준을 옮기지 않았다", () => {
    const at10 = computeSellability({ costPriceKrw: 90_000, domestic: { matched: true, averagePriceKrw: 100_000 } });
    const just_under = computeSellability({
      costPriceKrw: 90_100,
      domestic: { matched: true, averagePriceKrw: 100_000 },
    });
    expect(at10.level).toBe("GREEN");
    expect(just_under.level).toBe("RED");
  });

  it("값을 못 읽었을 때 «지어내지» 않는다", () => {
    expect(YELLOW.estimatedMarginPercent).toBeNull();
    expect(UNKNOWN.estimatedMarginPercent).toBeNull();
  });
});

describe("③ 🔴 /today 배지가 «근거» 를 밝힌다 (7-5)", () => {
  const body = code(TODAY);

  it("판매판단 배지 옆에 기준이 적혀 있다", () => {
    expect(body).toContain("판매판단");
    expect(body).toContain("시장 평균가 기준");
  });

  it("기준 표시가 판매판단 배지 «안» 에 있다 — 다른 배지에 붙지 않았다", () => {
    const iBadge = body.indexOf("판매판단");
    const iBasis = body.indexOf("시장 평균가 기준");
    expect(iBadge).toBeGreaterThan(-1);
    expect(iBasis).toBeGreaterThan(iBadge);
    /* 두 배지 사이 거리가 멀면 다른 블록에 붙은 것이다. 같은 span 안이면 가깝다. */
    expect(iBasis - iBadge).toBeLessThan(600);
  });

  it("🔴 원가를 모르는 상태(⚪)에는 기준을 붙이지 않는다 — 쓰지 않은 근거다", () => {
    /* UNKNOWN 은 평균가를 «쓰지 못한» 상태다. 그때 「시장 평균가 기준」이라고
       적으면 쓰지 않은 근거를 썼다고 말하는 것이 된다. */
    expect(body).toContain('sellability.level !== "UNKNOWN"');
  });

  it("🔴 대시보드는 여전히 CASE 를 계산하지 않는다 — 두 벌 판정을 만들지 않았다", () => {
    /* 목록에 CASE 를 새로 계산해 넣으면 같은 판정이 두 곳에서 각자 돌게 된다.
       이번 수정은 «말하는 방식» 만 고친 것이고, 그 사실을 여기서 고정한다. */
    const readiness = code(
      readFileSync(
        fileURLToPath(new URL("../../api/snapshots/_lib/compute-readiness.ts", import.meta.url)),
        "utf8",
      ),
    );
    expect(readiness).not.toContain("computePriceRecommendation");
    expect(readiness).not.toContain("deriveRepresentativeSellerVerdict");
  });
});
