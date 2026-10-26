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

      /**
       * 🔴 `step` 은 **CPO 가 고정한 Evidence 사슬의 순서** 다(①TITLE → ②BRAND →
       *    ③MODEL_CODE → ④DESCRIPTION → ⑤보조 → ⑥IMAGE). 🟢 그래서 번호가 **장식이
       *    아니라 정보** 이고, 화면의 좌측 레일이 **사슬이 어디서 끊기는지** 를 보여 준다.
       */
      const ROWS: { step: string; label: string; mono?: boolean; pick: (f: ProductFacts) => unknown; note?: string }[] = [
        { step: "①", label: "상품명", pick: (f) => f.title },
        { step: "②", label: "브랜드", pick: (f) => f.brand },
        { step: "③", label: "품번", mono: true, pick: (f) => f.brandModelCode },
        { step: "⑤", label: "색상", pick: (f) => f.colorText },
        { step: "⑤", label: "소재", pick: (f) => f.materialText, note: "Shopify 경로는 이 칸에 설명문 전문이 들어온다" },
        { step: "⑤", label: "형태·분류", pick: (f) => f.categoryText },
        { step: "⑤", label: "핏", pick: (f) => f.fitText },
        { step: "·", label: "판매처 SKU", mono: true, pick: (f) => f.sellerSku, note: "matcher 가 읽지 않는다 — 보존만" },
        { step: "⑥", label: "이미지 수", mono: true, pick: (f) => f.imageUrls.length, note: "이미지 비교는 구현돼 있지 않다" },
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

          /** 🟢 후보 쪽이 비면 행에 **끊김 표시** 를 준다 — 사슬이 어디서 멈추는지 보인다. */
          const evidenceRows = ROWS.map((r) => {
            const cv = r.pick(c.facts);
            const broken = cv === null || cv === undefined || cv === "" || cv === 0;
            return (
              `<tr${broken ? ' class="broken"' : ""}>` +
              `<td class="step">${esc(r.step)}</td>` +
              `<th>${esc(r.label)}${r.note ? `<em>${esc(r.note)}</em>` : ""}</th>` +
              `<td${r.mono ? ' class="mono"' : ""}>${val(r.pick(o.facts))}</td>` +
              `<td${r.mono ? ' class="mono"' : ""}>${val(cv)}</td></tr>`
            );
          }).join("");

          const descBlock = (f: ProductFacts, who: string) =>
            f.description
              ? `<div class="desc"><b>${esc(who)} 상세설명</b><p>${esc(f.description)}</p></div>`
              : `<div class="desc empty"><b>${esc(who)} 상세설명</b><p>🔴 이 경로에서 상세설명이 <b>공급되지 않았다</b>` +
                ` — 「상세설명이 없는 상품」이 아니라 <b>우리가 읽지 못한 것</b>일 수 있습니다.</p></div>`;

          return `
<section class="card">
  <h2><span class="cid">${esc(p.id)}</span>${esc(host(p.url))}</h2>
  <div class="meta">
    <span class="pill">대표님 이전 판정 <b>${esc(p.human)}</b></span>
    <span class="pill">시스템 판정 <b>${esc(String(cross.verdict))}</b></span>
    <span class="pill">품번 비교 <b>${esc(code)}</b></span>
    <span class="src">원상품 ${esc(o.source)} · 후보 ${esc(c.source)}</span>
  </div>
  <div class="ledger">
    <table class="ev">
      <thead><tr><td class="step"></td><th>Evidence</th><th>해외 원상품</th><th>국내·해외 후보</th></tr></thead>
      <tbody>${evidenceRows}</tbody>
    </table>
  </div>
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
 /* ── 따져 = 「따져보고 판매하라」. 어휘가 전부 «판별» 이다(증거·판정·보류·충돌).
    그래서 이 화면은 대시보드가 아니라 **증거 조서** 로 짰다. ───────────────── */
 :root{
   --ink:#1a1f2e;          /* 구조 · 먹색 */
   --ink-soft:#4a5468;
   --paper:#faf8f4;        /* 읽는 면 · 종이 */
   --sheet:#fffdf9;
   --rule:#ddd6c9;         /* 실선 — 종이쪽으로 치우친 중성색 */
   --seal:#9a6b2f;         /* 강조 · 인(印) 황동 — 사슬 번호·눈썹·링크 */
   --alarm:#a8322a;        /* 의미색: 🔴 읽지 못함 (프로젝트 기존 관례) */
   --affirm:#2f6b4a;       /* 의미색: 🟢 확인됨 */
   --kr-serif:"Nanum Myeongjo","Apple SD Gothic Neo",Batang,"Times New Roman",serif;
   --kr-sans:Pretendard,"Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",system-ui,sans-serif;
   --mono:ui-monospace,SFMono-Regular,"SF Mono",Consolas,"Liberation Mono",monospace;
 }
 *{box-sizing:border-box}
 body{margin:0;padding:0;background:var(--paper);color:var(--ink);
      font:15px/1.75 var(--kr-sans);-webkit-font-smoothing:antialiased}
 .wrap{max-width:1120px;margin:0 auto;padding:40px 24px 80px;display:flex;flex-direction:column;gap:28px}

 /* 조서 표제 */
 .masthead{border-bottom:2px solid var(--ink);padding-bottom:20px;
           display:flex;flex-direction:column;gap:10px}
 .eyebrow{font:600 11px/1 var(--kr-sans);letter-spacing:.18em;text-transform:uppercase;color:var(--seal)}
 h1{font:400 34px/1.3 var(--kr-serif);margin:0;text-wrap:balance;letter-spacing:-.01em}
 .masthead .count{font-variant-numeric:tabular-nums;font-family:var(--mono);
                  font-size:12px;color:var(--ink-soft)}

 .note{background:var(--sheet);border:1px solid var(--rule);padding:20px 22px;
       display:flex;flex-direction:column;gap:10px}
 .note h3{font:600 13px/1 var(--kr-sans);letter-spacing:.08em;margin:0;color:var(--seal);
          text-transform:uppercase}
 .note ul{margin:0;padding-left:20px;display:flex;flex-direction:column;gap:7px;
          max-width:62rem;color:var(--ink-soft)}
 .note li b{color:var(--ink)}
 .note.limit{border-left:3px solid var(--alarm);background:#fdf8f7}
 .note.limit h3{color:var(--alarm)}

 /* 사건 기록 한 장 */
 .card{background:var(--sheet);border:1px solid var(--rule);
       display:flex;flex-direction:column;gap:16px;padding:24px}
 .card h2{font:400 22px/1.3 var(--kr-serif);margin:0;
          display:flex;align-items:baseline;gap:12px;flex-wrap:wrap}
 .card h2 .cid{font-family:var(--mono);font-size:13px;font-variant-numeric:tabular-nums;
               color:var(--seal);letter-spacing:.04em}
 .meta{display:flex;flex-wrap:wrap;gap:8px;align-items:center;
       font-size:12px;color:var(--ink-soft)}
 .meta .pill{border:1px solid var(--rule);padding:3px 9px;background:var(--paper)}
 .meta .pill b{color:var(--ink);font-weight:600}
 .meta .src{flex-basis:100%;color:#8c8578;font-size:11px;font-family:var(--mono)}

 /* 증거 원장 — 좌측 레일이 사슬 ①→⑥ 이고, 끊긴 칸은 선으로 지운다 */
 .ledger{overflow-x:auto}
 table.ev{width:100%;border-collapse:collapse;min-width:640px}
 table.ev td,table.ev th{border-bottom:1px solid var(--rule);padding:10px 12px;
                         vertical-align:top;text-align:left;font-size:14px;word-break:break-word}
 table.ev thead td,table.ev thead th{border-bottom:1.5px solid var(--ink);
   font:600 11px/1 var(--kr-sans);letter-spacing:.1em;text-transform:uppercase;color:var(--ink-soft);
   padding-bottom:8px}
 table.ev td.step{width:34px;text-align:center;color:var(--seal);font-size:13px;
                  border-right:1px solid var(--rule);background:var(--paper)}
 table.ev tbody th{width:170px;font-weight:600;color:var(--ink)}
 table.ev tbody th em{display:block;font-style:normal;font-weight:400;margin-top:3px;
                      font-size:11px;line-height:1.5;color:var(--alarm)}
 table.ev td.mono{font-family:var(--mono);font-variant-numeric:tabular-nums;font-size:13px}
 tr.broken th{text-decoration:line-through;text-decoration-color:var(--alarm);
              text-decoration-thickness:1px;color:var(--ink-soft)}
 tr.broken td.step{color:var(--alarm);opacity:.55}
 .na{color:var(--alarm);font-size:13px}

 /* 상세설명 — 이 화면의 본문. 두 장을 나란히 둔다 */
 .descs{display:grid;grid-template-columns:1fr 1fr;gap:16px}
 @media(max-width:860px){.descs{grid-template-columns:1fr}}
 .desc{background:var(--paper);border:1px solid var(--rule);padding:14px 16px;
       display:flex;flex-direction:column;gap:8px}
 .desc b{font:600 11px/1 var(--kr-sans);letter-spacing:.1em;text-transform:uppercase;
         color:var(--seal)}
 .desc p{white-space:pre-wrap;margin:0;max-height:300px;overflow-y:auto;
         font-size:13.5px;line-height:1.8;color:var(--ink)}
 .desc.empty{border-left:3px solid var(--alarm);background:#fdf8f7}
 .desc.empty b{color:var(--alarm)}
 .desc.empty p{color:var(--ink-soft)}

 .auto,.judge{border:1px solid var(--rule);padding:14px 16px;background:var(--paper);
              display:flex;flex-direction:column;gap:8px;font-size:13.5px}
 .auto b,.judge b{font:600 11px/1 var(--kr-sans);letter-spacing:.1em;text-transform:uppercase;
                  color:var(--seal)}
 .auto ul{margin:0;padding-left:20px;display:flex;flex-direction:column;gap:6px;color:var(--ink-soft)}
 .auto ul b{font:inherit;letter-spacing:0;text-transform:none;color:var(--ink);
            font-family:var(--mono);font-size:13px}

 /* 대표님이 답하는 자리 — 유일하게 색을 쓰는 블록 */
 .ask{border:1px solid var(--seal);border-left-width:3px;background:#fdfaf4;
      padding:16px 18px;display:flex;flex-direction:column;gap:10px}
 .ask b{font:600 11px/1 var(--kr-sans);letter-spacing:.1em;text-transform:uppercase;color:var(--seal)}
 .ask ol{margin:0;padding-left:22px;display:flex;flex-direction:column;gap:8px;max-width:58rem}
 .ask ol li::marker{font-family:var(--mono);color:var(--seal)}
 .ask ol li:last-child{border-top:1px solid var(--rule);padding-top:10px;margin-top:2px}

 .links{display:flex;gap:18px;flex-wrap:wrap}
 .links a{color:var(--seal);text-decoration:none;border-bottom:1px solid var(--seal);
          font-size:13px;padding-bottom:1px}
 .links a:hover,.links a:focus-visible{color:var(--ink);border-bottom-color:var(--ink)}
 :focus-visible{outline:2px solid var(--seal);outline-offset:2px}
 @media(prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
</style>
<div class="wrap">
<header class="masthead">
 <span class="eyebrow">따져 · 동일상품 증거 조서</span>
 <h1>상세설명만으로 동일상품을 가릴 수 있습니까?</h1>
 <span class="count">검토 대상 ${picked.length}건 · 대표님 확인 1회</span>
</header>

<div class="note">
 <h3>왜 이 화면인가</h3>
 <ul>
  <li>지금까지는 <b>코드가 이미 가진 칸</b>(브랜드·색상·소재)만 파고들었습니다. 대표님 말씀대로
      <b>상세설명 하나만 제대로 읽어도</b> 필요한 정보가 대부분 나올 수 있습니다.</li>
  <li>그래서 이 화면은 <b>상세설명 전문을 그대로</b> 보여 드리고, 사건마다 여섯 가지만 묻습니다.</li>
  <li>왼쪽 번호 ①–⑥ 은 <b>증거를 보는 순서</b>입니다. 후보 쪽이 빈 칸은 <b>줄을 그어</b>
      두었으니, 사슬이 어디서 끊기는지 바로 보입니다.</li>
  <li>시스템 판정은 <b>참고용</b>입니다. 대표님 판단이 기준이고,
      <b>CTO 는 이 화면에서 아무 판정도 채우지 않았습니다.</b></li>
 </ul>
</div>

<div class="note limit">
 <h3>먼저 알려 드릴 한계 셋</h3>
 <ul>
  <li><b>현재 브랜드 추출기는 상세설명을 읽지 않습니다.</b> 그래서 「설명에서 브랜드를 찾은 건수 0」은
      <b>효과가 0이라는 뜻이 아니라, 읽는 경로가 아직 없다는 뜻</b>입니다.</li>
  <li><b>형태·색상·소재·세트 구성도 상세설명에서 추출하는 경로가 없습니다.</b>
      빈 칸을 「그 상품에 없다」로 읽지 말아 주십시오.</li>
  <li><b>${esc(MISSING_HOSTS.join(" · "))}</b> 는 이 묶음에 <b>들어 있지 않습니다</b>
      (다른 조사에서 쓴 라벨입니다). 분모는 ${picked.length}건입니다.</li>
 </ul>
</div>
${cards}
</div>
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
