/**
 * 🔵 PHASE 1 — Smallable 6조합 라이브 실측(문서 §3 과 «같은» 조합).
 * 🔴 읽기만 한다 · DB 쓰기 0 · 과금 0. 🔴 운영 코드 변경 0.
 * 🔴 헤더 초과(WU-083)를 피해 maxHeaderSize 를 64KB 로 올린다.
 */
import { PrismaClient } from "@prisma/client";
import https from "node:https";

const p = new PrismaClient();
const row = (
  await p.$queryRawUnsafe(
    `select source_product_url as u from price_observations
     where source_product_url ilike '%smallable%' order by checked_at desc limit 1`,
  )
)[0];
await p.$disconnect();
const base = String(row.u).split("?")[0];
console.log("상품 URL:", base, "\n");

const COMBOS = [
  ["currency=EUR&country=JP", "문서: EUR 81"],
  ["currency=JPY&country=JP", "문서: JPY 13,365  ← 일본 현지가"],
  ["currency=JPY&country=KR", "문서: JPY 12,045  ← 한국가를 엔화로"],
  ["currency=USD&country=US", "문서: USD 91"],
  ["currency=KRW&country=KR", "문서: KRW 114,464"],
  ["country=JP", "통화 미지정 — egress 가 정한다"],
];

const get = (url) =>
  new Promise((res) => {
    https
      .get(url, { maxHeaderSize: 65536, headers: { "User-Agent": "Mozilla/5.0", "Accept-Language": "en" } }, (r) => {
        let b = "";
        r.on("data", (c) => (b += c));
        r.on("end", () => res({ status: r.statusCode, html: b }));
      })
      .on("error", (e) => res({ status: 0, html: "", err: e.message }));
  });

/** 🔴 JSON-LD offers 에서 읽는다 — 추정하지 않는다. */
const read = (html) => {
  const out = [];
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const j = JSON.parse(m[1]);
      const offers = [].concat(j.offers ?? []);
      for (const o of offers) {
        if (o?.price && o?.priceCurrency) out.push(`${o.priceCurrency} ${o.price}`);
      }
    } catch {}
  }
  return [...new Set(out)];
};

for (const [q, note] of COMBOS) {
  const r = await get(`${base}?${q}`);
  const vals = read(r.html);
  console.log(
    `  ${q.padEnd(26)} HTTP ${String(r.status).padEnd(4)} ${(vals.join(" / ") || "🔴 읽기 실패").padEnd(26)} (${note})`,
  );
  await new Promise((s) => setTimeout(s, 900));
}
