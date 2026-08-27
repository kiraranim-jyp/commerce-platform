/**
 * N-4.18-Q3 PART H-3-4(대표님 지시, 2026-08-27) — 해외/국내 대표 이미지의 dHash
 * 교차비교. `packages/image/src/services/dedup.service.ts`의 기존
 * `computeDifferenceHash`/`hammingDistance`를 그대로 재사용한다(새 해시 알고리즘
 * 없음). 그 함수는 로컬 파일 경로만 받으므로, 이 파일이 하는 일은 "URL을 임시
 * 파일로 받아서 그 함수에 넘기고 끝나면 지운다"는 얇은 래퍼뿐이다.
 *
 * 대표님 지시 3가지 원칙:
 * 1. distance<=10(기존 dedup.service.ts DEFAULT_THRESHOLD 실측 기준)을 그대로
 *    1차 검증 기준으로 쓴다 — 새로 지어내지 않는다.
 * 2. 결과는 confidence 점수가 아니라 ImageEvidenceResult(strong_match/
 *    possible_match/weak_or_no_evidence) 3단계로만 저장한다.
 * 3. weak_or_no_evidence는 "다른 상품"이 아니라 "이미지로 판단할 근거가 없다"는
 *    뜻이다(크롭/배경제거/좌우반전/촬영각도차 때문에 dHash가 실패할 수 있음).
 */
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { computeDifferenceHash, hammingDistance } from "@commerce/image";
import type { ImageEvidenceResult } from "./evidence";

const FETCH_TIMEOUT_MS = 10000;
const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

async function downloadToTempFile(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": CHROME_UA },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    const dir = mkdtempSync(path.join(tmpdir(), "cartpilot-img-evidence-"));
    const file = path.join(dir, `${randomUUID()}.img`);
    writeFileSync(file, buffer);
    return file;
  } catch {
    return null;
  }
}

/** URL 하나를 다운로드해 dHash를 계산하고 임시 파일은 즉시 지운다. 다운로드/디코딩
 * 실패(404, 타임아웃, 이미지가 아닌 응답 등)는 null — 추정하지 않는다. */
export async function hashImageUrl(url: string): Promise<string | null> {
  const file = await downloadToTempFile(url);
  if (!file) return null;
  try {
    return await computeDifferenceHash(file);
  } catch {
    return null;
  } finally {
    rmSync(path.dirname(file), { recursive: true, force: true });
  }
}

/** N-4.18-Q3 PART H-3(대표님 지시, 2026-08-27) — "여러 장을 교차비교"하기 위해
 * 해외 이미지 전체 x 국내 이미지 전체의 모든 쌍 중 최소 거리를 쓴다(한 쌍이라도
 * 강하게 일치하면 강한 증거로 본다 — 첫 장만 비교하지 않는다). 다운로드 비용을
 * 고려해 상한을 둔다(둘 다 최대 5장까지만, 실측 확인: FORETFORET 상세는 이미지가
 * 1장뿐이라 이 상한이 실제로 걸리는 경우는 드물다). */
const MAX_IMAGES_PER_SIDE = 5;

export interface ImageDistanceResult {
  /** 실제로 비교에 성공한 쌍들 중 최소 hamming distance. 한 쌍도 비교 못 하면 null. */
  minDistance: number | null;
  /** 다운로드+해시 계산에 성공한 이미지 쌍의 수(디버깅/투명성용). */
  comparedPairs: number;
}

export async function computeMinImageDistance(
  foreignImageUrls: string[],
  domesticImageUrls: string[],
): Promise<ImageDistanceResult> {
  const foreign = foreignImageUrls.slice(0, MAX_IMAGES_PER_SIDE);
  const domestic = domesticImageUrls.slice(0, MAX_IMAGES_PER_SIDE);
  if (foreign.length === 0 || domestic.length === 0) {
    return { minDistance: null, comparedPairs: 0 };
  }

  const foreignHashes = await Promise.all(foreign.map(hashImageUrl));
  const domesticHashes = await Promise.all(domestic.map(hashImageUrl));

  let minDistance: number | null = null;
  let comparedPairs = 0;
  for (const a of foreignHashes) {
    if (!a) continue;
    for (const b of domesticHashes) {
      if (!b) continue;
      comparedPairs += 1;
      const distance = hammingDistance(a, b);
      if (minDistance === null || distance < minDistance) minDistance = distance;
    }
  }
  return { minDistance, comparedPairs };
}

/** N-4.18-Q3 PART H-3-4 실측 결과(2026-08-27, 아래 3개 실제 상품 쌍을 실제로
 * 다운로드해 hashImageUrl로 직접 측정 — 지어낸 값 아님, hashImageUrl(URL)을
 * 같은 URL로 두 번 호출해 distance=0이 나오는 것도 별도로 확인해 파이프라인
 * 자체의 정확성을 먼저 검증했다):
 *
 *   - 동일상품(PèPè 골든케이스, 해외 junioredition.com 사진 vs 국내 FORETFORET
 *     자체 촬영 사진): distance = 86
 *   - 유사하지만 다른 상품(RULII 내 PèPè 다른 색상 — Milk 원본 vs Rosa 핑크,
 *     같은 브랜드/같은 신발 라인의 다른 컬러웨이): distance = 119
 *   - 완전히 다른 상품(PèPè 신발 vs Bobo Choses 아동복): distance = 107
 *
 * 대표님이 3가지 카테고리로 실측을 요청한 이유(dHash가 실패할 수 있다는 우려)가
 * 그대로 확인됐다: 세 값 모두 dedup.service.ts의 기존 임계값(<=10)을 훨씬
 * 넘고, 순서도 "동일상품(86) < 완전-다른상품(107) < 유사-다른상품(119)"으로
 * 실제 동일성과 단조적으로 대응하지 않는다(완전히 다른 상품이 유사한 다른
 * 상품보다 오히려 거리가 더 가깝게 나왔다). 원인으로 추정되는 것: 이 3개
 * 이미지 쌍 전부 배경/크롭/구도가 사이트마다 크게 다르고, computeDifferenceHash가
 * "fit: fill"로 원본 비율을 무시하고 강제로 리사이즈하기 때문에 실제 형태 정보가
 * 왜곡됐을 가능성이 있다 — 다만 이건 가설이고, 이번 단계에서 알고리즘을 바꾸지
 * 않으므로(대표님 지시: 이번 단계 변경 금지 항목) 검증하지 않았다.
 *
 * 결론: 기존 임계값(<=10)을 그대로 쓰면 실측 3건 전부 strong_match가 아니라
 * weak_or_no_evidence로 분류된다(진짜 동일상품인 골든케이스도 포함). 이는
 * "틀린 답"이 아니라 안전한 결과다 — weak_or_no_evidence는 "다른 상품"이
 * 아니라 "이 이미지 비교로는 판단할 근거가 없다"는 뜻이므로, 실제로 근거가
 * 약했던 이번 3개 케이스를 정직하게 그렇게 분류한 것이다. possible_match
 * 중간대는 이번 3개 실측만으로는 근거를 못 만들었다(세 값의 순서 자체가
 * 신뢰할 수 없어서 중간값을 아무 데나 그어도 의미가 없다) — 그래서 지금은
 * possible_match를 반환하지 않는다(타입에는 존재하되 미사용, H-3-1/evidence.ts
 * 참고). */
const STRONG_MATCH_MAX_DISTANCE = 10;

export function classifyImageEvidence(minDistance: number | null): ImageEvidenceResult {
  if (minDistance === null) return "unavailable";
  return minDistance <= STRONG_MATCH_MAX_DISTANCE ? "strong_match" : "weak_or_no_evidence";
}
