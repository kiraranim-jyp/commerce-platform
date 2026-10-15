/**
 * WU-008 ② — `B226AC117` **스냅샷별 시장 관측 + 샵 실효 상태** 읽기 전용 덤프
 *
 * 🔴 READ ONLY · 외부 API 0 · Gemini 0 · 가격 추정/환산 0.
 *
 * 왜 필요한가 — 1차 덤프에서 **같은 상품이 스냅샷 13개로 쪼개져 있고** 원본 URL 이
 * `.co.jp`(JPY 26,400) 와 `.com`(EUR 120) **둘** 이었다. CEO 가 연 화면이 어느
 * 스냅샷인지에 따라 보이는 원본 통화가 달라진다. 🔴 그래서 **스냅샷마다** 어떤 시장
 * 관측을 갖고 있는지 갈라 읽는다(특히 `en-kr` = ₩258,000 보유 여부).
 */
import { PrismaClient } from "@prisma/client";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();
const OUT = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");

async function main() {
  mkdirSync(OUT, { recursive: true });

  const snaps = await prisma.$queryRawUnsafe(
    `select id, source_url, workspace_id, created_at,
            workspace->'canonicalProduct'->'price' as price,
            workspace->'canonicalProduct'->'brand' as brand
       from product_snapshots
      where source_url ilike '%b226ac117%'
      order by created_at desc`,
  );

  const rows = await prisma.$queryRawUnsafe(
    `select snapshot_id, source, currency, market_code, price_krw, count(*)::int as n,
            min(source_product_url) as sample_url
       from price_observations
      where snapshot_id = any($1::uuid[])
      group by snapshot_id, source, currency, market_code, price_krw
      order by snapshot_id, market_code nulls first`,
    snaps.map((s) => s.id),
  );

  /** 🔴 실효 ON/OFF 의 owner 는 workspace 설정이다(카탈로그 enabled 는 무시된다). */
  const wsIds = [...new Set(snaps.map((s) => s.workspace_id))];
  const settings = await prisma.$queryRawUnsafe(
    `select ws.workspace_id, s.domain, s.collection_strategy, s.enabled as catalog_enabled,
            ws.enabled as ws_enabled, s.category_scope
       from workspace_domestic_shop_settings ws
       join domestic_price_sources s on s.id = ws.source_id
      where ws.workspace_id = any($1::uuid[])
      order by ws.workspace_id, s.domain`,
    wsIds,
  );

  writeFileSync(
    path.join(OUT, "wu008-market-split.json"),
    JSON.stringify({ snaps, rows, settings }, (_k, v) => (typeof v === "bigint" ? Number(v) : v), 1),
    "utf8",
  );

  console.log("=== 스냅샷별 원본가 + 보유 시장 관측");
  for (const s of snaps) {
    const mine = rows.filter((r) => r.snapshot_id === s.id);
    const p = s.price?.value ?? {};
    const host = (() => {
      try {
        return new URL(s.source_url).host;
      } catch {
        return "?";
      }
    })();
    const markets = mine.map((m) => `${m.market_code || "(없음)"}:${m.currency}/${m.price_krw}`).join("  ");
    console.log(
      `${String(s.created_at).slice(4, 10)} ${s.id.slice(0, 8)} ${host.padEnd(18)} ` +
        `원본=${p.amount ?? "-"} ${p.currency ?? "-"} brand="${s.brand?.value ?? ""}"`,
    );
    console.log(`     관측: ${markets || "(없음)"}`);
    const hasKr = mine.some((m) => m.market_code === "en-kr");
    console.log(`     🔴 en-kr(₩258,000) 보유: ${hasKr ? "🟢 있다" : "🔴 **없다**"}`);
  }

  console.log("\n=== workspace 샵 실효 상태 (이 상품의 workspace 들)");
  const byWs = {};
  for (const r of settings) (byWs[r.workspace_id] ??= []).push(r);
  for (const [ws, list] of Object.entries(byWs)) {
    const on = list.filter((r) => r.ws_enabled);
    const auto = on.filter((r) => String(r.collection_strategy).startsWith("AUTO"));
    console.log(`  ws ${ws.slice(0, 8)} — 설정 ${list.length}개 · 실효 ON ${on.length} · 그중 AUTO ${auto.length}`);
    for (const r of auto) console.log(`      🟢 ${r.domain} ${r.collection_strategy} scope=${JSON.stringify(r.category_scope)}`);
    const offAuto = list.filter((r) => !r.ws_enabled && String(r.collection_strategy).startsWith("AUTO"));
    for (const r of offAuto) console.log(`      🔴 OFF ${r.domain} ${r.collection_strategy}`);
  }

  console.log("\n🟢 wu008-market-split.json 기록 완료 (DB 쓰기 0)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
