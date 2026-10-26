import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { factsFromProductUrl } from "@commerce/crawler";
import type { ProductFacts } from "@commerce/shared";
import { SAME05_PAIRS } from "./core-same05-gt";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 CORE-IMAGE-EVIDENCE-01 STEP 1 — **이미지 «공급» 실태**(측정 only · 운영 변경 0)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **matcher 를 만들지 않는다.** 이 하니스는 ⒜ 운영 경로가 이미지를 **주는가**
 *    ⒝ 그 URL 이 **열리는가** ⒞ 무엇이 들어 있는가 — 셋만 잰다.
 *
 * 🔴 **「이미지가 없다」를 matcher 문제로 적지 않는다**(CPO §5).
 * 🔴 분모를 숨기지 않는다 — facts 를 못 얻은 건은 **분모 밖** 이다.
 *
 * ── 🟢 왜 S4 클러스터인가 ───────────────────────────────────────────────────
 * ```
 * 원상품 S4 = Main Story 「Bubble Sweatshirt in **Grey Melange**」 · sku AW26MS185
 *   C42  human SAME       main-story.com   **Grey Melange**   ← 🟢 양성 대조
 *   C19  human DIFFERENT  junioredition    **Conker Stripe**  (품번 AW26MS185 **동일**)
 *   C20  human DIFFERENT  junioredition    **Graystone**      (품번 AW26MS185 **동일**)
 *   C25  human DIFFERENT  main-story.com   **Graystone**
 *   C22  human DIFFERENT  donokids         Conker Stripe #AW26MS185 (품번 **오등록** 의심)
 * ⟹ 🔴 이미지가 답해야 하는 질문이 **정확히 하나** 로 좁혀진다 —
 *    「같은 디자인·같은 품번인데 **색/무늬가 다른** 것을 가를 수 있는가」
 * ```
 */

const LIVE = process.env.CORE_IMAGE_EVIDENCE_LIVE === "1";

/** 🔴 CPO 가 지정한 3건 + 🟢 **양성 대조 C42** 와 색상 variant **C25** 를 같이 본다. */
const CASES = ["C19", "C20", "C22", "C25", "C42"] as const;

/** 🔴 산출물을 **작업트리에 쓰지 않는다** — 스크래치패드로 뺀다(worktree clean 유지). */
const OUT = process.env.CORE_IMAGE_EVIDENCE_OUT ?? join(tmpdir(), "core-image-evidence-01");

const pad = (s: string, n: number) => s + " ".repeat(Math.max(0, n - [...s].length));

/** 🟢 **디코딩하지 않는다** — JPEG/PNG 헤더만 읽어 크기를 얻는다(새 의존성 0). */
function imageSize(buf: Buffer): { w: number; h: number; kind: string } | null {
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) {
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), kind: "PNG" };
  }
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) {
        i += 1;
        continue;
      }
      const marker = buf[i + 1]!;
      const len = buf.readUInt16BE(i + 2);
      /** SOF0/1/2/9 등 — 🔴 DHT(0xC4)·DAC(0xCC) 는 SOF 가 아니다. */
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { w: buf.readUInt16BE(i + 7), h: buf.readUInt16BE(i + 5), kind: "JPEG" };
      }
      i += 2 + len;
    }
    return { w: 0, h: 0, kind: "JPEG" };
  }
  if (buf.length > 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    return { w: 0, h: 0, kind: "WEBP" };
  }
  return null;
}

describe.skipIf(!LIVE)("CORE-IMAGE-EVIDENCE-01 STEP 1 — 이미지 공급(라이브)", () => {
  it(
    "운영 경로가 이미지를 주는가 · 그 URL 이 열리는가",
    async () => {
      mkdirSync(OUT, { recursive: true });
      const manifest: Record<string, unknown> = {};

      /** 🟢 원상품은 GT fixture 의 canonicalProduct 이미지를 쓴다(운영 저장분 그대로). */
      const origin = SAME05_PAIRS.find((p) => p.id === "C19")!.origin;
      const targets: { id: string; label: string; url: string | null; facts: ProductFacts | null }[] = [
        { id: "ORIGIN-S4", label: "원상품 Grey Melange", url: origin.sourceUrl, facts: origin },
      ];

      for (const id of CASES) {
        const p = SAME05_PAIRS.find((x) => x.id === id);
        if (!p) {
          targets.push({ id, label: "GT 분모에 없음", url: null, facts: null });
          continue;
        }
        let facts: ProductFacts | null = null;
        let status = "?";
        let path = "?";
        try {
          const r = (await factsFromProductUrl(p.url)) as unknown as Record<string, unknown>;
          status = String(r.status ?? "?");
          path = String(r.fetchPath ?? "?");
          facts = ((r.candidate as Record<string, unknown> | undefined)?.facts as ProductFacts) ?? null;
        } catch (e) {
          status = `THREW(${(e as Error).message.slice(0, 30)})`;
        }
        /** 🔴 라이브가 facts 를 못 주면 **저장 facts 로 대체하지 않는다** — 상태를 그대로 적는다. */
        manifest[`${id}.live`] = { status, path, gotFacts: Boolean(facts) };
        targets.push({ id, label: `${p.human} · ${p.facts.title.slice(0, 44)}`, url: p.url, facts });
      }

      console.log(`\n${"═".repeat(108)}`);
      console.log("  [STEP 1] 이미지 «공급» — 🔴 「없음」은 matcher 문제가 아니다");
      console.log(`${"═".repeat(108)}`);
      console.log(`  ${pad("건", 11)}${pad("라이브 facts", 14)}${pad("imageUrls", 11)}상태 / 경로`);

      const toFetch: { id: string; idx: number; url: string }[] = [];
      for (const t of targets) {
        /** 🟢 원상품도 **같은 칸** 이다 — `productFactsFromIdentityDna` 가 `imageUrls` 로 옮겨 둔다. */
        const urls: string[] = (t.facts?.imageUrls ?? []).slice();
        const live = manifest[`${t.id}.live`] as { status?: string; path?: string } | undefined;
        console.log(
          `  ${pad(t.id, 11)}${pad(t.facts ? "Y" : "—", 14)}${pad(String(urls.length), 11)}${live?.status ?? "(fixture)"} / ${live?.path ?? "-"}`,
        );
        urls.forEach((u, i) => toFetch.push({ id: t.id, idx: i, url: u }));
        manifest[`${t.id}.urls`] = urls;
      }

      console.log(`\n${"═".repeat(108)}`);
      console.log("  [STEP 1-b] 각 이미지 URL 실제 접근 — HTTP / MIME / bytes / 크기");
      console.log(`${"═".repeat(108)}`);
      const rows: Record<string, unknown>[] = [];
      for (const f of toFetch) {
        let http = 0;
        let mime = "";
        let bytes = 0;
        let dim = "-";
        try {
          const res = await fetch(f.url, { redirect: "follow" });
          http = res.status;
          mime = res.headers.get("content-type") ?? "";
          if (res.ok) {
            const buf = Buffer.from(await res.arrayBuffer());
            bytes = buf.length;
            const s = imageSize(buf);
            dim = s ? `${s.kind} ${s.w}x${s.h}` : "unknown";
            writeFileSync(join(OUT, `${f.id}-${String(f.idx).padStart(2, "0")}.jpg`), buf);
          }
        } catch (e) {
          mime = `THREW(${(e as Error).message.slice(0, 24)})`;
        }
        rows.push({ id: f.id, idx: f.idx, http, mime, bytes, dim, url: f.url });
        console.log(`  ${pad(f.id, 11)}${pad(String(f.idx), 4)}${pad(String(http), 6)}${pad(mime, 14)}${pad(String(bytes), 9)}${dim}`);
      }

      const ok = rows.filter((r) => r.http === 200).length;
      console.log(`\n  접근 성공 **${ok}/${rows.length}**`);
      manifest.images = rows;
      writeFileSync(join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));
      console.log(`  🟢 저장 위치 ${OUT}`);

      expect(rows.length).toBeGreaterThan(0);
    },
    20 * 60 * 1000,
  );
});
