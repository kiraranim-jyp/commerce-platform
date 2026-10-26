import { describe, expect, it } from "vitest";
import { factsFromProductUrl } from "@commerce/crawler";
import { compareModelCode } from "@commerce/crawler/src/comparison-search/model-code";
import { compareCrossSellerProducts } from "@commerce/crawler/src/comparison-search/cross-seller";
import { deriveMatchTruth } from "@commerce/crawler/src/comparison-search/match-truth";
import type { ProductFacts } from "@commerce/shared";
import { SAME05_PAIRS } from "./core-same05-gt";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 CORE-SAME-SPRINT-06 — **Identity 영향 matrix**(CPO 추가 성공기준)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **`DIFFERENT → SAME` 이 하나라도 나오면 즉시 STOP** 이다(CPO 문장).
 *
 * ── 🔴 어떻게 before/after 를 재는가 ──────────────────────────────────────────
 * ```
 * 라이브를 **한 번만** 수집하고(HTTP 중복 0) 같은 facts 로 두 벌을 만든다:
 *   AFTER   운영 산출 그대로(= PLAIN_HTML 에 description 이 공급된 상태)
 *   BEFORE  **description 을 비운** 복제본 + 품번 보강을 **되돌린** 상태
 * 🔴 「되돌린다」가 핵심이다 — 운영 산출의 `brandModelCode` 에는 **이미 보강이
 *    적용돼 있어서** description 만 비우면 BEFORE 가 되지 않는다(SPRINT-04 교훈).
 * 🟢 그래서 BEFORE 는 **보강이 만든 값만** 되돌린다 — 그 판별식은 하나다:
 *    「설명문의 단일 품번 == 산출 품번」이면 **그 값은 보강이 넣은 것** 이다.
 *    🔴 단 Shopify 경로는 라벨/slug 생산자가 **먼저** 품번을 넣을 수 있으므로
 *       **PLAIN_HTML 경로에서만** 되돌린다(이 Sprint 가 바꾼 경로가 그것뿐이다).
 * ```
 * 🔴 운영 판정 순서를 **그대로** 쓴다(복제식 금지) —
 *    `compareCrossSellerProducts` → `compareModelCode` → `deriveMatchTruth`.
 */

const CODE_RE = () => /\bB\d{3}[A-Z]{2}\d{3}\b/gi;
const codesIn = (s: string | null | undefined): string[] =>
  s ? [...new Set((s.match(CODE_RE()) ?? []).map((x) => x.toUpperCase()))] : [];

const pad = (s: string, n: number) => s + " ".repeat(Math.max(0, n - [...s].length));
const padL = (s: string, n: number) => " ".repeat(Math.max(0, n - [...s].length)) + s;
const host = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "?";
  }
};

const LIVE = process.env.CORE_SPRINT06_LIVE === "1";

describe.skipIf(!LIVE)("CORE-SAME-SPRINT-06 — Identity 영향 matrix", () => {
  it(
    "공급 전/후 verdict 전이를 재고 DIFFERENT→SAME 이 0 임을 단언한다",
    async () => {
      const urls = [...new Set(SAME05_PAIRS.map((p) => p.url))];
      interface Live {
        url: string;
        status: string;
        fetchPath: string;
        facts: ProductFacts | null;
      }
      const live = new Map<string, Live>();
      for (const url of urls) {
        try {
          const r = (await factsFromProductUrl(url)) as unknown as Record<string, unknown>;
          const cand = r.candidate as Record<string, unknown> | undefined;
          live.set(url, {
            url,
            status: String(r.status ?? "?"),
            fetchPath: String(r.fetchPath ?? "UNRESOLVED"),
            facts: (cand?.facts as ProductFacts | undefined) ?? null,
          });
        } catch (e) {
          live.set(url, { url, status: `THREW(${(e as Error).message.slice(0, 24)})`, fetchPath: "UNRESOLVED", facts: null });
        }
      }

      /** 🔴 BEFORE 를 만든다 — description 제거 **그리고** 보강이 넣은 품번 되돌리기. */
      function toBefore(l: Live): ProductFacts | null {
        if (!l.facts) return null;
        const f = l.facts;
        if (l.fetchPath !== "PLAIN_HTML") return f; // 🔴 이 Sprint 가 안 바꾼 경로는 그대로
        const fromDesc = codesIn(f.description);
        const addedByRecovery = fromDesc.length === 1 && f.brandModelCode === fromDesc[0];
        return { ...f, description: null, brandModelCode: addedByRecovery ? null : f.brandModelCode };
      }

      /** 🟢 운영 순서 그대로. */
      function judge(origin: ProductFacts, cand: ProductFacts) {
        const cross = compareCrossSellerProducts(origin, cand);
        const code = compareModelCode(origin.brandModelCode, cand.brandModelCode ?? null);
        const truth = deriveMatchTruth("low", code, cross.verdict, cross.blockers, cross.conflicts, !cand.colorText);
        return { verdict: String(cross.verdict), code: String(code), truth: String(truth) };
      }

      /** 🔴 SAME 축은 **운영 verdict** 하나다(「SAME 인가」를 내가 새로 정의하지 않는다). */
      const isSame = (v: string) => v === "SAME";

      interface Transition {
        id: string;
        host: string;
        path: string;
        human: string;
        before: string;
        after: string;
        codeBefore: string;
        codeAfter: string;
      }
      const rows: Transition[] = [];
      for (const p of SAME05_PAIRS) {
        const l = live.get(p.url);
        if (!l?.facts) continue;
        const before = toBefore(l) as ProductFacts;
        const a = judge(p.origin, l.facts);
        const b = judge(p.origin, before);
        rows.push({
          id: p.id,
          host: host(p.url),
          path: l.fetchPath,
          human: p.human,
          before: b.verdict,
          after: a.verdict,
          codeBefore: b.code,
          codeAfter: a.code,
        });
      }

      /** ── 공급 분모 ───────────────────────────────────────────────────── */
      const htmlRows = rows.filter((r) => r.path === "PLAIN_HTML");
      const htmlLive = [...live.values()].filter((l) => l.fetchPath === "PLAIN_HTML");
      const htmlOk = htmlLive.filter((l) => l.facts);
      const supplied = htmlOk.filter((l) => l.facts?.description);
      console.log(`\n${"═".repeat(100)}`);
      console.log("  [공급] PLAIN_HTML description");
      console.log(`${"═".repeat(100)}`);
      console.log(`  PLAIN_HTML URL             ${htmlLive.length}`);
      console.log(`  facts 확보                 ${htmlOk.length}`);
      console.log(`  🟢 description 공급 성공     **${supplied.length}**/${htmlOk.length}`);
      for (const l of htmlOk) {
        const d = l.facts?.description;
        console.log(
          `     ${pad(host(l.url), 24)}${d ? `🟢 ${String(d.length).padStart(5)}자` : "🔴 없음(JSON-LD Product.description 부재)"}`,
        );
      }

      /** ── Identity 영향 matrix ───────────────────────────────────────── */
      const m = { ss: 0, sd: 0, dd: 0, ds: 0, uu: 0, uc: 0 };
      for (const r of rows) {
        const b = isSame(r.before);
        const a = isSame(r.after);
        if (r.human === "SAME") b && a ? m.ss++ : b && !a ? m.sd++ : 0;
        if (r.human === "DIFFERENT") !b && !a ? m.dd++ : !b && a ? m.ds++ : 0;
        if (r.human === "UNCERTAIN") (r.before === r.after ? m.uu++ : m.uc++);
      }
      /** 🔴 system 전이도 **따로** 센다 — human 라벨과 섞으면 전이를 못 본다. */
      const sysSameToDiff = rows.filter((r) => isSame(r.before) && !isSame(r.after));
      const sysDiffToSame = rows.filter((r) => !isSame(r.before) && isSame(r.after));

      console.log(`\n${"═".repeat(100)}`);
      console.log("  [Identity 영향] 🔴 DIFFERENT → SAME 은 **0 이어야 한다**");
      console.log(`${"═".repeat(100)}`);
      console.log(`  ${pad("효과", 34)}건수`);
      console.log(`  ${pad("human SAME → system SAME 유지", 34)}${padL(String(m.ss), 4)}`);
      console.log(`  ${pad("human SAME → system 이탈", 34)}${padL(String(m.sd), 4)}`);
      console.log(`  ${pad("human DIFFERENT → 차단 유지", 34)}${padL(String(m.dd), 4)}`);
      console.log(`  ${pad("🔴 human DIFFERENT → SAME 누출", 34)}${padL(String(m.ds), 4)}`);
      console.log(`  ${pad("UNCERTAIN 불변 / 변화", 34)}${padL(`${m.uu} / ${m.uc}`, 6)}`);
      console.log(`\n  system 전이(human 무관)`);
      console.log(`     SAME → 비SAME   ${sysSameToDiff.length}`);
      console.log(`     비SAME → SAME   ${sysDiffToSame.length}`);
      for (const r of [...sysSameToDiff, ...sysDiffToSame]) {
        console.log(`       ${pad(r.id, 8)}${pad(r.host, 22)}${pad(r.path, 14)}${r.before} → ${r.after}  [human ${r.human}]`);
      }

      /** ── MODEL_CODE ─────────────────────────────────────────────────── */
      const codeNew = htmlRows.filter((r) => r.codeBefore !== r.codeAfter);
      const conflictAfter = rows.filter((r) => r.codeAfter === "conflict");
      const conflictBefore = rows.filter((r) => r.codeBefore === "conflict");
      console.log(`\n${"═".repeat(100)}`);
      console.log("  [MODEL_CODE] 🔴 보호를 «완화하지 않았다» — 충돌은 차단으로 나타난다");
      console.log(`${"═".repeat(100)}`);
      console.log(`  PLAIN_HTML 에서 code 판정이 바뀐 쌍   ${codeNew.length}/${htmlRows.length}`);
      for (const r of codeNew) console.log(`     ${pad(r.host, 24)}${r.codeBefore} → **${r.codeAfter}**  [human ${r.human}]`);
      console.log(`  conflict 총수   before ${conflictBefore.length} → after **${conflictAfter.length}**`);

      /** ── 🔴🔴 단언 ──────────────────────────────────────────────────── */
      /** 🔴 발화 단언 먼저 — 공급이 0 이면 아래 「변화 0」이 **무의미** 하다. */
      expect(htmlOk.length, "🔴 PLAIN_HTML facts 가 0 이면 측정불가(열화)").toBeGreaterThan(0);
      expect(supplied.length, "🔴 공급이 0 이면 이 Sprint 가 발화하지 않았다").toBeGreaterThan(0);
      /** 🔴🔴 **CPO STOP 게이트** — 이것이 이 Sprint 의 합격선이다. */
      expect(m.ds, "🔴🔴 human DIFFERENT 가 SAME 으로 열리면 즉시 STOP 이다").toBe(0);
      expect(sysDiffToSame.length, "🔴🔴 system 비SAME → SAME 전이도 0 이어야 한다").toBe(0);
      /** 🔴 **소재 축 입력 불변** — PLAIN_HTML 에 material 이 생기면 계약 위반이다. */
      expect(htmlOk.filter((l) => l.facts?.materialText).length, "🔴 materialText 가 채워졌다").toBe(0);

      console.log(`\n  🟢 HTTP ${urls.length} 회(중복 0) · 판정 ${rows.length}쌍 × 2 · 운영 변경은 공급 배선뿐`);
    },
    15 * 60 * 1000,
  );
});
