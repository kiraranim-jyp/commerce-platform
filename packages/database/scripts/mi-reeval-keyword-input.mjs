/**
 * 🔵 MI-REEVAL STEP 3 ① — **키워드 비교 입력(원문 전문)을 영속화한다**(읽기 전용).
 *
 * 🔴 운영 변경 0 · DB 쓰기 0 · 크롤링 0 · 번역 0 · GT 변경 0.
 *
 * 🔴🔴 **왜 전문이 필요한가** — `mi-reeval-01-desc-pairs.json` 은 설명문을 **400자 발췌** 로
 *    들고 있고 실측으로 **origin 25 · candidate 39 쌍이 그 길이에서 잘렸다**.
 *    키워드 추출을 발췌로 하면 **뒤쪽 속성(소재·사이즈)을 구조적으로 놓친다**.
 * 🟢 전문 출처 둘 — 후보는 `%TEMP%/step2-evidence.json.descriptionRaw`(이미 수집분) ·
 *    원본은 DB `canonicalProduct.description/descriptionKo`(읽기만).
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const ROOT = path.join(process.cwd(), "..", "..");
const FIX = path.join(ROOT, "apps", "admin", "src", "app", "api", "price-history", "_lib", "__tests__", "fixtures");
const TMP = path.join(os.tmpdir(), "mi-url-evidence");
const need = ["desc-compare.json", "step2-evidence.json"].filter((f) => !existsSync(path.join(TMP, f)));
if (need.length) {
  console.log(`🔴 ${need.join(" · ")} 가 없다 — 키워드 입력을 만들지 못했다(재생성 필요)`);
  process.exit(1);
}
const dc = JSON.parse(readFileSync(path.join(TMP, "desc-compare.json"), "utf8"));
const s2 = JSON.parse(readFileSync(path.join(TMP, "step2-evidence.json"), "utf8")).rows;

/** 🔴 후보 설명문 **전문** — URL 키로 붙인다(발췌가 아니다). */
const normU = (u) => String(u).replace(/^https?:\/\/(www\.)?/, "").replace(/\/+$/, "").toLowerCase();
const candDesc = new Map();
for (const r of s2) if (r.descriptionRaw) candDesc.set(normU(r.candidateUrl), String(r.descriptionRaw));
const candTitle = new Map();
for (const r of s2) candTitle.set(normU(r.candidateUrl), r.liveTitle ?? r.baselineTitle ?? null);

/** 🔴 원본 설명문 **전문** — DB 에서 읽는다(`{value}` 래퍼 안쪽). */
const originUrls = [...new Set(dc.pairs.map((p) => p.originUrl).filter(Boolean))];
const p = new PrismaClient();
const lit = (s) => `'${String(s).replace(/'/g, "''")}'`;
const snaps = await p.$queryRawUnsafe(`
  select source_url,
         workspace->'canonicalProduct'->'title'->>'value' title,
         workspace->'canonicalProduct'->'description'->>'value' description,
         workspace->'canonicalProduct'->'descriptionKo'->>'value' description_ko,
         workspace->'canonicalProduct'->'brand'->>'value' brand,
         workspace->'canonicalProduct'->'color'->>'value' color,
         workspace->'canonicalProduct'->'material'->>'value' material,
         created_at
    from product_snapshots
   where source_url in (${originUrls.map(lit).join(",")}) and workspace ? 'canonicalProduct'
   order by created_at desc`);
await p.$disconnect();
/** 🔴 같은 원본 URL 의 스냅샷이 여럿이면 **최신 하나** 를 쓴다(반복 스냅샷 중복 제거). */
const origin = new Map();
for (const r of snaps) if (!origin.has(r.source_url)) origin.set(r.source_url, r);

const pairs = dc.pairs.map((x) => {
  const o = origin.get(x.originUrl) ?? null;
  const k = normU(x.candidateUrl);
  return {
    originUrl: x.originUrl, originCode: x.originCode ?? null, candidateUrl: x.candidateUrl,
    candidateDomain: x.candidateDomain,
    baselineSystemVerdict: x.baselineSystemVerdict ?? null, humanGt: x.humanGt ?? null,
    origin: {
      title: o?.title ?? x.originTitle ?? null,
      description: o?.description ?? null,
      descriptionKo: o?.description_ko ?? null,
      brand: o?.brand ?? null, color: o?.color ?? null, material: o?.material ?? null,
    },
    candidate: {
      title: candTitle.get(k) ?? x.candidateTitle ?? null,
      /** 🟢 **전문** 이다 — 발췌(400자)가 아니다. */
      description: candDesc.get(k) ?? null,
    },
  };
});

const kb = (s) => (s / 1024).toFixed(0);
const bytes = Buffer.byteLength(JSON.stringify(pairs), "utf8");
writeFileSync(path.join(FIX, "mi-reeval-03-keyword-input.json"),
  JSON.stringify({
    source: "desc-compare.json(쌍) + step2-evidence.json(후보 설명문 전문) + product_snapshots(원본 전문)",
    note: "🔴 설명문은 «전문» 이다(400자 발췌가 아니다) · 번역 0 · 가공 0",
    pairs,
  }, null, 1), "utf8");
console.log(`🟢 키워드 입력 fixture — ${pairs.length} 쌍 · ${kb(bytes)}KB`);
console.log(`   원본 설명문 전문 ${pairs.filter((x) => x.origin.description).length}/${pairs.length} · 번역문 ${pairs.filter((x) => x.origin.descriptionKo).length}`);
console.log(`   후보 설명문 전문 ${pairs.filter((x) => x.candidate.description).length}/${pairs.length}`);
console.log(`   🔴 발췌(400자) 대비 — 전문에서 더 읽은 쌍: origin ${pairs.filter((x) => (x.origin.description ?? "").length > 400).length} · candidate ${pairs.filter((x) => (x.candidate.description ?? "").length > 400).length}`);
