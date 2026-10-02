import type { CanonicalProduct, ProvenanceField } from "@commerce/shared";
import { isNoticeReferenceEligible, type NoticeReferenceEligibleField } from "./reference-eligibility";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * PRODUCT-BULK-REFERENCE (CPO 확정, 2026-10-01)
 * **「상세페이지 참조」를 한 번에 — 빈 칸에만.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 대표님 요구는 하나다: *「상품마다 필드를 하나씩 체크하는 일을 없애자」*.
 * 그래서 버튼 한 번에 «비어 있는» 허용 필드만 참조로 바꾼다.
 *
 * ── 🔴 롯데ON 과 «분리» 한다 ──────────────────────────────────────────────
 * 롯데ON 은 고시 값을 `articleValues`(항목코드 → 값) 라는 «채널 전용 맵» 에
 * 담는다. 네이버·쿠팡은 `CanonicalProduct` «공통 필드» 를 읽는다. 저장 위치가
 * 달라서 한 함수로 둘을 처리할 수 없다 — 억지로 합치면 어느 한쪽이 조용히
 * 안 먹는다. 그래서 이 파일은 공통 필드만 다루고, 롯데ON 의
 * `planLotteOnBulkReference` 는 **동작 변경 없이 그대로 둔다**.
 *
 * 🔴 네이버·쿠팡이 «함께» 해결되는 것은 부수효과가 아니라 구조다 — 둘이 같은
 * `CanonicalProduct` 필드를 읽기 때문이다. 상품정보 탭에서 한 번 누르면 된다.
 *
 * ── 🔴 `manufacturer` 를 대상에서 뺀다 ────────────────────────────────────
 * 참조를 넣으면 `resolveManufacturer` 의 5단 폴백이 «멈춘다»(DETAIL_REFERENCE
 * 분기). 브랜드 관리·판매자 기본값에 더 정확한 제조사가 있을 수 있는데 참조가
 * 그것을 덮는다. 그래서 전체 적용에서 제외하고 «개별 선택» 으로 남긴다.
 * (CPO 확정 — 이 제외가 사라지면 테스트가 실패한다.)
 *
 * ── 🔴 영구 제외 ──────────────────────────────────────────────────────────
 * `certificationType` · `childCertification` 은 애초에 화이트리스트에 없다
 * (NOTICE_KC_FIELDS_NEVER_REFERENCE_ELIGIBLE). 규제 값이라 참조로 대체할 수
 * 없다. `naverShoppingSearchInfo.modelName`(카탈로그용)도 참조 불가이고, 그것은
 * `CanonicalProduct` 필드가 아니라 payload 전용 값이라 여기 대상 자체가 아니다.
 */

/**
 * 전체 적용 대상 8개. **화이트리스트(9개)에서 `manufacturer` 를 뺀 것**이다 —
 * 목록을 손으로 또 적지 않고 «빼서» 만든다. 화이트리스트가 늘면 여기도 같이
 * 늘고, 그때 `manufacturer` 제외만 유지된다.
 */
export const BULK_REFERENCE_EXCLUDED_FIELDS = ["manufacturer"] as const;

export type BulkReferenceField = Exclude<
  NoticeReferenceEligibleField,
  (typeof BULK_REFERENCE_EXCLUDED_FIELDS)[number]
>;

export const BULK_REFERENCE_FIELDS: readonly BulkReferenceField[] = [
  "itemName",
  "modelName",
  "weight",
  "material",
  "color",
  "careInstructions",
  "recommendedAge",
  "importer",
] as const;

export interface BulkReferencePlan {
  /** 바뀐 필드만 담은 patch. 아무것도 안 바뀌면 빈 객체다. */
  next: Partial<Pick<CanonicalProduct, BulkReferenceField>>;
  /** 이번에 참조로 바꾼 필드. */
  applied: BulkReferenceField[];
  /** 건드리지 않은 필드와 그 이유. */
  skipped: { field: BulkReferenceField; reason: "HAS_VALUE" | "ALREADY_REFERENCE" }[];
}

/** 이 필드가 「비어 있다」고 볼 수 있는가. 공백만 있는 값도 빈 것으로 본다. */
function isEmpty(field: ProvenanceField<string> | undefined): boolean {
  return !field || field.value.trim() === "";
}

/**
 * 「상세페이지 참조 전체 적용」의 계획을 세운다. **이 함수는 상품을 바꾸지 않는다** —
 * patch 와 설명을 돌려주고, 적용은 호출부(React setState)가 한다.
 *
 * 🔴 **기존 값을 절대 덮지 않는다.** 값이 있으면 `HAS_VALUE` 로 건너뛴다.
 * 🔴 **멱등** — 이미 참조인 필드는 `ALREADY_REFERENCE` 로 건너뛰므로, 두 번
 *    눌러도 `applied` 가 비고 결과가 바뀌지 않는다.
 * 🔴 `value` 를 «지어내지 않는다». 빈 문자열을 유지하고 `source` 로만 표시한다 —
 *    `resolveNoticeFieldValue` 가 그 조합을 보고 참조 문구를 만든다. 여기서
 *    `DETAIL_PAGE_REFERENCE_TEXT` 를 직접 넣으면 「사용자가 그 문자열을 입력한
 *    것」과 구분되지 않는다.
 */
export function planProductBulkReference(
  product: Pick<CanonicalProduct, BulkReferenceField>,
  fields: readonly BulkReferenceField[] = BULK_REFERENCE_FIELDS,
): BulkReferencePlan {
  const next: Partial<Pick<CanonicalProduct, BulkReferenceField>> = {};
  const applied: BulkReferenceField[] = [];
  const skipped: BulkReferencePlan["skipped"] = [];

  for (const key of fields) {
    /* 🔴 이중 게이트 — 호출부가 목록을 잘못 넘겨도 화이트리스트가 막는다
       (롯데ON 의 isLotteOnSellerFillableArticle 와 같은 수법). */
    if (!isNoticeReferenceEligible(key)) continue;
    if ((BULK_REFERENCE_EXCLUDED_FIELDS as readonly string[]).includes(key)) continue;

    const field = product[key] as ProvenanceField<string> | undefined;
    if (!isEmpty(field)) {
      skipped.push({ field: key, reason: "HAS_VALUE" });
      continue;
    }
    if (field?.source === "DETAIL_PAGE_REFERENCE") {
      skipped.push({ field: key, reason: "ALREADY_REFERENCE" });
      continue;
    }
    next[key] = {
      value: "",
      source: "DETAIL_PAGE_REFERENCE",
      confidence: 1,
    } as ProvenanceField<string> as never;
    applied.push(key);
  }

  return { next, applied, skipped };
}

/**
 * 화면에 적을 한 줄. 🔴 숫자를 지어내지 않는다 — applied/skipped 를 센 것뿐이다.
 */
export function describeBulkReferencePlan(plan: BulkReferencePlan): string {
  if (plan.applied.length === 0) {
    return plan.skipped.length > 0 ? "모두 이미 값이 있거나 참조로 처리돼 있습니다." : "적용할 항목이 없습니다.";
  }
  const kept = plan.skipped.filter((s) => s.reason === "HAS_VALUE").length;
  const already = plan.skipped.filter((s) => s.reason === "ALREADY_REFERENCE").length;
  const tail = [kept > 0 ? `${kept}개는 입력값이 있어 유지` : "", already > 0 ? `${already}개는 이미 참조` : ""]
    .filter(Boolean)
    .join(" · ");
  return tail ? `${plan.applied.length}개 적용 · ${tail}` : `${plan.applied.length}개 적용`;
}
