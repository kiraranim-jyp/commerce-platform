import { PRICE_SECTION_TITLE } from "./price-hierarchy";

/**
 * MATCHING-2.0-INTEGRATION-1(CEO 지시, 2026-09-13) — **이 MI가 어느 상품에 대한
 * 것인지 한눈에 보이게 한다.**
 *
 * ── 무엇이 문제였나 ──────────────────────────────────────────────────────
 * MI 화면 맨 위에는 판정과 숫자만 있고, 그 판정이 무슨 상품에 대한 것인지는
 * 어디에도 없었다. 셀러는 탭 두세 개를 오가며 상품을 보는데, 돌아왔을 때
 * "지금 보고 있는 이 ₩113,629가 아까 그 상품 값이 맞나"를 확인할 방법이 화면
 * 안에 없다. 게다가 이 화면은 **여러 판매처의 가격**을 나란히 보여주는 화면이라,
 * 기준이 되는 상품이 명시되지 않으면 목록의 어느 줄이 원본인지도 흐려진다.
 *
 * ── 절대 다른 판매처 URL로 바꾸지 않는다 ─────────────────────────────────
 * 여기 적히는 것은 **판매자가 등록한 그 URL 그대로**다. 매칭으로 찾아낸 동일상품
 * 후보가 아무리 확실해도(🟢) 그 후보의 URL이 이 자리에 오는 일은 없다 — 그
 * 순간 "원본"이라는 말이 "우리가 원본이라고 판단한 것"으로 바뀌고, 셀러는 자기가
 * 붙여넣은 주소와 화면의 주소가 다른 이유를 물을 수 없게 된다. 그래서 이 함수는
 * 후보 목록을 **입력으로도 받지 않는다**(global-market.ts가 국내 비교상품을
 * 받지 않는 것과 같은 장치다).
 *
 * ── 계산하지 않는다 ─────────────────────────────────────────────────────
 * 서버 응답의 product.title / product.sourceUrl을 그대로 옮기고, 화면에 적을
 * 짧은 모양만 만든다. 주소를 정규화하거나 로케일 프리픽스를 떼지 않는다 —
 * 클릭했을 때 열리는 곳과 눈에 보이는 곳이 같아야 한다.
 */

/** 화면 폭을 넘기지 않는 길이. 넘치는 부분은 가운데를 접는다 — 끝을 자르면
 * 상품 번호(…-430701)가 사라져서 어느 상품인지 알아보는 기능 자체가 없어진다. */
const MAX_DISPLAY_URL_LENGTH = 56;

export interface OriginProductLink {
  /** 카드 제목. ① 원본 상품과 같은 말을 쓴다 — 같은 사실에 이름이 둘이 되지 않게. */
  title: string;
  /** 상품명 그대로. 비어 있으면 null이고, 그때는 줄을 그리지 않는다. */
  productTitle: string | null;
  /** 실제로 여는 주소. 판매자가 등록한 값 그대로다. */
  url: string | null;
  /** 눈에 보이는 짧은 모양. 접힌 자리는 "…"로 표시한다. */
  displayUrl: string | null;
  /** 링크에 붙는 말. */
  linkLabel: string;
}

export const ORIGIN_PRODUCT_LINK_LABEL = "🔗 원본 상품 보기";

/** 가운데를 접는다. 앞은 어느 판매처인지(호스트), 뒤는 어느 상품인지(품번/슬러그)를
 * 말하므로 둘 다 남겨야 한 줄만 보고도 상품을 알아볼 수 있다. */
export function shortenUrlForDisplay(url: string, maxLength: number = MAX_DISPLAY_URL_LENGTH): string {
  const visible = url.replace(/^https?:\/\//, "");
  if (visible.length <= maxLength) return visible;
  // 앞뒤를 같은 비중으로 남긴다(가운데 "…" 한 글자를 빼고 반씩).
  const keep = Math.floor((maxLength - 1) / 2);
  return `${visible.slice(0, keep)}…${visible.slice(visible.length - keep)}`;
}

export function buildOriginProductLink(input: { title?: string | null; sourceUrl?: string | null }): OriginProductLink {
  const productTitle = input.title?.trim() || null;
  // http(s)가 아닌 값은 링크로 만들지 않는다 — 화면에서 열 수 없는 주소를
  // "원본 상품 보기"라고 부르면 그 말이 거짓이 된다.
  const raw = input.sourceUrl?.trim() || "";
  const url = /^https?:\/\//i.test(raw) ? raw : null;
  return {
    title: PRICE_SECTION_TITLE.ORIGINAL,
    productTitle,
    url,
    displayUrl: url ? shortenUrlForDisplay(url) : null,
    linkLabel: ORIGIN_PRODUCT_LINK_LABEL,
  };
}
