import { describe, expect, it } from "vitest";
import { factsFromProductUrl } from "@commerce/crawler";
import {
  IDENTITY_EVIDENCE_AXES,
  PROBE_EVIDENCE_AXES,
  type EvidenceItem,
  type ProductEvidence,
  type ProductFacts,
} from "@commerce/shared";
import { SAME05_BASELINE, SAME05_PAIRS, same05Judge, same05Tally, fmtTally } from "./core-same05-gt";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 CORE-DESC-EVIDENCE-01 — **Evidence coverage 측정**(라이브 · 운영 경로 그대로)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **왜 라이브여야 하는가 — 저장 GT 로는 구조적으로 못 잰다**(SPRINT-10 이 겪은 그 자리).
 * ```
 * 저장 facts 의 `description` = **0/33**(SPRINT-03 이전 스냅샷) ⟹ 그 분모로 재면
 * DESCRIPTION source 가 **언제나 0** 이고 그것은 제품 사실이 아니다.
 * 🟢 그래서 운영 `factsFromProductUrl` 로 **지금 다시** 수집한다.
 * ```
 *
 * 🟢🟢 **복제식이 아니다** — `attachProductEvidence` 가 **운영 경로에 배선돼 있으므로**
 *    이 하니스는 `facts.evidence` 를 **읽기만** 한다(증거를 여기서 다시 만들지 않는다).
 *    ⟹ 「하니스에서는 되는데 운영에서는 안 되는」 WU-110/134 의 함정을 구조적으로 피한다.
 *
 * 🔴 facts 를 못 얻은 쌍은 **분모에서 뺀다** — 「추출 0」으로 세지 않는다(측정불가).
 */

const LIVE = process.env.CORE_DESC_EVIDENCE_LIVE === "1";

const pad = (s: string, n: number) => s + " ".repeat(Math.max(0, n - [...s].length));
const frac = (n: number, d: number) => (d === 0 ? "측정불가(분모 0)" : `${n}/${d} (${((n / d) * 100).toFixed(1)}%)`);
const host = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "?";
  }
};
const items = (ev: ProductEvidence | null | undefined, axis: string): EvidenceItem[] =>
  (ev?.[axis as keyof ProductEvidence] as EvidenceItem[] | undefined) ?? [];
const hasFrom = (ev: ProductEvidence | null | undefined, axis: string, src: string): boolean =>
  items(ev, axis).some((i) => i.source === src);

describe.skipIf(!LIVE)("CORE-DESC-EVIDENCE-01 — Evidence coverage(라이브)", () => {
  it(
    "TITLE / DESCRIPTION 별 축 coverage 와 matcher 불변을 «같이» 잰다",
    async () => {
      const urls = [...new Set(SAME05_PAIRS.map((p) => p.url))];
      const live = new Map<string, { path: string; status: string; facts: ProductFacts | null }>();
      for (const url of urls) {
        try {
          const r = (await factsFromProductUrl(url)) as unknown as Record<string, unknown>;
          const cand = r.candidate as Record<string, unknown> | undefined;
          live.set(url, {
            path: String(r.fetchPath ?? "UNRESOLVED"),
            status: String(r.status ?? "?"),
            facts: (cand?.facts as ProductFacts | undefined) ?? null,
          });
        } catch (e) {
          live.set(url, { path: "UNRESOLVED", status: `THREW(${(e as Error).message.slice(0, 24)})`, facts: null });
        }
      }

      const usable = SAME05_PAIRS.filter((p) => live.get(p.url)?.facts);
      const skipped = SAME05_PAIRS.length - usable.length;
      const factsOf = (url: string) => live.get(url)!.facts as ProductFacts;
      const withDesc = usable.filter((p) => factsOf(p.url).description);

      console.log(`\n${"═".repeat(104)}`);
      console.log("  [1] 분모 — 🔴 못 얻은 것은 「0」이 아니라 «분모 밖» 이다");
      console.log(`${"═".repeat(104)}`);
      console.log(`  GT 쌍 ${SAME05_PAIRS.length} · 라이브 facts 확보 **${usable.length}** · 🔴 제외 ${skipped}`);
      console.log(`  description 존재              ${frac(withDesc.length, usable.length)}`);
      console.log(`  evidence 칸 존재              ${frac(usable.filter((p) => factsOf(p.url).evidence).length, usable.length)}`);

      console.log(`\n${"═".repeat(104)}`);
      console.log("  [2] Identity 축 coverage — 🔴 source 를 «갈라서» 센다");
      console.log(`${"═".repeat(104)}`);
      console.log(`  ${pad("축", 14)}${pad("전체", 18)}${pad("TITLE", 18)}${pad("DESCRIPTION", 18)}DESC(설명보유 분모)`);
      for (const axis of IDENTITY_EVIDENCE_AXES) {
        const any = usable.filter((p) => items(factsOf(p.url).evidence, axis).length > 0).length;
        const t = usable.filter((p) => hasFrom(factsOf(p.url).evidence, axis, "TITLE")).length;
        const d = usable.filter((p) => hasFrom(factsOf(p.url).evidence, axis, "DESCRIPTION")).length;
        const dOfDesc = withDesc.filter((p) => hasFrom(factsOf(p.url).evidence, axis, "DESCRIPTION")).length;
        console.log(
          `  ${pad(axis, 14)}${pad(frac(any, usable.length), 18)}${pad(frac(t, usable.length), 18)}${pad(frac(d, usable.length), 18)}${frac(dOfDesc, withDesc.length)}`,
        );
      }

      console.log(`\n${"═".repeat(104)}`);
      console.log("  [3] 🟡 관측 전용 축 — 추출 «가능성만» 잰다(matcher 축 승격 0)");
      console.log(`${"═".repeat(104)}`);
      for (const axis of PROBE_EVIDENCE_AXES) {
        const any = usable.filter((p) => items(factsOf(p.url).evidence, axis).length > 0).length;
        console.log(`  ${pad(axis, 14)}${frac(any, usable.length)}`);
      }

      console.log(`\n${"═".repeat(104)}`);
      console.log("  [4] 🔴 DESCRIPTION 에서만 나온 축 — TITLE 이 못 준 것을 설명문이 메운 건수");
      console.log(`${"═".repeat(104)}`);
      for (const axis of IDENTITY_EVIDENCE_AXES) {
        const only = usable.filter(
          (p) =>
            hasFrom(factsOf(p.url).evidence, axis, "DESCRIPTION") && !hasFrom(factsOf(p.url).evidence, axis, "TITLE"),
        );
        console.log(`  ${pad(axis, 14)}${pad(String(only.length), 6)}${only.map((p) => p.id).join(" ")}`);
      }

      console.log(`\n${"═".repeat(104)}`);
      console.log("  [5] 건별 — 🔴 CEO 반례를 «이름으로» 같이 본다");
      console.log(`${"═".repeat(104)}`);
      for (const p of usable) {
        const f = factsOf(p.url);
        const axes = [...IDENTITY_EVIDENCE_AXES, ...PROBE_EVIDENCE_AXES]
          .map((a) => {
            const src = new Set(items(f.evidence, a).map((i) => (i.source === "TITLE" ? "T" : "D")));
            return src.size ? `${a}:${[...src].sort().join("")}` : "";
          })
          .filter(Boolean)
          .join(" ");
        console.log(
          `  ${pad(p.id, 7)}${pad(p.human, 10)}${pad(host(p.url), 22)}${pad(live.get(p.url)!.path, 14)}${f.description ? "desc✓" : "desc·"}  ${axes}`,
        );
      }

      console.log(`\n${"═".repeat(104)}`);
      console.log("  [6] 🔴🔴 matcher 불변 — Evidence 가 늘어도 verdict 가 바뀌면 «실패» 다");
      console.log(`${"═".repeat(104)}`);
      /** 🔴 증거를 떼어낸 facts 와 붙인 facts 를 **같은 운영 judge** 에 넣어 비교한다. */
      let changed = 0;
      for (const p of usable) {
        const f = factsOf(p.url);
        const { evidence: _x, ...withoutEvidence } = f;
        const a = same05Judge(p.origin, withoutEvidence as ProductFacts);
        const b = same05Judge(p.origin, f);
        if (String(a.cross.verdict) !== String(b.cross.verdict) || a.tier !== b.tier) {
          changed += 1;
          console.log(`  🔴 ${p.id} ${String(a.cross.verdict)}→${String(b.cross.verdict)} · ${a.tier}→${b.tier}`);
        }
      }
      console.log(`  verdict/tier 변화 **${changed}** 건  (기대 0)`);

      const live33 = same05Tally(
        (p) => (live.get(p.url)?.facts ? String(same05Judge(p.origin, factsOf(p.url)).cross.verdict) : "UNKNOWN"),
        usable,
      );
      console.log(`  ${fmtTally("LIVE", live33)}`);
      console.log(`  🔴 저장 GT 기준선(분모 33) = ${JSON.stringify(SAME05_BASELINE)} — 분모가 달라 **직접 비교 금지**`);

      /** 🔴 이 측정의 **유일한 PASS 조건** — 증거는 늘어도 판정은 그대로다. */
      expect(changed).toBe(0);
      expect(usable.length).toBeGreaterThan(0);
    },
    20 * 60 * 1000,
  );
});
