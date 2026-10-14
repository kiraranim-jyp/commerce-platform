/**
 * WU-007 — Zero-Cost Deterministic Discovery **읽기 전용** 인벤토리 덤프
 *
 * 🔴 **READ ONLY.** INSERT/UPDATE/DELETE 0 · migration 0 · schema 0 · 외부 API 0 ·
 *    Gemini 0 · AI 0. 🔴 측정용 JSON 만 쓴다(운영 DB 에 한 글자도 쓰지 않는다).
 *
 * 🔴🔴 **이 WU 의 핵심 질문이 「도메인 목록이 어디서 오는가」다.**
 *    소매처 직접 Discovery 는 «도메인을 이미 알고 있을 때» 만 성립하고, Common Crawl CDX
 *    도 urlkey 가 역순 도메인으로 시작하므로 **도메인 없이는 질의가 안 된다**(실측).
 *    → 그래서 「질의 가능한 도메인 전수」를 먼저 센다. 그것이 Discovery 의 **상한** 이다.
 *
 * 모으는 것 셋:
 *   ① 등록부 전수 — domestic_price_sources (도메인 · 수집전략 · scope)
 *   ② workspace 실효 ON/OFF — workspace_domestic_shop_settings
 *      🔴 카탈로그의 enabled 칸은 **무시** 된다(메모 manual-means-uninvestigated)
 *   ③ 26개 상품이 **이미 갖고 있는** 국내 링크 (axis ③ 분모)
 *
 * 사용법: packages/database 에서
 *   node --env-file=.env scripts/mi-007-discovery-inventory-dump.mjs
 */
import { PrismaClient } from "@prisma/client";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();
const OUT = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");

function readSnapshotIds() {
  const p = path.join(OUT, "e2e-snapshots.json");
  if (!existsSync(p)) throw new Error(`선행 덤프 없음: ${p}`);
  return JSON.parse(readFileSync(p, "utf8")).map((r) => r.id);
}

async function main() {
  const ids = readSnapshotIds();
  console.log(`대상 스냅샷 ${ids.length}개`);
  mkdirSync(OUT, { recursive: true });

  /** 🔴 칸 이름을 추측하지 않는다 — information_schema 로 먼저 읽는다
   *     (이 트랙에서 같은 실수를 아홉 번 했다). */
  const cols = async (t) =>
    (
      await prisma.$queryRawUnsafe(
        `select column_name from information_schema.columns where table_name = $1 order by ordinal_position`,
        t,
      )
    ).map((r) => r.column_name);

  const schema = {
    domestic_price_sources: await cols("domestic_price_sources"),
    workspace_domestic_shop_settings: await cols("workspace_domestic_shop_settings"),
    domestic_product_links: await cols("domestic_product_links"),
  };
  console.log("── 칸 확인");
  for (const [t, c] of Object.entries(schema)) console.log(`  ${t}: ${c.join(", ")}`);

  const sources = await prisma.$queryRawUnsafe(
    `select id, name, domain, collection_strategy, enabled, category_scope
       from domestic_price_sources order by domain`,
  );

  const settings = await prisma.$queryRawUnsafe(
    `select workspace_id, source_id, enabled from workspace_domestic_shop_settings`,
  );

  /** ③ 26개 상품이 이미 가진 국내 링크. 🔴 조인으로 도메인을 얻는다
   *     (링크 테이블에 domain 칸이 **없다** — WU-021 에서 걸린 함정). */
  const links = await prisma.$queryRawUnsafe(
    `select l.*, s.domain as source_domain, s.name as source_name
       from domestic_product_links l
       join domestic_price_sources s on s.id = l.source_id
      where l.snapshot_id = any($1::uuid[])`,
    ids,
  );

  const payload = { schema, sources, settings, links, snapshotIds: ids };
  writeFileSync(
    path.join(OUT, "wu007-inventory.json"),
    JSON.stringify(payload, (_k, v) => (typeof v === "bigint" ? Number(v) : v), 1),
    "utf8",
  );

  console.log("── 요약");
  console.log(`  등록부 전수            ${sources.length}`);
  const byStrategy = {};
  for (const s of sources) byStrategy[s.collection_strategy] = (byStrategy[s.collection_strategy] ?? 0) + 1;
  console.log(`  수집전략별             ${JSON.stringify(byStrategy)}`);
  console.log(`  workspace 설정 행      ${settings.length}`);
  console.log(`  26개 상품의 국내 링크  ${links.length}`);
  const linkedSnaps = new Set(links.map((l) => l.snapshot_id));
  console.log(`  링크 보유 상품         ${linkedSnaps.size} / ${ids.length}`);
  const linkDomains = {};
  for (const l of links) linkDomains[l.source_domain] = (linkDomains[l.source_domain] ?? 0) + 1;
  console.log(`  링크 도메인별          ${JSON.stringify(linkDomains)}`);
  console.log(`\n🟢 wu007-inventory.json 기록 완료 (DB 쓰기 0)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
