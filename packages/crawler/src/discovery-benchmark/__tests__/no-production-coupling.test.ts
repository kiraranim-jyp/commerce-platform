/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI-P0-02b ⑥(CPO 지시, 2026-10-11) — **import graph 를 본다. 파일명이 아니다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 이 파일은 **원래 없었다.** 그런데 `discovery-benchmark/types.ts` 머리 주석이
 *    「Production 런타임이 여기 있는 것을 하나도 import 하지 않는다(그 사실을
 *    `__tests__/no-production-coupling.test.ts` 가 지킨다)」고 적어 뒀다.
 *    **그 파일이 없었으므로 그 문장은 거짓이었고**, 실제로는
 *    `comparison-search/product-url-facts.ts` 가
 *    `discovery-benchmark/url-resolver` 를 직접 import 하고 있었다.
 *
 * 🔴 실제 가드(`discovery-benchmark.test.ts`)는 `index.ts` 의 **export 만** 봤다.
 *    배럴에서 export 하지 않아도 **깊은 import 로 들어갈 수 있다** — 그 경로가
 *    바로 이 저장소에서 실제로 뚫린 경로다. 「막는 가드가 있다」는
 *    「막힌다」가 아니다. [[guard-predates-the-new-path]]
 *
 * 🔴 **방향을 혼동하지 않는다.**
 *      benchmark → Production   ✅ 허용. 하니스는 기존 함수를 «주입받아 부른다»
 *                                  (types.ts 의 MiAdapter·CrawlerAdapter 원칙)
 *      Production → benchmark   ❌ 금지. 실험 코드가 운영 동작을 바꿀 수 있게 된다
 *
 * 🔴 CPO 명시: 이 테스트는 「production 로직을 benchmark 에 연결하자」는 뜻이 «아니다».
 *    반대로 **benchmark 가 Production 에 역으로 coupling 되지 않게** 실제 import
 *    graph 를 재는 것이다.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const CRAWLER_SRC = path.join(__dirname, "..", "..");
const BENCHMARK_DIR = path.join(CRAWLER_SRC, "discovery-benchmark");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full));
      continue;
    }
    if (entry.endsWith(".ts")) out.push(full);
  }
  return out;
}

/** 🔴 주석을 벗긴다 — 주석 안의 「discovery-benchmark」는 import 가 아니다.
 *  이 저장소가 여덟 번 걸린 함정이다. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/**
 * 🔴 `import`/`export ... from` «그리고» 동적 `import()` 와 `require()` 를 다 본다.
 *    정적 import 만 보면 `await import("../discovery-benchmark/x")` 로 우회된다.
 */
const SPECIFIER_RE =
  /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*)["']([^"']+)["']/g;

function importSpecifiers(file: string): string[] {
  const src = stripComments(readFileSync(file, "utf8"));
  const out: string[] = [];
  for (const m of src.matchAll(SPECIFIER_RE)) out.push(m[1]);
  return out;
}

/** 상대 specifier 를 절대 경로로 바꾼다. 비상대(패키지)는 null. */
function resolveRelative(fromFile: string, specifier: string): string | null {
  if (!specifier.startsWith(".")) return null;
  return path.resolve(path.dirname(fromFile), specifier);
}

const isInside = (target: string, dir: string) => {
  const rel = path.relative(dir, target);
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
};

describe("🔴 discovery-benchmark ↔ Production coupling (import graph)", () => {
  const benchmarkFiles = walk(BENCHMARK_DIR);
  const productionFiles = walk(CRAWLER_SRC).filter(
    (f) =>
      !isInside(f, BENCHMARK_DIR) &&
      // 🔴 테스트는 Production 런타임이 아니다 — benchmark 를 import 해도 된다.
      !f.split(path.sep).includes("__tests__"),
  );

  it("측정 대상이 실제로 잡혔다 — 0개를 통과로 읽지 않는다", () => {
    // 🔴 glob 이 0건이면 아래 모든 단언이 공짜로 통과한다. 그것이
    //    「테스트가 돌았다」로 읽히는 가장 흔한 거짓 PASS 다.
    expect(benchmarkFiles.length).toBeGreaterThan(5);
    expect(productionFiles.length).toBeGreaterThan(20);
    expect(productionFiles.some((f) => f.endsWith("product-url-facts.ts"))).toBe(true);
  });

  /**
   * 🔴 **이 단언이 이 파일의 전부다.** 2026-10-11 이전에는 이것이 FAIL 했다
   *    (`product-url-facts.ts` → `discovery-benchmark/url-resolver`).
   */
  it("🔴 Production 런타임 파일이 discovery-benchmark 를 import 하지 않는다", () => {
    const violations: string[] = [];
    for (const file of productionFiles) {
      for (const spec of importSpecifiers(file)) {
        const target = resolveRelative(file, spec);
        if (target && isInside(target, BENCHMARK_DIR)) {
          violations.push(`${path.relative(CRAWLER_SRC, file)} → ${spec}`);
        }
      }
    }
    expect(
      violations,
      "Production 이 실험 하니스를 import 한다. 하니스를 고치면 운영 동작이 바뀐다 — " +
        "공유가 필요하면 그 로직을 Production 쪽으로 «옮기고» benchmark 가 그것을 쓰게 한다 " +
        "(url-shape.ts 가 그 선례다).",
    ).toEqual([]);
  });

  /** 🔴 배럴 export 도 같이 막는다 — 기존 가드가 보던 축을 잃지 않는다. */
  it("crawler 배럴(index.ts)이 discovery-benchmark 를 노출하지 않는다", () => {
    const barrel = stripComments(readFileSync(path.join(CRAWLER_SRC, "index.ts"), "utf8"));
    expect(barrel).not.toContain("discovery-benchmark");
  });

  /**
   * 🔴 반대 방향은 **허용이고, 실제로 존재해야 한다.** benchmark 가 Production 을
   *    하나도 부르지 않으면 그것은 「기존 MI 를 재는 하니스」가 아니라 내 구현을
   *    재는 하니스다(types.ts 의 금지 사항). 그 사실도 숫자로 잠근다.
   */
  it("🟢 benchmark → Production 방향은 실제로 존재한다", () => {
    const inbound = new Set<string>();
    for (const file of benchmarkFiles) {
      if (file.split(path.sep).includes("__tests__")) continue;
      for (const spec of importSpecifiers(file)) {
        const target = resolveRelative(file, spec);
        if (target && !isInside(target, BENCHMARK_DIR) && isInside(target, CRAWLER_SRC)) {
          inbound.add(spec);
        }
      }
    }
    expect(inbound.size).toBeGreaterThan(0);
    // 🔴 url-shape 이동이 되돌려지면 이 단언이 깨진다.
    expect([...inbound]).toContain("../comparison-search/url-shape");
  });
});
