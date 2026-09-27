/**
 * ════════════════════════════════════════════════════════════════════════════
 * 장기 스프린트 S-16 — **택배사는 Common 하나다. 채널 코드는 Mapping 이다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── 왜 ────────────────────────────────────────────────────────────────────
 * 설정 화면에 택배사 칸이 «둘» 이었다.
 *
 *     택배사 (Coupang)     쿠팡 코드체계(CJGLS …)
 *     택배사 (SmartStore)  자유 문자열(예: CJ대한통운)
 *
 * 둘 다 같은 사실을 말한다 — 「이 판매자는 우체국택배로 보낸다」. 그런데 셀러가
 * 두 번 고른다. 🔴 Commerce 를 20~30개로 늘리는 것이 목표이므로 이 구조는
 * 그대로 두면 «택배사 30칸» 이 된다. 셀러 부담이 Commerce 수만큼 늘어난다.
 *
 * ── 그래서 ────────────────────────────────────────────────────────────────
 * 셀러는 «우체국택배» 하나를 고르고, 채널이 각자 자기 코드로 읽는다.
 *
 *     Common  EPOST(우체국택배)
 *        ├ 쿠팡        EPOST          ← 쿠팡 코드체계
 *        ├ 스마트스토어 우체국택배      ← 조회 API 가 없어 사람 이름이 그대로 간다
 *        └ 롯데ON      🔴 UNKNOWN     ← 89 목록에서 «셀러가 고른» 값만 쓴다
 *
 * 🔴 롯데ON 칸을 «지어내지 않는다». 89(DV_CO_CD) 실응답을 본 적이 없고, 이름이
 * 같다고 코드가 같다고 볼 근거가 없다. 그 값은 067 이 만든 자리에 «셀러가 고른
 * 것» 만 들어간다(S-8/9).
 *
 * 🔴 새 코드값을 만들지도 않았다. 아래 코드와 이름은 설정 화면이 이미 쓰던
 * 목록 그대로다 — 옮겨 담기만 했다.
 */

export interface CommonCarrier {
  /** Common 키. 쿠팡 코드와 «우연히» 같지만 의미는 다르다 — 이것은 우리 축이다. */
  key: string;
  /** 셀러가 보는 이름. 화면에는 이 값만 쓴다. */
  name: string;
  /** 쿠팡이 요구하는 코드. */
  coupang: string;
  /**
   * 스마트스토어가 받는 값. 🔴 네이버는 출고 택배사 «조회 API 가 없다»(확인됨)
   * — 그래서 사람이 읽는 이름이 그대로 간다. 코드가 아니다.
   */
  smartstore: string;
}

export const COMMON_CARRIERS: CommonCarrier[] = [
  { key: "CJGLS", name: "CJ대한통운", coupang: "CJGLS", smartstore: "CJ대한통운" },
  { key: "HANJIN", name: "한진택배", coupang: "HANJIN", smartstore: "한진택배" },
  { key: "LOTTE", name: "롯데택배", coupang: "LOTTE", smartstore: "롯데택배" },
  { key: "KGB", name: "로젠택배", coupang: "KGB", smartstore: "로젠택배" },
  { key: "EPOST", name: "우체국택배", coupang: "EPOST", smartstore: "우체국택배" },
  { key: "KDEXP", name: "경동택배", coupang: "KDEXP", smartstore: "경동택배" },
  { key: "CVSNET", name: "GS Postbox 택배(편의점택배)", coupang: "CVSNET", smartstore: "GS Postbox 택배" },
  { key: "HDEXP", name: "합동택배", coupang: "HDEXP", smartstore: "합동택배" },
  { key: "ILYANG", name: "일양로지스", coupang: "ILYANG", smartstore: "일양로지스" },
  { key: "CHUNIL", name: "천일택배", coupang: "CHUNIL", smartstore: "천일택배" },
  { key: "DAESIN", name: "대신택배", coupang: "DAESIN", smartstore: "대신택배" },
];

const BY_KEY = new Map(COMMON_CARRIERS.map((c) => [c.key, c]));
/** 기존에 저장된 쿠팡 코드로도 찾을 수 있게 한다 — 마이그레이션 없이 읽기 위해서다. */
const BY_COUPANG = new Map(COMMON_CARRIERS.map((c) => [c.coupang, c]));

export function findCommonCarrier(keyOrCoupangCode: string | null | undefined): CommonCarrier | null {
  const raw = keyOrCoupangCode?.trim();
  if (!raw) return null;
  return BY_KEY.get(raw) ?? BY_COUPANG.get(raw) ?? null;
}

/** 셀러 화면에 쓸 이름. 🔴 모르면 코드를 «보여주지 않는다»(S-19 와 같은 규칙). */
export function commonCarrierName(keyOrCoupangCode: string | null | undefined): string {
  const carrier = findCommonCarrier(keyOrCoupangCode);
  if (carrier) return carrier.name;
  return keyOrCoupangCode?.trim() ? "택배사 확인 필요" : "";
}
