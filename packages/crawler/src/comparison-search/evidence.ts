/**
 * N-4.18-Q3 PART H-3-1(대표님 지시, 2026-08-27) — 동일상품 판별 엔진의 "증거" 데이터
 * 계약. 이 파일은 STEP H-2 실측 조사에서 확인된 필드만 담는다(추측 필드 없음):
 *
 *   modelCode  — FORETFORET 상세페이지 JSON-LD(schema.org/Product)의 `mpn` 실측 확인.
 *   options[]  — RULII/LOOXLOO/DEUXBEBE 3개 Cafe24 사이트 JSON-LD `offers[]` 배열
 *                (옵션 조합별 name/price/availability/itemCode) 실측 확인.
 *   aggregateAvailability — FORETFORET는 offers가 배열이 아니라 단일 객체라서
 *                옵션별 재고가 없다(실측 확인) — 상품 전체 재고만 여기 채운다.
 *   images[]   — 해외(Shopify product.images) 7장, 국내(JSON-LD image) 1장 실측 확인.
 *   description — 아직 어떤 파서도 안 읽는다(원문엔 있음, 실측: FORETFORET "소재"/
 *                "상세설명" 텍스트 존재만 확인) — 필드만 계약에 두고 항상 null.
 *
 * 이번 단계(H-3-1)는 "구조만" 만든다 — 실제로 이 필드를 채우는 추출 로직(H-3-2:
 * FORETFORET mpn 연결, H-3-3: Cafe24 offers[] 연결, H-3-4: dHash)은 아직 구현하지
 * 않는다. 기존 ComparisonCandidate/match.ts/각 사이트 파서는 이 파일 도입으로
 * 전혀 바뀌지 않는다 — 완전히 별도 네임스페이스다.
 */

/** N-4.18-Q3 PART H-3(대표님 지시) — MPN 등 모델번호가 "있으면 무조건 강한 점수"가
 * 아니라, 다른 증거(특히 브랜드)와 충돌하는지까지 함께 봐야 한다는 지시를 반영한
 * 상태값. exact=완전 일치, partial=부분 일치(예: 접두사만 같음, 아직 판정 규칙
 * 미정), unavailable=양쪽 다 modelCode가 없어서 비교 자체를 못 함, conflict=
 * 양쪽 다 있는데 다름. */
export type ModelEvidenceResult = "exact" | "partial" | "unavailable" | "conflict";

/** brand-alias.ts의 기존 alias 목록과 match.ts의 brandsMatch()를 그대로 재사용할
 * 예정(H-3-3 이후) — 새 브랜드 정규화 로직을 여기서 새로 만들지 않는다. */
export type BrandEvidenceResult = "exact" | "alias" | "compatible" | "conflict";

/** N-4.18-Q3 PART H-3(대표님 지시, 2026-08-27) — "재고 상태가 같은지"가 아니라
 * "상품 구성(옵션 이름/개수/사이즈 범위)이 같은지"를 우선 비교한다. 재고
 * (availability)는 ProductOption에 그대로 보존하되, 이 판정에는 강하게
 * 반영하지 않는다 — 같은 신발이어도 해외/국내 사이트마다 어느 사이즈가 먼저
 * 품절되는지는 서로 무관할 수 있기 때문(대표님 예시: EU24/25 재고가 사이트마다
 * 반대로 나올 수 있음). */
export type OptionEvidenceResult = "strong_overlap" | "partial_overlap" | "unavailable";

/** N-4.18-Q3 PART H-3(대표님 지시) — dHash 불일치는 "다른 상품"이 아니라 "이미지로는
 * 판단할 근거가 없다"는 뜻이다(판매처가 자체 촬영 사진을 쓸 수 있으므로). 그래서
 * "mismatch"라는 이름을 쓰지 않는다 — 이름 자체가 판정 방향을 오해하게 만들지
 * 않도록.
 *
 * N-4.18-Q3 PART H-3-4(대표님 지시, 2026-08-27) — possible_match를 3번째
 * 단계로 추가한다(대표님이 요청한 계약 모양). 다만 실측(image-evidence.ts
 * 참고: 동일상품 distance=86, 완전-다른상품 distance=107, 유사-다른상품
 * distance=119 — 3개 실제 상품 쌍을 실제로 다운로드해 측정)에서는 세 값이
 * 기존 임계값(<=10)을 전부 넘고 순서도 실제 동일성과 단조적으로 대응하지
 * 않았다 — "중간대"를 채울 신뢰할 수 있는 근거가 없다. 그래서 이 타입에는
 * 값을 만들어두되, 지금 시점의 classifyImageEvidence()는 possible_match를
 * 반환하지 않는다(실제 사례가 더 쌓이기 전까지 임계값을 지어내지 않는다 —
 * 이 프로젝트 전체의 "추측 금지" 원칙). unavailable은 별개 상태: "비교를
 * 시도조차 못함"(이미지가 한쪽 또는 양쪽에 아예 없음)을 뜻하고,
 * weak_or_no_evidence는 "비교는 했지만 강한 근거가 아님"을 뜻한다 — 둘을
 * 구분해야 나중에 "왜 이미지 증거가 없는지"를
 * 설명할 수 있다. */
export type ImageEvidenceResult = "strong_match" | "possible_match" | "weak_or_no_evidence" | "unavailable";

/** 옵션 조합 하나(예: RULII "24", LOOXLOO "BLACK-FREE", DEUXBEBE "22(140mm)").
 * name은 사이트 원문 표기를 그대로 둔다 — 색상/사이즈로 억지로 분리 파싱하지
 * 않는다(실측 확인: 사이트마다 조합 표기 방식이 서로 다름 — 억지로 통일하면
 * PART G-15에서 경계한 "사이트별 예외가 다시 생기는" 상황이 반복된다). */
export interface ProductOption {
  name: string;
  price: number | null;
  /** true=재고 있음, false=품절, null=이 옵션의 재고 상태를 확인할 방법이 없음
   * (추측 금지 — soldOut 필드와 동일한 3-상태 원칙, match.ts/types.ts 기존
   * ComparisonCandidate.soldOut과 의미를 통일한다). */
  availability: boolean | null;
  /** Cafe24 offers[].url의 item_code 쿼리 파라미터(실측 확인) — 있으면 보존. */
  itemCode?: string;
}

/** 상세페이지 1건에서 뽑아낸 증거 묶음. 검색 결과(ComparisonCandidate)와는
 * 별도 타입이다 — 검색은 후보 발굴, 이건 그중 상세 확인 대상으로 선정된
 * 후보(selectCandidatesForDetailConfirmation, 기존 MAX_DETAIL_CONFIRMATIONS_PER_SHOP
 * 상한 그대로 재사용 예정)에서만 만들어진다. */
export interface ProductIdentityEvidence {
  brand: string | null;
  title: string;
  /** JSON-LD mpn(제조사 품번) 또는 sku 필드에서 확인된 경우만 채운다(추측 금지).
   * FORETFORET에서 실측 확인(mpn="PP24KASHE1195NER"), 나머지 사이트는 아직
   * 미확인(H-3-2에서 사이트별로 실측하며 채워나간다). */
  modelCode: string | null;
  /** 실측 확인된 이미지 URL만 담는다. 해외/국내 양쪽 다 배열이다 — 첫 장만
   * 비교하지 않고 여러 장을 교차비교하기 위함(대표님 지시). */
  images: string[];
  /** 옵션별 정보가 있는 사이트(Cafe24 계열, offers[] 배열)만 채운다. 빈 배열은
   * "옵션이 실제로 하나뿐"과 "옵션 정보를 못 가져옴"을 구분하지 못하므로,
   * H-3-3 구현 시 반드시 구분되는 값을 쓸 것(예: 빈 배열 vs null) — 지금은
   * 계약 단계라 이 구분을 확정하지 않는다. */
  options: ProductOption[];
  /** 옵션별 재고가 없는 사이트(FORETFORET처럼 JSON-LD offers가 단일 객체인
   * 경우, 실측 확인)를 위한 상품 전체 재고. options가 채워진 사이트에서는
   * 굳이 다시 계산하지 않고 null로 둘 수 있다(중복 계산 금지). */
  aggregateAvailability: boolean | null;
  regularPrice: number | null;
  salePrice: number | null;
  /** 아직 어떤 파서도 이 필드를 채우지 않는다(H-2 조사 결과: 원문엔 있으나
   * 추출 로직 없음). 항상 null — 채우는 로직은 이번 계약 범위 밖. */
  description: string | null;
}

/** 후보 하나에 대한 증거별 독립 판정. 점수를 하나로 합산하지 않고 각 증거의
 * 판정을 그대로 보존한다(대표님 지시: "왜 91%인가"가 아니라 "무슨 증거 때문에
 * 동일상품으로 봤는가"를 알 수 있어야 함). text는 기존 scoreCandidateMatch의
 * confidence를 그대로 재사용한다 — 새 텍스트 유사도 계산을 만들지 않는다. */
export interface CandidateEvidenceResult {
  modelCode: ModelEvidenceResult;
  brand: BrandEvidenceResult;
  options: OptionEvidenceResult;
  image: ImageEvidenceResult;
  /** match.ts scoreCandidateMatch(query, candidate).confidence 그대로. */
  text: number;
}

/** 상세조회 결과(ProductIdentityEvidence)와 검색 결과(ComparisonCandidate)를
 * 묶는 연결 구조. ComparisonCandidate 타입 자체는 이번 단계에서 변경하지
 * 않는다(검색 결과와 상세 증거를 분리 보관 — 대표님 지시). evidence가 null인
 * 경우는 "상세 확인 대상이 아니었음(low/medium 이하로 선정 안 됨)" 또는
 * "상세 조회를 시도했으나 실패함" 둘 다를 포함한다 — 이 둘을 구분하려면
 * 별도 상태 필드가 필요하지만, 이번 계약 단계에서는 임의로 만들지 않는다
 * (H-3-2 구현 시 실제 필요성이 확인되면 그때 추가). */
export interface CandidateWithEvidence {
  candidateUrl: string;
  evidence: ProductIdentityEvidence | null;
}
