import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CANONICAL_FIELD_LAYER,
  COMMERCE_NAME_PATTERN,
  MASTER_FIELD_GROUP,
  masterFieldLayerOf,
  type CanonicalProductKey,
  type MasterFieldLayer,
} from "../master-product";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * NEXT-04d Phase A — **경계가 «실제로» 서 있는지 기계로 확인한다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * `satisfies Record<keyof CanonicalProduct, …>` 가 이미 컴파일 단계에서
 * 미분류를 막는다. 그런데 컴파일 에러는 «타입을 고치는 사람» 에게만 보인다 —
 * 이 파일은 같은 것을 **읽을 수 있는 문장으로** 실패하게 만든다:
 *
 *   ① 인터페이스에 있는 칸이 지도에 빠지면 → 어느 칸인지 이름을 찍고 실패
 *   ② 지도에 있는데 인터페이스에서 사라졌으면 → 마찬가지
 *   ③ 🔴 Master 층 필드 이름에 커머스 이름이 박히면 실패
 *
 * ③ 이 이번 구조의 핵심이다. 「Master 가 롯데ON 을 안다」가 되는 순간 신규
 * 커머스마다 상품 타입에 칸이 하나씩 붙는다 — 그 길을 여기서 막는다.
 */

/** product-types.ts 원문에서 `CanonicalProduct` 의 «최상위» 칸 이름만 뽑는다.
 *
 * 🔴 정규식으로 파일 전체를 훑지 않는다. 중첩 객체(lotteOnChannelInfo 의
 * category/notice/delivery 등)의 안쪽 키까지 최상위로 세면 검사가 거짓말을
 * 한다. 중괄호 깊이를 세어 depth 0 인 줄만 읽는다. */
function declaredCanonicalKeys(): string[] {
  const source = readFileSync(new URL("../product-types.ts", import.meta.url), "utf8");
  const start = source.indexOf("export interface CanonicalProduct {");
  expect(start, "CanonicalProduct 선언을 못 찾았다 — 이 검사가 무의미해진다").toBeGreaterThan(-1);
  const body = source.slice(start + "export interface CanonicalProduct {".length);

  let depth = 1;
  let end = -1;
  for (let i = 0; i < body.length; i += 1) {
    if (body[i] === "{") depth += 1;
    else if (body[i] === "}") {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  expect(end, "CanonicalProduct 의 끝 중괄호를 못 찾았다").toBeGreaterThan(-1);

  const stripped = body
    .slice(0, end)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*/g, "");

  const keys: string[] = [];
  let nested = 0;
  for (const rawLine of stripped.split("\n")) {
    const line = rawLine.trim();
    if (nested === 0) {
      const match = /^([A-Za-z][A-Za-z0-9_]*)\??\s*:/.exec(line);
      if (match) keys.push(match[1]);
    }
    for (const ch of line) {
      if (ch === "{" || ch === "[") nested += 1;
      else if (ch === "}" || ch === "]") nested -= 1;
    }
  }
  return keys;
}

const DECLARED = declaredCanonicalKeys();
const MAPPED = Object.keys(MASTER_FIELD_GROUP) as CanonicalProductKey[];

describe("① 분류되지 않은 필드는 «없다»", () => {
  it("🔴 CanonicalProduct 의 모든 칸이 지도에 있다 — 빠진 이름을 찍는다", () => {
    const missing = DECLARED.filter((key) => !(key in MASTER_FIELD_GROUP));
    expect(
      missing,
      `새 필드를 추가하고 master-product.ts 의 MASTER_FIELD_GROUP 에 등록하지 않았다: ${missing.join(", ")}`,
    ).toEqual([]);
  });

  it("지도에만 있고 타입에서 사라진 칸도 «없다»", () => {
    const stale = MAPPED.filter((key) => !DECLARED.includes(key));
    expect(stale, `지운 필드가 지도에 남아 있다: ${stale.join(", ")}`).toEqual([]);
  });

  it("두 목록의 개수가 같다 — 현재 51칸", () => {
    expect(DECLARED.length).toBe(MAPPED.length);
    expect(MAPPED.length).toBe(51);
  });
});

describe("② 층별 구성이 CPO 확정 구조와 같다", () => {
  const countByLayer = MAPPED.reduce<Record<string, number>>((acc, key) => {
    const layer = masterFieldLayerOf(key);
    acc[layer] = (acc[layer] ?? 0) + 1;
    return acc;
  }, {});

  it.each([
    ["MASTER", 27],
    ["CONTENT", 5],
    ["SELLING", 4],
    ["COMMERCE_BINDING", 6],
    ["SOURCE", 7],
    ["LEGACY", 2],
  ])("%s = %d칸", (layer, expected) => {
    /* 숫자를 박아 두는 이유: 분류가 «조용히» 움직이는 것을 막는다. 새 필드를
       추가하면 여기도 같이 고쳐야 하고, 그때 「이게 어느 층인가」를 한 번 더
       생각하게 된다. */
    expect(countByLayer[layer] ?? 0).toBe(expected);
  });

  it("모든 칸이 6개 라벨 중 하나다", () => {
    const LABELS: MasterFieldLayer[] = ["MASTER", "CONTENT", "SELLING", "COMMERCE_BINDING", "SOURCE", "LEGACY"];
    for (const key of MAPPED) expect(LABELS).toContain(masterFieldLayerOf(key));
  });
});

describe("③ 🔴 Master 는 커머스를 «모른다»", () => {
  it("Master 층 필드 이름에 판매 채널 이름이 박혀 있지 않다", () => {
    const offenders = MAPPED.filter(
      (key) => masterFieldLayerOf(key) === "MASTER" && COMMERCE_NAME_PATTERN.test(key),
    );
    expect(
      offenders,
      `Master 가 커머스를 알게 됐다 — CommerceBinding 으로 옮겨야 한다: ${offenders.join(", ")}`,
    ).toEqual([]);
  });

  it("Content 층도 마찬가지다 — 채널별 콘텐츠는 아직 없다", () => {
    const offenders = MAPPED.filter(
      (key) => masterFieldLayerOf(key) === "CONTENT" && COMMERCE_NAME_PATTERN.test(key),
    );
    expect(offenders).toEqual([]);
  });

  it("🔴 lotteOnChannelInfo 는 COMMERCE_BINDING 이다", () => {
    // 이 한 칸이 분류 전체의 이유다(04d 조사).
    expect(masterFieldLayerOf("lotteOnChannelInfo")).toBe("COMMERCE_BINDING");
  });

  it.each([
    ["channelPriceOverrides"],
    ["categoryFieldOverrides"],
    ["categoryResolverKpi"],
    ["categoryRecommendationCache"],
  ] as const)("%s 도 COMMERCE_BINDING 이다", (key) => {
    expect(masterFieldLayerOf(key as CanonicalProductKey)).toBe("COMMERCE_BINDING");
  });

  it("🔴 `shopify*` 는 커머스가 아니라 «원본 사이트» 라 SOURCE 다", () => {
    /* 우리가 파는 채널이 아니다. 이름이 플랫폼처럼 생겼다는 이유로
       Binding 에 넣으면 「원본에서 읽은 신호」가 채널 값으로 둔갑한다. */
    expect(masterFieldLayerOf("shopifyTags")).toBe("SOURCE");
    expect(masterFieldLayerOf("shopifyProductType")).toBe("SOURCE");
    expect(COMMERCE_NAME_PATTERN.test("shopifyTags")).toBe(false);
  });
});

describe("④ 판매 조건은 Master 가 아니다 (CPO 확정)", () => {
  it.each([["priceOverrideKrw"], ["priceBreakdown"], ["shippingFee"], ["returnPolicy"]] as const)(
    "%s = SELLING",
    (key) => {
      expect(masterFieldLayerOf(key as CanonicalProductKey)).toBe("SELLING");
    },
  );

  it("🔴 원본 원가(price)는 여전히 Master 다 — 「원본이 얼마였나」는 상품 사실이다", () => {
    expect(masterFieldLayerOf("price")).toBe("MASTER");
    expect(masterFieldLayerOf("regularPrice")).toBe("MASTER");
  });
});

describe("⑤ 이름 충돌을 만들지 않았다", () => {
  it("🔴 MI 매칭용 ProductFacts 와 다른 이름을 쓴다", () => {
    const source = readFileSync(new URL("../master-product.ts", import.meta.url), "utf8");
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");
    // 「export type ProductFacts」 같은 선언이 생기면 product-facts.ts 와 충돌한다.
    expect(code).not.toMatch(/export\s+(type|interface)\s+ProductFacts\b/);
    expect(code).toContain("MasterProductFacts");
  });
});

describe("⑥ 이 파일은 «값» 을 만들지 않는다 — 런타임 동작 변경 0", () => {
  it("분류표는 순수 데이터다 — CanonicalProduct 를 만들거나 고치는 코드가 없다", () => {
    const source = readFileSync(new URL("../master-product.ts", import.meta.url), "utf8");
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");
    for (const forbidden of ["backfillCanonicalProduct", "supabase", "fetch(", "JSON.parse"]) {
      expect(code, `경계 선언 파일이 ${forbidden} 를 건드린다`).not.toContain(forbidden);
    }
  });

  it("조회 함수는 지도를 그대로 읽는다", () => {
    for (const key of MAPPED) {
      expect(masterFieldLayerOf(key)).toBe(CANONICAL_FIELD_LAYER[key]);
    }
  });
});
