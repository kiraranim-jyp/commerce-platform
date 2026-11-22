/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 MI-IDENTITY-REVIEW-COMPLETION-02 — **상세설명 근거는 «지금» 불가능하다**
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **이 어댑터가 빈 배열을 돌려준다. 그 이유가 이 WU 의 중요한 발견이다.**
 *
 * 1차 구현은 상세설명 추출기 둘을 import 해 원상품의 브랜드·상품명 근거를 보여줬고
 * **로컬 build 는 exit 0** 이었다. 그런데 **Production 배포가 실패했다**:
 * ```
 * Module not found: @commerce/crawler/src/comparison-search/brand-description-evidence
 * Module not found: @commerce/crawler/src/comparison-search/product-name-description-evidence
 * ```
 * 🔴 원인 — **그 두 파일이 git 에 커밋되어 있지 않다**(`git ls-files` 전수 확인 ·
 *    작업트리에만 있는 untracked 파일이다). Vercel 은 저장소에서 빌드하므로 **없다**.
 *
 * 🔴🔴 **그래서 헌장 §5-D 의 「상세설명 증거 «추출» 은 구현돼 있다(302줄 · 310줄)」는
 *    «로컬 작업트리» 에서만 참이다.** 저장소 기준으로는 **존재하지 않는다.**
 *
 * 🔴 **CTO 는 그 파일을 커밋하지 않았다** — 사용자 작업물이고 CTO 작업물이 아니다
 *    (헌장 §4-D 「사용자 수정 파일을 덮어쓰거나 재작성하지 않는다」).
 *    🔵 커밋 여부는 **그 파일 소유자 / CPO 판단** 이다.
 *
 * 🟢 그래서 **화면의 다른 부분은 그대로** 두고 이 축만 비웠다 — 원상품 ↔ 후보 세 축
 *    비교 · 보류 사유 · 원문 통로는 **전부 작동한다**(소비처가 한 곳이라 가능했다).
 * 🟢 그 파일들이 커밋되면 **이 파일만** 되살리면 된다.
 *
 * 🔴 되살릴 때도 **표시 전용** 이어야 한다 — 「상세설명으로 운영 SAME 판정을 바꾼다」는
 *    CPO 가 **두 번** 거부했다.
 * ═══════════════════════════════════════════════════════════════════════════════
 */
import type { OriginIdentity } from "./mi-same-candidates";

/** 🟢 네 상태의 **사람 말**. 🔴 「확정」이라는 말을 쓰지 않는다 — 관찰 결론이다. */
export const DESCRIPTION_EVIDENCE_STATE_LABEL: Record<string, string> = {
  CORROBORATED: "두 출처가 같은 값을 말함",
  OBSERVED: "한 출처에서만 관찰됨",
  CONFLICT: "출처끼리 다른 값을 말함",
  UNKNOWN: "상세설명에서 찾지 못함",
};

export const DESCRIPTION_EVIDENCE_HEADING = "원상품 상세설명 근거";
/**
 * 🔴🔴 **이 한 줄이 이 영역의 안전장치다.** 없으면 다음 사람이 이 값을 판정 근거로
 *    읽는다 — 그것이 CPO 가 두 번 거부한 그 연결이다.
 * 🟢 추출기가 저장소에 돌아오면 **문장을 다시 쓰지 않아도** 된다(상수는 살아 있다).
 */
export const DESCRIPTION_EVIDENCE_SCOPE =
  "상세설명에서 읽은 관찰값입니다 — 동일상품 자동 판정에는 사용되지 않습니다.";

export interface OriginDescriptionEvidenceLine {
  axis: "BRAND" | "TITLE";
  /** 🟢 네 상태 중 하나. 🔴 코드 토큰을 화면에 노출하지 않는다(라벨로 바꿔 쓴다). */
  state: string;
  /** 🔴 `CORROBORATED` 가 아니면 `null` — 추출기 계약 그대로다(확정값이 아니다). */
  observed: string | null;
  /** 🟢 사람이 읽는 이유 문장 — 추출기가 낸 것을 **그대로** 옮긴다. */
  reasons: string[];
}

/**
 * 🔴 **지금은 항상 빈 배열이다** — 추출기가 저장소에 없다(위 머리말).
 * 🟢 화면은 빈 배열이면 **영역을 그리지 않는다** ⟹ 「찾아봤지만 근거가 없다」는
 *    거짓말을 하지 않는다. 없는 것은 **근거가 아니라 추출기** 다.
 * 🔴 여기서 추출기를 **새로 구현하지 않았다** — CPO 가 「기존 것을 재사용」하라고
 *    했고, 새로 쓰면 그것은 **두 번째 추출기** 가 된다(갈라지는 날이 온다).
 */
export function originDescriptionEvidence(
  _identity: OriginIdentity | null | undefined,
): OriginDescriptionEvidenceLine[] {
  return [];
}
