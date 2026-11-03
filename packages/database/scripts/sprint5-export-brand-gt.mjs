/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 SPRINT 5 — **운영 FP/TP 를 GT fixture 로 고정한다**(read-only · SELECT only)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CPO GO(2026-11-03): 「실제 운영 FP/TP 를 고정해서, BRAND_MISMATCH 정책을 적용하면
 * 무엇을 막고 무엇을 잃는지 측정하라.」 🔴 **전체 recall 추정치로 쓰지 않는다.**
 *
 * 🔴 **사람 판정을 먼저 고정한다** — 반사실을 보고 라벨을 바꾸지 않는다(§3).
 * 🔴 **지어내지 않는다** — 전부 운영이 저장한 값이다. 없으면 `null`.
 * 🔴 쓰기 0 · 외부 호출 0 · 운영 코드 0.
 *
 * ── 🔴🔴 brand 를 «문자열 비교» 로만 쓰지 않는다(§4) ───────────────────────
 * `candidate_reviews` 에 후보 brand 칸이 **없다**. 🟢 대신 운영이 저장한
 * `match_reasons` 의 **「보류: 브랜드 X ↔ Y」** 한 줄이 **양쪽 brand 원문** 을 들고 있다.
 * ⟹ 그 줄을 파싱해 fixture 에 넣고, **판매처 상호인지** 를 도메인과 대조해 같이 적는다.
 */
import { writeFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

const rows = await p.$queryRawUnsafe(`
  select r.id, r.snapshot_id, s.title as origin_title, r.origin_code,
         r.candidate_domain, r.candidate_title, r.candidate_url,
         r.system_verdict, r.match_truth, r.price_tier, r.blockers, r.match_reasons,
         r.human_verdict, r.human_note, r.market, r.price_amount, r.price_currency, r.source,
         coalesce(r.reviewed_at, r.last_seen_at)::text as at,
         (ps.workspace->'canonicalProduct'->'brand'->>'value')      as origin_brand,
         (ps.workspace->'canonicalProduct'->'brand'->>'source')     as origin_brand_source,
         (ps.workspace->'canonicalProduct'->'brand'->>'confidence') as origin_brand_confidence
    from candidate_reviews r
    left join product_snapshots s  on s.id  = r.snapshot_id
    left join product_snapshots ps on ps.id = r.snapshot_id
   where r.human_verdict is not null
   order by coalesce(r.reviewed_at, r.last_seen_at) desc
`);

/** 🔴 운영이 적은 그 줄에서만 뽑는다 — 다른 데서 brand 를 가져오지 않는다. */
function brandsFromReasons(reasons) {
  if (!Array.isArray(reasons)) return { originBrandInReason: null, candidateBrandInReason: null };
  for (const line of reasons) {
    const m = /^보류:\s*브랜드\s+(.+?)\s*↔\s*(.+?)\s*$/.exec(String(line));
    if (m) return { originBrandInReason: m[1], candidateBrandInReason: m[2] };
  }
  return { originBrandInReason: null, candidateBrandInReason: null };
}

/**
 * 🔴🔴 §4 역위험 축 — **그 brand 가 「판매처 상호」인가.**
 *    판정은 **도메인과의 글자 겹침** 하나로만 한다(사전 0 · 추정 0).
 *    예: `petitemaisonkids.com` ↔ brand "Petite Maison Kids" ⟹ 상호다.
 * 🔴 「아니다」를 「진짜 상품 브랜드다」로 단정하지 않는다 — **UNKNOWN** 을 남긴다.
 */
function brandLooksLikeShopName(brand, domain) {
  if (!brand || !domain) return null;
  const b = brand.toLowerCase().replace(/[^a-z0-9]/g, "");
  const d = domain.toLowerCase().replace(/^www\./, "").split(".")[0].replace(/[^a-z0-9]/g, "");
  if (!b || !d) return null;
  return d.includes(b) || b.includes(d);
}

const fixture = rows.map((r, i) => {
  const { originBrandInReason, candidateBrandInReason } = brandsFromReasons(r.match_reasons);
  const blockers = Array.isArray(r.blockers) ? r.blockers : [];
  return {
    id: `${r.human_verdict === "SAME" ? "TP" : r.human_verdict === "DIFFERENT" ? "FP" : "OT"}-${String(i + 1).padStart(2, "0")}`,
    at: r.at,
    source: r.source,
    originTitle: r.origin_title ?? null,
    originCode: r.origin_code ?? null,
    originBrand: r.origin_brand ?? null,
    originBrandSource: r.origin_brand_source ?? null,
    originBrandConfidence: r.origin_brand_confidence ?? null,
    candidateDomain: r.candidate_domain ?? null,
    candidateTitle: r.candidate_title ?? null,
    candidateUrl: r.candidate_url ?? null,
    /** 🔴 후보 brand 는 **운영 reasons 원문** 에서만 왔다(칸이 따로 없다). */
    originBrandInReason,
    candidateBrandInReason,
    /** 🔴 **상호 의심** — 도메인 겹침으로만 판정. 판단 못 하면 null(UNKNOWN). */
    candidateBrandLooksLikeShopName: brandLooksLikeShopName(candidateBrandInReason, r.candidate_domain),
    systemVerdict: r.system_verdict ?? null,
    matchTruth: r.match_truth ?? null,
    priceTier: r.price_tier ?? null,
    blockers,
    hasBrandMismatch: blockers.includes("BRAND_MISMATCH"),
    matchReasons: Array.isArray(r.match_reasons) ? r.match_reasons : null,
    market: r.market ?? null,
    priceAmount: r.price_amount ?? null,
    priceCurrency: r.price_currency ?? null,
    /** 🔴🔴 **사람 판정은 여기서 고정된다** — 반사실을 보고 바꾸지 않는다. */
    humanVerdict: r.human_verdict,
    humanNote: r.human_note ?? null,
  };
});

const out = {
  sprint: "SPRINT5-BRAND-GT",
  note:
    "운영 candidate_reviews 의 **사람 판정이 있는 행 전수**. 🔴 전체 상품군 recall 추정치로 쓰지 않는다 — " +
    "BRAND_MISMATCH 정책을 적용했을 때 **현재 확인된 FP/TP 가 어떻게 변하는지** 만 잰다.",
  capturedFrom: "production candidate_reviews (read-only)",
  rows: fixture,
};
const path = new URL(
  "../../../apps/admin/src/app/api/price-history/_lib/__tests__/fixtures/sprint5-brand-gt.json",
  import.meta.url,
);
writeFileSync(path, JSON.stringify(out, null, 2), "utf8");

const n = (f) => fixture.filter(f).length;
console.log(`fixture ${fixture.length}행 저장`);
console.log(`  human SAME ${n((r) => r.humanVerdict === "SAME")} · DIFFERENT ${n((r) => r.humanVerdict === "DIFFERENT")} · 그 외 ${n((r) => !["SAME", "DIFFERENT"].includes(r.humanVerdict))}`);
console.log(`  BRAND_MISMATCH 보유 ${n((r) => r.hasBrandMismatch)}`);
console.log(`  후보 brand 원문 확보 ${n((r) => r.candidateBrandInReason)} · 🔴 상호 의심 ${n((r) => r.candidateBrandLooksLikeShopName === true)}`);
console.log(`  → ${path.pathname}`);
await p.$disconnect();
