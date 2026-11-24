/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MI-CEO-JUDGMENT-HISTORY-01 — **CEO 22건을 «이력 표» 에 초기 적재한다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **새 migration 0** — `ceo_judgments`/`ceo_judgment_axes` 는 **이미 적용돼 있다**
 *    (실측 2026-11-24: 표 2 · RLS on · 행 0). 이 스크립트는 **행만** 넣는다.
 * 🔴 **기존 `candidate_reviews` 를 건드리지 않는다** — 판정값·행 **변경 0**.
 * 🔴 **멱등** — 같은 `(review_key, pair_id)` 가 이미 있고 판정이 같으면 **건너뛴다**
 *    (재실행에서 중복 이력 **0** · CPO 검증 2항).
 * 🔴 **provenance 를 섞지 않는다**(CPO §2):
 * ```
 * DIRECT      계약 `CEO_CASES` 에 CEO 판정이 직접 적혀 있다
 * COMPLEMENT  **닫힌 22건 모집단의 여집합** 으로 도출됐다 — 🔴 개별 CEO 발언으로
 *             직접 판정한 것처럼 적지 않는다
 * ```
 * 🔴 `raw_note` 는 **null 이다** — CEO 산문을 지어내지 않는다(그 표의 계약).
 * 🔴 `--apply` 없이는 **읽기만** 한다.
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";

const APPLY = process.argv.includes("--apply");
const BASE =
  "../../apps/admin/src/app/pipeline/commerce/__tests__/baselines/ceo22-restored.json";
const REVIEW_KEY = "MCRW01-CEO-REVIEW";
const REVIEWER = "CEO";
/** 🟢 조서 시점 — 복원표가 적어 둔 날짜 하나를 쓴다(지금 시각을 판정 시점으로 적지 않는다). */
const REVIEWED_AT = "2026-11-24T00:00:00.000Z";

const PROV = {
  DIRECT: "DIRECT — 계약 CEO_CASES 에 CEO 판정이 직접 기록됨",
  COMPLEMENT:
    "COMPLEMENT — 닫힌 22건 모집단의 여집합으로 도출(CEO 명시 총계 SAME 4 / DIFFERENT 18). 개별 발언으로 직접 판정된 것이 아니다",
};

/**
 * 🔵🔵🔵 **키를 «여기서 만들지 않는다».**
 *
 * 🔴🔴 1차 구현이 쿼리를 **전부 지웠다**. 운영 `reviewKey` 는
 *    `canonicalizeProductUrl`(= **식별 파라미터 보존**)이라 `?branduid=…` 같은 후보의
 *    키가 **달라진다** ⟹ 저장 키와 조회 키가 갈라져 **이력을 못 찾는다**(083 주석의 함정).
 * 🟢 그래서 계약 `ceo22-keys.test.ts` 가 **운영 함수로** 만든 파일을 읽는다 — owner 하나.
 */
const KEYS = JSON.parse(
  readFileSync("../../apps/admin/src/app/pipeline/commerce/__tests__/baselines/ceo22-keys.json", "utf8"),
).keys;
function reviewKeyOf(raw) {
  const k = KEYS[raw];
  if (!k) {
    console.log(`🔴 중단 — 그 URL 의 키가 생성 파일에 없다: ${raw}`);
    process.exit(1);
  }
  return k;
}

const base = JSON.parse(readFileSync(BASE, "utf8"));
if (base.total !== 22 || base.same !== 4 || base.different !== 18) {
  console.log("🔴 중단 — 복원표가 4/18/22 가 아니다");
  process.exit(1);
}

const p = new PrismaClient();
try {
  /** 🔴 원상품 URL 은 **그 스냅샷의 source_url** 이다 — 지어내지 않는다. */
  const snapIds = [...new Set(base.rows.map((r) => r.snapshotId))];
  const snaps = await p.$queryRawUnsafe(
    `select id::text id, source_url from product_snapshots where id = any($1::uuid[])`,
    snapIds,
  );
  const originUrl = new Map(snaps.map((s) => [s.id, s.source_url]));
  const missingOrigin = base.rows.filter((r) => !originUrl.get(r.snapshotId));
  if (missingOrigin.length > 0) {
    console.log(`🔴 중단 — 원상품 URL 을 못 찾은 행 ${missingOrigin.length}`);
    process.exit(1);
  }

  let inserted = 0;
  let skipped = 0;
  let conflict = 0;
  for (const r of base.rows) {
    /** 🟢 쌍 식별자 — URL 키로 고정한다(조서 안에서 유일하고 재실행에 안정적이다). */
    const pairId = reviewKeyOf(r.url);
    const prev = await p.$queryRawUnsafe(
      `select id::text id, version, human_verdict from ceo_judgments
         where review_key = $1 and pair_id = $2 order by version desc limit 1`,
      REVIEW_KEY,
      pairId,
    );
    if (prev.length > 0) {
      if (prev[0].human_verdict === r.ceoVerdict) {
        skipped += 1;
        continue;
      }
      conflict += 1;
      console.log(`  🔴 기존 이력과 판정이 다르다 — 건드리지 않는다: ${r.url.slice(0, 56)}`);
      continue;
    }
    if (APPLY) {
      await p.$executeRawUnsafe(
        `insert into ceo_judgments
           (review_key, pair_id, origin_url, candidate_url, review_url_key,
            human_verdict, reviewer, reviewed_at, raw_note, decision_context,
            version, supersedes_id, snapshot_id)
         values ($1,$2,$3,$4,$5,$6,$7,$8::timestamptz,null,$9,1,null,$10::uuid)`,
        REVIEW_KEY,
        pairId,
        originUrl.get(r.snapshotId),
        r.url,
        reviewKeyOf(r.url),
        r.ceoVerdict,
        REVIEWER,
        REVIEWED_AT,
        PROV[r.basis],
        r.snapshotId,
      );
    }
    inserted += 1;
  }
  console.log(
    `${APPLY ? "적용" : "드라이런"} — 신규 ${inserted} · 이미 동일(건너뜀) ${skipped} · 판정 충돌 ${conflict}`,
  );

  if (APPLY) {
    const back = await p.$queryRawUnsafe(
      `select human_verdict, count(*)::int n from ceo_judgments where review_key = $1 group by 1 order by 2 desc`,
      REVIEW_KEY,
    );
    console.log("확인 — 이력 판정 분포:", JSON.stringify(back));
    const prov = await p.$queryRawUnsafe(
      `select split_part(decision_context,' —',1) p, count(*)::int n from ceo_judgments
         where review_key = $1 group by 1 order by 2 desc`,
      REVIEW_KEY,
    );
    console.log("확인 — provenance:", JSON.stringify(prov));
    const v = await p.$queryRawUnsafe(
      `select version, count(*)::int n, count(supersedes_id)::int sup from ceo_judgments
         where review_key = $1 group by 1 order by 1`,
      REVIEW_KEY,
    );
    console.log("확인 — version/supersedes:", JSON.stringify(v));
    /** 🔴 **기존 판정이 바뀌지 않았는지** 같이 본다(이 표가 저 표를 건드리지 않는다). */
    const cr = await p.$queryRawUnsafe(
      `select human_verdict, count(*)::int n from candidate_reviews
         where candidate_url = any($1::text[]) group by 1 order by 2 desc`,
      base.rows.map((r) => r.url),
    );
    console.log("확인 — candidate_reviews 그 22건(불변이어야 한다):", JSON.stringify(cr));
  }
} catch (e) {
  console.log("ERR", e.message.slice(0, 400));
  process.exitCode = 1;
} finally {
  await p.$disconnect();
}
