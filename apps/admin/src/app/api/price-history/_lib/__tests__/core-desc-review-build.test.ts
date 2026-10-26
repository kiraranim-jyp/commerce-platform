import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { factsFromProductUrl } from "@commerce/crawler";
import { compareModelCode } from "@commerce/crawler/src/comparison-search/model-code";
import { compareCrossSellerProducts } from "@commerce/crawler/src/comparison-search/cross-seller";
import { extractDetailModelCodes } from "@commerce/crawler/src/comparison-search/model-code-from-detail";
import type { ProductFacts } from "@commerce/shared";
import { SAME05_PAIRS, type Same05Pair } from "./core-same05-gt";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 CORE-DESC-REVIEW — **CEO 육안 검증 화면**(상세설명 Evidence · 운영 변경 0)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **CTO 가 판정하지 않는다.** 이 화면은 **CEO 가 보고 답하는** 질문 여섯을 담는다 —
 *    상세설명만으로 ① 브랜드 ② 품번 ③ 상품 형태 ④ 색상/소재 ⑤ 세트/구성 ⑥ **결정적 문구**
 *    를 찾을 수 있는가.
 *
 * 🔴 **운영 변경 0 · 판정 0 · 추출기 수정 0.** 화면은 운영 `factsFromProductUrl` 산출을
 *    **그대로** 보여준다(새 파서 0 · 새 축 0 · 점수 0).
 *
 * 🔴 **CPO 지목 대상 중 둘은 이 GT 에 «없다»** — `biskuit` · `luxboy`(SPRINT-09 실측).
 *    🟢 그 사실을 **화면에 적는다** — 「없는 것」을 조용히 빼면 CEO 가 분모를 잘못 읽는다.
 */

const TARGET_IDS = ["C27", "C05", "C06", "C19", "C20", "C50", "S1-5", "S1-6", "C22", "C42", "C25"];
/** 🔴 CPO 가 지목했으나 이 GT 에 없는 호스트 — 화면에 **명시** 한다. */
const MISSING_HOSTS = ["biskuit", "luxboy", "bornyesterdaykids"];

const esc = (s: unknown): string =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
const host = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "?";
  }
};
const na = '<span class="na">없음</span>';
const val = (v: unknown) => (v === null || v === undefined || v === "" ? na : esc(v));

const LIVE = process.env.CORE_DESC_REVIEW_LIVE === "1";

describe.skipIf(!LIVE)("CORE-DESC-REVIEW — CEO 육안 검증 화면(운영 변경 0)", () => {
  it(
    "상세설명 Evidence 비교 화면을 만든다",
    async () => {
      const picked = SAME05_PAIRS.filter((p) => TARGET_IDS.includes(p.id));
      expect(picked.length, "🔴 대상이 0 이면 화면이 성립하지 않는다").toBeGreaterThan(0);

      const urls = [...new Set(picked.map((p) => p.url))];
      const originUrls = [...new Set(picked.map((p) => p.origin.sourceUrl))];
      const live = new Map<string, ProductFacts | null>();
      for (const u of [...urls, ...originUrls]) {
        try {
          const r = (await factsFromProductUrl(u)) as unknown as Record<string, unknown>;
          const c = r.candidate as Record<string, unknown> | undefined;
          live.set(u, (c?.facts as ProductFacts | undefined) ?? null);
        } catch {
          live.set(u, null);
        }
      }

      /** 🔴 라이브가 비면 **저장 facts** 로 내려간다 — 어느 쪽인지 화면에 적는다. */
      const factsOf = (u: string, stored: ProductFacts) => {
        const l = live.get(u);
        return { facts: l ?? stored, source: l ? "라이브 재수집" : "저장 스냅샷(🔴 description 없음)" };
      };

      const ROWS: { label: string; pick: (f: ProductFacts) => unknown; note?: string }[] = [
        { label: "① 상품명 (TITLE)", pick: (f) => f.title },
        { label: "② 브랜드 (BRAND)", pick: (f) => f.brand },
        { label: "③ 품번 (MODEL CODE)", pick: (f) => f.brandModelCode },
        { label: "⑤ 색상 (COLOR)", pick: (f) => f.colorText },
        { label: "⑤ 소재 (MATERIAL)", pick: (f) => f.materialText, note: "🔴 Shopify 경로는 이 칸에 설명문 전문이 들어온다" },
        { label: "⑤ 형태/분류 (FORM)", pick: (f) => f.categoryText },
        { label: "⑤ 핏 (FIT)", pick: (f) => f.fitText },
        { label: "— 판매처 SKU", pick: (f) => f.sellerSku, note: "🔴 matcher 가 읽지 않는다(보존만)" },
        { label: "⑥ 이미지 수", pick: (f) => f.imageUrls.length, note: "🔴 이미지 비교는 구현돼 있지 않다" },
      ];

      const cards = picked
        .map((p: Same05Pair) => {
          const o = factsOf(p.origin.sourceUrl, p.origin);
          const c = factsOf(p.url, p.facts);
          const cross = compareCrossSellerProducts(o.facts, c.facts);
          const code = String(compareModelCode(o.facts.brandModelCode, c.facts.brandModelCode ?? null));
          const blockers = (cross.blockers ?? []).map((b) => String(b.blocker));
          const conflicts = (cross.conflicts ?? []).map((x) => String(x.conflict));
          const descCodes = extractDetailModelCodes(c.facts.description);

          const evidenceRows = ROWS.map(
            (r) =>
              `<tr><th>${esc(r.label)}${r.note ? `<em>${esc(r.note)}</em>` : ""}</th>` +
              `<td>${val(r.pick(o.facts))}</td><td>${val(r.pick(c.facts))}</td></tr>`,
          ).join("");

          const descBlock = (f: ProductFacts, who: string) =>
            f.description
              ? `<div class="desc"><b>${esc(who)} 상세설명</b><p>${esc(f.description)}</p></div>`
              : `<div class="desc empty"><b>${esc(who)} 상세설명</b><p>🔴 이 경로에서 상세설명이 <b>공급되지 않았다</b>` +
                ` — 「상세설명이 없는 상품」이 아니라 <b>우리가 읽지 못한 것</b>일 수 있습니다.</p></div>`;

          return `
<section class="card">
  <h2>${esc(p.id)} · ${esc(host(p.url))}</h2>
  <div class="meta">
    <span>CEO 이전 판정: <b>${esc(p.human)}</b></span>
    <span>시스템 판정: <b>${esc(String(cross.verdict))}</b></span>
    <span>품번 비교: <b>${esc(code)}</b></span>
    <span class="src">원상품 facts: ${esc(o.source)} · 후보 facts: ${esc(c.source)}</span>
  </div>
  <table class="ev">
    <thead><tr><th>Evidence</th><th>해외 원상품</th><th>국내/해외 후보</th></tr></thead>
    <tbody>${evidenceRows}</tbody>
  </table>
  <div class="descs">
    ${descBlock(o.facts, "원상품")}
    ${descBlock(c.facts, "후보")}
  </div>
  <div class="auto">
    <b>④ 상세설명에서 «자동으로» 찾은 것</b>
    <ul>
      <li>품번: ${descCodes.length ? `<b>${esc(descCodes.join(", "))}</b>` : "🔴 못 찾음"}</li>
      <li>브랜드: 🔴 <b>현재 BRAND 추출기는 상세설명을 읽지 않습니다</b>(SPRINT-08 코드 추적) —
          그래서 여기가 비는 것은 「설명에 브랜드가 없다」는 뜻이 <b>아닙니다</b>.</li>
      <li>형태 · 색상 · 소재 · 세트/구성: 🔴 <b>상세설명에서 추출하는 경로가 없습니다</b>.</li>
    </ul>
  </div>
  <div class="ask">
    <b>🟡 대표님께 묻는 것</b>
    <ol>
      <li>상세설명만으로 <b>브랜드</b>를 알 수 있습니까?</li>
      <li>상세설명만으로 <b>품번</b>을 알 수 있습니까?</li>
      <li>상세설명만으로 <b>상품 형태</b>(티셔츠/가디건/세트 등)를 알 수 있습니까?</li>
      <li>상세설명만으로 <b>색상·소재</b>를 알 수 있습니까?</li>
      <li>상세설명만으로 <b>세트/구성</b>(단품인가 세트인가)을 알 수 있습니까?</li>
      <li>🔴 <b>동일상품이라고 판단되는 «결정적 문구»가 어디에 있습니까?</b> (그 문장을 알려 주십시오)</li>
    </ol>
  </div>
  <div class="links">
    <a href="${esc(p.origin.sourceUrl)}" target="_blank" rel="noreferrer">원상품 페이지 열기</a>
    <a href="${esc(p.url)}" target="_blank" rel="noreferrer">후보 페이지 열기</a>
  </div>
  <div class="judge">
    시스템 보류/충돌 사유: ${blockers.length || conflicts.length ? esc([...blockers, ...conflicts].join(" · ")) : na}
  </div>
</section>`;
        })
        .join("");

      const html = `<!doctype html><meta charset="utf-8"><title>상세설명 Evidence 육안 검증</title>
<style>
 body{font:14px/1.6 -apple-system,"Segoe UI",system-ui,sans-serif;margin:0;padding:24px;background:#f6f7f9;color:#111}
 h1{font-size:20px;margin:0 0 8px}
 .intro{background:#fff;border:1px solid #e3e6ea;border-radius:10px;padding:16px;margin-bottom:20px}
 .intro ul{margin:8px 0 0 18px;padding:0}
 .warn{background:#fff6f6;border-color:#f0c9c9}
 .card{background:#fff;border:1px solid #e3e6ea;border-radius:10px;padding:16px;margin-bottom:20px}
 h2{font-size:16px;margin:0 0 8px}
 .meta{display:flex;flex-wrap:wrap;gap:12px;font-size:12px;color:#555;margin-bottom:12px}
 .meta .src{color:#888}
 table.ev{width:100%;border-collapse:collapse;margin-bottom:12px;table-layout:fixed}
 table.ev th,table.ev td{border:1px solid #e3e6ea;padding:8px;vertical-align:top;word-break:break-word;font-size:13px}
 table.ev thead th{background:#f0f2f5;text-align:left}
 table.ev tbody th{width:210px;background:#fafbfc;text-align:left;font-weight:600}
 table.ev tbody th em{display:block;font-style:normal;font-size:11px;color:#b00;font-weight:400;margin-top:2px}
 .na{color:#b00}
 .descs{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px}
 @media(max-width:900px){.descs{grid-template-columns:1fr}}
 .desc{background:#fafbfc;border:1px solid #e3e6ea;border-radius:8px;padding:10px;font-size:13px}
 .desc p{white-space:pre-wrap;margin:6px 0 0;max-height:320px;overflow:auto}
 .desc.empty{background:#fff6f6;border-color:#f0c9c9}
 .auto,.ask,.judge{background:#fafbfc;border:1px solid #e3e6ea;border-radius:8px;padding:10px;font-size:13px;margin-bottom:10px}
 .ask{background:#fffdf3;border-color:#e8dca8}
 .auto ul,.ask ol{margin:6px 0 0 18px;padding:0}
 .links a{display:inline-block;margin-right:12px;font-size:13px}
</style>
<h1>상세설명 Evidence 육안 검증 — ${picked.length}건</h1>
<div class="intro">
 <b>왜 이 화면인가</b>
 <ul>
  <li>지금까지 우리는 <b>코드가 가진 칸</b>(브랜드·색상·소재)만 파고들었습니다. 대표님 말씀대로
      <b>상세설명 하나만 제대로 읽어도</b> 필요한 정보가 대부분 나올 수 있습니다.</li>
  <li>그래서 이 화면은 <b>상세설명 전문을 그대로</b> 보여 주고, 아래 여섯 질문만 묻습니다.</li>
  <li>🔴 시스템 판정은 <b>참고용</b>입니다. 대표님 판단이 기준입니다.</li>
  <li>🔴 <b>CTO 는 이 화면에서 아무 판정도 채우지 않았습니다.</b></li>
 </ul>
</div>
<div class="intro warn">
 <b>🔴 먼저 알려 드릴 한계 둘</b>
 <ul>
  <li><b>현재 BRAND 추출기는 상세설명을 읽지 않습니다.</b> 그래서 「설명에서 브랜드를 찾은 건수 0」은
      <b>효과가 0이라는 뜻이 아니라 읽는 경로가 없다는 뜻</b>입니다.</li>
  <li><b>형태·색상·소재·세트 구성도 상세설명에서 추출하는 경로가 없습니다.</b></li>
  <li>🔴 CPO 가 지목한 <b>${esc(MISSING_HOSTS.join(" · "))}</b> 는 현재 이 비교 묶음에
      <b>들어 있지 않습니다</b>(다른 조사에서 쓴 라벨입니다). 분모를 ${picked.length}건으로 읽어 주십시오.</li>
 </ul>
</div>
${cards}
`;
      const out = join(__dirname, "../../../../../../../../docs/core-desc-evidence-review.html");
      writeFileSync(out, html, "utf8");
      console.log(`\n  🟢 화면 생성 — ${out}`);
      console.log(`  대상 ${picked.length}건 · HTTP ${urls.length + originUrls.length} 회 · 운영 변경 0`);
      const withDesc = picked.filter((p) => factsOf(p.url, p.facts).facts.description).length;
      console.log(`  🔴 후보 상세설명 공급 **${withDesc}/${picked.length}** — 나머지는 「없다」가 아니라 **못 읽었다** 다`);
      expect(html).toContain("동일상품이라고 판단되는");
      /** 🔴 CTO 가 판정을 채우지 않았다는 것을 **기계로** 단언한다. */
      expect(html).not.toMatch(/judgedByCto|"ceo"\s*:/);
    },
    15 * 60 * 1000,
  );
});
