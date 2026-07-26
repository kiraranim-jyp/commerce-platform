import type { CanonicalProduct, PlatformId } from "@commerce/shared";
import { classifyProductType } from "../classify";
import { PLATFORM_CATEGORY_TABLES, type CategoryPath } from "../platform-categories";
import type { CategoryProvider } from "../provider";
import type { CategoryCandidate } from "../types";

const ALTERNATE_DISCOUNT = 0.85;

function flattenTable(platform: PlatformId): CategoryPath[] {
  const table = PLATFORM_CATEGORY_TABLES[platform];
  const paths: CategoryPath[] = [];
  const seen = new Set<string>();
  for (const mapping of Object.values(table)) {
    for (const entry of [mapping.primary, mapping.alternate]) {
      if (!entry) continue;
      const key = entry.path.join(">");
      if (seen.has(key)) continue;
      seen.add(key);
      paths.push(entry);
    }
  }
  return paths;
}

/**
 * 규칙 기반(키워드 매칭) 구현체 — AI API를 호출하지 않고 title/description만 보고
 * 판단하기 때문에 브라우저에서도 그대로 실행할 수 있다(CommerceWorkspace가 클라이언트
 * 컴포넌트에서 직접 호출한다).
 */
export const ruleBasedCategoryProvider: CategoryProvider = {
  getCategories(platform) {
    return flattenTable(platform);
  },

  searchCategories(platform, query) {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return flattenTable(platform).filter(
      (entry) => entry.name.toLowerCase().includes(q) || entry.path.some((p) => p.toLowerCase().includes(q)),
    );
  },

  recommendCategory(product: CanonicalProduct, platform: PlatformId): CategoryCandidate[] {
    const classified = classifyProductType(product);
    if (classified.length === 0) return [];

    const top = classified[0];
    const mapping = PLATFORM_CATEGORY_TABLES[platform][top.type];
    const candidates: CategoryCandidate[] = [
      {
        id: `${platform}:${top.type}:primary`,
        name: mapping.primary.name,
        path: mapping.primary.path,
        platform,
        confidence: top.confidence,
        reason: top.reasons,
        source: "rule",
      },
    ];

    if (mapping.alternate) {
      candidates.push({
        id: `${platform}:${top.type}:alternate`,
        name: mapping.alternate.name,
        path: mapping.alternate.path,
        platform,
        confidence: Math.round(top.confidence * ALTERNATE_DISCOUNT * 100) / 100,
        reason: [...top.reasons, "상위/유사 카테고리로도 등록 가능"],
        source: "rule",
      });
    }

    return candidates;
  },
};
