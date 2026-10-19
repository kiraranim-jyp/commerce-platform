/**
 * WU-123 — **신규 후보 7건 육안 검토 화면** 생성기 (CEO 클릭 판정 · 운영 변경 0).
 *
 * 🔴 MI 로직 · 가격 · DB · 배포 **건드리지 않는다**. `wu-122.json`(운영 MI 산출)만 읽는다.
 * 🔴 CTO 는 SAME/DIFFERENT 를 적지 않는다 — 화면의 칸은 **전부 비어 있다**.
 * 🟢 이미지는 **data: URI**(Artifact CSP 가 원격 호스트를 막는다) · 검증 화면용으로만 `og:image` 를 읽는다.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36";
const SRC = path.join(process.env.TEMP ?? ".", "mi-p0-02", "wu-122.json");
const MAX = 900_000;

const ORIGINS = {
  S1: { code: "B226AC010", url: "https://bobochoses.com/products/b226ac010-booty-ghosts-t-shirt", name: "Booty Ghosts 긴팔 티셔츠", color: "heather grey" },
  S2: { code: "B226AC009", url: "https://bobochoses.com/products/b226ac009-hug-hairy-monster-t-shirt", name: "Hug Hairy Monster 긴팔 티셔츠", color: "light blue" },
};

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const meta = (h, p) => {
  for (const re of [
    new RegExp(`<meta[^>]+property=["']${p}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${p}["']`, "i"),
  ]) {
    const m = h.match(re);
    if (m) return m[1];
  }
  return null;
};
const grab = async (pageUrl) => {
  const r = await fetch(pageUrl, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(40000) }).catch(() => null);
  if (!r?.ok) return null;
  const html = await r.text();
  const img = meta(html, "og:image");
  if (!img) return null;
  const u = img.startsWith("//") ? `https:${img}` : img;
  const ir = await fetch(u, { headers: { "User-Agent": UA, Referer: new URL(pageUrl).origin }, signal: AbortSignal.timeout(40000) }).catch(() => null);
  if (!ir?.ok) return null;
  const b = Buffer.from(await ir.arrayBuffer());
  if (b.length > MAX) return null;
  return `data:${(ir.headers.get("content-type") || "image/jpeg").split(";")[0]};base64,${b.toString("base64")}`;
};

const main = async () => {
  const rows = JSON.parse(readFileSync(SRC, "utf8")).filter((r) => r.best === "SAME" || r.best === "PRESUMED_SAME");
  const originImg = {};
  for (const k of Object.keys(ORIGINS)) originImg[k] = await grab(ORIGINS[k].url);

  let n = 0;
  const cards = [];
  for (const r of rows) {
    const sid = r.S1 === r.best ? "S1" : "S2";
    const o = ORIGINS[sid];
    const img = await grab(r.url);
    const id = `c${++n}`;
    console.log(`${id} ${sid} ${img ? "img OK" : "img -"} ${r.host}`);
    cards.push(`
<section>
  <div class="pair">
    <div class="card origin">
      <div class="lab">원상품 — 이것과 비교해 주십시오</div>
      ${originImg[sid] ? `<img src="${originImg[sid]}" alt="">` : `<div class="noimg">이미지 없음</div>`}
      <div class="t">${esc(o.name)}</div>
      <div class="m">품번 ${esc(o.code)} · 색상 ${esc(o.color)}</div>
    </div>
    <div class="card">
      <div class="lab">후보 ${n} — ${esc(r.host)}</div>
      ${img ? `<img src="${img}" alt="">` : `<div class="noimg">이미지 없음</div>`}
      <div class="t">${esc(r.title) || "<i>제목 없음</i>"}</div>
      <div class="m">${r.code ? `품번 <b>${esc(r.code)}</b>` : "품번 없음"}</div>
      <div class="sys">우리 시스템: <b>${r.best === "SAME" ? "같은 상품으로 봤습니다" : "같은 상품으로 추정했습니다"}</b></div>
      <div class="u"><a href="${esc(r.url)}" target="_blank" rel="noreferrer">판매처 페이지 열기 ↗</a></div>
    </div>
  </div>
  <fieldset class="gt" data-id="${id}" data-host="${esc(r.host)}" data-url="${esc(r.url)}"
            data-origin="${esc(o.code)}" data-sys="${esc(r.best)}" data-title="${esc(r.title ?? "")}">
    <legend>이 둘은 같은 상품입니까?</legend>
    <div class="opts">
      <label class="o same"><input type="radio" name="v-${id}" value="SAME"><span>같은 상품</span></label>
      <label class="o diff"><input type="radio" name="v-${id}" value="DIFFERENT"><span>다른 상품</span></label>
      <label class="o unc"><input type="radio" name="v-${id}" value="UNCERTAIN"><span>애매</span></label>
    </div>
    <input class="why" type="text" placeholder="이유 (선택 — 예: 긴팔이 아니다 / 색이 다르다)" aria-label="후보 ${n} 판정 이유">
  </fieldset>
</section>`);
  }

  writeFileSync(
    "docs/wu-123-gt-review.html",
    `<title>새로 찾은 후보 ${rows.length}건 — 같은 상품인지 봐 주십시오</title>
<style>
:root{--ink:#17150f;--mut:#6f6c62;--line:#ded8c8;--bg:#faf7ef;--ok:#1f6b3a;--no:#9a2f2f;--acc:#8c3b12}
body{margin:0;background:var(--bg);color:var(--ink);font:17px/1.65 -apple-system,"Segoe UI",system-ui,sans-serif}
.wrap{max-width:980px;margin:0 auto;padding:38px 20px 110px}
h1{font-size:26px;margin:0 0 8px;letter-spacing:-.01em}
.sub{color:var(--mut);font-size:15px;margin:0 0 26px}
.box{background:#fff;border:1px solid var(--line);border-left:3px solid var(--acc);padding:15px 17px;font-size:15px;margin:0 0 28px}
section{border-top:1px solid var(--line);padding:24px 0}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:18px}
@media(max-width:720px){.pair{grid-template-columns:1fr}}
.card{background:#fff;border:1px solid var(--line);border-radius:4px;padding:14px;display:flex;flex-direction:column;gap:7px}
.card.origin{background:#fffdf7}
.card img{width:100%;aspect-ratio:1;object-fit:contain;background:#f3f0e7}
.noimg{aspect-ratio:1;display:grid;place-items:center;background:#f3f0e7;color:var(--mut);font-size:13px}
.lab{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--mut)}
.t{font-size:15px;font-weight:650;line-height:1.35}
.m{font-size:13px;color:var(--mut)}
.sys{font-size:13px;color:var(--acc)}
.u{font-size:13px;margin-top:auto}.u a{color:var(--mut)}
.gt{margin:16px 0 0;border:0;padding:0;display:flex;flex-direction:column;gap:8px}
.gt legend{font-size:15px;font-weight:650;padding:0 0 6px}
.opts{display:flex;gap:8px;max-width:560px}
.o{flex:1;position:relative}
.o input{position:absolute;inset:0;opacity:0;width:100%;height:100%;margin:0;cursor:pointer}
.o span{display:block;text-align:center;font-size:15px;padding:12px 4px;border:1px solid var(--line);border-radius:4px;background:#fff;color:var(--mut)}
.o input:focus-visible+span{outline:2px solid var(--acc);outline-offset:1px}
.same input:checked+span{background:var(--ok);border-color:var(--ok);color:#fff;font-weight:700}
.diff input:checked+span{background:var(--no);border-color:var(--no);color:#fff;font-weight:700}
.unc input:checked+span{background:#7a6a2f;border-color:#7a6a2f;color:#fff;font-weight:700}
.why{font:inherit;font-size:14px;padding:9px 11px;border:1px solid var(--line);border-radius:4px;background:#fff;max-width:560px;box-sizing:border-box;width:100%}
.bar{position:fixed;left:0;right:0;bottom:0;z-index:20;display:flex;gap:10px;align-items:center;background:#fffdf7;border-top:1px solid var(--line);padding:11px 16px;font-size:15px}
.bar b{font-variant-numeric:tabular-nums}.bar .sp{flex:1}
.bar button{font:inherit;font-size:14px;padding:9px 15px;border:1px solid var(--ink);background:var(--ink);color:#fdfcf8;border-radius:4px;cursor:pointer}
.bar button.gh{background:transparent;color:var(--ink)}
#out{display:none;width:100%;height:200px;font:12px/1.5 ui-monospace,Menlo,Consolas,monospace;border:1px solid var(--line);padding:10px;box-sizing:border-box;margin:18px 0 0;background:#fff}
#out.on{display:block}
</style>
<div class="wrap">
<h1>새로 찾은 후보 ${rows.length}건 — 같은 상품인지 봐 주십시오</h1>
<p class="sub">클릭만 하시면 됩니다. 다 하신 뒤 아래 「결과 복사」를 눌러 주십시오.</p>
<div class="box">
<b>무엇인지</b> — 지금까지 화면에 올라오지 않던 <b>새 판매처 후보</b>입니다.
왼쪽이 <b>원상품</b>, 오른쪽이 <b>후보</b>입니다.
<br><br>
🔴 <b>「우리 시스템」 줄은 참고용</b>입니다 — 대표님 판정이 정답입니다.
애매하면 <b>애매</b>가 맞습니다. 🟢 입력은 <b>자동 저장</b>되니 중간에 닫으셔도 됩니다.
<br><br>
🔴 사진은 각 페이지의 대표 이미지라 각도·색감이 다를 수 있습니다. 필요하시면
<b>「판매처 페이지 열기」</b>로 실제 상품을 보셔도 됩니다.
</div>
${cards.join("\n")}
<textarea id="out" readonly aria-label="판정 결과"></textarea>
</div>
<div class="bar">
  <span><b id="prog">0</b> / <b>${rows.length}</b> 판정</span>
  <span class="sp"></span>
  <button id="copy" type="button">결과 복사</button>
  <button id="show" type="button" class="gh">내용 보기</button>
</div>
<script>
(function(){
  var KEY="wu123-gt";
  var sets=[].slice.call(document.querySelectorAll(".gt"));
  var prog=document.getElementById("prog"), out=document.getElementById("out");
  function rows(){return sets.map(function(f){
    var r=f.querySelector("input[type=radio]:checked");
    return {id:f.dataset.id,originCode:f.dataset.origin,host:f.dataset.host,url:f.dataset.url,
            title:f.dataset.title,systemVerdict:f.dataset.sys,
            verdict:r?r.value:null,reason:f.querySelector(".why").value.trim()||null};});}
  function json(){var a=rows(),d=a.filter(function(x){return x.verdict;});
    return JSON.stringify({wu:"WU-123",total:a.length,judged:d.length,
      counts:["SAME","DIFFERENT","UNCERTAIN"].reduce(function(o,k){o[k]=d.filter(function(x){return x.verdict===k;}).length;return o;},{}),
      candidates:a},null,1);}
  function sync(){var a=rows();prog.textContent=String(a.filter(function(x){return x.verdict;}).length);
    out.value=json();try{localStorage.setItem(KEY,JSON.stringify(a));}catch(e){}}
  try{(JSON.parse(localStorage.getItem(KEY)||"[]")).forEach(function(s){
    var f=sets.filter(function(x){return x.dataset.url===s.url;})[0];if(!f)return;
    if(s.verdict){var r=f.querySelector("input[value="+s.verdict+"]");if(r)r.checked=true;}
    if(s.reason)f.querySelector(".why").value=s.reason;});}catch(e){}
  document.addEventListener("change",sync);
  document.addEventListener("input",function(e){if(e.target.classList.contains("why"))sync();});
  document.getElementById("show").addEventListener("click",function(){out.classList.toggle("on");
    if(out.classList.contains("on"))out.scrollIntoView({block:"center"});});
  document.getElementById("copy").addEventListener("click",function(){
    var b=this,t=b.textContent;
    function ok(){b.textContent="복사됐습니다";setTimeout(function(){b.textContent=t;},1800);}
    function fb(){out.classList.add("on");out.select();out.scrollIntoView({block:"center"});
      b.textContent="아래 칸을 복사해 주십시오";setTimeout(function(){b.textContent=t;},2600);}
    try{navigator.clipboard.writeText(json()).then(ok,fb);}catch(e){fb();}});
  sync();
})();
</script>`,
  );
  console.log(`rows=${rows.length} → docs/wu-123-gt-review.html`);
};
main();
