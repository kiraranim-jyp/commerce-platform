/**
 * SPRINT 3 — DISCOVERY QUALITY 진단 (read-only)
 *
 * 🔴 목적은 하나다 — CEO 캡처의 오염 후보가 **어느 축으로 1차 집계에 들어왔는지** 를
 *    추측하지 않고 **저장된 값으로** 읽는다(§2 STEP 2 · 「값으로 읽는다」).
 * 🔴 쓰기 0 · 운영 코드 0 · 추가 HTTP 0.
 */
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

const CODES = ["b226ac043", "b226ac010"];

for (const code of CODES) {
  console.log(`\n${"=".repeat(78)}\n=== ${code.toUpperCase()}\n${"=".repeat(78)}`);

  const snaps = await p.$queryRawUnsafe(
    `select id, workspace_id, title, source_url, status, created_at, updated_at,
            (workspace->'canonicalProduct'->'brand'->>'value') as brand,
            (workspace->'canonicalProduct'->>'brandModelCode') as code
       from product_snapshots
      where lower(source_url) like $1
      order by updated_at desc limit 6`,
    `%${code}%`,
  );
  console.log(`\n-- product_snapshots (${snaps.length}건)`);
  for (const s of snaps) {
    console.log(
      `  ${s.id}  ${String(s.status).padEnd(12)} brand="${s.brand ?? ""}" code=${s.code ?? "-"}  upd=${new Date(s.updated_at).toISOString()}`,
    );
    console.log(`     ${s.title}`);
    /** 🔴 ②(라이브 1회)의 입력이다 — 손으로 지어내면 엉뚱한 상품에 붙는다. */
    console.log(`     SNAPSHOT=${s.id}  WORKSPACE=${s.workspace_id}  URL=${s.source_url}`);
  }
  if (!snaps.length) {
    console.log("  🔴 스냅샷 0건 — 이 상품은 운영 DB 에 없다(측정불가, 0 이 아니다)");
    continue;
  }

  for (const s of snaps.slice(0, 2)) {
    const rows = await p.$queryRawUnsafe(
      `select domain, url, market, system_verdict, system_price_tier, system_match_truth,
              price_amount, price_currency, price_status, human_verdict, title, created_at
         from candidate_reviews
        where snapshot_id = $1
        order by system_verdict nulls last, price_currency, price_amount`,
      s.id,
    );
    console.log(`\n-- candidate_reviews  snapshot=${s.id}  (${rows.length}건)`);
    if (!rows.length) {
      console.log("   🔴 0건 — 저장 경로가 비었다(화면은 라이브 산출로 떴을 수 있다)");
      continue;
    }
    for (const r of rows) {
      console.log(
        `   ${String(r.market ?? "-").padEnd(8)} ${String(r.domain).padEnd(26)}` +
          ` v=${String(r.system_verdict ?? "-").padEnd(14)} tier=${String(r.system_price_tier ?? "-").padEnd(11)}` +
          ` truth=${String(r.system_match_truth ?? "-").padEnd(18)}` +
          ` ${String(r.price_amount ?? "-").padStart(10)} ${String(r.price_currency ?? "").padEnd(4)}` +
          ` ps=${String(r.price_status ?? "-").padEnd(18)} h=${r.human_verdict ?? "-"}`,
      );
      console.log(`      ${String(r.title ?? "").slice(0, 96)}`);
    }

    /** 🔴 1차 집계에 «실제로» 들어가는 조건을 운영 규칙 그대로 센다 */
    const os = rows.filter((r) => r.market === "OVERSEAS" && r.price_amount != null);
    const inAgg = os.filter((r) => r.system_price_tier !== "EXCLUDED");
    const sameOnly = inAgg.filter(
      (r) => r.system_verdict === "SAME" || r.system_verdict === "PRESUMED_SAME",
    );
    console.log(
      `\n   🌎 해외 가격 보유 ${os.length} → 현재 집계 진입(EXCLUDED 만 제외) ${inAgg.length}` +
        ` → verdict SAME/PRESUMED 로 좁히면 ${sameOnly.length}`,
    );
    const lowest = (xs) => {
      const by = {};
      for (const r of xs) {
        const c = r.price_currency ?? "?";
        by[c] = by[c] == null ? Number(r.price_amount) : Math.min(by[c], Number(r.price_amount));
      }
      return by;
    };
    console.log(`   현재 최저가  ${JSON.stringify(lowest(inAgg))}`);
    console.log(`   좁힌 뒤      ${JSON.stringify(lowest(sameOnly))}`);
    console.log(`   verdict 분포 ${JSON.stringify(
      os.reduce((a, r) => ((a[r.system_verdict ?? "null"] = (a[r.system_verdict ?? "null"] ?? 0) + 1), a), {}),
    )}`);
    console.log(`   tier 분포    ${JSON.stringify(
      os.reduce((a, r) => ((a[r.system_price_tier ?? "null"] = (a[r.system_price_tier ?? "null"] ?? 0) + 1), a), {}),
    )}`);
  }
}

await p.$disconnect();
