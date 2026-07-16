import sharp from "sharp";

export interface ThumbnailCandidate {
  fileName: string;
  file: string;
}

export interface ThumbnailSelectionResult {
  thumbnail: string;
}

export interface ThumbnailSelector {
  select(candidates: ThumbnailCandidate[]): Promise<ThumbnailSelectionResult>;
}

/**
 * 무료 기본 구현: 해상도가 가장 큰 이미지를 대표이미지로 선택한다.
 * API 호출이 없어 비용이 들지 않는다. 정확도를 높이려면 AI Vision 기반
 * 선택기(별도 구현)로 교체할 수 있다.
 */
export class ResolutionThumbnailSelector implements ThumbnailSelector {
  async select(candidates: ThumbnailCandidate[]): Promise<ThumbnailSelectionResult> {
    if (candidates.length === 0) {
      throw new Error("썸네일 후보 이미지가 없습니다.");
    }

    let best = candidates[0];
    let bestPixels = -1;

    for (const candidate of candidates) {
      const metadata = await sharp(candidate.file).metadata();
      const pixels = (metadata.width ?? 0) * (metadata.height ?? 0);
      if (pixels > bestPixels) {
        bestPixels = pixels;
        best = candidate;
      }
    }

    return { thumbnail: best.fileName };
  }
}
