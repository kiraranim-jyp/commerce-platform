import { findCommonCarrier } from "@commerce/shared";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 공통 택배사 → 롯데ON 택배사 코드 — **이름이 정확히 같을 때만 잇는다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── 왜 이제 되는가 ────────────────────────────────────────────────────────
 * `COMMON_CARRIERS` 표에 롯데ON 열이 «없다». 그 이유가 표 안에 적혀 있다 —
 *
 *     「🔴 롯데ON 칸을 «지어내지 않는다». 89(DV_CO_CD) 실응답을 본 적이 없고,
 *       이름이 같다고 코드가 같다고 볼 근거가 없다.」
 *
 * 2026-09-28 에 그 실응답을 받았다(CEO 1회 확보) —
 *
 *     61건 · `cdNm` 이 사람이 읽는 택배사명 · 🔴 이름 중복 «0건»
 *     0001 롯데택배 · 0002 CJ대한통운 · 0004 우체국택배 · 0005 로젠택배 …
 *     공통 11종 중 «10종이 완전 일치»
 *
 * ── 🔴 그래도 표에 열을 «추가하지 않는다» ────────────────────────────────
 * 코드를 Common 에 박으면 그것이 곧 「Common 에 채널 코드를 넣는 일」이다.
 * 롯데ON 이 코드를 바꾸면 우리 표가 조용히 틀린 값을 들고 있게 된다.
 *
 * 그래서 «실시간 목록과 대조» 한다. 코드의 주인은 채널이다.
 *
 * ── 🔴 완전 일치만 ───────────────────────────────────────────────────────
 * 실응답이 그 이유를 보여준다 —
 *
 *     0001 롯데택배        vs  0055 롯데택배 해외특송
 *     0002 CJ대한통운      vs  0056 CJ대한통운 국제특송
 *
 * 부분 일치를 쓰면 국내 배송이 «국제특송» 으로 등록된다. 포함 검사·유사명·
 * 첫 후보 자동선택 전부 금지다(CPO 명시).
 *
 * 못 찾으면 코드를 «만들지 않는다». 「확인 필요」로 남긴다.
 */

export interface LotteOnCarrierOption {
  code: string;
  name: string | null;
}

export type LotteOnCarrierMatch =
  /** 이름이 정확히 같은 후보가 «하나» 다. 이때만 자동으로 잇는다. */
  | { status: "MATCHED"; code: string; name: string }
  /** 공통 설정에 택배사가 없다 — 이을 대상 자체가 없다. */
  | { status: "NO_COMMON_CARRIER" }
  /** 공통 택배사는 있는데 우리 표가 그것을 모른다(옛 값·오타 등). */
  | { status: "UNKNOWN_COMMON_CARRIER" }
  /** 롯데ON 목록에 정확히 같은 이름이 «없다». 🔴 비슷한 이름으로 잇지 않는다. */
  | { status: "NOT_FOUND"; commonName: string }
  /**
   * 정확히 같은 이름이 «둘 이상» 이다.
   *
   * 🔴 2026-09-28 실응답에서는 0건이었다. 그래도 방어한다 — 채널이 목록을
   * 늘리면서 같은 이름을 두 번 넣을 수 있고, 그때 «아무거나» 고르면 그것이
   * 곧 오등록이다. 셀러가 고르게 남긴다.
   */
  | { status: "AMBIGUOUS"; commonName: string; count: number };

/**
 * @param commonCarrier 공통 설정에 저장된 값 — 표의 `key` 또는 «옛» 쿠팡 코드.
 *                      (`findCommonCarrier` 가 둘 다 읽는다 — 마이그레이션 없이)
 * @param couriers      롯데ON 89(DV_CO_CD) 조회 결과. 🔴 저장된 표가 아니라
 *                      «지금 받은» 목록이어야 한다.
 */
export function resolveLotteOnCarrier(
  commonCarrier: string | null | undefined,
  couriers: readonly LotteOnCarrierOption[],
): LotteOnCarrierMatch {
  const raw = commonCarrier?.trim();
  if (!raw) return { status: "NO_COMMON_CARRIER" };

  const carrier = findCommonCarrier(raw);
  /* 🔴 모르는 값이면 이름을 «추정하지 않는다». 저장된 문자열을 그대로 롯데ON
     목록과 비교하면 우연히 맞을 수도 있지만 그것은 근거가 아니다. */
  if (!carrier) return { status: "UNKNOWN_COMMON_CARRIER" };

  const commonName = carrier.name.trim();
  /* 완전 일치. trim 만 한다 — 대소문자 변환·공백 제거·괄호 제거를 «하지 않는다».
     그런 정규화는 우리가 만드는 규칙이고, 「GS Postbox 택배(편의점택배)」처럼
     괄호가 붙은 공통 이름을 롯데ON 의 「GS Postbox 택배」에 억지로 붙이게 된다. */
  const matches = couriers.filter((option) => (option.name ?? "").trim() === commonName);

  if (matches.length === 1) {
    const only = matches[0];
    return { status: "MATCHED", code: only.code, name: (only.name ?? "").trim() };
  }
  if (matches.length > 1) return { status: "AMBIGUOUS", commonName, count: matches.length };
  return { status: "NOT_FOUND", commonName };
}

/**
 * 셀러에게 보여줄 한 줄. 🔴 코드는 «어디에도» 넣지 않는다(S-19 와 같은 규칙).
 */
export function describeLotteOnCarrierMatch(match: LotteOnCarrierMatch): string {
  switch (match.status) {
    case "MATCHED":
      return `${match.name} — 배송 프로필과 이름이 같아 자동으로 이었습니다`;
    case "NO_COMMON_CARRIER":
      return "배송 프로필에 기본 택배사가 없습니다 — 먼저 정해 주세요";
    case "UNKNOWN_COMMON_CARRIER":
      return "롯데ON 택배사 매핑 확인 필요 — 배송 프로필의 택배사를 알아보지 못했습니다";
    case "NOT_FOUND":
      return `롯데ON 택배사 매핑 확인 필요 — 롯데ON 목록에 「${match.commonName}」과 이름이 정확히 같은 택배사가 없습니다`;
    case "AMBIGUOUS":
      return `롯데ON 택배사 매핑 확인 필요 — 「${match.commonName}」과 이름이 같은 택배사가 ${match.count}개입니다`;
  }
}
