/**
 * WU-017-E2E — 케이스 원상품의 **canonicalProduct 전문** 읽기 전용 덤프
 *
 * 🔴 **READ ONLY.** 외부 API 0 · Gemini 0 · AI 0 · 쓰기 0.
 *
 * 🔴🔴 왜 «전문» 이 필요한가 — 운영 query 를 **복제하지 않기 위해서** 다.
 *    운영 호출부(check/route.ts:52 → run-domestic-price-check.ts:801)는
 *      `buildProductIdentityDna(canonicalProduct)` → `productFactsFromIdentityDna(dna)`
 *    로 query.facts 를 만든다. 칸 몇 개만 떠서 손으로 facts 를 만들면 그것이
 *    **하니스 결함** 이다(이 트랙에서 열한 번 걸린 그 실수).
 *
 * 사용법: packages/database 에서
 *   node --env-file=.env scripts/mi-017-e2e-case-dump.mjs
 */
import { PrismaClient } from "@prisma/client";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();
const OUT = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");

/**
 * 🔴 선행 덤프(`mi-017-e2e-urlset.json`)에서 **실제로 관측된** 스냅샷만 고른다.
 *    각 id 가 어느 케이스에 쓰이는지는 하니스가 적는다(여기서는 데이터만 낸다).
 */
const IDS = [
  "d92ba611-78ba-4e3e-a0b6-5c6fd0a6a0a6", // placeholder — 아래에서 prefix 로 해석한다
];

/** 🟢 id 앞 8자리만 알고 있으므로 prefix 로 찾는다(덤프 출력이 축약형이었다). */
const PREFIXES = ["d92ba611", "278d4c38", "ba9631b6", "0695a024", "e3aaae5b"];

async function main() {
  if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
  void IDS;

  const rows = await prisma.$queryRawUnsafe(
    `SELECT ps.id,
            ps.source_url,
            ps.workspace->'canonicalProduct' AS canonical_product
       FROM product_snapshots ps
      WHERE ps.workspace->'canonicalProduct' IS NOT NULL
        AND left(ps.id::text, 8) = any($1::text[])`,
    PREFIXES,
  );

  writeFileSync(path.join(OUT, "mi-017-e2e-cases.json"), JSON.stringify(rows, null, 2), "utf8");
  for (const r of rows) {
    const cp = r.canonical_product ?? {};
    console.log(
      `${String(r.id).slice(0, 8)} | brand=${cp.brand?.value ?? "(없음)"} | sku=${cp.sku?.value ?? "(없음)"} | ` +
        `model=${cp.modelName?.value ?? "(없음)"} | color=${cp.color?.value ?? "(없음)"} | ${r.source_url}`,
    );
  }
  console.log(`대상 ${rows.length}건 → ${path.join(OUT, "mi-017-e2e-cases.json")}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
