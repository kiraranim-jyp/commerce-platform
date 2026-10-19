/**
 * WU-111 STEP 3 — eraldo.com EUR 40 / trenbe USD 84 의 **육안 GT 페이지** 생성기.
 *
 * 🔴 운영 코드 변경 0. 이 스크립트는 `apps/admin` 밖이고 운영 추출기를 **고치지 않는다** —
 *    검증 화면용으로 `og:image` / `og:title` / JSON-LD 가격만 **읽는다**(WU-093/100 과 같은 방법).
 * 🔴 CTO 는 SAME/DIFFERENT 를 **판정하지 않는다** — 그 칸은 CEO 가 채운다.
 * 🟢 이미지는 **data: URI** 로 임베드한다(Artifact CSP 가 원격 호스트를 막는다).
 */
import { writeFileSync } from "node:fs";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36";

const PAIRS = [
  {
    sid: "B226AC010",
    origin: "https://bobochoses.com/products/b226ac010-booty-ghosts-t-shirt",
    cand: "https://www.eraldo.com/products/bobo-choses-booty-ghosts-t-shirt-340496",
    candShop: "eraldo.com",
    candPrice: "EUR 40",
    tier: "COMPARISON",
    truth: "TEXT_CONFIRMED",
    note: "🔴 이 통화(EUR)의 **유일한 가격** 이다 — 해외 EUR 최저가가 이 후보 하나로 정해진다",
  },
  {
    sid: "B226AC009",
    origin: "https://bobochoses.com/products/b226ac009-hug-hairy-monster-t-shirt",
    cand: "https://global.trenbe.com/products/bobo-choses-kids-hug-hairy-monster-long-sleeve-t-shirt-light-blue-b226ac009-451-160484657-p",
    candShop: "global.trenbe.com",
    candPrice: "USD 84",
    tier: "EXACT",
    truth: "STRONG_IDENTIFIER",
    note: "🟢 USD 최저가는 **58**(tinyapple.net) 이라 이 판정은 최저가를 바꾸지 않는다",
  },
];

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

async function look(url) {
  const r = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(45000) }).catch(
    (e) => ({ ok: false, status: 0, text: async () => String(e) }),
  );
  const html = await r.text();
  const out = {
    http: r.status ?? 0,
    title: meta(html, "og:title") ?? (html.match(/<title[^>]*>([^<]+)</i)?.[1] ?? null),
    img: meta(html, "og:image"),
    ogPrice: meta(html, "og:price:amount"),
    ogCur: meta(html, "og:price:currency"),
    img64: null,
  };
  if (out.img) {
    const u = out.img.startsWith("//") ? `https:${out.img}` : out.img;
    const ir = await fetch(u, {
      // 🔴 WU-093 교훈 — Referer 에 한글이 들어가면 fetch 가 ByteString 예외를 던진다. origin 만 보낸다.
      headers: { "User-Agent": UA, Referer: new URL(url).origin },
      signal: AbortSignal.timeout(45000),
    }).catch(() => null);
    if (ir?.ok) {
      const b = Buffer.from(await ir.arrayBuffer());
      const t = ir.headers.get("content-type")?.split(";")[0] || "image/jpeg";
      if (b.length < 2_600_000) out.img64 = `data:${t};base64,${b.toString("base64")}`;
    }
  }
  return out;
}

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const card = (label, url, f, extra = "") => `
<div class="card">
  <div class="lab">${label}</div>
  ${f.img64 ? `<img src="${f.img64}" alt="">` : `<div class="noimg">이미지 없음 (og:image ${f.img ? "가져오기 실패" : "없음"})</div>`}
  <div class="t">${esc(f.title) || "<i>제목 없음</i>"}</div>
  ${extra}
  <div class="u"><a href="${esc(url)}" target="_blank" rel="noreferrer">${esc(url)}</a></div>
  <div class="m">HTTP ${f.http}${f.ogPrice ? ` · og:price ${esc(f.ogPrice)} ${esc(f.ogCur ?? "")}` : ""}</div>
</div>`;

const main = async () => {
  const blocks = [];
  for (const p of PAIRS) {
    const [o, c] = [await look(p.origin), await look(p.cand)];
    console.log(`${p.sid} origin HTTP ${o.http} img ${o.img64 ? "OK" : "-"} / cand HTTP ${c.http} img ${c.img64 ? "OK" : "-"}`);
    blocks.push(`
<section>
  <h2>${p.sid}</h2>
  <p class="q">이 둘이 <b>같은 상품</b>입니까? — <b>SAME</b> / <b>DIFFERENT</b> / <b>UNCERTAIN</b></p>
  <div class="pair">
    ${card("원상품 (bobochoses.com)", p.origin, o)}
    ${card(
      `후보 — ${p.candShop}`,
      p.cand,
      c,
      `<div class="px">우리 집계가 쓰는 가격: <b>${p.candPrice}</b></div>
       <div class="m">우리 판정: tier <b>${p.tier}</b> · ${p.truth} · priceStatus <b>UNVERIFIED_SEARCH</b></div>`,
    )}
  </div>
  <p class="n">${p.note}</p>
</section>`);
  }

  writeFileSync(
    "docs/wu-111-gt-review.html",
    `<title>WU-111 — 해외 가격 후보 2건 육안 GT</title>
<style>
:root{--ink:#17150f;--mut:#6d6a5f;--line:#ded8c8;--bg:#faf7ef;--acc:#8c3b12}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.65 -apple-system,"Segoe UI",system-ui,sans-serif}
.wrap{max-width:1000px;margin:0 auto;padding:40px 20px 80px}
h1{font-size:26px;margin:0 0 6px;letter-spacing:-.01em}
.sub{color:var(--mut);font-size:14px;margin:0 0 30px}
section{border-top:1px solid var(--line);padding:26px 0}
h2{font-size:19px;margin:0 0 4px;font-variant-numeric:tabular-nums}
.q{margin:0 0 16px;font-size:15px;color:var(--acc)}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:18px}
@media(max-width:720px){.pair{grid-template-columns:1fr}}
.card{background:#fff;border:1px solid var(--line);border-radius:4px;padding:14px;display:flex;flex-direction:column;gap:8px}
.lab{font-size:11px;letter-spacing:.09em;text-transform:uppercase;color:var(--mut)}
.card img{width:100%;max-width:100%;aspect-ratio:1;object-fit:contain;background:#f3f0e7}
.noimg{aspect-ratio:1;display:grid;place-items:center;background:#f3f0e7;color:var(--mut);font-size:13px}
.t{font-size:15px;font-weight:600;line-height:1.4}
.px{font-size:15px;color:var(--acc)}
.u{font-size:11px;word-break:break-all}
.u a{color:var(--mut)}
.m{font-size:12px;color:var(--mut);font-variant-numeric:tabular-nums}
.n{font-size:13px;color:var(--mut);margin:14px 0 0}
.box{background:#fff;border:1px solid var(--line);border-left:3px solid var(--acc);padding:14px 16px;font-size:14px;margin:0 0 26px}
</style>
<div class="wrap">
<h1>WU-111 STEP 3 — 해외 가격 후보 2건 육안 GT</h1>
<p class="sub">판정은 대표님이 하십니다. CTO 는 동일상품 여부를 적지 않았습니다.</p>
<div class="box">
<b>왜 보시는가</b> — 두 후보의 가격이 <b>해외 가격비교 집계에 들어가 있는데</b>
<code>priceStatus</code> 가 <b>UNVERIFIED_SEARCH</b> 라서 화면의 그 후보 줄에는
「가격 확인 필요」가 뜹니다. 그 가격을 계속 쓸 것인지 정하려면
<b>그 후보가 정말 같은 상품인지</b> 가 먼저 필요합니다.
<br><br>
🔴 이미지는 각 페이지의 <b>대표 이미지(og:image)</b> 입니다 — 목록 썸네일이거나
로고일 수 있습니다. 애매하면 <b>UNCERTAIN</b> 으로 적어 주십시오.
</div>
${blocks.join("\n")}
</div>`,
  );
  console.log("docs/wu-111-gt-review.html written");
};
main();
