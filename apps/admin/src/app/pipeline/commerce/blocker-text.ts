/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-133 — **보류/충돌 축의 «말»** (라벨 전용 · 판정 0)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **이 파일이 따로 생긴 이유는 가드다.** 라벨 표를 선별기
 *    (`mi-same-candidates.ts`)에 두면 그 파일에 `COLOR_VARIANT` 같은 **8축 이름이
 *    문자열로** 들어가고, 「선별기에 8축/threshold 어휘가 없다」는 계약
 *    (`wu-132 F-1`)이 **내 라벨 때문에 FAIL** 한다. 🔴 그때 고를 수 있는 길은 둘이고
 *    하나는 틀렸다:
 * ```
 * ❌ 가드를 느슨하게 한다 — 그러면 나중에 «진짜» 완화가 들어와도 안 잡힌다
 * ✅ 라벨을 라벨이 사는 곳으로 옮긴다 — 가드는 그대로 엄격하다
 * ```
 * 🟢 그리고 이것이 이 저장소의 기존 방식이다 — 등급의 말은 `match-display.ts` 가,
 *    축의 말은 이 파일이 소유한다(MATCHING-UNIFY-1 과 같은 원칙).
 *
 * 🔴 **판정하지 않는다.** 점수도 threshold 도 완화도 없다. `cross-seller.ts` 가 이미
 *    낸 토큰을 **사람이 읽는 말로 바꾸는 것** 이 전부다.
 */

/**
 * 🔴 운영 토큰 → 셀러의 말.
 *
 * 🔴 **축을 추가하거나 의미를 바꾸지 않는다** — 여기 없는 축은 아래
 *    `BLOCKER_OTHER_TEXT` 로 묶인다(영문 내부 토큰을 화면에 내보내지 않기 위해서다 ·
 *    WU-056 에서 `EXCLUDED` 가 그대로 출력된 그 사고의 재발 방지).
 */
const BLOCKER_TEXT: Record<string, string> = {
  BRAND_UNCONFIRMED: "브랜드 미확인",
  BRAND_MISMATCH: "브랜드 불일치",
  NO_TITLE_OVERLAP: "상품명 겹침 없음",
  MODEL_CODE: "품번 충돌",
  COLOR: "색상 충돌",
  CATEGORY: "상품군 충돌",
  AUDIENCE: "대상 연령 충돌",
  AUDIENCE_LINE: "대상 라인 차이",
  GARMENT_FORM: "옷 형태 차이",
  MATERIAL: "소재 차이",
  SIZE_SYSTEM: "사이즈 체계 차이",
  COLOR_VARIANT: "색상 옵션 차이",
};

/** 🔴 사전에 없는 토큰을 **영문 그대로 노출하지 않는다**. */
export const BLOCKER_OTHER_TEXT = "기타 사유";

export function blockerText(token: string): string {
  return BLOCKER_TEXT[token] ?? BLOCKER_OTHER_TEXT;
}

/** 🟢 계약이 「축을 임의로 늘리지 않았다」를 셀 수 있게 열어 둔다. */
export const KNOWN_BLOCKER_TOKENS = Object.keys(BLOCKER_TEXT);
