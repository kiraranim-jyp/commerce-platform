import type { CanonicalProduct, PlatformId } from "@commerce/shared";
import { classifyProductType } from "../classify";
import { PLATFORM_CATEGORY_TABLES, type CategoryPath } from "../platform-categories";
import { detectCategoryProfile, fitCategoryPath, type CategoryProfile } from "../profiles";
import { resolveProductSignals } from "../product-resolver";
import type { CategoryProvider } from "../provider";
import type { CategoryCandidate } from "../types";

const ALTERNATE_DISCOUNT = 0.85;

/**
 * TTAEJYO 2.0(CEO 지시, 2026-09-12) — primary가 언제나 1순위이던 것을 고친다.
 *
 * ── 무엇이 문제였나 ──────────────────────────────────────────────────────
 * smartstore/coupang/elevenst.categories.ts의 12개 ProductType은 primary가
 * 거의 전부 "유아동…" 경로다. 성인/여성/잡화 경로는 이미 alternate에 들어
 * 있었다(예: Dress.alternate = 패션의류 > 여성의류 > 원피스). 그런데 이 provider는
 * 언제나 primary를 먼저 내보냈으므로, 여성 원피스를 넣어도 1순위 추천이
 * "유아동 원피스"였다 — 표에는 정답이 있는데 고르는 규칙이 아동으로 고정돼
 * 있었던 셈이다.
 *
 * ── 표를 카테고리마다 복제하지 않는다 ────────────────────────────────────
 * 가장 쉬운 해법은 WOMEN_PLATFORM_CATEGORY_TABLES를 하나 더 만드는 것이고,
 * 그게 이번 지시가 실패라고 못박은 방식이다(카테고리마다 코드 한 벌). 표는
 * 하나로 두고, **고르는 순서**만 프로필이 정한다. 카테고리가 하나 늘어도 이
 * 파일은 고치지 않는다.
 *
 * ── 프로필을 못 고르면 지금까지와 완전히 같다 ────────────────────────────
 * 정렬 자체를 건너뛴다. 아동 상품에서는 primary가 MATCH라 어차피 1순위가
 * 그대로 유지된다 — 회귀가 아니라 "아동일 때 원래 옳던 순서"가 이유를 갖게
 * 되는 것이다.
 */
function orderByProfile(entries: { path: CategoryPath; isPrimary: boolean }[], profile: CategoryProfile | null) {
  if (!profile) return entries;
  const rank = (entry: { path: CategoryPath }): number => {
    const text = [entry.path.name, ...entry.path.path].join(" ");
    const { fit } = fitCategoryPath(profile, text);
    // MATCH(0) → UNKNOWN(1) → CONFLICT(2). CONFLICT를 지우지 않고 뒤로만 보낸다 —
    // 셀러가 "이 상품은 사실 아동용"이라고 판단하면 그 후보를 고를 수 있어야 한다.
    return fit === "MATCH" ? 0 : fit === "CONFLICT" ? 2 : 1;
  };
  // 같은 등급이면 원래 순서를 지킨다(안정 정렬) — primary/alternate의 기존
  // 의미(더 좁은 자리가 primary)를 프로필이 없는 축에서는 그대로 둔다.
  return entries
    .map((entry, index) => ({ entry, index, rank: rank(entry) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((x) => x.entry);
}

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

    // 이 상품이 어느 카테고리인지 먼저 정한다. resolveProductSignals는 순수
    // 함수이고 이미 CanonicalProduct만 읽으므로(외부 호출 없음) 브라우저에서
    // 그대로 도는 이 provider의 성격이 바뀌지 않는다.
    const signals = resolveProductSignals(product);
    const detection = detectCategoryProfile(
      signals,
      `${product.title.value} ${product.description.value} ${(product.breadcrumbPath ?? []).join(" ")}`,
      product.brand.value,
    );

    const entries = orderByProfile(
      [
        { path: mapping.primary, isPrimary: true },
        ...(mapping.alternate ? [{ path: mapping.alternate, isPrimary: false }] : []),
      ],
      detection?.profile ?? null,
    );

    // confidence는 "표에서 몇 번째로 좁은 자리인가"가 아니라 "몇 번째 후보인가"를
    // 말한다. 순서가 프로필로 바뀌었으므로 할인율도 순서를 따라가야 한다 —
    // 그러지 않으면 1순위 후보가 2순위보다 낮은 신뢰도로 표시되는 화면이 된다.
    return entries.map((entry, index) => ({
      id: `${platform}:${top.type}:${entry.isPrimary ? "primary" : "alternate"}`,
      name: entry.path.name,
      path: entry.path.path,
      platform,
      confidence:
        index === 0 ? top.confidence : Math.round(top.confidence * ALTERNATE_DISCOUNT * 100) / 100,
      reason:
        index === 0
          ? detection
            ? [...top.reasons, `${detection.profile.label} 카테고리로 판단(${detection.reason})`]
            : top.reasons
          : [...top.reasons, "상위/유사 카테고리로도 등록 가능"],
      source: "rule" as const,
    })) satisfies CategoryCandidate[];
  },
};
