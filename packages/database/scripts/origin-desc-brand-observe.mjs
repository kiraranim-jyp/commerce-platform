/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MI-ORIGIN-DESCRIPTION-BRAND-OBSERVATION-01 — **읽기 전용 관찰**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **보호 파일을 읽지도 복사하지도 않았다** — `brand-description-evidence.ts` ·
 *    `product-name-description-evidence.ts` 는 소유권 불명 untracked 이고 CPO 가
 *    보호를 지시했다. 🟢 이 하니스는 **독립 구현** 이고 **운영에 import 되지 않는다**.
 * 🔴 DB **읽기만** 한다 · schema/migration **0** · 외부 URL 재수집 **0**.
 *
 * ── 🔴 브랜드 증거로 «인정하지 않는» 것(CPO §4) ─────────────────────────────
 * ```
 * 판매처 이름 · 도메인/URL 문자열 · 플랫폼 이름 · 단순 vendor 값 ·
 * 근거 불명 별칭 · 추측 복원
 * ⟹ 🟢 그래서 **상품과 명시적으로 연결된 표현** 만 센다 — 라벨(`브랜드:` · `Brand:`)
 *    또는 `by <브랜드>` 꼴, 그리고 **저장된 브랜드 문자열이 설명문에 그대로 있는** 경우.
 * 🔴 「대문자 단어가 있으면 브랜드」 같은 추정은 쓰지 않는다(그것이 오탐의 원천이다).
 * ```
 */
import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

/** 🔴 플랫폼·판매처 어휘 — 이것이 잡히면 **브랜드로 세지 않는다**. */
const NOT_A_BRAND = [
  "naver", "smartstore", "coupang", "11st", "gmarket", "auction", "wconcept", "musinsa",
  "cafe24", "shopify", "makeshop", "sixshop", "godomall", "lotte", "ssg", "kakao",
  "스마트스토어", "쿠팡", "네이버", "지마켓", "옥션", "위컨셉", "무신사", "롯데", "카페24",
  "본사", "공식몰", "스토어", "store", "shop", "mall", "official",
];

/** 🟢 라벨 꼴 — 상품과 **명시적으로** 연결된 브랜드 표현만. */
const LABELED = [
  /(?:브랜드|제조사|브랜드명)\s*[:：]\s*([^\n\r,;|]{2,40})/i,
  /\bbrand\s*[:：]\s*([^\n\r,;|]{2,40})/i,
  /\bmanufacturer\s*[:：]\s*([^\n\r,;|]{2,40})/i,
];

const clean = (s) => (s ?? "").replace(/\s+/g, " ").trim();
const low = (s) => clean(s).toLowerCase();

function labeledBrand(desc) {
  for (const re of LABELED) {
    const m = re.exec(desc ?? "");
    if (!m) continue;
    const v = clean(m[1]);
    if (v.length < 2) continue;
    if (NOT_A_BRAND.some((x) => low(v).includes(x))) continue;
    return { value: v, how: "LABELED", at: m.index, excerpt: clean((desc ?? "").slice(Math.max(0, m.index - 30), m.index + 80)) };
  }
  return null;
}

/** 🟢 저장된 브랜드가 설명문에 **그대로** 있는가 — 「확인」이고 「생성」이 아니다. */
function confirmsStored(desc, storedBrand) {
  const b = low(storedBrand);
  if (b.length < 2) return null;
  const d = low(desc);
  const i = d.indexOf(b);
  if (i < 0) return null;
  return { value: clean(storedBrand), how: "STORED_CONFIRMED", at: i, excerpt: clean((desc ?? "").slice(Math.max(0, i - 30), i + 80)) };
}

/** 🟢 `… by <Brand>` 꼴 — 이 저장소의 실제 제목·설명 관용(실측: junioredition 등). */
function byBrand(desc) {
  const m = /\bby\s+([A-Z][A-Za-z&'.\- ]{2,28})(?:[.,\n\r]|$)/.exec(desc ?? "");
  if (!m) return null;
  const v = clean(m[1]);
  if (NOT_A_BRAND.some((x) => low(v).includes(x))) return null;
  return { value: v, how: "BY_PATTERN", at: m.index, excerpt: clean((desc ?? "").slice(Math.max(0, m.index - 30), m.index + 80)) };
}

try {
  const rows = await p.$queryRawUnsafe(`
    select distinct cr.snapshot_id::text sid,
           ps.source_url,
           ps.workspace->'canonicalProduct'->'brand'->>'value'        stored_brand,
           ps.workspace->'canonicalProduct'->'title'->>'value'        stored_title,
           ps.workspace->'canonicalProduct'->'description'->>'value'  desc_raw
      from candidate_reviews cr
      join product_snapshots ps on ps.id = cr.snapshot_id
     where cr.market = 'KR' and cr.blockers @> '["BRAND_UNCONFIRMED"]'::jsonb`);

  const n = await p.$queryRawUnsafe(`
    select count(*)::int rows from candidate_reviews
     where market='KR' and blockers @> '["BRAND_UNCONFIRMED"]'::jsonb`);
  console.log(`국내 BRAND_UNCONFIRMED 행 ${n[0].rows} → 고유 원상품 ${rows.length}`);

  const tally = {};
  const bump = (k) => (tally[k] = (tally[k] ?? 0) + 1);
  const recovered = [];
  const conflicts = [];

  for (const r of rows) {
    const stored = clean(r.stored_brand);
    const desc = r.desc_raw ?? "";
    const hit = labeledBrand(desc) ?? confirmsStored(desc, stored) ?? byBrand(desc);

    let cls;
    if (desc.length === 0) cls = "UNRESOLVED";
    else if (stored.length > 0) {
      /** 🟢 저장 브랜드가 있으면 이미 확인된 쪽이다 — 충돌만 가른다. */
      if (hit && hit.how !== "STORED_CONFIRMED" && low(hit.value) !== low(stored)) {
        cls = "DESCRIPTION_CONFLICT";
        conflicts.push({ r, hit, stored });
      } else cls = "ORIGIN_BRAND_PRESENT";
    } else if (hit) {
      cls = "DESCRIPTION_BRAND_RECOVERABLE";
      recovered.push({ r, hit });
    } else cls = "ORIGIN_BRAND_UNCONFIRMED";
    bump(cls);
    console.log(
      `  ${r.sid.slice(0, 8)} | ${cls.padEnd(30)} | storedBrand=${JSON.stringify(stored).slice(0, 22).padEnd(24)} descLen=${String(desc.length).padStart(5)} | ${String(r.stored_title ?? "").slice(0, 40)}`,
    );
  }

  console.log(`\n분류 — ${JSON.stringify(tally)}`);
  if (recovered.length > 0) {
    console.log("\n🟢 상세설명에서 복구된 브랜드(원문 근거 포함)");
    for (const x of recovered) {
      console.log(`  ${x.r.sid.slice(0, 8)} | ${x.hit.how} @${x.hit.at} | "${x.hit.value}"`);
      console.log(`      원문: …${x.hit.excerpt}…`);
    }
  }
  if (conflicts.length > 0) {
    console.log("\n🔴 저장 브랜드 ↔ 상세설명 브랜드 충돌");
    for (const x of conflicts) {
      console.log(`  ${x.r.sid.slice(0, 8)} | 저장 "${x.stored}" ↔ 설명 "${x.hit.value}" (${x.hit.how})`);
      console.log(`      원문: …${x.hit.excerpt}…`);
    }
  }
  /** 🔴 후보 측 원인은 **추정하지 않는다** — 그 원문이 저장돼 있지 않다. */
  console.log(
    `\n🔴 후보 측 원인: **측정 불가**(후보 상세설명 미저장) — 이 측정은 **원상품 축 전용** 이다`,
  );
} catch (e) {
  console.log("ERR", e.message.slice(0, 400));
  process.exitCode = 1;
} finally {
  await p.$disconnect();
}
