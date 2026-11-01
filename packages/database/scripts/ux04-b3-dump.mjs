/**
 * CANDIDATE-UX-REFINE-04 B-3 — 계약 fixture 덤프 (read-only)
 *
 * 🔴 손으로 만든 행을 쓰지 않는다. 운영 `candidate_reviews` 의 실제 행을 그대로 싣는다
 *    (§5-B — 「측정은 운영이 낸 값으로」). 🔴 가공 0 · 필터 0(스냅샷 범위만).
 */
import { PrismaClient } from "@prisma/client";
import { writeFileSync } from "node:fs";
const p = new PrismaClient();

/** 🔵 price_status/match_reasons 가 **실제로 저장된** 스냅샷(B-2 배포 이후 분석분). */
const WITH_STATE = "79a09cfb-5e0c-4cc4-a8b5-349d89a603f7";
/** 🔵 행이 가장 많은 스냅샷 — price_status 가 **전건 null** 인 기존 분모(081 이전). */
const LEGACY = "243f6ffc-fdd2-49a8-94ea-a1860be08619";

const cols = `snapshot_id, workspace_id, candidate_url, candidate_domain, candidate_title,
  image_url, price_amount, price_currency, market, system_verdict, match_truth,
  price_tier, blockers, price_status, sold_out, match_reasons, source, human_verdict`;

const take = async (sid) =>
  p.$queryRawUnsafe(
    /** 🔴 `snapshot_id` 는 uuid 다 — 캐스트 없이 text 를 비교하면 42883 이다. */
    `select ${cols} from candidate_reviews where snapshot_id = $1::uuid order by last_seen_at desc`,
    sid,
  );

/** 🔴 source LOCK 의 **미매핑 분모** 가 표본에 있어야 한다(GT_IMPORT · 17행 실재). */
const unmapped = await p.$queryRawUnsafe(
  `select ${cols} from candidate_reviews where source not in ('SELLER_URL','OVERSEAS_AUTO') limit 4`,
);
const sellerUrl = await p.$queryRawUnsafe(
  `select ${cols} from candidate_reviews where source = 'SELLER_URL' limit 4`,
);
/** 🔴 price_tier = null 행(18행 실재) — 「버리지 않는다」(B3-02)의 분모다. */
const tierNull = await p.$queryRawUnsafe(
  `select ${cols} from candidate_reviews where price_tier is null limit 4`,
);

const out = {
  measuredAt: process.env.UX04_STAMP ?? null,
  note:
    "운영 candidate_reviews 실제 행(read-only 덤프 · 가공 0). " +
    "withState=B-2 배포 이후 분석분 · legacy=081 이전 분모 · unmapped/sellerUrl/tierNull=축별 분모.",
  withState: { snapshotId: WITH_STATE, rows: await take(WITH_STATE) },
  legacy: { snapshotId: LEGACY, rows: await take(LEGACY) },
  unmapped,
  sellerUrl,
  tierNull,
};

/** 🔴 기준이 **이 스크립트 파일** 이다(`packages/database/scripts/`) — 레포 루트가 아니다. */
const path =
  "../../../apps/admin/src/app/api/price-history/_lib/__tests__/fixtures/ux04-b3-reviews.json";
writeFileSync(new URL(path, import.meta.url), JSON.stringify(out, null, 2) + "\n");
console.log(
  `저장 — withState ${out.withState.rows.length} · legacy ${out.legacy.rows.length} · ` +
    `unmapped ${unmapped.length} · sellerUrl ${sellerUrl.length} · tierNull ${tierNull.length}`,
);
await p.$disconnect();
