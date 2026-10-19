/**
 * WU-093 — CEO 육안 GT 검증 페이지 **생성기** (일회성 도구 · 운영 코드 아님)
 *
 * 🔴 이 스크립트는 **운영 경로에 없다.** `apps/admin` 이 import 하지 않고, 배포에도
 *    들어가지 않는다. 하는 일은 셋뿐이다:
 *      ① WU-093 덤프(JSON)를 읽는다
 *      ② 검증 화면에 쓸 이미지를 **data: URI 로 끼워 넣는다**(자립형 페이지를 위해)
 *      ③ 자립형 HTML 을 쓴다
 * 🔴 판정(verdict/matchLevel/blocker)은 **읽기만** 한다 — 다시 계산하지 않는다(§9).
 * 🔴 원상품 이미지가 비어 있을 때만 `og:image` 를 **검증 화면용으로** 보충한다.
 *    운영 추출기를 고치지 않는다(§8 금지).
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const SRC = path.join(process.env.TEMP ?? ".", "mi-p0-02", "wu-093-gt.json");
const OUT = path.join(process.cwd(), "docs", "wu-093-gt-review.html");
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
/** 🔴 값이 없으면 «없음» 이라고 적는다 — 지어내지 않는다(§2). */
const or = (v) => (v === null || v === undefined || v === "" ? null : v);
const money = (p) => (p ? `${p.currency} ${Number(p.amount).toLocaleString()}` : null);

async function ogImage(pageUrl) {
  try {
    const r = await fetch(pageUrl, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20000) });
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

/** 🔴 ASCII 만 남긴다 — 한글 경로가 헤더에 들어가면 fetch 가 던진다. */
function originOf(u) {
  try {
    return new URL(u).origin;
  } catch {
    return undefined;
  }
}

async function dataUri(imgUrl, referer) {
  if (!imgUrl) return null;
  try {
    const r = await fetch(imgUrl, {
      /**
       * 🔴 **한글이 든 URL 을 Referer 에 그대로 넣으면 fetch 가 던진다** —
       *    `Cannot convert argument to a ByteString`. 실측에서 12건 중 10건이
       *    이것 때문에 실패했고 **이미지 자체는 200** 이었다.
       * 🟢 origin 만 쓴다(ASCII 보장 · 핫링크 차단에도 충분하다).
       */
      headers: { "User-Agent": UA, Referer: originOf(referer ?? imgUrl), Accept: "image/*" },
      signal: AbortSignal.timeout(30000),
    });
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 3_000_000) return null; // 🔴 과도하게 큰 것은 넣지 않는다
    const type = r.headers.get("content-type")?.split(";")[0] ?? "image/jpeg";
    return `data:${type};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

const data = JSON.parse(readFileSync(SRC, "utf8"));
let embedded = 0;
let failed = 0;

for (const c of data.cases) {
  if (!c.origin.imageUrl) {
    c.origin.imageUrl = await ogImage(c.origin.url);
    c.origin.imageFromOg = Boolean(c.origin.imageUrl);
  }
  c.origin.img = await dataUri(c.origin.imageUrl, c.origin.url);
  c.origin.img ? embedded++ : failed++;
  for (const s of c.shops)
    for (const x of s.candidates) {
      x.img = await dataUri(x.imageUrl, x.url);
      x.img ? embedded++ : failed++;
    }
}
console.log(`이미지 임베드 ${embedded} · 실패 ${failed}`);

/* ──────────────────────────── 렌더 ──────────────────────────── */
const field = (label, v) =>
  `<div class="f"><dt>${esc(label)}</dt><dd${or(v) === null ? ' class="none"' : ""}>${esc(or(v) ?? "없음")}</dd></div>`;

const pic = (img, alt) =>
  img
    ? `<img src="${img}" alt="${esc(alt)}" loading="lazy">`
    : `<div class="noimg">이미지를 가져오지 못했습니다</div>`;

function candidateBlock(c, s, x, i) {
  const id = `${c.id}-${s.domain}-${i}`;
  const o = c.origin;
  return `
<article class="cand" data-id="${esc(id)}" data-case="${esc(c.id)}" data-shop="${esc(s.domain)}" data-url="${esc(x.url)}">
  <header class="candhead">
    <span class="idx">${esc(id)}</span>
    <span class="shop">${esc(s.shopName)}</span>
  </header>
  <div class="cmp">
    <section class="side">
      <h4>원상품</h4>
      ${pic(o.img, o.title ?? "")}
      <dl>
        ${field("상품명", o.title)}
        ${field("브랜드", o.brand)}
        ${field("상품코드", o.modelCode)}
        ${field("색상", o.color)}
        ${field("가격", money(o.price))}
      </dl>
      <a class="ext" href="${esc(o.url)}" target="_blank" rel="noreferrer">원상품 페이지 열기 ↗</a>
    </section>
    <section class="side">
      <h4>후보</h4>
      ${pic(x.img, x.title ?? "")}
      <dl>
        ${field("상품명", x.title)}
        ${field("브랜드", x.brand)}
        ${field("상품코드 / SKU", x.modelCode)}
        ${field("색상", x.color)}
        ${field("가격", money(x.price))}
        ${field("시장", x.market)}
      </dl>
      <a class="ext" href="${esc(x.url)}" target="_blank" rel="noreferrer">후보 페이지 열기 ↗</a>
    </section>
  </div>
  <div class="sys">
    <b>시스템 판정</b>
    <span class="tag">${esc(x.systemVerdict ?? "없음")}</span>
    <span class="tag alt">matchLevel ${esc(x.systemMatchLevel ?? "없음")}</span>
    <span class="blk">blocker ${x.systemBlockers.length ? esc(x.systemBlockers.join(", ")) : "없음"}</span>
    <div class="rsn">${x.systemReasons.length ? esc(x.systemReasons.join(" · ")) : "근거 없음"}</div>
  </div>
  <div class="judge">
    <div class="btns" role="group" aria-label="${esc(id)} 육안 판정">
      <button type="button" data-v="SAME">🟢 SAME</button>
      <button type="button" data-v="DIFFERENT">🔴 DIFFERENT</button>
      <button type="button" data-v="UNCERTAIN">🟡 UNCERTAIN</button>
    </div>
    <label class="note">메모 <input type="text" placeholder="예: 색상이 다름 / 베이비 라인 / 양말임" aria-label="${esc(id)} 메모"></label>
  </div>
</article>`;
}

function caseBlock(c) {
  const shops = c.shops
    .map((s) => {
      const n = s.candidates.length;
      const head = `<div class="shophead"><b>${esc(s.shopName)}</b> <span class="dim">${esc(s.domain)}</span>
        <span class="cnt ${n === 0 ? "zero" : ""}">${s.status === "ok" ? `후보 ${n}건` : `검색 ${esc(s.status)}`}</span></div>`;
      if (n === 0) return `<div class="shop0">${head}</div>`;
      return `<div class="shopg">${head}${s.candidates.map((x, i) => candidateBlock(c, s, x, i + 1)).join("")}</div>`;
    })
    .join("");
  return `
<section class="case">
  <h2>${esc(c.id)} — 원상품 ${esc(c.origin.expectCode)}</h2>
  <p class="meta">후보 합계 <b>${c.total}</b>건 · 검색한 판매처 ${c.shops.length}곳${
    c.origin.imageFromOg ? " · <span class=\"warn\">원상품 이미지는 검증 화면용으로 페이지에서 가져왔습니다</span>" : ""
  }</p>
  ${shops}
</section>`;
}

const html = `<title>WU-093 — 후보 육안 검증 (S1 / S2)</title>
<style>
  :root{--ink:#16181c;--dim:#6b6f78;--paper:#fbfaf7;--card:#fff;--rule:#e4ded4;
        --ok:#2f6b4f;--no:#a8402a;--un:#8a6a14;--accent:#2f4858}
  *{box-sizing:border-box}
  body{margin:0;background:var(--paper);color:var(--ink);
       font:15px/1.6 -apple-system,"Segoe UI","Malgun Gothic",system-ui,sans-serif;
       font-variant-numeric:tabular-nums}
  .wrap{max-width:1040px;margin:0 auto;padding:28px 18px 120px}
  h1{font-size:25px;letter-spacing:-.02em;margin:0 0 6px;text-wrap:balance}
  h2{font-size:19px;margin:0 0 4px;letter-spacing:-.01em}
  h4{font-size:11px;letter-spacing:.09em;text-transform:uppercase;color:var(--dim);margin:0 0 8px}
  .lede{color:var(--dim);margin:0 0 20px;max-width:62ch}
  .howto{background:var(--card);border:1px solid var(--rule);border-radius:10px;padding:14px 16px;margin:0 0 26px}
  .howto ol{margin:8px 0 0;padding-left:20px} .howto li{margin:3px 0}
  .case{margin:34px 0 0;border-top:2px solid var(--ink);padding-top:16px}
  .meta{color:var(--dim);font-size:13px;margin:0 0 14px}
  .warn{color:var(--un)}
  .shophead{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap;margin:16px 0 8px}
  .dim{color:var(--dim);font-size:12px}
  .cnt{margin-left:auto;font-size:12px;color:var(--accent);border:1px solid var(--rule);
       border-radius:999px;padding:1px 10px;background:var(--card)}
  .cnt.zero{color:var(--dim)}
  .shop0{opacity:.72}
  .cand{background:var(--card);border:1px solid var(--rule);border-radius:12px;
        padding:14px;margin:0 0 14px}
  .candhead{display:flex;gap:10px;align-items:baseline;margin:0 0 10px}
  .idx{font:600 11px/1 ui-monospace,SFMono-Regular,Menlo,monospace;color:#fff;background:var(--accent);
       border-radius:5px;padding:4px 7px;letter-spacing:.03em}
  .shop{font-size:12px;color:var(--dim)}
  .cmp{display:grid;grid-template-columns:1fr 1fr;gap:14px}
  @media(max-width:680px){.cmp{grid-template-columns:1fr}}
  .side img{width:100%;height:230px;object-fit:contain;background:#f3f1ec;
            border:1px solid var(--rule);border-radius:8px;display:block}
  .noimg{height:230px;display:flex;align-items:center;justify-content:center;color:var(--dim);
         font-size:12px;background:#f3f1ec;border:1px dashed var(--rule);border-radius:8px}
  dl{margin:10px 0 0}
  .f{display:grid;grid-template-columns:76px 1fr;gap:8px;padding:3px 0;font-size:13px;
     border-bottom:1px solid #f2efe9}
  dt{color:var(--dim);font-size:12px} dd{margin:0;word-break:break-word}
  dd.none{color:#a8a39a}
  .ext{display:inline-block;margin-top:9px;font-size:12px;color:var(--accent)}
  .sys{margin:12px 0 0;padding:10px 12px;background:#f6f4ef;border-radius:8px;font-size:12.5px}
  .sys b{margin-right:8px}
  .tag{display:inline-block;border:1px solid var(--rule);background:#fff;border-radius:5px;
       padding:1px 7px;margin-right:5px;font-size:12px}
  .tag.alt{color:var(--dim)}
  .blk{color:var(--no)}
  .rsn{color:var(--dim);margin-top:5px;font-size:12px}
  .judge{margin-top:12px;display:flex;gap:12px;align-items:center;flex-wrap:wrap}
  .btns{display:flex;gap:6px}
  .btns button{font:inherit;font-size:13px;cursor:pointer;background:#fff;color:var(--ink);
    border:1.5px solid var(--rule);border-radius:8px;padding:7px 13px}
  .btns button:hover{border-color:var(--accent)}
  .btns button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
  .btns button[aria-pressed=true][data-v=SAME]{background:var(--ok);border-color:var(--ok);color:#fff}
  .btns button[aria-pressed=true][data-v=DIFFERENT]{background:var(--no);border-color:var(--no);color:#fff}
  .btns button[aria-pressed=true][data-v=UNCERTAIN]{background:var(--un);border-color:var(--un);color:#fff}
  .note{flex:1;min-width:230px;font-size:12px;color:var(--dim);display:flex;gap:7px;align-items:center}
  .note input{flex:1;font:inherit;font-size:13px;color:var(--ink);padding:7px 9px;
    border:1px solid var(--rule);border-radius:8px;background:#fff}
  .bar{position:fixed;left:0;right:0;bottom:0;background:rgba(251,250,247,.97);
       border-top:1px solid var(--rule);padding:11px 18px;display:flex;gap:14px;
       align-items:center;justify-content:center;flex-wrap:wrap}
  .bar button{font:inherit;font-size:14px;cursor:pointer;background:var(--ink);color:#fff;
    border:0;border-radius:9px;padding:9px 18px}
  .prog{font-size:13px;color:var(--dim)}
  textarea{position:absolute;left:-9999px}
</style>
<div class="wrap">
  <h1>후보 육안 검증 — S1 / S2</h1>
  <p class="lede">시스템이 낸 판정은 <b>그대로 보여만</b> 드립니다. 바뀌지 않습니다.
     아래 판정은 <b>따로 저장되는 사람 판정(GT)</b>입니다.</p>
  <div class="howto">
    <b>보시는 방법</b>
    <ol>
      <li>왼쪽 <b>원상품</b>과 오른쪽 <b>후보</b>의 <b>사진·상품명·색상</b>을 비교하십시오.</li>
      <li>같은 물건이면 <b>SAME</b>, 다른 물건이면 <b>DIFFERENT</b>, 사진만으로 모르겠으면 <b>UNCERTAIN</b>.</li>
      <li>헷갈리면 <b>후보 페이지 열기 ↗</b> 로 실제 판매 페이지를 확인하십시오.</li>
      <li>전부 고르신 뒤 맨 아래 <b>결과 복사</b>를 누르고 그대로 붙여넣어 주십시오.</li>
    </ol>
    <p style="margin:9px 0 0;font-size:13px;color:var(--dim)">
      ※ <b>상품코드가 「없음」</b>이거나 <b>브랜드가 판매처 이름</b>으로 보이는 것은 정상입니다 —
      그것이 지금 측정 중인 현상입니다. 판정에 반영하지 마시고 <b>물건 자체</b>만 봐 주십시오.</p>
  </div>
  ${data.cases.map(caseBlock).join("")}
</div>
<div class="bar">
  <span class="prog" id="prog"></span>
  <button type="button" id="copy">결과 복사</button>
</div>
<textarea id="sink" aria-hidden="true"></textarea>
<script>
(function(){
  var cards = Array.prototype.slice.call(document.querySelectorAll('.cand'));
  function prog(){
    var done = cards.filter(function(c){ return c.dataset.v; }).length;
    document.getElementById('prog').textContent = done + ' / ' + cards.length + ' 판정함';
  }
  cards.forEach(function(card){
    card.querySelectorAll('.btns button').forEach(function(b){
      b.setAttribute('aria-pressed','false');
      b.addEventListener('click', function(){
        card.querySelectorAll('.btns button').forEach(function(o){ o.setAttribute('aria-pressed','false'); });
        b.setAttribute('aria-pressed','true');
        card.dataset.v = b.dataset.v;
        prog();
      });
    });
  });
  prog();
  document.getElementById('copy').addEventListener('click', function(){
    var out = cards.map(function(c){
      return { id: c.dataset.id, case: c.dataset.case, shop: c.dataset.shop, url: c.dataset.url,
               verdict: c.dataset.v || null, note: (c.querySelector('.note input').value || '').trim() || null };
    });
    var txt = JSON.stringify({ wu: 'WU-093', humanReview: out }, null, 1);
    var sink = document.getElementById('sink');
    sink.value = txt; sink.select();
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
