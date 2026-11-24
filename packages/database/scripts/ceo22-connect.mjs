/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MI-HJP-02 — **CEO 22건 육안 판정을 운영 DB 에 «영구 연결» 한다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **새 행을 만들지 않는다. 새 표도 schema 변경도 0 이다.**
 *    22건 후보 URL 이 **이미 `candidate_reviews` 에 있다**(실측 22/22 · OVERSEAS_AUTO ·
 *    `human_verdict = null`) ⟹ 영구 연결은 **그 행의 판정 칸을 채우는 것** 이다.
 *
 * 🔴 **복원 근거**(CEO 에게 다시 묻지 않았다 · CPO §2):
 * ```
 * ⒜ 직접 근거 11건 — 계약 `CEO_CASES`(mce01-candidate-eligibility.test.ts)
 *      각 key 가 fixture 후보에 **정확히 1건** 으로 해석된다(모호 0 · 미발견 0)
 * ⒝ 여집합 11건 — CEO 가 명시한 총계 **SAME 4 / DIFFERENT 18** 과 후보 전수 22 에서
 *      SAME 4 를 빼면 **나머지는 전부 DIFFERENT** 다 ⟹ 추측이 아니라 **완전 분할** 이다
 * ```
 * 🔴 `human_note` 는 **쓰지 않는다** — CEO 근거 문장은 **그룹 공용**(고유 5개)이라
 *    개별 쌍에 복제하면 「대표님이 그 쌍에 직접 쓴 근거」처럼 보인다(메모 금지 항목).
 *
 * 🔴 **범위를 (snapshot_id, candidate_url) 로 묶는다** — URL 단독으로 쓰면 다른 원상품의
 *    행에 판정이 들어간다(그것이 CPO 가 막은 「URL 전역」이다).
 * 🔴 **덮어쓰지 않는다** — 이미 판정이 있고 값이 «다르면» 건드리지 않고 충돌로 보고한다.
 * 🔴 `--apply` 없이는 **읽기만** 한다.
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";

const APPLY = process.argv.includes("--apply");
const FIX = "../../apps/admin/src/app/api/price-history/_lib/__tests__/fixtures/";
const TEST =
  "../../apps/admin/src/app/pipeline/commerce/__tests__/mce01-candidate-eligibility.test.ts";

/** 🟢 계약에서 CEO 직접 근거를 읽는다 — 손으로 다시 적지 않는다. */
function ceoCases() {
  const src = readFileSync(TEST, "utf8");
  const out = [];
  const re = /\{ key: "([^"]+)", ceo: "([A-Z]+)"/g;
  let m;
  while ((m = re.exec(src)) != null) out.push({ key: m[1], ceo: m[2] });
  return out;
}

const ws = JSON.parse(readFileSync(FIX + "mcrw01-workspace.json", "utf8"));
/** 🟢 원상품(스냅샷) ↔ 후보 URL — 운영 조서가 만든 그 묶음 그대로. */
const pairs = [];
for (const r of ws.rows) {
  for (const c of r.candidates) {
    pairs.push({ snapshotId: r.snapshotId, originCode: r.opCode ?? null, url: c.url });
  }
}

const cases = ceoCases();
const sameKeys = cases.filter((c) => c.ceo === "SAME").map((c) => c.key);
const diffKeys = cases.filter((c) => c.ceo === "DIFFERENT").map((c) => c.key);

/** 🔴 각 key 가 **정확히 1건** 으로 해석되는지 먼저 확인한다(모호하면 중단). */
const resolve = (key) => {
  const hits = pairs.filter((p) => p.url.includes(key));
  if (hits.length !== 1) {
    console.log(`🔴 중단 — key 가 ${hits.length} 건으로 해석된다: ${key}`);
    process.exit(1);
  }
  return hits[0].url;
};
const sameUrls = new Set(sameKeys.map(resolve));
const diffUrlsDirect = new Set(diffKeys.map(resolve));

if (sameUrls.size !== 4) {
  console.log(`🔴 중단 — CEO SAME 이 4건이 아니다: ${sameUrls.size}`);
  process.exit(1);
}

/** 🟢 여집합 = DIFFERENT (CEO 명시 총계 4/18 과 전수 22 가 완전 분할을 만든다). */
const plan = pairs.map((p) => ({
  ...p,
  verdict: sameUrls.has(p.url) ? "SAME" : "DIFFERENT",
  basis: sameUrls.has(p.url)
    ? "DIRECT(CEO_CASES SAME)"
    : diffUrlsDirect.has(p.url)
      ? "DIRECT(CEO_CASES DIFFERENT)"
      : "COMPLEMENT(총계 4/18)",
}));

const nSame = plan.filter((p) => p.verdict === "SAME").length;
const nDiff = plan.length - nSame;
console.log(`복원표 — 전수 ${plan.length} · SAME ${nSame} · DIFFERENT ${nDiff}`);
if (nSame !== 4 || nDiff !== 18) {
  console.log("🔴 중단 — CEO 명시 총계(4/18)와 다르다");
  process.exit(1);
}

const p = new PrismaClient();
try {
  let connected = 0;
  let already = 0;
  let conflict = 0;
  let unmapped = 0;
  for (const row of plan) {
    const found = await p.$queryRawUnsafe(
      `select id, human_verdict from candidate_reviews
         where candidate_url = $1 and snapshot_id = $2::uuid`,
      row.url,
      row.snapshotId,
    );
    if (found.length === 0) {
      unmapped += 1;
      console.log(`  🔴 미매핑 — 그 스냅샷에 행이 없다: ${row.url.slice(0, 64)}`);
      continue;
    }
    const existing = found[0].human_verdict;
    if (existing === row.verdict) {
      already += 1;
      continue;
    }
    if (existing != null && existing !== row.verdict) {
      conflict += 1;
      console.log(`  🔴 충돌 — DB ${existing} ↔ CEO ${row.verdict}: ${row.url.slice(0, 56)}`);
      continue;
    }
    if (APPLY) {
      await p.$executeRawUnsafe(
        `update candidate_reviews
            set human_verdict = $1, reviewed_at = now()
          where id = $2::uuid and human_verdict is null`,
        row.verdict,
        found[0].id,
      );
    }
    connected += 1;
  }
  console.log(
    `${APPLY ? "적용" : "드라이런"} — 연결 ${connected} · 이미 동일 ${already} · 충돌 ${conflict} · 미매핑 ${unmapped}`,
  );
  if (APPLY) {
    const back = await p.$queryRawUnsafe(
      `select human_verdict, count(*)::int n from candidate_reviews
         where candidate_url = any($1::text[]) group by 1 order by 2 desc`,
      plan.map((x) => x.url),
    );
    console.log("확인 — 그 URL 들의 판정 분포:", JSON.stringify(back));
    const total = await p.$queryRawUnsafe(
      `select human_verdict, count(*)::int n from candidate_reviews group by 1 order by 2 desc`,
    );
    console.log("확인 — 전체 판정 분포:", JSON.stringify(total));
  }
} catch (e) {
  console.log("ERR", e.message.slice(0, 400));
  process.exitCode = 1;
} finally {
  await p.$disconnect();
}
