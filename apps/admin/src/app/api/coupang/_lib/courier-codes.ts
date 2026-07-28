/**
 * 쿠팡 Wing 택배사 코드 — 쿠팡은 이 목록을 조회하는 REST API를 제공하지 않고
 * 문서의 정적 참조표(Courier Code)로만 안내한다. 이번 세션에서 그 문서 페이지
 * 자체를 fetch로 확인하지 못했다(문서 사이트 봇 차단) — 아래는 Wing 연동에서
 * 흔히 쓰이는 값 기준의 참고 목록이다. 실제 계정에 등록된 택배사가 다르면
 * 설정 페이지에서 "직접 입력"으로 정확한 코드를 넣을 수 있게 해야 한다.
 */
export interface CourierOption {
  code: string;
  label: string;
}

export const COUPANG_COURIER_OPTIONS: CourierOption[] = [
  { code: "CJGLS", label: "CJ대한통운" },
  { code: "HANJIN", label: "한진택배" },
  { code: "LOTTE", label: "롯데택배" },
  { code: "KGB", label: "로젠택배" },
  { code: "EPOST", label: "우체국택배" },
  { code: "KDEXP", label: "경동택배" },
  { code: "CVSNET", label: "GS Postbox 택배(편의점택배)" },
  { code: "HDEXP", label: "합동택배" },
  { code: "ILYANG", label: "일양로지스" },
  { code: "CHUNIL", label: "천일택배" },
  { code: "DAESIN", label: "대신택배" },
];
