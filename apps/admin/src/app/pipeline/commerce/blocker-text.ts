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

/* ═══════════════════════════════════════════════════════════════════════════════
   🔵🔵🔵 MI-IDENTITY-REVIEW-COMPLETION-02 — **토큰 → 식별 축** 묶음
   ═══════════════════════════════════════════════════════════════════════════════

   🔴🔴 **왜 이 파일이냐** — 비교목록표가 축별 근거를 그리려면 「어느 토큰이 브랜드
      축인가」를 알아야 한다. 그 묶음을 **선별기(`mi-same-candidates`)에 두면**
      「선별기가 판정 어휘를 다룬다」는 기존 계약이 **내 코드 때문에 FAIL** 한다.
   🟢 그래서 **가드를 풀지 않고 코드를 옮겼다** — 이 파일이 이미 그 토큰 전부의
      소유자다(WU-133 이 `blocker-text.ts` 를 따로 만든 바로 그 이유다).

   🔴🔴 **이 함수가 생긴 직접 계기를 적는다** — 1차 구현이 `crossSellerBlockers` 를
      「문장」이라고 **가정** 해 화면에 그대로 뿌렸고, 실제로는 **내부 토큰**
      (`BRAND_UNCONFIRMED` · `MODEL_CODE`)이라 회귀가 FAIL 했다(`wu-146 7-c`
      「내부 토큰 노출」). 🟢 **그 가드가 맞았고 내 가정이 틀렸다.**

   🔴 **축을 늘리지 않는다** — 여기 없는 토큰은 축 칸에 **붙지 않는다**(사유 칠이 말한다).
   ═══════════════════════════════════════════════════════════════════════════════ */

export type BlockerIdentityAxis = "BRAND" | "MODEL_CODE" | "TITLE";

/**
 * 🔴 **식별 세 축에 직접 해당하는 토큰만** 담는다 — 소재·색상·상품군·대상은 식별
 *    조합(§5-D 의 「브랜드+품번 또는 상품명+품번」)이 아니라 **보조 근거** 다.
 */
const BLOCKER_IDENTITY_AXIS: Record<string, BlockerIdentityAxis> = {
  BRAND_UNCONFIRMED: "BRAND",
  BRAND_MISMATCH: "BRAND",
  MODEL_CODE: "MODEL_CODE",
  NO_TITLE_OVERLAP: "TITLE",
};

/**
 * 🟢 운영이 낸 토큰 배열에서 **그 축의 것만** 골라 **셀러의 말** 로 돌려준다.
 * 🔴 사전에 없는 토큰은 **버린다** — 「기타 사유」를 축 칸에 넣으면 「브랜드가 기타
 *    사유다」라는 말이 된다(그 역할은 사유 칠이 이미 한다).
 */
function identityAxisBlockerTexts(
  tokens: readonly string[] | null | undefined,
  axis: BlockerIdentityAxis,
): string[] {
  const out: string[] = [];
  for (const t of tokens ?? []) {
    if (BLOCKER_IDENTITY_AXIS[t] !== axis) continue;
    const s = blockerText(t);
    if (!out.includes(s)) out.push(s);
  }
  return out;
}

/**
 * 🟢 **후보 행에서 그 축의 「차이」를 셀러의 말로** 돌려준다.
 *
 * 🔴🔴 **칸을 읽는 자리가 왜 이 파일이냐** — 기존 계약 `wu-136 E-2` 가
 *    「결론 영역의 코드에 `crossSellerBlockers` 같은 **내부 칸 이름이 문자열로**
 *    없다」를 문다. 1차 구현이 `MarketPriceComparison` 안에서 그 칸을 직접 읽어
 *    **FAIL** 했다. 🟢 **가드를 풀지 않고 읽는 자리를 옮겼다** — 이 파일이 그
 *    토큰들의 소유자이므로 칸 이름도 여기 있는 것이 맞다(`derivedKrwOf` 가 같은
 *    이유로 영역 밖으로 나간 그 선례와 같은 모양이다).
 * 🔴 두 배열을 **같이** 본다 — 브랜드/제목은 `blockers`, 품번은 `conflicts` 에 온다.
 */
export function identityAxisDifferenceTexts(
  row: {
    crossSellerBlockers?: readonly string[] | null;
    crossSellerConflicts?: readonly string[] | null;
  },
  axis: BlockerIdentityAxis,
): string[] {
  const out = identityAxisBlockerTexts(row.crossSellerBlockers, axis);
  for (const s of identityAxisBlockerTexts(row.crossSellerConflicts, axis)) {
    if (!out.includes(s)) out.push(s);
  }
  return out;
}

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 EVIDENCE-SURFACE-01 — **근거 줄을 셋으로 «가른다»**(CPO 승인 2026-11-05)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **왜 필요했나** — 셀러 카드는 **차단 사유만** 보여주고(`blockerText`)
 *    **일치 근거는 `diagnostic` 구역에만** 있었다. 그래서 셀러가 「왜 다른 상품인가」는
 *    읽을 수 있는데 **「왜 같은 상품인가」는 읽을 수 없었다** ⟹ 소싱 판단의 절반이 없었다.
 *
 * 🟢🟢 **새 어휘를 만들지 않는다 — 운영이 쓴 말을 «고르기만» 한다.**
 *    운영 `cross-seller.ts` 는 이미 축 이름이 한국어인 줄을 쓴다(운영 DB 실측):
 * ```
 * 근거: 대상 KIDS · 근거: 상품군 TOP↔TOP · 근거: 색상 BLUE · 근거: 브랜드 품번 일치 ·
 * 근거: 소재 organic cotton:100 · 근거: 핏 loose fit ↔ relaxed fit(표현 차이 …)
 * 보류: 핵심 상품명에 겹치는 말이 없다 · 보류: 연령 라인 CHILD ↔ BABY ·
 * 보류: 옷의 형태 SWEATSHIRT ↔ TOP · 보류: 소재 … ↔ …
 * ```
 * 🔴 **접두어가 없는 줄은 «내부 진단» 이고 내보내지 않는다**(운영 DB 실측):
 * ```
 * ❌ 판정방법: CROSS_SELLER_AXES — …            (내부 경로 이름)
 * ❌ 판정근거: 입력 텍스트등급=low · 품번증거=unavailable … → TEXT_CONFIRMED(순위 3)
 * ❌ 모델명 유사도 0%                           🔴 WU-094 가 **자기모순** 을 실측한 줄이다
 *    (「유사도 0%」와 「URL slug 일치」가 같이 찍혔다 ⟹ 셀러 판단 근거로 쓸 수 없다)
 * ❌ 브랜드 일치 / 브랜드 불일치 / 카테고리 일치   🔴 **다른 생산자**(텍스트 점수기)의 거친
 *    요약이고 BRAND 축은 이미 blocker 로 나온다 ⟹ 같은 뜻을 두 말로 적지 않는다
 * ```
 * 🔴 **값은 운영이 관측한 그대로 둔다** — CPO 가 요구한 「원본 관측값」이 그것이다
 *    (`TOP↔TOP`·`organic cotton:100` 은 내부 코드가 아니라 **관측된 값** 이다).
 * 🔴 **판정하지 않는다** — 점수·threshold·완화 0. 이 파일은 여전히 라벨 전용이다.
 */
export const EVIDENCE_AGREE_PREFIX = "근거: ";
export const EVIDENCE_HOLD_PREFIX = "보류: ";
/** 🔴 「근거가 없다」를 빈 칸으로 두지 않는다 — 셀러가 「못 그렸다」와 구별해야 한다. */
export const EVIDENCE_NONE_TEXT = "확인된 근거 없음";

export interface SplitEvidence {
  /** 🟢 같다고 본 축. */
  agree: string[];
  /** 🔴 다르거나 확인되지 않아 **보류** 한 축. */
  hold: string[];
}

export function splitEvidenceReasons(
  reasons: readonly string[] | null | undefined,
): SplitEvidence {
  const agree: string[] = [];
  const hold: string[] = [];
  for (const raw of reasons ?? []) {
    if (typeof raw !== "string") continue;
    const line = raw.trim();
    if (line.startsWith(EVIDENCE_AGREE_PREFIX)) {
      agree.push(line.slice(EVIDENCE_AGREE_PREFIX.length).trim());
      continue;
    }
    if (line.startsWith(EVIDENCE_HOLD_PREFIX)) {
      hold.push(line.slice(EVIDENCE_HOLD_PREFIX.length).trim());
      continue;
    }
    /** 🔴 그 외는 **내부 진단** 이다 — 조용히 버리는 것이 아니라 «의도적으로» 제외한다. */
  }
  return { agree, hold };
}
