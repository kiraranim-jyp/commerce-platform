import type { Page } from "playwright-core";

export type StrategySource = "json-ld" | "open-graph" | "shopify" | "next-data" | "dom-scan";

/** 한 페이지에서 발견한 이미지 후보 하나. 여러 Strategy가 같은 URL을 찾으면
 * universal-extractor가 병합해서 점수 보너스를 준다. */
export interface ImageCandidate {
  url: string;
  alt?: string;
  width?: number;
  height?: number;
  /** 조상 5단계의 class/id를 합친 소문자 문자열 — 점수화에서 갤러리/추천상품/로고 판별에 쓴다. */
  context?: string;
  /** dom-scan 전용: 같은 부모 아래 형제 img 개수(3개 이상이면 갤러리로 간주). */
  siblingCount?: number;
  source: StrategySource;
}

export interface ExtractionContext {
  url: string;
  /** page.content() 결과 — 구조화 데이터 Strategy들은 이 문자열만 파싱한다. */
  html: string;
  /** dom-scan처럼 실제 DOM 평가가 필요한 Strategy만 사용한다. */
  page: Page;
}

export interface ExtractionStrategy {
  name: StrategySource;
  canHandle(ctx: ExtractionContext): boolean;
  extract(ctx: ExtractionContext): Promise<ImageCandidate[]>;
}
