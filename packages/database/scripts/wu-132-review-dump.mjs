/**
 * WU-132 — **읽기 전용** 검토 이력 덤프 (⑥ 재투입 E2E 의 입력)
 *
 * 🔴 READ ONLY · DB 쓰기 0 · 외부 API 0 · AI 0 · schema 변경 0.
 * 🔴 「SAME 만 재투입한다」를 **운영 데이터로** 확인하기 위한 덤프다 —
 *    숫자를 여기서 만들지 않고 `candidate_reviews` 를 그대로 센다.
 *
 * 사용법: packages/database 에서
 *   node --env-file=.env scripts/wu-132-review-dump.mjs
 */
import { PrismaClient } from "@prisma/client";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();
const OUT = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");
mkdirSync(OUT, { recursive: true });

const rows = await prisma.$queryRawUnsafe(
  `select origin_code, snapshot_id, candidate_url, candidate_domain, candidate_title,
          image_url, price_amount, price_currency, market,
          system_verdict, match_truth, human_verdict, source
     from candidate_reviews
    order by origin_code nulls last, human_verdict nulls last, candidate_url`,
);

const byVerdict = {};
const byOrigin = {};
for (const r of rows) {
  const v = r.human_verdict ?? "(미판단)";
  byVerdict[v] = (byVerdict[v] ?? 0) + 1;
  const k = r.origin_code ?? "(origin_code 없음)";
  byOrigin[k] ??= { total: 0, SAME: 0, DIFFERENT: 0, SIMILAR: 0, UNDECIDED: 0, none: 0 };
  byOrigin[k].total += 1;
  if (r.human_verdict) byOrigin[k][r.human_verdict] += 1;
  else byOrigin[k].none += 1;
}

/** 🔴 「SAME 만」의 분모/분자를 **운영 데이터로** 적는다. */
const sameUrls = rows.filter((r) => r.human_verdict === "SAME").map((r) => r.candidate_url);
/** 🔴 재투입이 **열지 않는** 것도 같이 센다(과거 DIFFERENT 는 들어가지 않는다). */
const notSame = rows.filter((r) => r.human_verdict && r.human_verdict !== "SAME").length;

console.log("rows:", rows.length);
console.log("byVerdict:", byVerdict);
console.log("byOrigin:", byOrigin);
console.log("SAME urls:", sameUrls.length, "| 재투입 제외(판단 있으나 SAME 아님):", notSame);
console.log("imageUrl 보유:", rows.filter((r) => r.image_url).length, "/", rows.length);

writeFileSync(
  path.join(OUT, "wu-132-reviews.json"),
  JSON.stringify({ rows, byVerdict, byOrigin, sameUrls, notSame }, null, 2),
  "utf8",
);
console.log("→", path.join(OUT, "wu-132-reviews.json"));
await prisma.$disconnect();
