import { describe, expect, it } from "vitest";
import { interpretField, type ProvenanceField } from "@commerce/shared";
import { manufacturerInputFromProduct, resolveManufacturer } from "../common/manufacturer";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * PIVOT NEXT-04c — 「이 값이 어디서 왔는가」와 「어떻게 쓰는가」를 가른다
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── 실제로 일어난 일 ──────────────────────────────────────────────────────
 * 셀러가 제조사에 「상세페이지 참조」를 골랐다. 저장된 것은 이 한 줄이다.
 *
 *     { value: "", source: "DETAIL_PAGE_REFERENCE", confidence: 1 }
 *
 * 그런데 같은 화면의 두 자리가 서로 다른 말을 했다.
 *
 *     ① 기본 상품정보   「규하맘샵」                 ← resolveManufacturer (value 만 봄)
 *     고시정보          「전체 상품 상세페이지 참조」  ← resolveNoticeFieldValue (source 를 봄)
 *
 * 🔴 어느 쪽도 버그가 아니었다. 같은 필드의 «다른 면» 을 본 것이다. value 가
 * 비었다는 이유로 「아직 없다」로 읽고 브랜드·판매자 기본값까지 내려간 것이
 * 원인이고, 그 원인은 「참조」가 값의 «출처» 자리에 저장돼 있었기 때문이다.
 *
 * ── 이 파일이 지키는 것 ────────────────────────────────────────────────────
 * ① interpretField 가 legacy 를 실측대로 읽는다
 * ② 「참조」가 폴백을 «타지 않는다» — P0 의 해소 조건
 * ③ 🔴 판단할 수 없는 것을 판단하지 «않는다»
 */

const f = <T,>(over: Partial<ProvenanceField<T>> & { value: T }): ProvenanceField<T> => ({
  source: "ORIGINAL",
  confidence: 0,
  ...over,
});

describe("① interpretField — legacy 해석", () => {
  it("🔴 DETAIL_PAGE_REFERENCE → DETAIL_REFERENCE (스냅샷 627건 · 예외 0)", () => {
    expect(interpretField(f({ value: "", source: "DETAIL_PAGE_REFERENCE", confidence: 1 })).inputMode).toBe(
      "DETAIL_REFERENCE",
    );
  });

  it("🔴 REQUIRED → REQUIRES_INPUT (스냅샷 2,429건 · 예외 0)", () => {
    expect(interpretField(f({ value: "", source: "REQUIRED" })).inputMode).toBe("REQUIRES_INPUT");
  });

  it("값이 있으면 VALUE", () => {
    for (const source of ["ORIGINAL", "AI_GENERATED", "USER_EDITED", "DEFAULT"] as const) {
      expect(interpretField(f({ value: "Nike", source })).inputMode).toBe("VALUE");
    }
  });

  it("🔴 그 외 + 빈 값 → UNRESOLVED — «판단하지 않는다»", () => {
    /* 실측: 이 조합이 3,565개이고 그중 1,780개가 AI 생성 5필드의 초기화다.
       REQUIRES_INPUT 으로 올리면 상품마다 「확인 필요」가 5개씩 늘고,
       VALUE 로 내리면 「이 빈 값은 의도된 것」이라는 없던 주장이 된다. */
    expect(interpretField(f({ value: "", source: "ORIGINAL" })).inputMode).toBe("UNRESOLVED");
    expect(interpretField(f({ value: "", source: "DEFAULT" })).inputMode).toBe("UNRESOLVED");
    expect(interpretField(f({ value: [] as string[], source: "ORIGINAL" })).inputMode).toBe("UNRESOLVED");
  });

  it("🔴 숫자 0 은 «있는 값» 이다 — 빈 값이 아니다", () => {
    expect(interpretField(f({ value: 0, source: "ORIGINAL" })).inputMode).toBe("VALUE");
  });

  it("새 데이터가 이미 말했으면 legacy 규칙을 «거치지 않는다»", () => {
    // source 는 REQUIRED 인데 inputMode 가 명시돼 있으면 그쪽이 이긴다.
    expect(interpretField(f({ value: "", source: "REQUIRED", inputMode: "DETAIL_REFERENCE" })).inputMode).toBe(
      "DETAIL_REFERENCE",
    );
  });

  it("해석 결과에는 «항상» inputMode 가 있다 — undefined 가 밖으로 새지 않는다", () => {
    const r = interpretField(f({ value: "", source: "ORIGINAL" }));
    expect(r.inputMode).toBeDefined();
    expect(r.value).toBe("");
    expect(r.source).toBe("ORIGINAL"); // 출처는 «그대로» 보존된다
  });
});

describe("② 🔴 P0 — 「참조」가 폴백을 타지 않는다", () => {
  const REFERENCED = { value: "", source: "DETAIL_PAGE_REFERENCE" };

  it("🔴 판매자 기본값이 있어도 「규하맘샵」이 나오지 않는다", () => {
    /* 이것이 실측으로 확인된 그 증상이다. 전에는 여기서 SELLER_DEFAULT 가
       잡혀 ①기본정보가 「규하맘샵」을 말했다. */
    const r = resolveManufacturer({
      ...manufacturerInputFromProduct({ manufacturer: REFERENCED }),
      brandProfileManufacturer: "Bobo Choses S.L.",
      sellerProfileManufacturer: "규하맘샵",
    });
    expect(r.value).not.toBe("규하맘샵");
    expect(r.value).not.toBe("Bobo Choses S.L.");
    expect(r.source).toBe("DETAIL_REFERENCE");
  });

  it("🔴 resolved 는 true 다 — 「못 찾았다」가 아니라 「이미 채웠다」", () => {
    const r = resolveManufacturer(manufacturerInputFromProduct({ manufacturer: REFERENCED }));
    expect(r.resolved).toBe(true);
    // 값은 비어 있다 — 채널 어댑터가 «자기 문구» 로 렌더한다(쿠팡과 스마트스토어의
    // 문구가 이미 다르다). Canonical 이 문구를 정하지 않는다.
    expect(r.value).toBe("");
  });

  it("🔴 상품에 «실제 값» 이 있으면 그것이 참조보다 앞선다", () => {
    // 참조는 「값을 안 넣기로 한 선택」이라 값이 있으면 애초에 성립하지 않는다.
    const r = resolveManufacturer(
      manufacturerInputFromProduct({ manufacturer: { value: "Nike", source: "USER_EDITED" } }),
    );
    expect(r.source).toBe("MANUAL");
    expect(r.value).toBe("Nike");
  });

  it("참조가 «아니면» 폴백은 그대로 돈다 — 기존 동작 무회귀", () => {
    const r = resolveManufacturer({
      ...manufacturerInputFromProduct({ manufacturer: { value: "", source: "REQUIRED" } }),
      sellerProfileManufacturer: "규하맘샵",
    });
    expect(r.source).toBe("SELLER_DEFAULT");
    expect(r.value).toBe("규하맘샵");
  });

  it("브랜드 → 판매자 순서도 그대로", () => {
    const r = resolveManufacturer({
      brandProfileManufacturer: "Bobo Choses S.L.",
      sellerProfileManufacturer: "규하맘샵",
    });
    expect(r.source).toBe("BRAND_DEFAULT");
  });

  it("새 형식(inputMode 명시)도 같은 결과", () => {
    const r = resolveManufacturer({
      ...manufacturerInputFromProduct({
        manufacturer: { value: "", source: "USER_EDITED", inputMode: "DETAIL_REFERENCE" },
      }),
      sellerProfileManufacturer: "규하맘샵",
    });
    expect(r.source).toBe("DETAIL_REFERENCE");
  });
});

describe("③ 이번에 넘지 않은 선", () => {
  it("🔴 UNRESOLVED 는 폴백을 막지 «않는다» — 지금 동작 그대로", () => {
    /* legacy 3,565건이 여기 해당한다. 막으면 멀쩡한 상품이 제조사 없이
       등록되거나 화면이 갑자기 「확인 필요」로 뒤덮인다. */
    const r = resolveManufacturer({
      ...manufacturerInputFromProduct({ manufacturer: { value: "", source: "ORIGINAL" } }),
      sellerProfileManufacturer: "규하맘샵",
    });
    expect(r.source).toBe("SELLER_DEFAULT");
  });

  it("저장 형식은 그대로다 — inputMode 는 optional 이고 기존 필드가 살아 있다", () => {
    const legacy = f({ value: "", source: "DETAIL_PAGE_REFERENCE", confidence: 1 });
    expect(legacy.inputMode).toBeUndefined();
    expect(interpretField(legacy).source).toBe("DETAIL_PAGE_REFERENCE");
  });
});
