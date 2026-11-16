/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 **SPRINT 2 — 단계별 검색의 «실행 기록» 과 1차 식별 신호**(CPO 확정 2026-11-16)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CEO 전략(CLAUDE.md §5-D-2)의 완료 조건이 「구현했다」가 아니라
 * **「동일 후보를 확보한 시점에 나머지 작업이 «실제로» 멈췄다를 실행 기록으로 증명」**
 * 이다. 그 기록을 남기는 칸이 이 파일이다.
 *
 * ── 🔴 이 파일이 «하지 않는» 것 ──────────────────────────────────────────────
 * ```
 * ❌ 판정하지 않는다        SAME / SIMILAR / PRESUMED_SAME 을 만들지도 바꾸지도 않는다
 * ❌ 멈추지 않는다          사다리를 멈추는 조건은 `index.ts` 의 기존 한 줄
 *                          (`crossSellerVerdict === "SAME"` · 자기참조 제외)이고
 *                          이 파일은 그 사실을 **적을 뿐** 이다
 * ❌ 새 비교 규칙을 만들지 않는다  품번은 `compareModelCode` · 브랜드는 `brandsCompatible`
 *                          **운영이 쓰는 그 두 함수** 를 그대로 부른다(CPO ①「새 함수 금지」)
 * ❌ HTTP 를 쓰지 않는다    이미 받은 후보의 가벼운 필드만 읽는다(§5-D-2 「저비용 식별」)
 * ```
 *
 * ── 🔴🔴 `primaryIdentityHits` 를 «SAME 수» 로 읽지 않는다 (CPO 명시) ─────────
 * ```
 * CPO 결정 원문 — 「품번 exact + 브랜드 일치만으로 «SAME 후보» 라 부르거나
 *                  CEO 의 SAME 기반 조기 종료 조건을 «충족했다» 로 간주 금지」
 * ⟹ 이 숫자는 **검색 우선순위·후보 식별** 용 관측값이다.
 * ⟹ 실제 SAME 은 `judgeDomesticCandidate` 결과만 인정한다(CPO ③).
 * 🔴 그래서 이 파일은 **그 함수를 부르지도, import 하지도 않는다** — 계약으로 잠근다.
 * ```
 *
 * 🔴 왜 「브랜드 **그리고** 품번」인가 — §5-D 가 「100%」를 그렇게 정의한다:
 *    「브랜드 단독 일치나 **품번처럼 보이는 문자열 하나** 로 100% 동일상품 판정을
 *     하지 않는다」. 그래서 둘 중 하나만 맞으면 이 신호는 **서지 않는다**.
 */
import { brandsCompatible } from "./cross-seller";
import { compareModelCode } from "./model-code";
/** 🔴 링크 모양 판별 owner 는 **하나** 다 — 이 파일에서 규칙을 다시 쓰지 않는다. */
import { classifyUrlShape } from "./url-shape";
import type { ComparisonCandidate } from "./types";
import type { ProductFacts } from "@commerce/shared";

/**
 * 🔵 **1차 식별 신호** — 「브랜드 + 제조사 품번」이 **둘 다** 일치하는가.
 *
 * 🔴 한쪽 칸이 비면 `false` 다. 「없다」를 「일치한다」로도 「다르다」로도 읽지 않는다
 *    (`compareModelCode` 가 그 상태를 `unavailable` 로 돌려주고, 그것은 exact 가 아니다).
 * 🔴 판매처 자신의 재고번호(`sellerSku`)는 **보지 않는다** — `ProductFacts` 주석이
 *    「그 둘을 섞은 것이 『SKU 가 다르니 다른 상품』이라는 틀린 규칙의 출발점」이라고
 *    적어 뒀고, 실제로 SPRINT 1 라이브에서 looxloo 후보 5건의 품번이 전부
 *    `76A7D-xxx-xx`(판매처 자체 SKU)였다.
 */
export function hasPrimaryIdentitySignal(origin: ProductFacts | undefined, candidate: ProductFacts | undefined): boolean {
  if (!origin || !candidate) return false;
  if (!origin.brand || !candidate.brand) return false;
  if (!brandsCompatible(origin.brand, candidate.brand)) return false;
  return compareModelCode(origin.brandModelCode, candidate.brandModelCode) === "exact";
}

/** 🔴 `facts` 가 없는 후보는 세지 않는다(「0 건」이고 「측정 실패」가 아니다 — 그 경로는
 *  애초에 판정 근거를 들고 오지 않는다). */
export function countPrimaryIdentitySignals(
  origin: ProductFacts | undefined,
  candidates: readonly ComparisonCandidate[],
): number {
  let n = 0;
  for (const c of candidates) {
    if (hasPrimaryIdentitySignal(origin, c.facts)) n += 1;
  }
  return n;
}

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 **「검색 결과가 나왔다」 ≠ 「정상적인 상품 발견」**(CPO 지시 2026-11-16)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CPO 원문 — 「검색 후보 수와 **검증을 통과한 상품 수를 분리** 한다」 ·
 *            「계측 결과에 이미지·링크 **검증 불가 항목도 별도로** 남긴다」.
 *
 * 🔴🔴 **이 함수는 판정하지 않는다.** 세 축을 «세기만» 한다 —
 * ```
 * 링크   목록/검색/카테고리 페이지를 **상세페이지로 확인된 것처럼 기록하지 않는다**
 *        판별은 **기존 `classifyUrlShape`** 하나다(새 규칙 0)
 * 이미지 🔴 **「있다」만 센다 — 「일치한다」가 아니다.** 대표 이미지가 그 상품인지는
 *        사람이 보는 축이고(§5-D 보조 근거 · 표준 §2.2 가 SAME 정원에서 제외),
 *        CTO 가 그것을 판정하면 「이미지로 SAME 을 올렸다」가 된다
 * 가격   `VERIFIED_CURRENT` 만 센다(기존 가격 신뢰도 owner 그대로)
 * ```
 * 🔴 그리고 이 숫자들은 **SAME 판정의 근거가 아니다** — 이미지 오류·목록 링크는
 *    「노출 품질 실패」·「연결 품질 미달」이고 동일성 축이 아니다(CPO 표 그대로).
 */
export interface DomesticCandidateVerification {
  /** `classifyUrlShape === "PRODUCT_PAGE"` — **상세페이지로 보이는** 링크 수. */
  detailPage: number;
  /** 목록/검색/카테고리로 **판별된** 링크 수. 🔴 「상세 발견」으로 세지 않는다. */
  listingPage: number;
  /** 🔴 모양을 **판별하지 못한** 링크 수 — 「정상」도 「오류」도 아닌 **검증 불가** 다. */
  unknownShape: number;
  /** 🔴 대표 이미지가 **있다** 는 뜻뿐이다(일치 여부 아님). */
  withImage: number;
  /** 🔴 이미지가 없어 **이미지 검증 자체가 불가** 한 후보 수. */
  imageUnavailable: number;
  /** `priceStatus === "VERIFIED_CURRENT"` 인 후보 수. */
  priceConfirmed: number;
}

const EMPTY_VERIFICATION: DomesticCandidateVerification = {
  detailPage: 0,
  listingPage: 0,
  unknownShape: 0,
  withImage: 0,
  imageUnavailable: 0,
  priceConfirmed: 0,
};

export function verifyDomesticCandidates(
  candidates: readonly ComparisonCandidate[],
): DomesticCandidateVerification {
  const out = { ...EMPTY_VERIFICATION };
  for (const c of candidates) {
    const shape = classifyUrlShape(c.url);
    if (shape === "PRODUCT_PAGE") out.detailPage += 1;
    else if (shape === "LISTING_PAGE") out.listingPage += 1;
    else out.unknownShape += 1;
    if (c.imageUrl) out.withImage += 1;
    else out.imageUnavailable += 1;
    if (c.priceStatus === "VERIFIED_CURRENT") out.priceConfirmed += 1;
  }
  return out;
}

/**
 * 사다리 한 칸(또는 alias 폴백 한 번)의 실행 기록.
 *
 * 🔴 **칸마다 한 줄** 이다 — 합산한 값을 적지 않는다. 기존 비용 계측이 같은 규칙을
 *    쓴다(`run-domestic-price-check.ts` 「다섯 경로의 HTTP 를 합산하지 않는다 —
 *    비용 보고가 출처를 잃는다」). 합산은 읽는 쪽이 필요할 때 한다.
 */
export interface DomesticStageRecord {
  shopId: string;
  domain: string;
  /**
   * 사다리 칸 번호(0-based). 🔴 `null` 은 **alias 폴백** 이다 — 사다리 칸이 아니라
   * 「사다리를 다 쓰고도 0건일 때」 도는 별도 경로다(index.ts 의 기존 주석).
   */
  termIndex: number | null;
  term: string;
  /** 이 기록이 실제로 보낸 provider 검색 요청 수. */
  providerCalls: number;
  /** 이 칸이 **새로** 더한 후보 수(URL 중복 제거 «후»). */
  newCandidates: number;
  /** 🔴 관측 전용 — 위 `hasPrimaryIdentitySignal` 을 만족한 **새 후보** 수. */
  primaryIdentityHits: number;
  /**
   * 🔵 **검증 분리**(CPO 2026-11-16) — `newCandidates` 는 「검색 결과 수」이고
   *    이 칸은 「그중 무엇이 검증을 통과했는가」다. 🔴 **둘을 같은 수로 적지 않는다.**
   */
  verification: DomesticCandidateVerification;
  elapsedMs: number;
  /**
   * 이 칸 **뒤에 사다리가 멈췄는가.**
   *
   * 🔴 멈춤의 «이유» 를 이 파일이 정하지 않는다 — `index.ts` 의 기존 조건이 참이
   *    됐다는 사실만 적는다. 그래서 이 칸의 이름에 판정 어휘를 쓰지 않는다.
   */
  stoppedAfter: boolean;
}

/** 🔴 관측자는 **선택** 이다. 넘기지 않으면 한 줄도 돌지 않고 기존 동작과 완전히 같다. */
export type DomesticStageObserver = (record: DomesticStageRecord) => void;

export interface DomesticStageSummary {
  /** provider 검색 요청 **총합**(= CEO 완료 조건의 「검색 요청 수」). */
  providerCalls: number;
  /** 실제로 사용된 사다리 칸 수(샵별 칸을 모두 합친 수 — 샵 수가 아니다). */
  stagesUsed: number;
  /** 🔴 관측 전용 1차 식별 신호 합계. **SAME 수가 아니다.** */
  primaryIdentityHits: number;
  /** 사다리가 중간에 멈춘 샵 수(= 동일상품이 확정돼 뒤 칸을 **안 보낸** 샵). */
  shopsStoppedEarly: number;
  /** 검색에 쓴 벽시계 시간 합(샵이 병렬이라 **벽시계 총시간이 아니다**). */
  elapsedMsTotal: number;
  /**
   * 🔵 전체 후보 수. 🔴 아래 `verification` 과 **같은 수가 아니다** — 그것이 이 칸을
   *    따로 두는 이유다(「검색 결과가 나왔다」 ≠ 「정상적인 상품 발견」).
   */
  candidates: number;
  verification: DomesticCandidateVerification;
}

export interface DomesticStageCollector {
  observer: DomesticStageObserver;
  records: DomesticStageRecord[];
  summary(): DomesticStageSummary;
}

export function createDomesticStageCollector(): DomesticStageCollector {
  const records: DomesticStageRecord[] = [];
  return {
    observer: (record) => {
      records.push(record);
    },
    records,
    summary: () => ({
      providerCalls: records.reduce((n, r) => n + r.providerCalls, 0),
      stagesUsed: records.filter((r) => r.termIndex !== null).length,
      primaryIdentityHits: records.reduce((n, r) => n + r.primaryIdentityHits, 0),
      shopsStoppedEarly: new Set(records.filter((r) => r.stoppedAfter).map((r) => r.shopId)).size,
      elapsedMsTotal: records.reduce((n, r) => n + r.elapsedMs, 0),
      candidates: records.reduce((n, r) => n + r.newCandidates, 0),
      /** 🔴 칸을 **하나씩** 더한다 — 「통과 수」를 한 숫자로 뭉개면 어느 축이 실패했는지 사라진다. */
      verification: records.reduce<DomesticCandidateVerification>(
        (acc, r) => ({
          detailPage: acc.detailPage + r.verification.detailPage,
          listingPage: acc.listingPage + r.verification.listingPage,
          unknownShape: acc.unknownShape + r.verification.unknownShape,
          withImage: acc.withImage + r.verification.withImage,
          imageUnavailable: acc.imageUnavailable + r.verification.imageUnavailable,
          priceConfirmed: acc.priceConfirmed + r.verification.priceConfirmed,
        }),
        { ...EMPTY_VERIFICATION },
      ),
    }),
  };
}
