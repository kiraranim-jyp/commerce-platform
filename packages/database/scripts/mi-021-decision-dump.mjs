/**
 * WU-021 — 최종 MI / 등록판정 연결 검증용 **읽기 전용** 덤프
 *
 * 🔴 **READ ONLY.** INSERT/UPDATE/DELETE 0 · migration 0 · 외부 API 0 · Gemini 0.
 * 🔴 선행 덤프(`mi-gemini-005-dump.mjs`)가 남긴 `e2e-snapshots.json` 의 **같은 26개
 *    스냅샷** 에 대해, 판정 사슬의 입력으로 **운영 DB 가 실제로 갖고 있는 것** 을 모은다:
 *      ① price_observations **전 source**(선행 덤프는 DOMESTIC_SHOP 만 담았다)
 *      ② domestic_product_links (tier 산출 입력)
 *      ③ price_alerts (운영이 «이미 낸» 산출물 → §5-B CONTROL 후보)
 *
 * 사용법: packages/database 에서
 *   node --env-file=.env scripts/mi-021-decision-dump.mjs
 */
import { PrismaClient } from "@prisma/client";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();
const OUT = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");

function readSnapshotIds() {
  const p = path.join(OUT, "e2e-snapshots.json");
  if (!existsSync(p)) throw new Error(`선행 덤프 없음: ${p} — mi-gemini-005-dump.mjs 를 먼저 돌린다`);
  return JSON.parse(readFileSync(p, "utf8")).map((r) => r.id);
}

async function main() {
  const ids = readSnapshotIds();
  console.log(`대상 스냅샷 ${ids.length}개`);

  /** ① 관측 — 🔴 source 를 **거르지 않는다**(SELLER_ORIGIN 원가 축이 필요하다). */
  const observations = await prisma.$queryRawUnsafe(
    `select snapshot_id, id, source, source_label, source_product_url, source_ref_id,
            currency, price_amount, price_krw, shipping_cost_amount, tax_amount, exchange_rate,
            sale_price_krw, original_price_krw, sold_out, market_code, market_country, checked_at
       from price_observations
      where snapshot_id = any($1::uuid[])
      order by checked_at desc`,
    ids,
  );

  /** 🔴 칸 이름은 information_schema 로 읽어서 적었다 — 추측하지 않았다(`domain`·`shop_name`·
   *     `price_krw`·`sold_out` 은 이 표에 **없다**. 선행 덤프는 source 조인으로 만든 값이었다).
   * ② 링크 — tier 는 `priceTierFromLink` 가 산출한다(복제 금지). 입력만 가져온다. */
  const links = await prisma.$queryRawUnsafe(
    `select snapshot_id, source_id, match_truth, verified, match_type, cross_seller_verdict,
            external_url, matched_title, matched_brand, matched_color, match_confidence, status
       from domestic_product_links
      where snapshot_id = any($1::uuid[])`,
    ids,
  );

  /** ③ 🔴 운영이 «이미 낸» 산출물 — §5-B CONTROL 후보다. */
  const alerts = await prisma.$queryRawUnsafe(
    `select snapshot_id, id, category, severity, title, detail, status, opened_at
       from price_alerts
      where snapshot_id = any($1::uuid[])
      order by opened_at desc`,
    ids,
  );

  /** ④ 스냅샷 자체가 들고 있는 판정/상태 칸(있으면 CONTROL 로 쓴다). */
  const snapCols = await prisma.$queryRawUnsafe(
    `select column_name from information_schema.columns
      where table_name = 'product_snapshots' order by ordinal_position`,
  );

  const serialize = (rows) =>
    JSON.parse(JSON.stringify(rows, (_k, v) => (typeof v === "bigint" ? Number(v) : v)));

  mkdirSync(OUT, { recursive: true });
  writeFileSync(path.join(OUT, "d021-observations.json"), JSON.stringify(serialize(observations), null, 1), "utf8");
  writeFileSync(path.join(OUT, "d021-links.json"), JSON.stringify(serialize(links), null, 1), "utf8");
  writeFileSync(path.join(OUT, "d021-alerts.json"), JSON.stringify(serialize(alerts), null, 1), "utf8");
  writeFileSync(
    path.join(OUT, "d021-snapshot-columns.json"),
    JSON.stringify(snapCols.map((r) => r.column_name), null, 1),
    "utf8",
  );

  const bySource = {};
  for (const o of observations) bySource[o.source] = (bySource[o.source] ?? 0) + 1;
  console.log("관측", observations.length, bySource);
  console.log("링크", links.length, "· 알림", alerts.length);
  console.log("snapshot 칸", snapCols.length);
}

main()
  .catch((e) => {
    console.error("ERR", e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
