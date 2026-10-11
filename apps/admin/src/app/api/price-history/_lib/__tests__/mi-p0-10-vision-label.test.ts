/**
 * ════════════════════════════════════════════════════════════════════════════
 * MI-P0-10 STEP A — **독립 라벨러 게이트** (CPO 지시, 2026-10-12)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 기본값 SKIP. `MI_P0_02_LIVE=1` 일 때만 실제 Gemini 를 쓴다.
 *
 * MI-P0-09 가 멈춘 자리는 하나였다 — **41쌍이 `UNLABELABLE`** 이고, 라벨 없는
 * 후보를 SAME/DIFF 로 추정하면 측정이 무효가 된다(CPO 금지).
 *
 * ── 🟢 라벨러를 «만들지» 않는다. 리포에 이미 있다 ──────────────────────────
 *   `vision-evidence.ts` 의 `observeVision(imgA, imgB)` —
 *     · 사진 두 장만 본다 → **title·brand·품번과 완전히 독립**
 *     · 🔴 「이 모듈이 내는 값은 **어떤 판정에도 입력으로 들어가지 않는다**」
 *       (파일 머리 주석, P0-A.29-B CEO 승인) → 순환이 **구조적으로** 없다
 *     · DB 를 쓰지 않는 순수 경로다(캐시 조회는 별 함수)
 *
 * ── 🔴 그래도 Vision 은 «사람» 이 아니다. 그래서 먼저 게이트를 통과시킨다 ───
 *   리포는 「브랜드 2개 259쌍에서 FP 0 · FN 0」을 적어 뒀다. 🔴 그것은 **인용이고
 *   내 측정이 아니다.** 그래서 이 파일은 **CEO 라벨 쌍으로 직접 재현** 한다.
 *
 *   라벨 출처는 `cross-seller-matching.test.ts`(MATCHING-2.0-CORE, CEO 지시
 *   2026-09-13)다. 🔴 그 파일의 단언이 「코드 스냅샷」이 아니라 **사람 라벨** 인
 *   근거: ① 제목이 제품 언어로 판단을 적는다(「= 동일상품」·「색상이 충돌하면」·
 *   「후드 ↔ 하프집업」) ② 픽스처가 실제 응답 원문이다 ③ 「이미지가 아무리
 *   가까워도 그것만으로 동일상품 등급을 만들지 못한다」처럼 **정책** 을 단언한다.
 *
 * ── 🔴 임계값을 내가 고르지 않는다 ─────────────────────────────────────────
 *   `vision-evidence.ts` 의 PROMPT 가 구간을 «이미» 정의했다 —
 *     0-20 clearly different · 21-50 probably different · 51-79 uncertain ·
 *     80-100 clearly same
 *   그래서 사전등록 기준은 **SAME ≥ 80 · DIFF ≤ 50** 이다. 결과를 보고
 *   임계값을 옮기면 그건 측정이 아니라 맞추기다.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { productFactsFromShopifyProduct, productFactsFromSmallableHtml } from "@commerce/crawler";
import { observeVision } from "../vision-evidence";
import type { ProductFacts } from "@commerce/shared";

const LIVE = process.env.MI_P0_02_LIVE === "1";
const OUT_DIR = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");
const HERE = path.dirname(fileURLToPath(import.meta.url));
// 🔴 __tests__ → _lib → price-history → api → app → src → admin → apps → root = 8단계.
//    9단계로 썼다가 ENOENT 가 났다 — 경로는 세어서 적는다.
const REPO_ROOT = path.resolve(HERE, "../".repeat(8));
const FIXTURES = path.join(REPO_ROOT, "packages/crawler/src/__tests__/fixtures");

/** 🔴 `scripts/.env` 를 직접 읽는다(기존 하니스와 같은 방식). 값은 절대 출력하지 않는다. */
function loadGeminiKey(): void {
  if (process.env.GEMINI_API_KEY?.trim()) return;
  const p = path.join(REPO_ROOT, "scripts", ".env");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const hit = /^\s*GEMINI_API_KEY\s*=\s*(.+?)\s*$/.exec(line);
    if (hit) process.env.GEMINI_API_KEY = hit[1].replace(/^["']|["']$/g, "");
  }
}

const smallable = (file: string, id: string): ProductFacts => {
  const f = productFactsFromSmallableHtml(readFileSync(path.join(FIXTURES, file), "utf8"), id);
  if (!f) throw new Error(`smallable fixture 읽기 실패: ${file}`);
  return f;
};
const bobo = (code: string): ProductFacts =>
  productFactsFromShopifyProduct(
    JSON.parse(readFileSync(path.join(FIXTURES, `bobochoses-${code.toLowerCase()}.json`), "utf8")),
    "bobochoses.com",
  );

/** Shopify 는 `//cdn.shopify.com/...` 형태(프로토콜 상대)로 내려준다. */
const absolute = (u: string | null | undefined): string | null =>
  !u ? null : u.startsWith("//") ? `https:${u}` : u;

/**
 * 🔴 CEO 라벨 쌍. **`cross-seller-matching.test.ts` 의 `it()` 제목에 적힌 판단만**
 *    옮겼다. 제목이 애매한 쌍은 «일부러 뺐다» — 예: `430700 ↔ B226AC112` 는
 *    「상품명에 겹치는 말이 없어 동일상품으로 올리지 않는다」인데, 그것은 **코드
 *    동작 설명** 이고 사람이 「다른 상품이다」라고 말한 것이 아니다.
 */
const LABELED: { id: string; label: "SAME" | "DIFF"; a: () => ProductFacts; b: () => ProductFacts; basis: string }[] = [
  { id: "A 430701↔B226AC114", label: "SAME", a: () => smallable("smallable-430701-product.html", "430701"), b: () => bobo("B226AC114"), basis: "쌍A 「= 동일상품」" },
  { id: "D 430632↔B226AC018", label: "SAME", a: () => smallable("smallable-430632-product.html", "430632"), b: () => bobo("B226AC018"), basis: "쌍D 「= 동일상품」" },
  { id: "F 430651↔B226AC043", label: "SAME", a: () => smallable("smallable-430651-fr.html", "430651"), b: () => bobo("B226AC043"), basis: "「근거가 여섯 축에서 맞아 동일상품으로 올라온다」" },
  { id: "C B226AC114↔B226AD013", label: "DIFF", a: () => bobo("B226AC114"), b: () => bobo("B226AD013"), basis: "쌍C 「= 다른 상품 가능성」" },
  { id: "E 430632↔B226AD013", label: "DIFF", a: () => smallable("smallable-430632-product.html", "430632"), b: () => bobo("B226AD013"), basis: "쌍E 「= 다른 상품 가능성」" },
  { id: "G 430651↔B226AC042", label: "DIFF", a: () => smallable("smallable-430651-fr.html", "430651"), b: () => bobo("B226AC042"), basis: "「색상이 충돌하면 … 동일상품이 되지 않는다」" },
  { id: "H 430701↔B226AC049", label: "DIFF", a: () => smallable("smallable-430701-product.html", "430701"), b: () => bobo("B226AC049"), basis: "「쌍B … 는 SAME이 아니다」(후드 ↔ 하프집업)" },
];

/** 🔴 사전등록 임계값. PROMPT 의 구간 정의를 그대로 쓴다. */
const SAME_MIN = 80;
const DIFF_MAX = 50;

describe.skipIf(!LIVE)("🔴 MI-P0-10 STEP A — Vision 이 CEO 라벨을 재현하는가", () => {
  it(
    "사람 라벨 쌍에 observeVision 을 돌려 사전등록 구간과 대조한다",
    async () => {
      loadGeminiKey();
      mkdirSync(OUT_DIR, { recursive: true });
      const rows: unknown[] = [];
      let agree = 0, disagree = 0, unmeasured = 0;

      for (const p of LABELED) {
        const fa = p.a(), fb = p.b();
        const ia = absolute(fa.imageUrls[0]), ib = absolute(fb.imageUrls[0]);
        const o = await observeVision(ia, ib);
        // 🔴 「점수 없음」을 「다르다」로 읽지 않는다 — 별 칸으로 센다.
        const predicted = o.score == null ? null : o.score >= SAME_MIN ? "SAME" : o.score <= DIFF_MAX ? "DIFF" : "UNCERTAIN";
        const ok = predicted === p.label;
        if (predicted === null) unmeasured++;
        else if (ok) agree++;
        else disagree++;
        rows.push({
          pair: p.id, humanLabel: p.label, basis: p.basis,
          visionStatus: o.status, visionScore: o.score, visionReason: o.reason,
          failureDetail: o.failureDetail, predicted, agrees: ok,
          imagesPresent: { a: !!ia, b: !!ib },
        });
        // eslint-disable-next-line no-console
        console.log(`${p.id.padEnd(26)} human=${p.label.padEnd(4)} score=${String(o.score ?? "-").padStart(3)} → ${String(predicted).padEnd(9)} ${ok ? "🟢" : "🔴"} ${o.status}`);
      }

      const report = {
        scope: {
          note: "🔴 사람 라벨 sample N=7 (SAME 3 · DIFF 4). 전수가 아니다.",
          labelSource: "cross-seller-matching.test.ts — MATCHING-2.0-CORE, CEO 지시 2026-09-13",
          citedButNotMeasuredHere: "리포 주석의 「브랜드 2개 259쌍 FP 0 · FN 0」은 인용이고 내 측정이 아니다",
          preRegisteredThresholds: { SAME_MIN, DIFF_MAX, source: "vision-evidence.ts PROMPT 의 구간 정의" },
        },
        agree, disagree, unmeasured, rows,
      };
      // eslint-disable-next-line no-console
      console.log("\n" + JSON.stringify(report, null, 2));

      // 🔴 방향을 단언하지 않는다 — 게이트 판정은 CTO 가 숫자를 보고 한다.
      expect(rows).toHaveLength(LABELED.length);
      writeFileSync(path.join(OUT_DIR, "mi-p0-10-gate.json"), JSON.stringify(report, null, 1), "utf8");
    },
    30 * 60 * 1000,
  );

  /**
   * ── STEP B — 실제 Discovery 후보에 독립 라벨을 붙여 FN/FP 를 «센다» ────────
   * 🔴 라벨 가능한 쌍만 센다. 이미지가 없는 쌍을 「다르다」로 읽지 않는다.
   * 🔴 그리고 판정은 MI-P0-09 가 **운영 `withConfidence` 로** 낸 것을 그대로 쓴다 —
   *    여기서 verdict 를 다시 만들지 않는다.
   */
  it(
    "이미지 양쪽 보유 쌍에 Vision 라벨을 붙여 Identity 와 교차한다",
    async () => {
      loadGeminiKey();
      const pp = path.join(OUT_DIR, "mi-p0-09-pairs.json");
      if (!existsSync(pp)) throw new Error(`선행 측정 없음: ${pp}`);
      interface P {
        arm: string; originHost: string; originTitle: string; candidateTitle: string; candidateUrl: string;
        ownerVerdict: string | null; verdict: string; blockers: string[]; corePoints: number;
        independent: { codeExact: boolean; label: string };
        soleBlockerRemovalYieldsSame: string | null;
        originImageUrl: string | null; candidateImageUrl: string | null;
      }
      const all = (JSON.parse(readFileSync(pp, "utf8")) as P[]).filter((x) => x.arm === "WITH_FALLBACK");
      // 🔴 같은 (origin, candidate) 쌍이 Level 중복으로 여러 번 오지 않도록 한 번 더 접는다.
      const seen = new Set<string>();
      const target = all.filter((x) => {
        if (!x.originImageUrl || !x.candidateImageUrl) return false;
        const k = `${x.originTitle} ||| ${x.candidateUrl}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });

      const rows: Record<string, unknown>[] = [];
      let n = 0;
      for (const x of target) {
        const o = await observeVision(absolute(x.originImageUrl), absolute(x.candidateImageUrl));
        const vision = o.score == null ? null : o.score >= SAME_MIN ? "SAME" : o.score <= DIFF_MAX ? "DIFF" : "UNCERTAIN";
        const idSame = x.verdict === "SAME";
        rows.push({
          originHost: x.originHost, candidateUrl: x.candidateUrl,
          originTitle: x.originTitle, candidateTitle: x.candidateTitle,
          identityVerdict: x.verdict, blockers: x.blockers, corePoints: x.corePoints,
          codeExact: x.independent.codeExact, soleBarrier: x.soleBlockerRemovalYieldsSame,
          visionStatus: o.status, visionScore: o.score, visionReason: o.reason, visionLabel: vision,
          /** 🔴 같은 사진을 양쪽이 쓰면 Vision 과제가 쉬워진다 — 그 사실을 같이 적는다. */
          sameImageUrl: absolute(x.originImageUrl) === absolute(x.candidateImageUrl),
          cross: vision == null ? "LABEL_UNAVAILABLE"
               : vision === "UNCERTAIN" ? "LABEL_UNCERTAIN"
               : idSame && vision === "SAME" ? "🟢 TP"
               : idSame && vision === "DIFF" ? "🔴 FP(Identity 가 SAME 인데 사진은 다르다)"
               : !idSame && vision === "SAME" ? "🔴 FN(사진은 같은데 Identity 가 SAME 이 아니다)"
               : "🟢 TN",
        });
        if (++n % 10 === 0) console.log(`  …${n}/${target.length}`); // eslint-disable-line no-console
      }

      const count = (xs: Record<string, unknown>[], key: (x: Record<string, unknown>) => string) => {
        const t: Record<string, number> = {};
        for (const x of xs) t[key(x)] = (t[key(x)] ?? 0) + 1;
        return Object.fromEntries(Object.entries(t).sort((a, b) => b[1] - a[1]));
      };
      const fn = rows.filter((r) => String(r.cross).startsWith("🔴 FN"));
      const report = {
        scope: {
          note: "🔴 라벨 가능한 쌍만. MI-P0-09 의 WITH_FALLBACK 177쌍 중 이미지 양쪽 보유 + 중복 제거분.",
          labelable: target.length, ofTotalPairs: all.length,
          warning: "🔴 이미지 없는 쌍은 «라벨 불가» 다. 「다르다」가 아니다.",
        },
        confusion: count(rows, (r) => String(r.cross)),
        byIdentityVerdict: count(rows, (r) => `${r.identityVerdict} × ${r.visionLabel}`),
        sameImageUrlPairs: rows.filter((r) => r.sameImageUrl).length,
        falseNegatives: fn.map((r) => ({
          originTitle: r.originTitle, candidateTitle: r.candidateTitle, candidateUrl: r.candidateUrl,
          identityVerdict: r.identityVerdict, blockers: r.blockers, corePoints: r.corePoints,
          codeExact: r.codeExact, soleBarrier: r.soleBarrier, visionScore: r.visionScore,
        })),
        falsePositives: rows.filter((r) => String(r.cross).startsWith("🔴 FP")).map((r) => ({
          originTitle: r.originTitle, candidateTitle: r.candidateTitle, candidateUrl: r.candidateUrl,
          visionScore: r.visionScore, visionReason: r.visionReason, blockers: r.blockers,
        })),
      };
      writeFileSync(path.join(OUT_DIR, "mi-p0-10-crossed.json"), JSON.stringify({ ...report, rows }, null, 1), "utf8");
      // eslint-disable-next-line no-console
      console.log("\n" + JSON.stringify(report, null, 2));
      expect(rows.length).toBe(target.length);
    },
    30 * 60 * 1000,
  );
});
