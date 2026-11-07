/**
 * 🔵 CEO EVIDENCE REVIEW ① — **DB 읽기 전용 덤프**. 쓰기 0 · 운영 변경 0 · 크롤링 0.
 *    산출 → `apps/admin/.../__tests__/fixtures/ceo-evidence-review-db.json`
 *    🔴 빌더(vitest)는 DB 를 직접 보지 않는다 — 이 파일이 **유일한 DB 경로** 다.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const ROOT = path.join(process.cwd(), "..", "..");
const FIX = path.join(ROOT, "apps", "admin", "src", "app", "api", "price-history", "_lib", "__tests__", "fixtures");
const A = JSON.parse(readFileSync(path.join(FIX, "wu-059-gt-facts.json"), "utf8"));
const B = JSON.parse(readFileSync(path.join(FIX, "wu-068-new-gt.json"), "utf8"));
const TARGET_IDS = ["C27", "C05", "C06", "C19", "C20", "C50", "S1-5", "S1-6", "C22", "C42", "C25"];
const urls = [...new Set([
  ...Object.entries(A.candidates).filter(([id]) => TARGET_IDS.includes(id)).map(([, c]) => c.url),
  ...Object.values(B).filter((r) => TARGET_IDS.includes(r.id)).map((r) => r.url),
])];

const p = new PrismaClient();
const lit = (s) => `'${String(s).replace(/'/g, "''")}'`;
const rows = await p.$queryRawUnsafe(`
  select candidate_url, candidate_domain, origin_code, candidate_title, image_url,
         price_amount, price_currency, market, price_status, sold_out,
         system_verdict, match_truth, price_tier, blockers,
         human_verdict, human_note, source, first_seen_at, last_seen_at
    from candidate_reviews where candidate_url in (${urls.map(lit).join(",")})`);
await p.$disconnect();

/** 🔴 `Date` 를 그대로 쓰면 JSON 에서 모양이 바뀐다 — 문자열로 고정한다. */
const clean = rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v instanceof Date ? v.toISOString() : v])));
writeFileSync(path.join(FIX, "ceo-evidence-review-db.json"),
  JSON.stringify({ dumpedFor: TARGET_IDS, urlsProbed: urls.length, rows: clean }, null, 1), "utf8");
console.log(`🟢 DB 덤프 — URL ${urls.length} 조회 · 행 ${clean.length} 저장(쓰기 0)`);
console.log(`   verdict 보유 ${clean.filter((r) => r.system_verdict).length} · 가격 보유 ${clean.filter((r) => r.price_amount != null).length}`);
