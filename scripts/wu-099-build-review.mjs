/**
 * WU-099 — **DROPPED 후보 가치 검증 페이지 생성기** (일회성 도구 · 운영 코드 아님)
 *
 * 🔴 운영 경로에 없다 — `apps/admin` 이 import 하지 않고 배포에도 들어가지 않는다.
 * 🔴 **값을 만들지 않는다** — 덤프(JSON)에 있는 것만 그린다.
 *    `priceTier` / `matchTruth` / `verified` 는 **애초에 덤프에 없다**(CPO 금지).
 * 🔴 **MI 에 넣지 않는다** — 이 페이지는 가격비교 경로와 **완전히 분리** 돼 있다.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const SRC = path.join(process.env.TEMP ?? ".", "mi-p0-02", "wu-099.json");
const OUT = path.join(process.cwd(), "docs", "wu-099-dropped-review.html");
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const or = (v) => (v === null || v === undefined || v === "" ? null : v);
const money = (p) => (p ? `${p.currency} ${Number(p.amount).toLocaleString()}` : null);

/** 🔴 ASCII 만 — 한글 경로가 헤더에 들어가면 fetch 가 던진다(WU-093 에서 10/12 실패). */
const originOf = (u) => {
  try {
    return new URL(u).origin;
  } catch {
    return undefined;
  }
};

/**
 * 🔴🔴 WU-100 — **검증 화면용 이미지 보강.** 운영 추출기는 **고치지 않는다**(CPO STEP 2).
 * 🔴 사이트별 규칙을 만들지 않는다 — **모든 후보에서 `og:image` 를 같이 가져와**
 *    운영 `imageUrl` 과 **다르면 둘 다** 보여준다. 그러면
 *    ⒜ imageUrl 이 null 인 11건 ⒝ 이미지가 잘려 판단 불가였던 1건 을
 *    **같은 규칙 하나로** 해결한다(하드코딩 0).
 */
async function ogImage(pageUrl) {
  try {
    const r = await fetch(pageUrl, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(25000) });
    if (!r.ok) return null;
    const html = await r.text();
    const m =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ??
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    return m ? new URL(m[1], pageUrl).toString() : null;
  } catch {
    return null;
  }
}

async function dataUri(imgUrl, pageUrl) {
  if (!imgUrl) return null;
  try {
    const r = await fetch(imgUrl, {
      headers: { "User-Agent": UA, Referer: originOf(pageUrl ?? imgUrl), Accept: "image/*" },
      signal: AbortSignal.timeout(30000),
    });
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 3_000_000) return null;
    const type = r.headers.get("content-type")?.split(";")[0] ?? "image/jpeg";
    return `data:${type};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

/**
 * 🔴🔴 **CEO 지적(2026-10-19): 「원상품이 뭔지 알려줘야 비교할 수 있다」.**
 *    1차 페이지는 후보만 보여주고 원상품을 **설명 문장에만** 적었다 — 육안 비교가
 *    목적인데 **비교 대상이 화면에 없었다**. 🟢 운영 facts 로 원상품을 올린다.
 * 🔴 가격이 `null` 이면 **「없음」으로 적는다**(SHOPIFY_JSON 경로 · WU-079 보류 항목).
 */
const ORIGIN_SRC = path.join(process.env.TEMP ?? ".", "mi-p0-02", "wu-099-origin.json");
const origin = JSON.parse(readFileSync(ORIGIN_SRC, "utf8"));
origin.img = await dataUri(origin.imageUrl, origin.url);
console.log(`원상품 이미지 ${origin.img ? "🟢" : "🔴 없음"}`);

const data = JSON.parse(readFileSync(SRC, "utf8"));
let ok = 0;
let fail = 0;
let ogAdded = 0;
for (const d of data.dropped) {
  /**
   * 🔴 **후보당 한 장만** 임베드한다 — 둘을 다 넣으니 페이지가 **11.85MB** 가 됐다.
   * 🟢 `og:image`(페이지 대표 이미지)를 **우선** 쓴다 — 목록 썸네일보다 상품을 잘 보여주고,
   *    그것이 ⒜ imageUrl null 11건 ⒝ 잘려서 판단불가 1건 을 **한 규칙으로** 해결한다.
   * 🔴 화면에 **「페이지 대표 이미지」라고 적는다** — 어느 그림인지 숨기지 않는다.
   */
  const og = await ogImage(d.url);
  d.ogUrl = og;
  d.img = og ? await dataUri(og, d.url) : null;
  d.fromOg = Boolean(d.img);
  if (!d.img) d.img = await dataUri(d.imageUrl, d.url);
  if (d.fromOg) ogAdded += 1;
  d.img ? ok++ : fail++;
}
console.log(`og:image 보강 ${ogAdded}건`);
console.log(`이미지 임베드 ${ok} · 실패 ${fail}`);

/** 🔴 시스템 판정 어휘를 **그대로** 쓴다 — 새 라벨을 만들지 않는다. */
const VERDICT = {
  CONFLICT: ["🔴", "충돌"],
  SIMILAR: ["⚪", "유사"],
  UNKNOWN: ["🟡", "판정 보류"],
  PRESUMED_SAME: ["🟡", "동일상품 추정"],
  SAME: ["🟢", "동일상품"],
};
const vlabel = (v) => {
  const x = VERDICT[v];
  return x ? `${x[0]} ${x[1]}` : `⚪ ${v ?? "없음"}`;
};

const field = (k, v) =>
  `<div class="f"><dt>${esc(k)}</dt><dd${or(v) === null ? ' class="none"' : ""}>${esc(or(v) ?? "없음")}</dd></div>`;

const card = (d, i) => `
<article class="c" data-i="${i}" data-domain="${esc(d.domain)}" data-url="${esc(d.url)}">
  <header class="h">
    <span class="n">${i + 1}</span>
    <b>${esc(d.domain)}</b>
    <span class="v ${esc(String(d.crossSellerVerdict))}">${esc(vlabel(d.crossSellerVerdict))}</span>
  </header>
  <div class="body">
    <div class="pic">${
      d.img
        ? `<img src="${d.img}" alt="${esc(d.title)}" loading="lazy"><span class="isrc">${
            d.fromOg ? "페이지 대표 이미지" : "목록 썸네일"
          }</span>`
        : `<div class="noimg">이미지를 가져오지 못했습니다<br><small>링크를 열어 확인해 주십시오</small></div>`
    }</div>
    <div>
      <p class="t">${esc(d.title)}</p>
      <dl>
        ${field("브랜드", d.brand)}
        ${field("상품코드", d.modelCode)}
        ${field("색상", d.color)}
        ${field("가격", money(d.price))}
        ${field("시장", d.market)}
      </dl>
      <p class="why"><b>보류 사유</b> 증거 평가를 시작하지 않았습니다 (${esc(d.dropGate)})</p>
      ${
        d.crossSellerBlockers.length || d.crossSellerConflicts.length
          ? `<p class="blk">${esc([...d.crossSellerBlockers, ...d.crossSellerConflicts].join(" · "))}</p>`
          : ""
      }
      ${d.matchReasons.length ? `<p class="rsn">${esc(d.matchReasons.join(" · "))}</p>` : ""}
      <a class="ext" href="${esc(d.url)}" target="_blank" rel="noreferrer">상품 페이지 열기 ↗</a>
    </div>
  </div>
  <div class="judge" role="group" aria-label="${i + 1}번 후보 평가">
    <button type="button" data-v="USEFUL">🟢 유용함</button>
    <button type="button" data-v="NOISE">🔴 불필요</button>
    <button type="button" data-v="UNSURE">🟡 판단 어려움</button>
    <label class="note">메모 <input type="text" aria-label="${i + 1}번 메모" placeholder="선택"></label>
  </div>
</article>`;

const html = `<title>WU-099 — 보류 후보 가치 검증 (26건)</title>
<style>
  :root{--ink:#16181c;--dim:#6b6f78;--paper:#fbfaf7;--card:#fff;--rule:#e4ded4;
        --ok:#2f6b4f;--no:#a8402a;--un:#8a6a14;--accent:#2f4858}
  *{box-sizing:border-box}
  body{margin:0;background:var(--paper);color:var(--ink);
       font:15px/1.6 -apple-system,"Segoe UI","Malgun Gothic",system-ui,sans-serif;
       font-variant-numeric:tabular-nums}
  .wrap{max-width:900px;margin:0 auto;padding:28px 18px 120px}
  h1{font-size:25px;letter-spacing:-.02em;margin:0 0 6px;text-wrap:balance}
  .lede{color:var(--dim);margin:0 0 18px;max-width:62ch}
  .howto{background:var(--card);border:1px solid var(--rule);border-radius:10px;padding:14px 16px;margin:0 0 24px}
  .howto ol{margin:8px 0 0;padding-left:20px}
  .c{background:var(--card);border:1px solid var(--rule);border-radius:12px;padding:14px;margin:0 0 14px}
  .h{display:flex;gap:9px;align-items:center;margin:0 0 10px;flex-wrap:wrap}
  .n{font:600 11px/1 ui-monospace,Menlo,monospace;background:var(--accent);color:#fff;
     border-radius:5px;padding:4px 7px}
  .v{margin-left:auto;font-size:12px;border:1px solid var(--rule);border-radius:999px;padding:1px 10px}
  .v.CONFLICT{color:var(--no)} .v.SIMILAR{color:var(--dim)} .v.UNKNOWN{color:var(--un)}
  .body{display:grid;grid-template-columns:200px 1fr;gap:14px}
  @media(max-width:620px){.body{grid-template-columns:1fr}}
  .crit{background:#fff8e8;border-left:3px solid var(--un);padding:8px 10px;margin:6px 0;border-radius:4px}
  .pic{display:grid;gap:4px}
  .isrc{font-size:10px;color:var(--dim);text-align:center}
  .pic img{width:100%;height:190px;object-fit:contain;background:#f3f1ec;
           border:1px solid var(--rule);border-radius:8px;display:block}
  .noimg{height:190px;display:flex;align-items:center;justify-content:center;color:var(--dim);
         font-size:12px;background:#f3f1ec;border:1px dashed var(--rule);border-radius:8px}
  .t{margin:0 0 8px;font-size:14px;line-height:1.45}
  dl{margin:0}
  .f{display:grid;grid-template-columns:72px 1fr;gap:8px;padding:2px 0;font-size:13px;
     border-bottom:1px solid #f2efe9}
  dt{color:var(--dim);font-size:12px} dd{margin:0;word-break:break-word}
  dd.none{color:#a8a39a}
  .why{margin:9px 0 0;font-size:12px;color:var(--dim)}
  .blk{margin:4px 0 0;font-size:12px;color:var(--no)}
  .rsn{margin:4px 0 0;font-size:12px;color:var(--dim)}
  .ext{display:inline-block;margin-top:9px;font-size:12px;color:var(--accent)}
  .judge{margin-top:12px;display:flex;gap:7px;align-items:center;flex-wrap:wrap}
  .judge button{font:inherit;font-size:13px;cursor:pointer;background:#fff;color:var(--ink);
    border:1.5px solid var(--rule);border-radius:8px;padding:7px 13px}
  .judge button:hover{border-color:var(--accent)}
  .judge button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
  .judge button[aria-pressed=true][data-v=USEFUL]{background:var(--ok);border-color:var(--ok);color:#fff}
  .judge button[aria-pressed=true][data-v=NOISE]{background:var(--no);border-color:var(--no);color:#fff}
  .judge button[aria-pressed=true][data-v=UNSURE]{background:var(--un);border-color:var(--un);color:#fff}
  .note{flex:1;min-width:200px;font-size:12px;color:var(--dim);display:flex;gap:7px;align-items:center}
  .note input{flex:1;font:inherit;font-size:13px;color:var(--ink);padding:7px 9px;
    border:1px solid var(--rule);border-radius:8px}
  .bar{position:fixed;left:0;right:0;bottom:0;background:rgba(251,250,247,.97);
       border-top:1px solid var(--rule);padding:11px 18px;display:flex;gap:14px;
       align-items:center;justify-content:center;flex-wrap:wrap}
  .bar button{font:inherit;font-size:14px;cursor:pointer;background:var(--ink);color:#fff;
    border:0;border-radius:9px;padding:9px 18px}
  .prog{font-size:13px;color:var(--dim)}
  /* 🔴 CEO 지적 — 원상품이 **스크롤해도 보여야** 비교가 된다. */
  .origin{position:sticky;top:0;z-index:5;display:grid;grid-template-columns:132px 1fr;gap:14px;
    background:var(--card);border:2px solid var(--accent);border-radius:12px;padding:12px;margin:0 0 20px;
    box-shadow:0 6px 18px rgba(0,0,0,.06)}
  @media(max-width:620px){.origin{grid-template-columns:96px 1fr}}
  .opic img{width:100%;height:132px;object-fit:contain;background:#f3f1ec;
    border:1px solid var(--rule);border-radius:8px;display:block}
  @media(max-width:620px){.opic img{height:96px}}
  .olabel{margin:0;font-size:11px;letter-spacing:.09em;text-transform:uppercase;color:var(--accent);font-weight:600}
  .ot{margin:2px 0 6px;font-size:16px;font-weight:600;line-height:1.35}
  textarea{position:absolute;left:-9999px}
</style>
<div class="wrap">
  <h1>보류 후보 — 보여줄 가치가 있습니까?</h1>
  <p class="lede">시스템이 <b>판정을 시작하지도 않고</b> 버린 후보 ${data.dropped.length}건입니다.
     지금은 화면에 <b>전혀 나오지 않습니다</b>. 이걸 보여주는 게 도움이 될지 봐 주십시오.</p>
  <div class="howto">
    <b>보시는 방법</b>
    <ol>
      <li><b>맨 위에 고정된 원상품</b>과 각 후보를 비교합니다.</li>
      <li class="crit"><b>기준은 하나입니다 — 「이것이 원상품과 «동일상품» 후보로 다시 볼 가치가 있는가」.</b>
        <br>🟢 <b>유용함</b> — 동일상품 후보로 다시 검토할 가치가 있다
        <br>🔴 <b>불필요</b> — 동일상품 후보로 볼 가치가 없다
        <br>🟡 <b>판단 어려움</b> — 정보가 부족해 판단할 수 없다
        <br><b>🔴 「같은 브랜드라 참고할 만하다」는 «유용함» 이 아닙니다.</b></li>
      <li>전부 고른 뒤 맨 아래 <b>결과 복사</b> → 그대로 붙여넣어 주십시오.</li>
    </ol>
    <p style="margin:9px 0 0;font-size:13px;color:var(--dim)">
      ※ 이 화면은 <b>검증 전용</b>입니다. 여기서 무엇을 누르셔도
      <b>가격비교·동일상품 판정·알림은 전혀 바뀌지 않습니다.</b><br>
      ※ <b>상품코드·색상이 「없음」</b>이거나 <b>가격이 없는</b> 것은 정상입니다 — 그것이 지금 측정 중인 상태입니다.</p>
  </div>
  <section class="origin" aria-label="비교 기준 원상품">
    <div class="opic">${
      origin.img
        ? `<img src="${origin.img}" alt="${esc(origin.title)}">`
        : `<div class="noimg">이미지 없음</div>`
    }</div>
    <div>
      <p class="olabel">비교 기준 — 원상품</p>
      <p class="ot">${esc(origin.title)}</p>
      <dl>
        ${field("브랜드", origin.brand)}
        ${field("상품코드", origin.modelCode)}
        ${field("색상", origin.color)}
        ${field("가격", money(origin.price))}
      </dl>
      <a class="ext" href="${esc(origin.url)}" target="_blank" rel="noreferrer">원상품 페이지 열기 ↗</a>
    </div>
  </section>
  ${data.dropped.map(card).join("")}
</div>
<div class="bar"><span class="prog" id="prog"></span><button type="button" id="copy">결과 복사</button></div>
<textarea id="sink" aria-hidden="true"></textarea>
<script>
(function(){
  var cards = Array.prototype.slice.call(document.querySelectorAll('.c'));
  function prog(){
    var n = cards.filter(function(c){ return c.dataset.v; }).length;
    document.getElementById('prog').textContent = n + ' / ' + cards.length + ' 평가함';
  }
  cards.forEach(function(card){
    card.querySelectorAll('.judge button').forEach(function(b){
      b.setAttribute('aria-pressed','false');
      b.addEventListener('click', function(){
        card.querySelectorAll('.judge button').forEach(function(o){ o.setAttribute('aria-pressed','false'); });
        b.setAttribute('aria-pressed','true');
        card.dataset.v = b.dataset.v;
        prog();
      });
    });
  });
  prog();
  document.getElementById('copy').addEventListener('click', function(){
    var out = cards.map(function(c){
      return { domain: c.dataset.domain, url: c.dataset.url,
               value: c.dataset.v || null,
               note: (c.querySelector('.note input').value || '').trim() || null };
    });
    var txt = JSON.stringify({ wu: 'WU-099', review: out }, null, 1);
    var s = document.getElementById('sink'); s.value = txt; s.select();
    try { document.execCommand('copy'); } catch (e) {}
    if (navigator.clipboard) { navigator.clipboard.writeText(txt).catch(function(){}); }
    var b = document.getElementById('copy'); var t = b.textContent;
    b.textContent = '복사했습니다 — 붙여넣어 주십시오';
    setTimeout(function(){ b.textContent = t; }, 2200);
  });
})();
</script>`;

writeFileSync(OUT, html, "utf8");
console.log(`작성: ${OUT} (${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MB)`);
