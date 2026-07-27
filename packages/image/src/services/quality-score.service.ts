import {
  componentsAboveRelativeSize,
  countEnclosedHoles,
  labelComponents,
  largestComponentLabel,
  MIN_COMPONENT_AREA_RATIO,
} from "../utils/connected-components.util";

export interface QualityScore {
  backgroundNoise: number; // 0-100, 100=깨끗(전경이 정상 크기 덩어리(들)로 뭉쳐있고 잔여 노이즈가 없음)
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

  // cleanAlphaNoise가 실제로 "정상 전경"으로 보존하는 기준(가장 큰 덩어리 대비
  // MIN_COMPONENT_AREA_RATIO 이상)과 동일한 기준으로 backgroundNoise를 계산한다 —
  // 그래야 신발 한 켤레처럼 정상적으로 여러 덩어리를 보존한 이미지가 "노이즈가
  // 많다"고 오판되지 않는다. 이 기준에 못 미치는 작은 잔여 덩어리는 여전히
  // backgroundNoise 감점 대상으로 남는다.
  const significant = componentsAboveRelativeSize(sizes, MIN_COMPONENT_AREA_RATIO);
  const significantSize = sizes.reduce(
    (sum, size, i) => (significant.has(i) ? sum + size : sum),
    0,
  );

  const backgroundNoise =
    totalFg === 0 ? 0 : Math.round(100 * (significantSize / totalFg));

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
