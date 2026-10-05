import { describe, expect, it } from "vitest";
import type { CanonicalProduct } from "@commerce/shared";
import { recommendLotteOnStandardCategories } from "../lotteon-category";
import type { LotteOnStandardCategory } from "../lotteon-category";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P2-5b — 롯데ON 추천: conflict 제거 → 점수순 → 최대 5개 (CPO 확정, 2026-10-05)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 실측 오추천: Magro Long Sleeve 의 추천 1순위가 「가방/지갑 > 남성가방 53점」이고
 * 정답인 테니스/의류 계열이 그 아래였다.
 *
 * 🔴 원인은 둘이고 이번 커밋은 **두 번째** 를 닫는다:
 *   ① productType 이 null 이어서 유형 대조가 생략됐다       → P2-5a-1(c68ecf8, 배포됨)
 *   ② conflict 후보를 목록에서 «걸러내지 않았다»            → 이 커밋
 *      (5점으로 내려가기만 해서 목록에 그대로 남았다)
 *
 * 🔴 「5개로 줄이기」가 본질이 아니다. 순서가 본질이다 — 적합성 필터가 «먼저» 다.
 */
const f = <T,>(value: T) => ({ value, source: "ORIGINAL" as const, confidence: 1 });

/** 실측 상품(STMMLS). P2-5a-1 이 배포된 뒤 productType 은 「티셔츠」로 잡힌다. */
const magro = () =>
  ({
    title: f("Sergio Tacchini Men's Magro Long Sleeve"),
    description: f("This Sergio Tacchini Men's Magro Long Sleeve has sporty style for chilly court days."),
    brand: f("Sergio Tacchini"),
    recommendedAge: f(""),
    sourceUrl: "https://www.tennis-warehouse.com/Sergio_Tacchini_Mens_Magro_Long_Sleeve/descpageMASGT-STMMLS.html",
  }) as unknown as CanonicalProduct;

function leaf(id: string, name: string, parentName: string): LotteOnStandardCategory {
  return {
    id,
    name,
    parentId: `P-${parentName}`,
    depth: 3,
    leaf: true,
    usable: true,
    displayCategories: [],
    noticeItemCodes: [],
    taxTypeCode: null,
    ageLimitCode: null,
    safetyTypeCodes: [],
  };
}
const parent = (name: string): LotteOnStandardCategory => ({
  ...leaf(`P-${name}`, name, ""),
  parentId: null,
  depth: 2,
  leaf: false,
});

/** 🔴 타 상품군을 «앞» 에 둔다 — 필터가 빠지면 그것이 상위에 서도록 불리하게 배치한다
 *  (기존 골프 fixture 가 아동 자리를 앞에 둔 것과 같은 의도). */
const CATEGORIES: LotteOnStandardCategory[] = [
  parent("가방/지갑"),
  parent("신발"),
  parent("남성의류"),
  leaf("B1", "남성가방", "가방/지갑"),
  leaf("B2", "남성지갑", "가방/지갑"),
  leaf("S1", "남성신발", "신발"),
  leaf("T1", "남성 티셔츠", "남성의류"),
  leaf("T2", "남성 맨투맨", "남성의류"),
];

describe("① 🔴 명백한 타 상품군이 후보에서 «사라진다»", () => {
  const result = recommendLotteOnStandardCategories(magro(), CATEGORIES);
  const names = result.candidates.map((c) => c.category.name);

  it("남성가방 — 후보에 없다", () => {
    expect(names).not.toContain("남성가방");
  });

  it("남성지갑 — 후보에 없다", () => {
    expect(names).not.toContain("남성지갑");
  });

  it("남성신발 — 후보에 없다", () => {
    expect(names).not.toContain("남성신발");
  });

  it("🔴 적합한 후보는 «남는다» — 필터가 과하지 않다", () => {
    expect(names).toContain("남성 티셔츠");
  });

  it("🔴 목록에 conflict 가 한 건도 없다", () => {
    for (const c of result.candidates) {
      expect(c.conflict, `${c.path.join(" > ")}`).toBe(false);
    }
  });

  it("1순위가 의류다 — 트리에서 가방이 앞에 있어도", () => {
    expect(result.candidates[0]!.category.name).toBe("남성 티셔츠");
  });
});

describe("② 최대 5개 · 점수 내림차순", () => {
  /** 적합 후보를 6개 이상 만들어 제한이 실제로 걸리는지 본다. */
  const many: LotteOnStandardCategory[] = [
    parent("남성의류"),
    ...["남성 티셔츠", "남성 맨투맨", "남성 셔츠", "남성 니트", "남성 후드티", "남성 조거팬츠", "남성 반바지"].map(
      (n, i) => leaf(`M${i}`, n, "남성의류"),
    ),
  ];
  const result = recommendLotteOnStandardCategories(magro(), many);

  it("🔴 5개를 넘지 않는다", () => {
    expect(result.candidates.length).toBeLessThanOrEqual(5);
  });

  it("🔴 가드가 공허하지 않다 — 후보 원본이 5개보다 많았다", () => {
    expect(many.filter((c) => c.leaf).length).toBeGreaterThan(5);
  });

  it("점수가 내림차순이다", () => {
    const scores = result.candidates.map((c) => c.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });

  it("limit 를 명시하면 그 값을 따른다 — 기존 호출부 계약 유지", () => {
    expect(recommendLotteOnStandardCategories(magro(), many, { limit: 2 }).candidates).toHaveLength(2);
  });
});

describe("③ 🔴 추천 실패가 직접 선택을 막지 않는다 (기존 흐름 보존)", () => {
  it("적합 후보가 하나도 없으면 REJECT 다 — 셀러가 직접 고르는 경로로 간다", () => {
    /* 🔴 여기가 안전장치의 핵심이다. conflict 를 걸러내면 「전부 conflict」인
       경우 candidates 가 비고, decision 은 `!best → REJECT` 로 같은 결론을 낸다.
       옛 코드의 `best.conflict → REJECT` 와 결과가 보존된다. */
    const onlyConflicts: LotteOnStandardCategory[] = [
      parent("가방/지갑"),
      leaf("B1", "남성가방", "가방/지갑"),
      leaf("B2", "여성가방", "가방/지갑"),
    ];
    const result = recommendLotteOnStandardCategories(magro(), onlyConflicts);
    expect(result.candidates).toEqual([]);
    expect(result.decision).toBe("REJECT");
  });

  it("후보가 아예 없어도 REJECT 다 — 빈 목록에서 터지지 않는다", () => {
    const result = recommendLotteOnStandardCategories(magro(), []);
    expect(result.decision).toBe("REJECT");
    expect(result.candidates).toEqual([]);
  });

  it("🔴 scannedLeafCount 는 «필터 전» 숫자를 그대로 보고한다", () => {
    /* 셀러에게 「몇 개를 훑었는가」와 「몇 개를 보여주는가」는 다른 사실이다 —
       필터가 늘어났다고 훑은 수를 줄여 적으면 추천 실패의 원인을 못 읽는다. */
    const result = recommendLotteOnStandardCategories(magro(), CATEGORIES);
    expect(result.scannedLeafCount).toBe(CATEGORIES.filter((c) => c.leaf).length);
    expect(result.scannedLeafCount).toBeGreaterThan(result.candidates.length);
  });
});
