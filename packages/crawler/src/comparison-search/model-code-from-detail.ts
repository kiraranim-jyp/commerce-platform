import type { ProductFacts } from "@commerce/shared";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 CORE-SAME-SPRINT-02 — **후보 상세설명에서 품번을 «보강» 한다**(CPO GO 2026-10-26)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **새 SAME 축이 아니다.** 기존 `MODEL_CODE` 축에 **증거를 공급** 하는 것뿐이다.
 *    threshold · `SAME_MIN_AXES` · `NO_TITLE_OVERLAP` · BRAND · COLOR · 8축 판정 구조 —
 *    **한 글자도 바꾸지 않는다.** 이 파일은 `ProductFacts` 한 칸을 **비어 있을 때만** 채운다.
 *
 * ── 🟢 왜 이것이 안전한 방향인가(실측) ──────────────────────────────────────
 * ```
 * GT 33쌍 반사실 — SAME 회수 **5/17 유지** · DIFFERENT 누출 **2 → 1** ·
 *                 기존 FP **2 → 1** · TN **8 → 9** · 안전조건 **6/6 PASS**
 * ⟹ 🟢 판정을 **느슨하게 한 것이 아니라** 더 좋은 증거를 넣어 **보호가 강해졌다**.
 * 실제 발화 3건(`core-sprint02-step456-matrix` 실측):
 *   C05  B226AC009 ↔ 원상품 B226AC009  exact    → SAME 유지     (human SAME)
 *   S1-6 B226AC141 ↔ 원상품 B226AC010  conflict → **FP → TN**   (human DIFFERENT)
 *   C50  B126AC151 ↔ 원상품 B226AC117  conflict → 차단 강화      (human DIFFERENT)
 * ```
 *
 * ── 🟢🟢 **SPRINT-03 에서 우회 구조가 «제거» 됐다**(CPO 정식화 2026-10-26) ──
 * ```
 * BEFORE  facts.**materialText** 를 raw text 로 읽었다 — 🔴 그 칸은 **소재 축의 입력** 이고
 *         설명문이 들어온 것은 `material = parse(…).length > 0 ? description : null`
 *         (`seller-facts.ts:200`)라는 **우연한 우회** 였다
 * AFTER   facts.**description** 만 읽는다 — `ProductFacts` 의 **정식 Evidence Layer 칸**
 * ⟹ 🔴 `description ?? materialText` 같은 **alias 폴백을 두지 않았다**(CPO §4 금지).
 *    그래서 「소재 조성이 파싱되지 않는 설명문」에서도 품번을 읽을 수 있게 됐고
 *    (BEFORE 는 그 경우 materialText 가 null 이라 **구조적으로 못 읽었다**),
 *    동시에 **소재 축의 의미에 손대지 않는다**(❌ comparator ❌ material 입력 변경).
 * 🔴 HTML 일반 경로는 `description` 을 **일부러 비운다** — 추정해서 채우지 않는다(계약 C).
 * ```
 *
 * 🔴 여전히 하지 않는 것 — ❌ 새 DESCRIPTION 축 ❌ threshold ❌ blocker/conflict 생성
 *    ❌ 「설명이 있다/유사하다 → SAME」 ❌ 원상품 설명 참조.
 */

/**
 * 🔴 **승인된 품번 패턴 하나뿐이다**(CPO §1-2). 느슨한 매칭을 추가하지 않는다.
 *
 * ❌ `226AC009`(접두 없음) ❌ `AC009` ❌ 숫자 일부 일치 ❌ fuzzy ❌ 로마자 추정
 * 🔴 전역 플래그가 있으므로 **매번 새로 만든다**(`lastIndex` 공유 사고 방지).
 */
export const DETAIL_MODEL_CODE_PATTERN = (): RegExp => /\bB\d{3}[A-Z]{2}\d{3}\b/gi;

/** 🔴 후보 상세 raw text 에서 **승인된 모양** 만, 중복 없이 뽑는다. */
export function extractDetailModelCodes(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return [...new Set((raw.match(DETAIL_MODEL_CODE_PATTERN()) ?? []).map((x) => x.toUpperCase()))];
}

/**
 * 후보 `brandModelCode` 를 **비어 있을 때만** 상세설명에서 보강한다.
 *
 * 🔴🔴 **Contract A — 기존 값을 덮지 않는다.** 설명에 다른 품번이 있어도 교체하지 않는다.
 *    ⟹ 기존 `compareModelCode` 충돌 보호(AC042↔AC043)가 **한 글자도 안 바뀐다**.
 * 🔴🔴 **Contract B — 후보측만 본다.** 이 함수는 `ProductFacts` **하나** 만 받는다 ⟹
 *    원상품을 볼 **방법이 구조적으로 없다**(「원상품 설명 → 후보 품번」이 불가능하다).
 * 🔴🔴 **Contract C — 둘 이상이면 고르지 않는다.** 지어내기 금지.
 * 🔴🔴 **Contract E — 충돌을 완화하지 않는다.** 복원값이 원상품과 다르면 기존
 *    `compareModelCode` 가 **conflict** 를 내고 그 보호가 그대로 작동한다(의도된 결과다).
 * 🔴🔴 **Contract G(SPRINT-03) — 읽는 칸은 `description` «하나» 다.**
 *    🔴 `materialText` 로 폴백하지 않는다 — 그러면 소재 축의 칸이 다시 **설명문 계약** 이
 *       되어 CPO §4 금지(「alias 처럼 계속 사용」)를 되돌린다.
 */
export function recoverModelCodeFromDetail(facts: ProductFacts): ProductFacts {
  /** Contract A — 값이 있으면 **그대로 돌려준다**(같은 객체 · 할당 0). */
  if (facts.brandModelCode) return facts;
  /** 🔴 Contract G — 정식 Evidence Layer 칸만 본다(소재 칸 폴백 **없음**). */
  const found = extractDetailModelCodes(facts.description);
  /** Contract C — 정확히 1개일 때만 보강한다. */
  if (found.length !== 1) return facts;
  return { ...facts, brandModelCode: found[0] };
}
