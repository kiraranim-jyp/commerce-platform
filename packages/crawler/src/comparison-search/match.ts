import type { ComparisonCandidate, ComparisonQuery } from "./types";

const STOPWORDS = new Set(["the", "a", "an", "for", "and", "with", "by"]);

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9가-힣]+/)
      .filter((t) => t.length > 1 && !STOPWORDS.has(t)),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/** 규칙 기반 매칭(AI 미사용): 브랜드 부분일치 + 제목 토큰 Jaccard 유사도. */
export function scoreCandidate(query: ComparisonQuery, candidate: ComparisonCandidate): number {
  const titleScore = jaccard(tokenize(query.title), tokenize(candidate.title));

  let brandScore = 0;
  if (query.brand) {
    const brand = query.brand.trim().toLowerCase();
    if (brand && candidate.title.toLowerCase().includes(brand)) brandScore = 1;
  }

  const combined = query.brand ? titleScore * 0.6 + brandScore * 0.4 : titleScore;
  return Math.round(combined * 100) / 100;
}

export function withConfidence(query: ComparisonQuery, candidates: ComparisonCandidate[]): ComparisonCandidate[] {
  return candidates
    .map((c) => ({ ...c, confidence: scoreCandidate(query, c) }))
    .sort((a, b) => b.confidence - a.confidence);
}
