import {
  countEnclosedHoles,
  labelComponents,
  largestComponentLabel,
} from "../utils/connected-components.util";

export interface QualityScore {
  backgroundNoise: number; // 0-100, 100=깨끗(전경이 하나의 덩어리로 뭉쳐있음)
  edgeQuality: number; // 0-100, 100=부드러운(anti-aliased) 경계
  holeCount: number; // 실루엣 내부에 갇힌 구멍 개수(원시값, 참고용)
  maskScore: number; // 0-100, 파편화+구멍 종합 점수
  overall: number; // 가중 평균 — 이 값으로 누끼 사용 여부를 결정한다
}

const SOFT_ALPHA_MIN = 20;
const SOFT_ALPHA_MAX = 235;

/**
 * 배경제거 결과 마스크의 품질을 순수 픽셀 연산만으로 점수화한다(LLM 호출 없음 —
 * 이미지 1장마다 AI Vision을 또 부르면 토큰 비용이 배로 들기 때문에, 무료로 계산
 * 가능한 휴리스틱으로 대신한다). product-processor의 cleanAlphaNoise()가 median
 * 필터 + 이진화를 마친 시점에 이미 갖고 있는 rawAlpha/binary를 그대로 받아 쓴다.
 */
export function scoreSegmentation(params: {
  rawAlpha: Buffer;
  binary: Uint8Array;
  width: number;
  height: number;
}): QualityScore {
  const { rawAlpha, binary, width, height } = params;

  const { labels, sizes } = labelComponents(binary, width, height);
  const totalFg = sizes.reduce((sum, size) => sum + size, 0);
  const largest = largestComponentLabel(sizes);
  const largestSize = largest === -1 ? 0 : sizes[largest];

  const backgroundNoise =
    totalFg === 0 ? 0 : Math.round(100 * (largestSize / totalFg));

  const holeCount = countEnclosedHoles(binary, width, height);
  const holesPenalty = Math.min(100, holeCount * 15);
  const maskScore = Math.round((backgroundNoise + (100 - holesPenalty)) / 2);

  let boundaryCount = 0;
  let softCount = 0;
  if (largest !== -1) {
    for (let idx = 0; idx < binary.length; idx++) {
      if (labels[idx] !== largest) continue;
      const x = idx % width;
      const y = (idx - x) / width;
      const isBoundary =
        (x > 0 && binary[idx - 1] === 0) ||
        (x < width - 1 && binary[idx + 1] === 0) ||
        (y > 0 && binary[idx - width] === 0) ||
        (y < height - 1 && binary[idx + width] === 0);
      if (!isBoundary) continue;

      boundaryCount++;
      const alpha = rawAlpha[idx];
      if (alpha >= SOFT_ALPHA_MIN && alpha <= SOFT_ALPHA_MAX) softCount++;
    }
  }
  const edgeQuality = boundaryCount === 0 ? 0 : Math.round(100 * (softCount / boundaryCount));

  const overall = Math.round(0.4 * maskScore + 0.35 * backgroundNoise + 0.25 * edgeQuality);

  return { backgroundNoise, edgeQuality, holeCount, maskScore, overall };
}
