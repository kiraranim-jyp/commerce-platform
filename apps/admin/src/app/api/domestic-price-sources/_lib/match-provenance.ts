import { MATCH_TRUTH_RANK, type CrossSellerVerdict, type MatchTruth, type ModelEvidenceResult } from "@commerce/crawler";
import { HUMAN_CONFIRMATION_PREFIX, type DomesticProductLink } from "./domestic-product-link";

/**
 * MATCHING-FIX-01 Phase C/D(CEO 지시, 2026-09-16) — **매칭 «근거»를 저장하고,
 * `verified` 가 무슨 뜻인지 말하는 방식을 고친다.**
 *
 * ══ 판정을 한 건도 바꾸지 않는다 ══════════════════════════════════════════════
 * 이 파일에는 «판정»이 없다. deriveMatchTruth 가 이미 낸 truth 와, 그 판정에
 * 들어간 입력(modelCode 증거 · 교차판매처 판정 · 텍스트 등급)을 **받아서 적기만**
 * 한다. 어떤 함수도 truth 를 다시 계산하지 않고, 어떤 함수도 verified 를 바꾸지
 * 않는다. 값을 채우는 일과 판정하는 일을 같은 파일에 두지 않는 것이 이 저장소의
 * 기존 원칙(decision.ts / match-truth.ts 주석)이고 여기서도 그대로다.
 *
 * ══ 왜 새 컬럼을 만들지 않았나 ═══════════════════════════════════════════════
 * 이번 작업은 마이그레이션이 금지다. `match_method` · `match_reason` 을 담을
 * 컬럼이 따로 없으므로, 이미 있는 `match_reasons text[]` 안에 **접두사가 붙은
 * 한 줄**로 남긴다. 사람이 읽어도 뜻이 통하고, 기계가 다시 읽을 수도 있다
 * (readMatchProvenance). 컬럼을 늘리는 것은 판정 «정의» 단계에서 다룬다.
 *
 * ══ 🔴 «낡음»은 이 코드가 판단하지 않는다 ════════════════════════════════════
 * MATCHING-FIX-01-A(CEO 조건, 2026-09-16) — 되돌린 기록.
 *
 * 한때 이 파일에는 판정기 «버전 문자열»이 있었고, readMatchProvenance() 가 그
 * 값을 현재 버전과 비교해 `stale: true/false` 라는 **판단**을 내놓았다. 컬럼을
 * 만들지는 않았지만 사실상 판정 버전 필드였고, CEO 가 푸시 조건으로 명시한
 * "stale 표시는 updated_at 기반으로만" 을 글자로만 피한 것이었다.
 *
 * 두 방식은 «실제로 다른 답»을 낸다:
 *   updated_at   "마지막 판정이 09-10 이다" — 사실만 말한다. 거짓말을 할 수 없다.
 *   버전 문자열     "이 행은 낡았다" — 판단까지 한다. 판정 로직을 안 바꾼 배포에서
 *                버전만 올리면 멀쩡한 행이 낡은 것이 되고, 판정을 바꿨는데 버전을
 *                안 올리면 낡은 행이 멀쩡한 것이 된다 — 사람이 매번 기억해야 한다.
 *
 * 그래서 버전 문자열과 그 비교를 **둘 다 제거**했다. 근거 줄(텍스트등급 · 품번증거
 * · 교차판매처 · 결과)은 CEO 가 요구한 매칭 근거 자체이므로 그대로 남는다 —
 * 없앤 것은 «버전»과 «버전으로 내리던 판단»뿐이다. 마지막 판정 시각은 링크 행의
 * `updated_at` 이 이미 들고 있고, 화면은 그 날짜까지만 말한다. "낡았다"는 판단은
 * 지금 단계에서는 사람이 한다.
 *
 * 🔴 다음 사람에게: 여기에 판정 버전 문자열을 다시 넣지 마라. 넣는 순간 위의 두
 *    가지 거짓말이 같이 돌아온다.
 */

const EVIDENCE_PREFIX = "판정근거: ";
const METHOD_PREFIX = "판정방법: ";
/** 저장 계층이 «지우면 안 되는 줄»로 알아보는 그 접두사와 같은 값을 쓴다 —
 *  두 곳이 다른 문자열을 쓰면 승인 기록이 조용히 사라진다. */
const HUMAN_PREFIX = HUMAN_CONFIRMATION_PREFIX;

/**
 * 이 판정이 **무슨 근거로** 내려졌는가.
 *
 * 🔴 "어느 근거가 이겼는가"가 아니라 **"어떤 근거가 있었는가"**를 적는다. 앞의
 *    셋(품번 충돌/완전 일치/부분 일치)과 교차판매처 반증은 deriveMatchTruth 가
 *    다른 것을 보기 «전에» 끝내는 자리라 이름과 사실이 정확히 일치한다
 *    (match-truth.ts:67-80). 나머지 한 자리(modelCode 를 비교조차 못 한 경우)는
 *    교차판매처와 텍스트 중 높은 쪽이 이기는데, 그 둘 중 누가 이겼는지를 여기서
 *    다시 계산하면 판정 로직을 복제하는 셈이다 — 그래서 «둘 다 있었다»고만 적고,
 *    실제 입력값은 buildMatchProvenanceReasons 가 전부 그대로 남긴다.
 */
export type MatchMethod =
  | "CROSS_SELLER_CONFLICT"
  | "MODEL_CODE_CONFLICT"
  | "MODEL_CODE_EXACT"
  | "MODEL_CODE_PARTIAL"
  | "CROSS_SELLER_AXES"
  | "TEXT_ONLY";

const METHOD_LABEL: Record<MatchMethod, string> = {
  CROSS_SELLER_CONFLICT: "교차판매처 반증(대상·성별·상품군·색상·브랜드 중 하나가 어긋남)",
  MODEL_CODE_CONFLICT: "브랜드 품번 충돌",
  MODEL_CODE_EXACT: "브랜드 품번 완전 일치",
  MODEL_CODE_PARTIAL: "브랜드 품번 부분 일치",
  CROSS_SELLER_AXES: "품번을 비교할 수 없어 교차판매처 축과 텍스트 등급으로 판단",
  TEXT_ONLY: "품번도 교차판매처 판정도 없어 텍스트 등급만으로 판단",
};

export function matchMethodLabel(method: MatchMethod): string {
  return METHOD_LABEL[method];
}

/**
 * deriveMatchTruth 의 «먼저 끝나는 자리»를 그대로 따라 읽는다. 새 규칙이 아니다 —
 * 그 함수의 분기 순서(match-truth.ts:67-80)를 읽기 전용으로 되짚는 것뿐이고,
 * 되짚을 수 없는 마지막 한 자리는 위 MatchMethod 주석대로 «있었던 근거»로 적는다.
 */
export function resolveMatchMethod(input: {
  modelCode: ModelEvidenceResult;
  crossSeller?: CrossSellerVerdict;
}): MatchMethod {
  if (input.crossSeller === "CONFLICT") return "CROSS_SELLER_CONFLICT";
  if (input.modelCode === "conflict") return "MODEL_CODE_CONFLICT";
  if (input.modelCode === "exact") return "MODEL_CODE_EXACT";
  if (input.modelCode === "partial") return "MODEL_CODE_PARTIAL";
  return input.crossSeller ? "CROSS_SELLER_AXES" : "TEXT_ONLY";
}

export interface MatchProvenanceInput {
  /** deriveMatchTruth 가 이미 낸 값. 여기서 다시 계산하지 않는다. */
  truth: MatchTruth;
  modelCode: ModelEvidenceResult;
  crossSeller?: CrossSellerVerdict;
  matchLevel: "very_high" | "high" | "medium" | "low";
  /** 해외측/국내측이 실제로 들고 있던 브랜드 품번(있으면). 추측하지 않는다. */
  foreignModelCode?: string | null;
  domesticModelCode?: string | null;
}

/**
 * match_reasons 배열 뒤에 붙일 «근거» 줄들. 판정에는 한 글자도 쓰이지 않는다.
 *
 * 🔴 판정에 들어간 입력을 **전부** 적는다. 하나를 빼고 요약하면, 나중에 이 행을
 *    읽는 사람이 "왜 이 등급인가"를 다시 추측하게 된다 — 그 추측이 이 저장소가
 *    반복해서 고쳐 온 실패다(matchReasons 문자열을 파싱해 등급을 역추론하던 일).
 */
export function buildMatchProvenanceReasons(input: MatchProvenanceInput): string[] {
  const method = resolveMatchMethod(input);
  const codes =
    input.foreignModelCode || input.domesticModelCode
      ? ` (해외 ${input.foreignModelCode ?? "없음"} ↔ 국내 ${input.domesticModelCode ?? "없음"})`
      : "";
  return [
    `${METHOD_PREFIX}${method} — ${METHOD_LABEL[method]}`,
    `${EVIDENCE_PREFIX}입력 텍스트등급=${input.matchLevel} · 품번증거=${input.modelCode}${codes} · 교차판매처=${input.crossSeller ?? "판정없음"} → ${input.truth}(순위 ${MATCH_TRUTH_RANK[input.truth]})`,
  ];
}

export interface MatchProvenance {
  method: MatchMethod | null;
  /**
   * 이 행에 근거 줄이 «적혀 있는가». 🔴 판단이 아니라 사실이다 — 행의 내용만
   * 보고 답하고, 코드 버전과는 비교하지 않는다. false 면 근거를 남기기 전의
   * 저장 경로가 만든 행이라 근거를 읽을 수 없다는 뜻이고, 그 이상(낡았다·
   * 틀렸다)은 말하지 않는다. 마지막 판정 시각은 행의 `updated_at` 이 말한다.
   */
  evidenceRecorded: boolean;
}

function findPrefixed(reasons: readonly string[], prefix: string): string | null {
  for (let i = reasons.length - 1; i >= 0; i -= 1) {
    const r = reasons[i];
    if (typeof r === "string" && r.startsWith(prefix)) return r.slice(prefix.length);
  }
  return null;
}

export function readMatchProvenance(link: Pick<DomesticProductLink, "matchReasons">): MatchProvenance {
  const reasons = link.matchReasons ?? [];
  const methodRaw = findPrefixed(reasons, METHOD_PREFIX);
  const method = methodRaw ? ((methodRaw.split(" — ")[0] ?? null) as MatchMethod | null) : null;
  return { method, evidenceRecorded: findPrefixed(reasons, EVIDENCE_PREFIX) !== null };
}

/* ═══════════════════ Phase D — `verified` 의 뜻을 셋으로 가른다 ═══════════════════ */

/**
 * 🔴 CEO 지시: "verified=true 는 «사람의 확인이 아니다». 사람이 확인한 것처럼
 *    보이면 안 된다."
 *
 * DB 의 `verified` 값은 **한 글자도 바꾸지 않는다**. 이 함수는 그 하나의 불리언이
 * 실제로는 세 가지 서로 다른 사실을 뭉쳐 놓은 것이라는 점을 드러낼 뿐이다:
 *
 *   autoDecided       엔진이 자동으로 «가격에 쓴다»고 결정했다 (= verified 그 값)
 *   identifierBacked  그 결정의 근거가 브랜드 품번이었다
 *   humanConfirmed    사람이 실제로 눈으로 보고 승인했다
 *
 * ── 세 번째를 «모른다»고 말하는 이유 ────────────────────────────────────────
 * 오늘의 스키마에는 사람의 승인과 엔진의 자동확정이 **같은 칸**(verified)에
 * 들어간다. 그래서 과거 행에 대해서는 사람이 눌렀는지 알 방법이 없다. 알 수
 * 없는 것을 false 라고 단정하지도, true 라고 꾸미지도 않는다 —
 * `humanConfirmedKnown: false` 가 그 «모른다»다. 앞으로 사람이 누르는 승인은
 * PATCH 경로가 HUMAN_PREFIX 줄을 남기므로 그때부터는 알 수 있다.
 */
export interface VerificationStanding {
  autoDecided: boolean;
  identifierBacked: boolean;
  humanConfirmed: boolean;
  humanConfirmedKnown: boolean;
}

const IDENTIFIER_METHODS: ReadonlySet<MatchMethod> = new Set(["MODEL_CODE_EXACT", "MODEL_CODE_PARTIAL"]);

export function describeVerification(
  link: Pick<DomesticProductLink, "matchReasons" | "verified" | "matchTruth">,
): VerificationStanding {
  const reasons = link.matchReasons ?? [];
  const provenance = readMatchProvenance(link);
  const humanLine = findPrefixed(reasons, HUMAN_PREFIX);
  return {
    autoDecided: link.verified,
    identifierBacked: provenance.method
      ? IDENTIFIER_METHODS.has(provenance.method)
      : // 판정방법 줄이 없는(낡은) 행은 예전 화면이 쓰던 근거 문구로만 알 수 있다.
        reasons.some((r) => typeof r === "string" && r.includes("식별자 근거")),
    humanConfirmed: humanLine !== null,
    // 사람 확인 기록이 있거나, 근거 줄을 남기는 저장 경로가 만든 행이면 «없다»도
    // 사실이다(그 경로부터 사람 승인은 HUMAN_PREFIX 줄로 따로 남는다). 🔴 행에
    // 무엇이 적혀 있는지만 보고 답한다 — 코드 버전과 비교하지 않는다.
    humanConfirmedKnown: humanLine !== null || provenance.evidenceRecorded,
  };
}

/**
 * 화면이 쓰는 한 줄. 🔴 세 경우 전부에서 «사람이 확인했다»고 읽히지 않아야 한다.
 * 확인한 적이 없으면 확인하지 않았다고 말하고, 알 수 없으면 알 수 없다고 말한다.
 */
export function verificationPhrase(standing: VerificationStanding): string {
  if (standing.humanConfirmed) return "사람이 확인함";
  const engine = standing.autoDecided
    ? standing.identifierBacked
      ? "엔진 자동 판정(품번 근거)"
      : "엔진 자동 판정(품번 없이 여러 축 일치)"
    : "엔진이 자동 확정하지 않음";
  return standing.humanConfirmedKnown ? `${engine} · 사람 확인 없음` : `${engine} · 사람 확인 여부 기록 없음`;
}
