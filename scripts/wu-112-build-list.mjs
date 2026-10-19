/**
 * WU-112 — **동일상품 후보 목록** 육안 GT 페이지 생성기 (CEO 입력용).
 *
 * 🔴 운영 코드 변경 0 · MI 입력 0 · 저장 0. `wu-112.json`(운영 함수 산출)만 읽어 HTML 로 만든다.
 * 🔴 CTO 는 SAME/DIFFERENT 를 적지 않는다 — 그 칸은 **CEO 가 채운다**.
 * 🟢 이미지는 **data: URI** 로 임베드한다(Artifact CSP 가 원격 호스트를 막는다).
 * 🔴 이미지가 없으면 **검증 화면용으로만** `og:image` 를 읽는다(WU-100 과 같은 규칙 ·
 *    사이트별 규칙 0 · 운영 추출기는 고치지 않는다).
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36";
const SRC = path.join(process.env.TEMP ?? ".", "mi-p0-02", "wu-112.json");
const MAX_IMG = 900_000;

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const meta = (html, prop) => {
  for (const re of [
    new RegExp(`<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${prop}["']`, "i"),
  ]) {
    const m = html.match(re);
    if (m) return m[1];
  }
  return null;
};

const grab = async (imgUrl, pageUrl) => {
  if (!imgUrl) return null;
  const u = imgUrl.startsWith("//") ? `https:${imgUrl}` : imgUrl;
  const r = await fetch(u, {
    // 🔴 WU-093 교훈 — Referer 에 한글이 들어가면 fetch 가 ByteString 예외를 던진다. origin 만.
    headers: { "User-Agent": UA, Referer: new URL(pageUrl).origin },
    signal: AbortSignal.timeout(40000),
  }).catch(() => null);
  if (!r?.ok) return null;
  const b = Buffer.from(await r.arrayBuffer());
  if (b.length > MAX_IMG) return { skipped: b.length };
  return { uri: `data:${(r.headers.get("content-type") || "image/jpeg").split(";")[0]};base64,${b.toString("base64")}` };
};

const ogImage = async (pageUrl) => {
  const r = await fetch(pageUrl, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(40000) }).catch(() => null);
  if (!r?.ok) return null;
  return meta(await r.text(), "og:image");
};

const GROUPS = [
  ["KR", "🇰🇷 국내 후보"],
  ["OVERSEAS", "🌎 해외 후보"],
  ["UNKNOWN", "❔ 시장 미확정 후보"],
];

const main = async () => {
  const data = JSON.parse(readFileSync(SRC, "utf8"));
  let got = 0;
  let skipped = 0;
  let none = 0;
  const sections = [];

  for (const g of data) {
    const originImg = await grab(await ogImage(g.originUrl), g.originUrl);
    const cards = [];
    for (const [mk, label] of GROUPS) {
      const rows = g.candidates.filter((c) => c.market === mk);
      if (rows.length === 0) continue;
      const inner = [];
      for (const c of rows) {
        let img = await grab(c.imageUrl, c.url);
        if (!img) {
          const og = await ogImage(c.url);
          img = await grab(og, c.url);
        }
        if (img?.uri) got += 1;
        else if (img?.skipped) skipped += 1;
        else none += 1;
        const price =
          c.priceAmount != null && c.priceCurrency
            ? `${esc(c.priceCurrency)} ${Number(c.priceAmount).toLocaleString()}`
            : "가격 미확인";
        inner.push(`
<div class="card">
  ${img?.uri ? `<img src="${img.uri}" alt="">` : `<div class="noimg">${img?.skipped ? "이미지 용량 초과(생략)" : "이미지 없음"}</div>`}
  <div class="t">${esc(c.title) || "<i>제목 없음</i>"}</div>
  <div class="shop">${esc(c.domain)}</div>
  <div class="m">${price}${c.modelCode ? ` · 품번 <b>${esc(c.modelCode)}</b>` : " · 품번 없음"}</div>
  <div class="sys">우리 시스템: ${esc(c.crossSellerVerdict ?? "판정 없음")}${
    c.priceTier ? ` · tier ${esc(c.priceTier)}` : ""
  }${c.shopJudgement === "DROPPED" ? " · <span class=dr>이 샵은 제외됨</span>" : ""}</div>
  <div class="u"><a href="${esc(c.url)}" target="_blank" rel="noreferrer">링크 열기 ↗</a></div>
  <div class="gt">판정: <b>SAME</b> / <b>DIFFERENT</b> / <b>UNCERTAIN</b></div>
</div>`);
      }
      cards.push(`<h3>${label} <span class="cnt">${rows.length}건</span></h3><div class="grid">${inner.join("")}</div>`);
    }

    sections.push(`
<section>
  <div class="origin">
    ${originImg?.uri ? `<img src="${originImg.uri}" alt="">` : `<div class="noimg sm">이미지 없음</div>`}
    <div>
      <div class="lab">원상품 — 이것과 비교해 주십시오</div>
      <div class="ot">${esc(g.originTitle)}</div>
      <div class="m">품번 <b>${esc(g.originCode) || "없음"}</b>${g.originColor ? ` · 색상 ${esc(g.originColor)}` : " · 색상 없음"}</div>
      <div class="u"><a href="${esc(g.originUrl)}" target="_blank" rel="noreferrer">원상품 링크 ↗</a></div>
    </div>
  </div>
  <h2>${esc(g.code)} — 후보 ${g.candidates.length}건</h2>
  ${cards.join("")}
</section>`);
  }

  writeFileSync(
    "docs/wu-112-candidate-list.html",
    `<title>WU-112 — 동일상품 후보 목록 (육안 GT)</title>
<style>
:root{--ink:#17150f;--mut:#6f6c62;--line:#dfd9ca;--bg:#faf7ef;--acc:#8c3b12;--dr:#9a2f2f}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 -apple-system,"Segoe UI",system-ui,sans-serif}
.wrap{max-width:1180px;margin:0 auto;padding:36px 18px 90px}
h1{font-size:25px;margin:0 0 6px;letter-spacing:-.01em}
.sub{color:var(--mut);font-size:14px;margin:0 0 24px}
.box{background:#fff;border:1px solid var(--line);border-left:3px solid var(--acc);padding:14px 16px;font-size:14px;margin:0 0 30px}
section{border-top:1px solid var(--line);padding:24px 0 8px}
.origin{position:sticky;top:0;z-index:5;display:flex;gap:14px;align-items:center;background:#fffdf7;border:1px solid var(--line);padding:12px;margin:0 0 16px}
.origin img{width:92px;height:92px;object-fit:contain;background:#f3f0e7;flex:none}
.noimg{display:grid;place-items:center;background:#f3f0e7;color:var(--mut);font-size:12px;aspect-ratio:1}
.noimg.sm{width:92px;height:92px;flex:none}
.lab{font-size:11px;letter-spacing:.09em;text-transform:uppercase;color:var(--mut)}
.ot{font-size:17px;font-weight:650}
h2{font-size:17px;margin:0 0 12px;font-variant-numeric:tabular-nums}
h3{font-size:14px;margin:22px 0 10px;letter-spacing:.02em}
.cnt{color:var(--mut);font-weight:400;font-size:13px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(228px,1fr));gap:14px}
.card{background:#fff;border:1px solid var(--line);border-radius:4px;padding:11px;display:flex;flex-direction:column;gap:6px}
.card img{width:100%;aspect-ratio:1;object-fit:contain;background:#f3f0e7}
.t{font-size:13.5px;font-weight:600;line-height:1.35}
.shop{font-size:12px;color:var(--acc)}
.m{font-size:12px;color:var(--mut);font-variant-numeric:tabular-nums}
.sys{font-size:11.5px;color:var(--mut)}
.dr{color:var(--dr)}
.u{font-size:12px}.u a{color:var(--mut)}
.gt{font-size:12px;border-top:1px dashed var(--line);padding-top:6px;margin-top:auto}
</style>
<div class="wrap">
<h1>WU-112 — 동일상품 후보 목록 (육안 GT)</h1>
<p class="sub">판정은 대표님이 하십니다. CTO 는 동일상품 여부를 적지 않았습니다.</p>
<div class="box">
<b>해 주실 일</b> — 각 후보가 맨 위 <b>원상품</b>과 같은 상품인지
<b>SAME / DIFFERENT / UNCERTAIN</b> 중 하나로 봐 주십시오. 애매하면 <b>UNCERTAIN</b> 이 맞습니다.
<br><br>
🔴 <b>「우리 시스템」 줄은 참고용</b>입니다 — 그것이 정답이 아니라, 대표님 판정이 정답입니다.
「이 샵은 제외됨」은 <b>지금 가격비교에 쓰이지 않는 후보</b>라는 뜻이고,
그 판단이 맞는지 보는 것이 이번 검토의 목적입니다.
<br><br>
🔴 이미지는 각 페이지의 <b>대표 이미지</b>라 목록 썸네일이나 로고일 수 있습니다.
🔴 가격은 <b>이번 판정에 쓰지 않습니다</b> — 가격 작업은 동일상품 판정이 끝난 뒤입니다.
</div>
${sections.join("\n")}
</div>`,
  );
  console.log(`images ok=${got} skipped=${skipped} none=${none}`);
  console.log("docs/wu-112-candidate-list.html written");
};
main();
