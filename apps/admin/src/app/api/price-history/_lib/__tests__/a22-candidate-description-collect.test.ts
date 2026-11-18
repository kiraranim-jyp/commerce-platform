/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 A 과제 — **A군 22건 후보 설명문 수집 + 식별 축 «관찰»**(CPO 승인 2026-11-19)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **이것은 정확도 개선 실험이 «아니다».** 후보측 상세설명 원문을 확보했을 때
 *    KIDS 식별 축이 **어떻게 채워지는지** 보는 **관찰 실험** 이다(CPO 명시).
 *    ⟹ verdict 재계산 **0** · 정밀도 산출 **0** · SAME 판정 변경 **0**.
 *
 * 🔴 **승인 범위(엄격)**
 * ```
 * 대상      A군 GT=SAME 16 + GT=DIFFERENT 6 = **22**  (UNCERTAIN/UNDECIDED 제외)
 * 제외      main-story 3(제외 브랜드) · wconcept 1(robots 전면차단) ·
 *           trenbe 3(CASE-01 이 HTTP 429 → TimeoutError 로 확정)
 * HTTP      **최대 22건** — 🔴 성공 «보장» 수가 아니다. 못 받은 것은 그대로 기록한다
 * 금지      UA 변경 · 재시도 정책 변경 · 접근 제한 우회 · DB/migration ·
 *           운영 연결 · 기존 산출물 덮어쓰기 · 사용자 파일/보호 문서 수정
 * ```
 * 🟢 **재사용** — 축 추출/비교는 B16 과 **같은 함수** 다(`extractKeywords` · `compareAxis` ·
 *    `ALL_AXES`). 🔴 그 모듈(`mi-reeval-shadow-keywords.ts`)은 **사용자 untracked 파일**
 *    이라 **읽기(import)만** 하고 한 글자도 고치지 않았다.
 * 🟢 **fetch 는 운영 owner** 를 쓴다(`fetchPlainHtmlWithFinalUrl`) ⟹ CASE-01 이 심은
 *    `[PLAIN-HTML-FAIL]` 이 **429 · 404 · TimeoutError 를 구분해 찍는다**(새 fetcher 0).
 *
 * ── 실행 ──
 * ```
 * A22_COLLECT=1 npx vitest run src/app/api/price-history/_lib/__tests__/a22-candidate-description-collect.test.ts
 * ```
 * 🔴 flag 가 없으면 **네트워크 0** 이다(회귀에서 외부를 때리지 않는다).
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fetchPlainHtmlWithFinalUrl } from "@commerce/crawler/src/shopify-product-json";
import {
  ALL_AXES,
  compareAxis,
  extractKeywords,
  type ExtractOptions,
} from "./mi-reeval-shadow-keywords";

const LIVE = process.env.A22_COLLECT === "1";
const DIR = path.join(
  process.cwd(), "src", "app", "api", "price-history", "_lib", "__tests__", "preserved",
);
const COORDS = path.join(DIR, "a33-candidate-coordinates.json");
/** 🔴 **전용 보존 파일** 이다 — 기존 산출물을 덮어쓰지 않는다(쓰기 주체는 이 파일 하나). */
const OUT = path.join(DIR, "a22-candidate-descriptions.json");
const SHADOW = path.join(process.cwd(), "..", "..", "docs", "MI-REEVAL-STEP5-SHADOW.json");

type Pair = { pairId: string; domain: string; originUrl: string; candidateUrl: string };
type ShadowPair = Pair & { priorGt?: string; ceoLatest?: string };

const EXCLUDED_HOSTS = ["main-story.com", "www.wconcept.co.kr", "global.trenbe.com"] as const;
const hostOf = (u: string) => {
  try {
    return new URL(u).hostname;
  } catch {
    return "(unparsed)";
  }
};
const gtOf = (p: ShadowPair) => p.ceoLatest ?? p.priorGt ?? "(none)";

/** 🟢 대상 선정은 **좌표 사본 + GT** 로만 한다 — 손으로 URL 을 고르지 않는다. */
function selectTargets(): { pair: Pair; gt: string }[] {
  const live = (JSON.parse(readFileSync(SHADOW, "utf8")) as { pairsA: ShadowPair[] }).pairsA;
  return live
    .filter((p) => !EXCLUDED_HOSTS.includes(hostOf(p.candidateUrl) as never))
    .filter((p) => gtOf(p) === "SAME" || gtOf(p) === "DIFFERENT")
    .map((p) => ({
      pair: { pairId: p.pairId, domain: p.domain, originUrl: p.originUrl, candidateUrl: p.candidateUrl },
      gt: gtOf(p),
    }));
}

/**
 * 🔴 **추출 필드만** 저장한다 — 원시 HTML 을 저장하지 않는다(사용자 제약
 *    「불필요한 상품 원문 전체 저장 금지」 · B군 선례 `{title, description}` 와 같은 모양).
 */
function titleFromHtml(html: string): string | null {
  const og = /<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']+)["']/i.exec(html)?.[1];
  const t = /<title[^>]*>([\s\S]{0,300}?)<\/title>/i.exec(html)?.[1];
  const v = (og ?? t ?? "").replace(/\s+/g, " ").trim();
  return v.length > 0 ? v : null;
}

/** 🟢 설명문은 **선언된 자리** 에서만 읽는다 — 본문 전체를 긁지 않는다. */
function descriptionFromHtml(html: string): string | null {
  for (const re of [
    /<meta[^>]+name=["']description["'][^>]*content=["']([^"']{20,})["']/i,
    /<meta[^>]+property=["']og:description["'][^>]*content=["']([^"']{20,})["']/i,
  ]) {
    const v = re.exec(html)?.[1]?.replace(/\s+/g, " ").trim();
    if (v && v.length >= 20) return v;
  }
  /** 🟢 JSON-LD `Product.description` — 구조화 칸이고 본문 스크래핑이 아니다. */
  const ld = /"description"\s*:\s*"((?:[^"\\]|\\.){20,})"/i.exec(html)?.[1];
  if (ld) {
    try {
      const v = JSON.parse(`"${ld}"`).replace(/\s+/g, " ").trim();
      if (v.length >= 20) return v;
    } catch {
      /* 🔴 파싱 실패를 지어내지 않는다 — null 로 둔다. */
    }
  }
  return null;
}

const GUARDS_OFF: ExtractOptions = {};
const GUARDS_ON: ExtractOptions = { useObserved: true };

describe("A 과제 — A군 22건 대상 선정(네트워크 0)", () => {
  it("S-1 🟢 대상이 **22건** 이고 GT 는 **SAME 16 · DIFFERENT 6** 이다", () => {
    const t = selectTargets();
    expect(t).toHaveLength(22);
    expect(t.filter((x) => x.gt === "SAME")).toHaveLength(16);
    expect(t.filter((x) => x.gt === "DIFFERENT")).toHaveLength(6);
  });

  it("S-2 🔴 제외 셋이 **하나도 섞이지 않았다**", () => {
    const hosts = selectTargets().map((x) => hostOf(x.pair.candidateUrl));
    for (const h of EXCLUDED_HOSTS) {
      expect(hosts, `🔴 ${h} 가 대상에 섞였다`).not.toContain(h);
    }
  });

  it("S-3 🔴 UNCERTAIN · UNDECIDED 가 **제외됐다**", () => {
    const gts = new Set(selectTargets().map((x) => x.gt));
    expect([...gts].sort()).toEqual(["DIFFERENT", "SAME"]);
  });

  /**
   * 🔴🔴 **자기참조 함정을 피한다 — «실행 구간» 만 본다.**
   *
   * 1차 구현이 이 파일 **전체** 를 훑었고 **제 계약이 제 계약 문자열을 잡아 FAIL** 했다
   * (금지 토큰 목록 자체가 소스에 있으니 당연히 `toContain` 이 참이 된다).
   * 🟢 금지/허용을 가르는 선은 `const MAX_GET = 22;` 다 — 그 뒤가 **실행 코드** 이고
   *    앞은 **대상 선정과 계약** 이다. 🔴 이 트랙이 여러 번 밟은 「엉뚱한 구간 slice」의
   *    반대쪽 실수이므로 구간 경계를 **단언으로 같이 고정** 한다.
   */
  const execSection = () => {
    const full = readFileSync(
      path.join(process.cwd(), "src", "app", "api", "price-history", "_lib", "__tests__",
        "a22-candidate-description-collect.test.ts"),
      "utf8",
    );
    /**
     * 🔴🔴 **주석을 «먼저» 벗긴다.** 1차 구현이 원문에서 `indexOf` 를 했고 **주석 안의
     *    언급** 을 먼저 집어 구간이 밀렸다 — 그래서 또 FAIL 했다. 메모
     *    `source-scan-must-strip-comments` 의 그 규칙을 순서까지 지킨다.
     */
    const bare = full.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
    /**
     * 🔴 **`lastIndexOf` 다.** `indexOf` 는 이 헬퍼 «안의» 문자열 리터럴을 먼저 잡아
     *    구간이 또 밀렸다(두 번째 자기참조). 실제 모듈 선언은 이 describe 뒤에 **하나뿐**
     *    이므로 마지막 등장이 그것이다.
     */
    const at = bare.lastIndexOf("const MAX_GET = 22;");
    expect(at, "🔴 상한 선언이 사라졌다 — 구간을 가를 수 없다").toBeGreaterThan(0);
    return { full, exec: bare.slice(at) };
  };

  it("S-4 🔴🔴 HTTP 상한이 **22** 이고 실행 구간에 **우회 수단이 없다**", () => {
    const { full, exec } = execSection();
    expect(full).toContain("MAX_GET = 22");
    expect(exec).toContain("slice(0, MAX_GET)");
    /** 🔴 UA 변경·우회·재시도 금지(CASE-01 `C-4` 와 같은 축). */
    for (const banned of ["User-Agent", "UA_POOL", "Mozilla", "maxHeaderSize", "AbortSignal"]) {
      expect(exec, `🔴 ${banned} — 접근 제한 우회·재시도 변경 금지`).not.toContain(banned);
    }
    /** 🟢 fetch 는 **운영 owner 하나** 만 쓴다(새 fetcher 0). */
    expect(exec).toContain("fetchPlainHtmlWithFinalUrl(");
    expect(exec).not.toContain("fetch(");
  });

  it("S-5 🔴🔴 기존 산출물 **덮어쓰기 0**(쓰기는 전용 파일 하나)", () => {
    const { exec, full } = execSection();
    expect((exec.match(/writeFileSync\(/g) ?? []).length).toBe(1);
    expect(exec).toContain("writeFileSync(OUT");
    /**
     * 🔴🔴 **내 단언이 틀렸던 자리 — 고치고 기록한다.**
     *
     * 1차는 실행 구간에 기존 산출물 «이름» 이 없는지 봤고 FAIL 했다. 걸린 것은 쓰기
     * 대상이 아니라 산출물의 **출처 기록**(`source: "…STEP5-SHADOW.json#pairsA"`)이었다 —
     * 🟢 그것은 **있어야 하는 값** 이다(분모 추적 가능성 · CPO 보고 항목 ⑥).
     * ⟹ 🟢 그래서 보는 것을 **「쓰기 «대상»」** 으로 좁혔다. 쓰기는 `OUT` 하나이고
     *    `OUT` 은 `preserved/` 의 **전용 파일** 이다(경로 선언을 같이 단언한다).
     */
    expect(exec).not.toMatch(/writeFileSync\(\s*(?!OUT)/);
    expect(full).toContain('const OUT = path.join(DIR, "a22-candidate-descriptions.json")');
    expect(full).toContain('"preserved",');
  });
});

const MAX_GET = 22;

describe("A 과제 — 수집 + 식별 축 관찰", () => {
  it.skipIf(!LIVE)(
    "C-1 🔵 22건 수집 → 추출 필드 보존 → 축 집계(GT 별)",
    async () => {
      const targets = selectTargets().slice(0, MAX_GET);
      expect(targets).toHaveLength(22);
      /** 🟢 원본측 설명문은 **이미 있다** — 좌표 사본과 shadow 에서 읽는다(재수집 0). */
      const rows: Record<string, unknown>[] = [];
      let gets = 0;

      for (const { pair, gt } of targets) {
        gets += 1;
        const fetched = await fetchPlainHtmlWithFinalUrl(pair.candidateUrl);
        /** 🔴 실패를 성공으로 만들지 않는다 — 사유는 `[PLAIN-HTML-FAIL]` 이 찍는다. */
        const title = fetched ? titleFromHtml(fetched.html) : null;
        const description = fetched ? descriptionFromHtml(fetched.html) : null;
        rows.push({
          pairId: pair.pairId,
          host: hostOf(pair.candidateUrl),
          gt,
          reached: fetched !== null,
          /** 🔴 **확보 여부를 분리한다** — 도달했어도 설명문이 없을 수 있다. */
          hasDescription: typeof description === "string",
          descriptionLength: description?.length ?? 0,
          title,
          description,
        });
      }

      expect(gets, "🔴 상한을 넘었다").toBeLessThanOrEqual(MAX_GET);

      /** 🟢 축 집계 — B16 과 **같은 함수** · 가드 ON/OFF 둘 다. */
      const usable = rows.filter((r) => r.hasDescription);
      const tally = (opts: ExtractOptions, which: string) => {
        const t: Record<string, Record<string, number>> = {};
        for (const r of usable) {
          const o = extractKeywords(
            { title: null, description: null, code: String(r.pairId).split("|")[0] ?? null },
            opts,
          );
          const c = extractKeywords(
            { title: r.title as string | null, description: r.description as string | null },
            opts,
          );
          for (const axis of ALL_AXES) {
            const st = compareAxis(axis, o, c).status;
            t[axis] ??= {};
            t[axis][st] = (t[axis][st] ?? 0) + 1;
          }
        }
        console.log(`[A22-AXES ${which}] ${JSON.stringify(t)}`);
        return t;
      };

      const out = {
        note: "🔴 관찰 실험이다 — verdict 재계산 0 · 정밀도 0 · SAME 판정 변경 0. 추출 필드만 저장(원시 HTML 0).",
        source: "docs/MI-REEVAL-STEP5-SHADOW.json#pairsA (GT=SAME 16 + DIFFERENT 6)",
        attempted: gets,
        reached: rows.filter((r) => r.reached).length,
        withDescription: usable.length,
        byGt: {
          SAME: { attempted: rows.filter((r) => r.gt === "SAME").length, withDescription: usable.filter((r) => r.gt === "SAME").length },
          DIFFERENT: { attempted: rows.filter((r) => r.gt === "DIFFERENT").length, withDescription: usable.filter((r) => r.gt === "DIFFERENT").length },
        },
        axisTallyGuardsOff: tally(GUARDS_OFF, "guards-off"),
        axisTallyGuardsOn: tally(GUARDS_ON, "guards-on"),
        rows,
      };
      writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`);
      console.log(
        `[A22-COLLECT] ${JSON.stringify({
          attempted: out.attempted, reached: out.reached, withDescription: out.withDescription, byGt: out.byGt,
        })}`,
      );
      expect(out.attempted).toBe(22);
    },
    600_000,
  );

  /** 🟢 수집 뒤에만 의미가 있다 — 없으면 조용히 건너뛴다(거짓 PASS 를 만들지 않는다). */
  it.skipIf(!existsSync(OUT))("C-2 🟢 보존 파일에 **원시 HTML 이 없다**", () => {
    const raw = readFileSync(OUT, "utf8");
    expect(raw).not.toContain("<html");
    expect(raw).not.toContain("<script");
    expect(raw).not.toContain("<!DOCTYPE");
    const d = JSON.parse(raw) as { attempted: number; coords?: unknown };
    expect(d.attempted).toBeLessThanOrEqual(MAX_GET);
  });

  it("C-3 🔴 좌표 사본이 **그대로** 다(수집이 좌표를 바꾸지 않는다)", () => {
    const c = JSON.parse(readFileSync(COORDS, "utf8")) as { count: number };
    expect(c.count).toBe(33);
  });
});
