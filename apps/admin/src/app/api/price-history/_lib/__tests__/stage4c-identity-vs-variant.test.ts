import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 STAGE 4-C — **IDENTITY vs VARIANT**(CPO 2026-11-04 · 분석 전용)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 코드 0 · threshold 0 · score 0 · blocker 0 · migration 0 · UI 0 · Search 0 · 네트워크 0.
 * 🔴 **Legacy Human Judgment 를 덮어쓰지 않는다** — 그대로 두고 **새 칸으로** 나란히 적는다.
 * 🔴 **CTO 가 새 Identity 라벨을 «확정» 하지 않는다** — 관측과 분기만 적는다(CPO 몫).
 */

const FIX = join(__dirname, "fixtures");
const pad = (s: unknown, n: number) => String(s ?? "-").replace(/\s+/g, " ").slice(0, n) + " ".repeat(Math.max(0, n - String(s ?? "-").length));
const v = (x: unknown) => (x == null || String(x).trim() === "" ? null : String(x).replace(/\s+/g, " ").trim());

interface GtCandidate {
  searchId: string;
  domain: string;
  humanGt: string;
  humanReason?: string;
  title: string;
  facts: Record<string, unknown>;
}
const gt = JSON.parse(readFileSync(join(FIX, "wu-059-gt-facts.json"), "utf8")) as {
  origins: Record<string, { canonicalProduct: Record<string, unknown> }>;
  candidates: Record<string, GtCandidate>;
};
const ops = JSON.parse(readFileSync(join(FIX, "sprint5-brand-gt.json"), "utf8")) as {
  rows: {
    candidateDomain: string | null;
    candidateTitle: string | null;
    originTitle: string | null;
    systemVerdict: string | null;
    humanVerdict: string;
    matchReasons: string[] | null;
  }[];
};

/**
 * 🔴 **사전을 만들지 않는다** — 사람이 쓴 사유 문장에 그 «말» 이 있는지만 본다.
 *    분류가 안 되면 `?` 로 둔다(추정 금지).
 */
const classifyReason = (why?: string): string => {
  if (!why) return "?(사유 없음)";
  if (/컬러|색/.test(why)) return "COLOR";
  if (/긴팔|반팔|소매|형태|기장/.test(why)) return "FORM";
  if (/무늬|패턴|프린트|디자인|그래픽/.test(why)) return "DESIGN";
  if (/품번|모델|코드/.test(why)) return "MODEL";
  if (/브랜드/.test(why)) return "BRAND";
  return `?(${why.slice(0, 18)})`;
};

/** 🔴 제목 꼬리의 «변형 이름» 만 떼어 본다 — 색인지 무늬인지는 **단정하지 않는다**. */
const FORM_WORDS = ["long sleeve", "short sleeve", "sleeveless", "hoodie", "sweatshirt", "jacket", "t-shirt", "pants", "dress", "cap"];
const PATTERN_WORDS = ["stripe", "check", "print", "graphic", "floral", "all over", "all-over"];

describe("STAGE4-C — Identity vs Variant (분석 전용)", () => {
  it("표1 IDENTITY vs VARIANT · 표2 DECISIVE EVIDENCE · 표3 DESCRIPTION", () => {
    /* eslint-disable no-console */
    console.log("\n═══ 표1 IDENTITY vs VARIANT (Legacy 라벨 보존 · 새 칸은 «관측» 이다) ═══");
    console.log(
      `${pad("case", 6)} ${pad("원상품", 26)} ${pad("후보 제목", 44)} ${pad("품번(원↔후)", 22)} ${pad("색(원↔후)", 26)} ${pad("Legacy", 10)} 사유축`,
    );
    const reasonFreq = new Map<string, number>();
    const rows = Object.entries(gt.candidates);
    for (const [cid, c] of rows) {
      const o = gt.origins[c.searchId]?.canonicalProduct ?? {};
      const oCode = v((o.sku as { value?: string })?.value) ?? v((o as Record<string, unknown>).modelName);
      const cCode = v(c.facts.brandModelCode);
      const oColor = v((o.color as { value?: string })?.value);
      const cColor = v(c.facts.colorText);
      const axis = c.humanGt === "DIFFERENT" ? classifyReason(c.humanReason) : "-";
      if (c.humanGt === "DIFFERENT") reasonFreq.set(axis, (reasonFreq.get(axis) ?? 0) + 1);
      const t = c.title.toLowerCase();
      const form = FORM_WORDS.filter((w) => t.includes(w));
      const pat = PATTERN_WORDS.filter((w) => t.includes(w));
      console.log(
        `${pad(cid, 6)} ${pad(v((o.title as { value?: string })?.value), 26)} ${pad(c.title, 44)} ` +
          `${pad(`${oCode ?? "-"}↔${cCode ?? "-"}`, 22)} ${pad(`${oColor ?? "-"}↔${cColor ?? "-"}`, 26)} ${pad(c.humanGt, 10)} ${axis}`,
      );
      if (form.length || pat.length) {
        console.log(`        제목 안의 형태어 ${JSON.stringify(form)} · 무늬어 ${JSON.stringify(pat)}`);
      }
    }

    console.log("\n═══ 표2 DECISIVE EVIDENCE — 사람이 DIFFERENT 라고 적은 «축» 분포 ═══");
    for (const [k, n] of [...reasonFreq.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${pad(k, 24)} ${n}`);
    console.log("  🔴 `?` 는 **사유가 저장돼 있지 않다** — 「없다」가 아니라 측정불가다.");

    console.log("\n═══ 표2-b 품번 «없이» 사람이 SAME 을 준 사례 — 무엇이 결정적이었나 ═══");
    for (const [cid, c] of rows) {
      if (c.humanGt !== "SAME") continue;
      if (v(c.facts.brandModelCode)) continue;
      console.log(
        `  ${pad(cid, 5)} ${pad(c.domain, 22)} brand=${pad(v(c.facts.brand), 16)} "${pad(c.title, 56)}"`,
      );
    }

    console.log("\n═══ 표3 DESCRIPTION IDENTITY ═══");
    const withDesc = rows.filter(([, c]) => "description" in c.facts);
    console.log(`  GT 후보 ${rows.length} 중 description 칸 보유 ${withDesc.length}`);
    console.log("  🔴 그 칸은 **캡처 시점에 없었다** — 「원문에 없었다」가 아니다(측정불가).");
    console.log("  🔴 현재 Identity 판정기(cross-seller)의 description 소비는 **0회**(소스 전수).");

    console.log("\n═══ 운영 FP — Generic 만으로 선 사례 전수 ═══");
    const scored = ops.rows.filter((r) => r.systemVerdict);
    const GENERIC = ["상품군", "색상", "대상", "핏", "소재"];
    let genericOnly = 0;
    for (const r of scored) {
      if (r.humanVerdict !== "DIFFERENT") continue;
      const ev = (r.matchReasons ?? []).filter((l) => l.startsWith("근거:")).map((l) => l.slice(4).trim());
      if (ev.length === 0) continue;
      const onlyGeneric = ev.every((e) => GENERIC.some((g) => e.startsWith(g)));
      if (onlyGeneric) {
        genericOnly++;
        console.log(`  🔴 ${pad(r.candidateDomain, 22)} "${pad(r.candidateTitle, 44)}" 근거=${ev.join(" · ")}`);
      }
    }
    console.log(`  ⟹ **Generic 만으로 선 FP ${genericOnly}건**`);

    console.log("\n═══ 운영 TP — 결정적 근거에 식별자가 있었나 ═══");
    for (const r of scored) {
      if (r.humanVerdict !== "SAME") continue;
      const ev = (r.matchReasons ?? []).filter((l) => l.startsWith("근거:")).map((l) => l.slice(4).trim());
      const hasId = ev.some((e) => /품번|상품명/.test(e));
      console.log(`  ${hasId ? "🟢" : "🔴"} ${pad(r.candidateDomain, 22)} 근거=${ev.join(" · ") || "(저장 안 됨)"}`);
    }

    expect(rows.length).toBeGreaterThan(0);
    expect(scored.length).toBeGreaterThan(0);
  });
});
