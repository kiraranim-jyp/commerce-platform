/**
 * ════════════════════════════════════════════════════════════════════════════
 * 롯데ON 상품정보제공고시 — **품목별 항목 schema**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── 이 파일이 생긴 경위 ───────────────────────────────────────────────────
 * 우리는 「고시 항목코드(`pdArtlCd`)를 얻을 길이 없다」고 세 문서에 적었다.
 * 근거는 `89 PD_ARTL_CD → rowCount 0` 한 줄이었는데, 그 그룹 이름은 **우리가
 * 지어낸 것**이었다. API 88(공통코드 그룹조회) 전체 147개에도 그 그룹은 없다.
 *
 * 없는 게 맞았다 — 다만 이유가 달랐다. `pdArtlCd` 는 **공통코드가 아니다.**
 * API 87 문서가 두 필드를 다르게 적어 두었다:
 *
 *     pdItmsCd  「상품품목코드 [공통코드 : PD_ITMS_CD]」   ← 참조 있음
 *     pdArtlCd  「상품항목코드」                          ← 참조 «없음»
 *
 * 그리고 롯데ON 은 품목별 항목표를 **공식 문서로 게시**하고 있었다. API 87
 * 문서의 `pdItmsInfo` 설명란에 걸린 다운로드 링크다(§SOURCE). 그 표의 열이
 * 정확히 `품목코드 | 항목코드 | 항목명 | 작성 가이드라인 | 필수여부` 다.
 *
 * ── 🔴 왜 40품목 364행을 다 넣지 않는가 ───────────────────────────────────
 * 넣을 수 있지만 넣지 않는다. 지금 등록하려는 품목은 23 하나이고, **쓰지 않는
 * 표를 코드에 넣으면 그것이 검증되지 않은 채 굳는다.** 필요한 품목이 생기면
 * 그때 같은 출처에서 그 품목을 추가한다(`noticeSchemaFor` 가 모르면 null 을
 * 돌려주고, 호출부는 「모른다」로 처리한다 — 빈 배열로 «없다» 라고 말하지 않는다).
 *
 * ── 🔴 항목코드를 «전역 사전» 으로 다루지 않는 이유 ───────────────────────
 * 364행이 고유 항목코드 164개를 쓰고 40품목이 그것을 공유한다. 대체로 같은
 * 뜻이지만 **완전히 균일하지는 않다** — 실제로 갈리는 것들이 있다:
 *
 *     0490  「사용상 주의사항」    vs 「사용할 때의 주의사항」
 *     0620  「원료명 및 함량」      vs 「원재료명 및 함량」
 *     1210  「유효기간, 이용조건」  vs 「이용조건, 이용기간」
 *
 * 그래서 «품목 → 항목» 으로만 읽는다. 코드 하나로 이름을 역추적하지 않는다.
 */

/** 이 표가 어디서 왔는지를 코드가 «직접» 말한다 — 나중에 판본을 바꿀 때 근거가 된다. */
export const LOTTEON_NOTICE_SCHEMA_SOURCE = {
  /** API 87 「상품등록」 문서의 `pdItmsInfo` 설명란에 걸린 다운로드 링크. */
  linkText: "23년 1월 상품정보제공고시 개정반영",
  url: "https://s3.ap-northeast-2.amazonaws.com/doc-pub.lotteon.com/product/static/article/%ED%92%88%EB%AA%A9%ED%98%84%ED%96%89%ED%99%94_20221109_%EA%B3%B5%EC%9C%A0%EC%9A%A9.pdf",
  /** PDF 메타데이터의 생성 시각. 파일명은 `20221109` 다. */
  documentCreatedAt: "2022-11-16",
  /** 이 표가 반영한다고 밝힌 고시 개정의 시행일. */
  reflectsRevisionEffectiveFrom: "2023-01-01",
  /**
   * 🔴 확정되지 않은 것: 공정위 고시가 2023-01-01 이후 다시 개정됐는지는
   * 확인하지 못했다. 확인된 것은 **롯데ON 이 지금도 API 87 문서에서 이 파일을
   * 가리킨다**는 사실뿐이다. 「현행 법령」이 아니라 「롯데ON 이 현재 제시하는
   * 작성 기준」으로 다룬다.
   */
  currencyVerified: false,
} as const;

export interface LotteOnNoticeArticleSpec {
  /** payload 의 `pdArtlCd`. */
  code: string;
  /** 셀러에게 보여줄 이름. 표의 「항목명」 그대로다 — 우리가 짓지 않는다. */
  label: string;
  /** 표의 「필수여부」. 품목 23 은 13항목 전부 Y 다. */
  required: boolean;
  /** 표의 「작성 가이드라인」. 없으면 생략한다(빈 문자열을 만들지 않는다). */
  guideline?: string;
}

/**
 * 품목 23 「어린이제품」 — 13항목. 표의 순서 그대로다.
 *
 * 🔴 `0200`(KC 인증정보)의 가이드라인에 사업 조건에 관한 문장이 있다. 그대로
 * 옮겨 둔다 — 우리가 해석해서 줄이지 않는다. 공식 확인이 진행 중이다.
 */
const NOTICE_ITEM_23_CHILDREN: readonly LotteOnNoticeArticleSpec[] = [
  { code: "0210", label: "품명 및 모델명", required: true, guideline: "품명과 모델명 모두 입력해주세요." },
  {
    code: "0200",
    label: "KC 인증정보",
    required: true,
    guideline:
      "「어린이제품 안전 특별법」에 따른 안전인증ㆍ안전확인ㆍ공급자적합성확인대상어린이제품에 한해 기재해주세요. 어린이제품 및 방송통신기자재는 개정 전안법특례대상이 아니므로 구매대행/병행수입을 선택할 수 없습니다.",
  },
  { code: "0780", label: "크기, 중량", required: true, guideline: "섬유제품 등의 경우 치수 정보로 대체 가능해요." },
  { code: "0020", label: "색상", required: true },
  { code: "0410", label: "재질", required: true, guideline: "섬유의 경우 혼용률도 함께 기재해주세요." },
  { code: "0790", label: "사용연령 또는 권장사용연령", required: true },
  {
    code: "1830",
    label: "크기ㆍ체중의 한계",
    required: true,
    guideline: "착용 또는 탑승용 어린이제품과 같이 크기ㆍ체중에 제한이 있는 품목의 경우 반드시 기재해주세요.",
  },
  { code: "0220", label: "동일모델의 출시년월", required: true },
  { code: "0070", label: "제조자, 수입자", required: true },
  {
    code: "0060",
    label: "제조국",
    required: true,
    guideline: "원산지와 가공지가 다를 경우 각각 기재해주세요. 제조국은 법률상 중요정보이니 정확히 선택해주세요.",
  },
  { code: "0800", label: "취급방법 및 취급시 주의사항, 안전표시 (주의, 경고 등)", required: true },
  {
    code: "0080",
    label: "품질보증기준",
    required: true,
    guideline: "품질보증기준이 소비자분쟁해결기준보다 불리할 경우에는 불리하다는 사실과 품질보증기준을 함께 기재해주세요.",
  },
  { code: "0090", label: "A/S 책임자와 전화번호", required: true, guideline: "AS책임자(업체명)와 전화번호를 모두 입력해주세요." },
] as const;

/** 지금 표에 들여온 품목. 늘어나면 여기에 «출처를 확인한 뒤» 추가한다. */
const SCHEMAS: Record<string, readonly LotteOnNoticeArticleSpec[]> = {
  "23": NOTICE_ITEM_23_CHILDREN,
};

/**
 * 그 품목의 고시 항목들. **모르는 품목이면 `null`** 이다.
 *
 * 🔴 빈 배열을 돌려주지 않는다. 빈 배열은 「항목이 없다」는 뜻이 되고, 호출부가
 * 그것을 「채울 게 없으니 통과」로 읽으면 고시 없는 상품이 등록된다.
 * 「모른다」와 「없다」를 섞지 않는다 — 이 스프린트에서 그 혼동으로 한 번 틀렸다.
 */
export function noticeSchemaFor(pdItmsCd: string | null | undefined): readonly LotteOnNoticeArticleSpec[] | null {
  const code = (pdItmsCd ?? "").trim();
  if (!code) return null;
  return SCHEMAS[code] ?? null;
}

/** 우리가 표를 들여온 품목 목록(화면이 「이 품목은 아직 모른다」고 말할 때 쓴다). */
export function knownNoticeItemCodes(): string[] {
  return Object.keys(SCHEMAS);
}
