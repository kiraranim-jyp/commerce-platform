import { describe, expect, it } from "vitest";
import type { CanonicalProduct, FieldSource, ProvenanceField } from "@commerce/shared";
import {
  BULK_REFERENCE_EXCLUDED_FIELDS,
  BULK_REFERENCE_FIELDS,
  describeBulkReferencePlan,
  planProductBulkReference,
  type BulkReferenceField,
} from "../bulk-reference";
import {
  DETAIL_PAGE_REFERENCE_TEXT,
  NOTICE_KC_FIELDS_NEVER_REFERENCE_ELIGIBLE,
  NOTICE_REFERENCE_ELIGIBLE_FIELDS,
  resolveNoticeFieldValue,
} from "../reference-eligibility";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * PRODUCT-BULK-REFERENCE (CPO 확정, 2026-10-01)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 대표님 요구: *「상품마다 하나씩 체크하는 일을 없애자」*. 그래서 재는 것은
 * 「버튼이 동작하는가」가 아니라 **「누르면 안 되는 것을 누르지 않는가」** 다 —
 * 기존 값 보존 · KC 영구 제외 · manufacturer 제외 · 멱등.
 */
function field(value: string, source: FieldSource = "ORIGINAL"): ProvenanceField<string> {
  return { value, source, confidence: source === "ORIGINAL" ? 0.9 : 1 };
}

/** 8개 대상 필드만 가진 최소 상품. 전부 비어 있다. */
function emptyTarget(): Pick<CanonicalProduct, BulkReferenceField> {
  return {
    itemName: field(""),
    modelName: field(""),
    weight: field(""),
    material: field(""),
    color: field(""),
    careInstructions: field(""),
    recommendedAge: field(""),
    importer: field(""),
  } as unknown as Pick<CanonicalProduct, BulkReferenceField>;
}

describe("① 대상 목록 — 8개이고, 화이트리스트에서 «빼서» 만든다", () => {
  it("8개다", () => {
    expect(BULK_REFERENCE_FIELDS).toHaveLength(8);
  });

  it("🔴 manufacturer 가 «없다» — 전체 적용에서 제외", () => {
    expect(BULK_REFERENCE_FIELDS).not.toContain("manufacturer");
    expect(BULK_REFERENCE_EXCLUDED_FIELDS).toContain("manufacturer");
  });

  it("🔴 대상 + 제외 = 화이트리스트 — 목록이 두 벌로 갈리지 않는다", () => {
    const union = new Set<string>([...BULK_REFERENCE_FIELDS, ...BULK_REFERENCE_EXCLUDED_FIELDS]);
    expect([...union].sort()).toEqual([...NOTICE_REFERENCE_ELIGIBLE_FIELDS].sort());
  });

  it("🔴 KC 영구 제외 필드가 대상에 들어오지 않는다", () => {
    for (const kc of NOTICE_KC_FIELDS_NEVER_REFERENCE_ELIGIBLE) {
      expect(BULK_REFERENCE_FIELDS as readonly string[]).not.toContain(kc);
    }
  });

  it("🔴 카탈로그용 modelName 은 대상이 아니다 — CanonicalProduct 필드가 아니다", () => {
    /* naverShoppingSearchInfo.modelName 은 payload 전용 값이라 여기 들어올 수
       없다. 대상의 `modelName` 은 «고시» 모델명(product.modelName)이다. */
    expect(BULK_REFERENCE_FIELDS as readonly string[]).not.toContain("naverShoppingSearchInfo.modelName");
  });
});

describe("② 빈 칸만 적용하고 기존 값은 보존한다", () => {
  it("전부 비어 있으면 8개가 적용된다", () => {
    const plan = planProductBulkReference(emptyTarget());
    expect(plan.applied).toHaveLength(8);
    expect(plan.skipped).toHaveLength(0);
  });

  it("🔴 기존 값이 있으면 «건드리지 않는다»", () => {
    const product = { ...emptyTarget(), material: field("65% Cotton"), color: field("White") };
    const plan = planProductBulkReference(product);
    expect(plan.applied).toHaveLength(6);
    expect(plan.applied).not.toContain("material");
    expect(plan.applied).not.toContain("color");
    expect(plan.skipped.map((s) => s.field).sort()).toEqual(["color", "material"]);
    expect(plan.skipped.every((s) => s.reason === "HAS_VALUE")).toBe(true);
    /* patch 에 그 두 필드가 «없다» — 덮어쓸 기회 자체가 없다. */
    expect(plan.next).not.toHaveProperty("material");
    expect(plan.next).not.toHaveProperty("color");
  });

  it("공백만 있는 값은 «빈 것» 으로 본다", () => {
    const plan = planProductBulkReference({ ...emptyTarget(), weight: field("   ") });
    expect(plan.applied).toContain("weight");
  });

  it("사용자가 직접 입력한 값도 보존한다 — source 와 무관하게 값이 있으면 유지", () => {
    const plan = planProductBulkReference({ ...emptyTarget(), itemName: field("테니스 상의", "USER_EDITED") });
    expect(plan.applied).not.toContain("itemName");
  });
});

describe("③ 🔴 멱등 — 두 번 눌러도 결과가 바뀌지 않는다", () => {
  it("두 번째 호출의 applied 가 비고 ALREADY_REFERENCE 로 기록된다", () => {
    const first = planProductBulkReference(emptyTarget());
    const after = { ...emptyTarget(), ...first.next } as Pick<CanonicalProduct, BulkReferenceField>;
    const second = planProductBulkReference(after);
    expect(second.applied).toHaveLength(0);
    expect(second.skipped).toHaveLength(8);
    expect(second.skipped.every((s) => s.reason === "ALREADY_REFERENCE")).toBe(true);
    expect(second.next).toEqual({});
  });

  it("세 번 눌러도 같다", () => {
    let p = emptyTarget();
    for (let i = 0; i < 3; i += 1) {
      p = { ...p, ...planProductBulkReference(p).next } as Pick<CanonicalProduct, BulkReferenceField>;
    }
    for (const key of BULK_REFERENCE_FIELDS) {
      const f = p[key] as ProvenanceField<string>;
      expect(f.source).toBe("DETAIL_PAGE_REFERENCE");
      expect(f.value).toBe("");
    }
  });
});

describe("④ provenance — value 를 지어내지 않고 source 로 표시한다", () => {
  it("🔴 value 는 «빈 문자열» 이고 source 만 DETAIL_PAGE_REFERENCE 다", () => {
    const plan = planProductBulkReference(emptyTarget());
    for (const key of plan.applied) {
      const f = plan.next[key] as ProvenanceField<string>;
      expect(f.value, `${key} 에 문자열을 넣었다 — 사용자 입력과 구분되지 않는다`).toBe("");
      expect(f.source).toBe("DETAIL_PAGE_REFERENCE");
    }
  });

  it("그 조합이 실제 payload 에서 참조 문구가 된다 — resolveNoticeFieldValue 와 이어진다", () => {
    const plan = planProductBulkReference(emptyTarget());
    const material = plan.next.material as ProvenanceField<string>;
    expect(resolveNoticeFieldValue("material", material)).toBe(DETAIL_PAGE_REFERENCE_TEXT);
  });

  it("🔴 DETAIL_PAGE_REFERENCE_TEXT 를 직접 넣지 않았다", () => {
    const plan = planProductBulkReference(emptyTarget());
    expect(JSON.stringify(plan.next)).not.toContain(DETAIL_PAGE_REFERENCE_TEXT);
  });
});

describe("⑤ 🔴 manufacturer 가 brand/seller 폴백을 «우회하지 않는다»", () => {
  it("manufacturer 를 명시적으로 넘겨도 적용되지 않는다 — 이중 게이트", () => {
    const withMfr = { ...emptyTarget(), manufacturer: field("") } as unknown as Pick<
      CanonicalProduct,
      BulkReferenceField
    >;
    const plan = planProductBulkReference(withMfr, ["manufacturer" as BulkReferenceField]);
    expect(plan.applied).toHaveLength(0);
    expect(plan.next).toEqual({});
  });

  it("🔴 그래서 manufacturer 는 DETAIL_REFERENCE 가 되지 않고 폴백이 살아 있다", () => {
    /* resolveManufacturer 는 source 가 DETAIL_PAGE_REFERENCE 면 거기서 «멈춘다».
       전체 적용이 그것을 켜면 브랜드 관리·판매자 기본값의 더 정확한 값을 못 쓴다. */
    const plan = planProductBulkReference(emptyTarget());
    expect(JSON.stringify(plan.next)).not.toContain("manufacturer");
  });
});

describe("⑥ 화이트리스트 밖은 통과시키지 않는다", () => {
  it("🔴 certificationType 을 넘겨도 무시된다", () => {
    const plan = planProductBulkReference(emptyTarget(), ["certificationType" as never]);
    expect(plan.applied).toHaveLength(0);
    expect(plan.next).toEqual({});
  });

  it("아무 이름이나 넘겨도 무시된다", () => {
    const plan = planProductBulkReference(emptyTarget(), ["price" as never, "stockQuantity" as never]);
    expect(plan.applied).toHaveLength(0);
  });
});

describe("⑦ 화면 문구 — 센 것만 적는다", () => {
  it("전부 적용되면 개수만 적는다", () => {
    expect(describeBulkReferencePlan(planProductBulkReference(emptyTarget()))).toBe("8개 적용");
  });

  it("유지된 것이 있으면 그 수를 함께 적는다", () => {
    const plan = planProductBulkReference({ ...emptyTarget(), material: field("면 100%") });
    expect(describeBulkReferencePlan(plan)).toBe("7개 적용 · 1개는 입력값이 있어 유지");
  });

  it("두 번째 호출이면 적용할 것이 없다고 말한다", () => {
    const first = planProductBulkReference(emptyTarget());
    const second = planProductBulkReference({ ...emptyTarget(), ...first.next } as Pick<
      CanonicalProduct,
      BulkReferenceField
    >);
    expect(describeBulkReferencePlan(second)).toContain("이미");
  });
});

describe("⑧ 🔴 careInstructions 의 우선순위가 고정된다 (③과 충돌 금지)", () => {
  /* CPO 지시: 원본 세탁정보가 있으면 원본 → 없으면 「케어라벨 참조」(③에서 도입)
     → 사용자가 전체 적용하면 「상세페이지 참조」. 순서를 코드가 지키는지 잰다.
     🔴 여기서 재는 것은 ②의 책임 범위다 — 「값이 있으면 절대 건드리지 않는다」.
     그래야 ③이 기본값을 넣어도 전체 적용이 그것을 덮지 않는다. */
  it("원본 세탁정보가 있으면 전체 적용이 덮지 않는다", () => {
    const plan = planProductBulkReference({
      ...emptyTarget(),
      careInstructions: field("Machine wash at 30°C"),
    });
    expect(plan.applied).not.toContain("careInstructions");
    expect(plan.next).not.toHaveProperty("careInstructions");
  });

  it("🔴 ③이 넣을 기본값(어떤 문구든)도 «값» 이므로 덮지 않는다", () => {
    const plan = planProductBulkReference({
      ...emptyTarget(),
      careInstructions: field("케어라벨 참조", "DEFAULT"),
    });
    expect(plan.applied).not.toContain("careInstructions");
    expect(plan.skipped.find((s) => s.field === "careInstructions")?.reason).toBe("HAS_VALUE");
  });

  it("비어 있을 때만 참조가 들어간다", () => {
    const plan = planProductBulkReference({ ...emptyTarget(), careInstructions: field("") });
    expect(plan.applied).toContain("careInstructions");
  });
});
