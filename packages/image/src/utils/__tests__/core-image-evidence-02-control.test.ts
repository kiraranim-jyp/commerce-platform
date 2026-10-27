import { describe, expect, it } from "vitest";
import { computeVisualSignature, hammingHex } from "../visual-signature.util";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 CORE-IMAGE-EVIDENCE-02 STEP 3 — **control set 재측정**(라이브 · 측정 only)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **threshold 를 산출하지 않는다**(CPO §12 · §13). 이 하니스가 답하는 질문은
 *    **하나** 다 — 「정규화 후에도 SAME/DIFFERENT 정보가 안정적으로 «분리» 되는가」.
 *
 * 🔴 표본은 **한 상품군** 이다(Main Story Bubble Sweatshirt · S4 계열).
 *    ⟹ 🔴 이 숫자로 production 규칙을 만들지 않는다.
 *
 * 🔴 이 파일은 **packages/image** 에 있다 — `sharp` 가 이 패키지에만 설치돼 있어서
 *    apps/admin 에서는 import 자체가 실패한다(실측).
 */

const LIVE = process.env.CORE_IMAGE_EVIDENCE_LIVE === "1";

/** 🟢 IMAGE-EVIDENCE-01 이 확정한 control set — 🔴 새 외부 상품을 추가하지 않는다. */
const CONTROL: { id: string; label: string; url: string }[] = [
  {
    id: "ORIGIN-S4",
    label: "원상품 Grey Melange",
    url: "https://ggxncgcbvuscwawpagbq.supabase.co/storage/v1/object/public/product-images/7d89b395-47c9-4207-bb03-b3e997e512c9-0001.jpg",
  },
  {
    id: "C42",
    label: "🟢 human SAME · Grey Melange(main-story)",
    url: "https://cdn.shopify.com/s/files/1/2263/4907/files/AW26MS185-BubbleSweatshirt-GreyMelange_front.jpg?v=1784452279",
  },
  {
    id: "C19",
    label: "DIFFERENT · Conker Stripe(junioredition)",
    url: "https://cdn.shopify.com/s/files/1/0874/8574/files/Main-Story-AW26-Bubble-Sweatshirt-Conker-Stripe.jpg?v=1786095357",
  },
  {
    id: "C20",
    label: "DIFFERENT · Graystone(junioredition)",
    url: "https://cdn.shopify.com/s/files/1/0874/8574/files/Main-Story-AW26-Bubble-Sweatshirt-Graystone.jpg?v=1786095718",
  },
  {
    id: "C25",
    label: "DIFFERENT · Graystone(main-story)",
    url: "https://cdn.shopify.com/s/files/1/2263/4907/files/AW26MS185-BubbleSweatshirt-Graystone_front.jpg?v=1784452256",
  },
  {
    id: "C22",
    label: "DIFFERENT · Conker Stripe(donokids · 🟢 02 에서 공급 복구)",
    url: "https://www.donokids.com/shopimages/DONOKIDS/0260020000082.jpg",
  },
];

const pad = (s: string, n: number) => s + " ".repeat(Math.max(0, n - [...s].length));
const padL = (s: string, n: number) => " ".repeat(Math.max(0, n - [...s].length)) + s;
const colorGap = (a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }) =>
  Math.round(Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2));

describe.skipIf(!LIVE)("CORE-IMAGE-EVIDENCE-02 STEP 3 — raw vs normalized(라이브)", () => {
  it(
    "정규화 후에도 SAME/DIFFERENT 정보가 분리되는가",
    async () => {
      const sigs = new Map<string, Awaited<ReturnType<typeof computeVisualSignature>>>();
      const failures: string[] = [];
      const timings: number[] = [];
      const bytes: number[] = [];

      for (const c of CONTROL) {
        try {
          const res = await fetch(c.url, { redirect: "follow" });
          if (!res.ok) {
            failures.push(`${c.id} HTTP ${res.status}`);
            continue;
          }
          const buf = Buffer.from(await res.arrayBuffer());
          bytes.push(buf.length);
          const t0 = Date.now();
          sigs.set(c.id, await computeVisualSignature(buf));
          timings.push(Date.now() - t0);
        } catch (e) {
          failures.push(`${c.id} THREW ${(e as Error).message.slice(0, 40)}`);
        }
      }

      console.log(`\n${"═".repeat(104)}`);
      console.log("  [1] 서명 — 🔴 threshold 를 내지 않는다(분리 여부만 본다)");
      console.log(`${"═".repeat(104)}`);
      console.log(`  ${pad("건", 11)}${pad("크기", 13)}${pad("trim", 7)}${pad("rawDHash", 18)}${pad("normDHash", 18)}색`);
      for (const c of CONTROL) {
        const s = sigs.get(c.id);
        if (!s) {
          console.log(`  ${pad(c.id, 11)}🔴 실패`);
          continue;
        }
        console.log(
          `  ${pad(c.id, 11)}${pad(`${s.sourceWidth}x${s.sourceHeight}`, 13)}${pad(s.trimmed ? "Y" : "n", 7)}` +
            `${pad(s.rawDHash, 18)}${pad(s.normalizedDHash, 18)}rgb(${s.color.r},${s.color.g},${s.color.b})`,
        );
      }

      const base = sigs.get("ORIGIN-S4");
      expect(base).toBeDefined();

      console.log(`\n${"═".repeat(104)}`);
      console.log("  [2] 원상품 대비 — 🔴 raw 와 normalized 를 «같이» 적는다");
      console.log(`${"═".repeat(104)}`);
      console.log(`  ${pad("건", 11)}${pad("raw", 7)}${pad("norm", 7)}${pad("색거리", 9)}라벨`);
      for (const c of CONTROL) {
        if (c.id === "ORIGIN-S4") continue;
        const s = sigs.get(c.id);
        if (!s || !base) continue;
        console.log(
          `  ${pad(c.id, 11)}${padL(String(hammingHex(base.rawDHash, s.rawDHash)), 4)}   ` +
            `${padL(String(hammingHex(base.normalizedDHash, s.normalizedDHash)), 4)}   ` +
            `${padL(String(colorGap(base.color, s.color)), 6)}   ${c.label}`,
        );
      }

      console.log(`\n${"═".repeat(104)}`);
      console.log("  [3] 같은 상품 · 다른 판매처  C19 ↔ C22");
      console.log(`${"═".repeat(104)}`);
      const c19 = sigs.get("C19");
      const c22 = sigs.get("C22");
      if (c19 && c22) {
        console.log(
          `  raw ${hammingHex(c19.rawDHash, c22.rawDHash)} · norm ${hammingHex(c19.normalizedDHash, c22.normalizedDHash)} · 색거리 ${colorGap(c19.color, c22.color)}`,
        );
      }
      const c20 = sigs.get("C20");
      const c25 = sigs.get("C25");
      if (c20 && c25) {
        console.log(
          `  [같은 color variant] C20 ↔ C25  raw ${hammingHex(c20.rawDHash, c25.rawDHash)} · norm ${hammingHex(c20.normalizedDHash, c25.normalizedDHash)} · 색거리 ${colorGap(c20.color, c25.color)}`,
        );
      }

      console.log(`\n  처리시간 평균 ${(timings.reduce((a, b) => a + b, 0) / Math.max(1, timings.length)).toFixed(0)} ms/장`);
      console.log(`  평균 파일 ${(bytes.reduce((a, b) => a + b, 0) / Math.max(1, bytes.length) / 1024).toFixed(0)} KB`);
      console.log(`  🔴 실패 ${failures.length}${failures.length ? ` — ${failures.join(" · ")}` : ""}`);
      console.log(`  🔴 표본은 **한 상품군** 이다 — 이 숫자로 threshold 를 정하지 않는다`);

      /** 🔴 PASS 조건은 **분리 여부** 하나다(임계값 없음) — SAME 쌍이 DIFFERENT 쌍보다 가깝다. */
      if (base && sigs.get("C42")) {
        const same = hammingHex(base.normalizedDHash, sigs.get("C42")!.normalizedDHash);
        const diffs = ["C19", "C20", "C25", "C22"]
          .map((id) => sigs.get(id))
          .filter(Boolean)
          .map((s) => hammingHex(base.normalizedDHash, s!.normalizedDHash));
        console.log(`\n  🟢 정규화 후 — SAME ${same} vs DIFFERENT 최소 ${Math.min(...diffs)}`);
        expect(same).toBeLessThan(Math.min(...diffs));
      }
      expect(failures).toHaveLength(0);
    },
    20 * 60 * 1000,
  );
});
