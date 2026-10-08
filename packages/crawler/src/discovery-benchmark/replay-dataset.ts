import type { QueryId, ResolutionClass } from "./types";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI-DISCOVERY-P5.4-C.2 STEP 3(CPO 지시, 2026-10-08) — **원본 데이터와 보고용
 * 문자열을 같은 칸에 담지 않는다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 이 파일이 존재하는 이유는 실제 사고다. 1차 Replay 하니스가 가독성을 위해
 *    `url.slice(0, 92)` 로 콘솔에 출력했고, 그 **잘린 문자열** 이 그대로 측정
 *    데이터로 복구됐다. 결과:
 *
 *      총 106건 중 16건(15%) 잘림 · 2건은 퍼센트 인코딩이 깨져 파싱 불가
 *      🔴 그중에 load-bearing 후보가 있었다 —
 *         `littleluna.co.kr/product/%EB%A9%94…-aw26ms185-bub` 에서 끊겨
 *         `grey-melange` 가 사라졌고, 「K=5 에서 Little Luna 탈락」이라는
 *         **거짓 결론**이 나왔다. 랭킹 탓이 아니라 데이터 손상이었다.
 *
 * 🔴 그래서 이 모듈은 **두 가지를 타입으로 갈라 둔다**:
 *      ① `ReplayCandidateRecord` — 저장용. 원문 그대로. 절대 자르지 않는다.
 *      ② `forReport()`           — 출력용. 자르는 «유일한» 자리.
 *
 *    잘린 값이 저장 경로에 들어갈 수 없다 — `forReport()` 는 `string` 을
 *    돌려주고 어떤 레코드 칸도 그 타입을 받지 않는다.
 */

/** 🔴 저장되는 한 건. 모든 URL 은 **원문 그대로** 다. */
export interface ReplayCandidateRecord {
  /** Google grounding 이 준 리다이렉트 주소. 🔴 opaque — 여기엔 상품 신호가 없다. */
  groundingUrl: string;
  /** grounding 이 함께 준 제목(실측: 도메인명). 🔴 probe 전 유일한 신호다. */
  webTitle: string | null;
  /** 어느 질의가 찾았는가. */
  queryId: QueryId;
  /** 그 질의 안에서의 응답 순서. */
  queryRank: number;
  /** probe 가 리다이렉트를 따라간 도착지. probe 실패 시 null. */
  finalUrl: string | null;
  /** 도착지가 알려준 canonical. 없으면 null — 지어내지 않는다. */
  canonicalUrl: string | null;
  /** 도착지 분류. probe 를 못 했으면 null. */
  classification: ResolutionClass | null;
  /** 크롤러에 넘길 정규 URL. 재조립 불가면 null. */
  crawlerUrl: string | null;
  /** 같은 판매처의 같은 상품을 합치는 키. */
  dedupeKey: string | null;
  /** probe 가 받은 본문 바이트(비용). probe 안 했으면 null. */
  probeBytes: number | null;
}

export interface ReplayJobDataset {
  jobKey: string;
  /** 🔴 원본 상품 URL — 자기참조 판정의 기준. */
  originUrl: string;
  /** 이 JOB 에서 실제로 Google 에 보낸 질의. */
  queries: { id: QueryId; text: string }[];
  /** Google 호출 결과 분류(§11). 「0 후보」와 실패를 가르는 유일한 근거. */
  queryOutcomes: { id: QueryId; outcome: string }[];
  candidates: ReplayCandidateRecord[];
}

export interface ReplayDataset {
  /** 🔴 측정 시각은 호출부가 넣는다 — 이 모듈은 시간을 만들지 않는다. */
  capturedAt: string;
  model: string;
  jobs: ReplayJobDataset[];
}

/**
 * 🔴 **자르는 유일한 자리.** 반환은 `string` 이고 어떤 레코드 칸도 이 타입을
 *    받지 않으므로, 잘린 값이 저장 경로에 들어갈 수 없다.
 *
 * 🔴 퍼센트 인코딩을 «디코딩하지 않는다» — 자르면 `%EB%A9` 같은 조각이 남아
 *    `decodeURIComponent` 가 던진다(1차 사고에서 2건이 그랬다). 읽기 좋게
 *    보여주고 싶으면 `safeDecode()` 로 «자르기 전에» 디코딩한다.
 */
export function forReport(value: string | null, maxLength = 92): string {
  if (value === null) return "(없음)";
  return value.length <= maxLength ? value : `${value.slice(0, maxLength)}…(${value.length}자)`;
}

/**
 * 🔴 깨진 퍼센트 인코딩이 **한 건 때문에 전체를 망치지 않게** 한다.
 *    실패하면 원문을 그대로 돌려준다 — 값을 버리지 않는다.
 */
export function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** 저장. 🔴 `JSON.stringify` 가 원문을 그대로 쓴다 — 가공하지 않는다. */
export function serializeReplayDataset(dataset: ReplayDataset): string {
  return JSON.stringify(dataset, null, 1);
}

/**
 * 복원. 🔴 모양이 아닌 것은 **던진다** — 조용히 빈 값으로 만들면 1차 사고처럼
 * 손상된 데이터로 측정하게 된다.
 */
export function parseReplayDataset(raw: string): ReplayDataset {
  const parsed = JSON.parse(raw) as ReplayDataset;
  if (!Array.isArray(parsed.jobs)) throw new Error("ReplayDataset: jobs 가 배열이 아니다");
  for (const job of parsed.jobs) {
    if (typeof job.jobKey !== "string" || !Array.isArray(job.candidates)) {
      throw new Error(`ReplayDataset: job 모양이 깨졌다(${String(job?.jobKey)})`);
    }
    for (const c of job.candidates) {
      if (typeof c.groundingUrl !== "string" || c.groundingUrl.length === 0) {
        throw new Error(`ReplayDataset: groundingUrl 이 비었다(${job.jobKey})`);
      }
    }
  }
  return parsed;
}
