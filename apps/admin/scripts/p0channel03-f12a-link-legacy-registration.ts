/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-CHANNEL-03 F-12a — **기존 등록 하나를 새 Identity 구조에 «잇는다»(CLI).**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 판단과 안전 검사는 여기 «없다». 전부 `_lib/link-legacy-registration.ts`
 * 안에 있고, 이 파일은 그것을 부르고 결과를 사람이 읽게 찍을 뿐이다.
 * 같은 일을 하는 라우트(POST /api/channel-products/link)와 «같은 함수» 를
 * 쓴다 — 두 벌이 되면 한쪽에만 검사가 빠진다.
 *
 * 🔴 대부분의 경우 이 스크립트가 아니라 «라우트» 를 쓰는 편이 낫다. 이쪽은
 * Supabase service-role 키(모든 RLS 를 우회하는 열쇠)를 사람 손에 쥐여 줘야
 * 돌아간다. 라우트는 이미 로그인한 세션으로 같은 일을 한다.
 *
 * 사용법:
 *   npx tsx scripts/p0channel03-f12a-link-legacy-registration.ts            # dry-run
 *   npx tsx scripts/p0channel03-f12a-link-legacy-registration.ts --apply
 *   ... --external=13713593585 --channel=smartstore
 *
 * 필요 환경변수: NEXT_PUBLIC_SUPABASE_URL · SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "@supabase/supabase-js";
import { linkLegacyRegistration } from "../src/app/api/_lib/link-legacy-registration";

export {};

function arg(name: string, fallback: string): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

async function main() {
  const externalProductId = arg("external", "13713593585");
  const channel = arg("channel", "smartstore");
  const apply = process.argv.includes("--apply");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("🔴 STOP — Supabase 자격증명이 없습니다(NEXT_PUBLIC_SUPABASE_URL · SUPABASE_SERVICE_ROLE_KEY).");
    console.error("   아무것도 쓰지 않았습니다.");
    process.exit(1);
  }

  console.log(`대상: channel=${channel} · external_product_id=${externalProductId}`);
  console.log(apply ? "모드: 🔴 APPLY (실제로 씁니다)\n" : "모드: dry-run (읽기만 합니다)\n");

  /* 🔴 service-role 클라이언트라 워크스페이스 자물쇠를 넘기지 않는다. 대신
     이 스크립트를 «사람이» 직접 돌린다는 것 자체가 확인 절차다. 라우트 쪽은
     세션의 워크스페이스로 잠근다. */
  const result = await linkLegacyRegistration(createClient(url, key), {
    externalProductId,
    channel,
    apply,
  });

  if (!result.ok) {
    console.error(`\n🔴 STOP — ${result.stop}`);
    console.error("   아무것도 쓰지 않았습니다.");
    process.exit(1);
  }
  if (result.alreadyLinked) {
    console.log("이미 이어져 있습니다 — 할 일이 없습니다.");
    console.log(`  snapshot=${result.plan.snapshotId} · product=${result.plan.productId ?? "(없음)"}`);
    return;
  }

  console.log("§1 대상");
  console.log(`  snapshot        ${result.plan.snapshotId}`);
  console.log(`  title           ${result.plan.snapshotTitle ?? "(없음)"}`);
  console.log(`  workspace       ${result.plan.workspaceId ?? "(없음)"}`);
  console.log(`  성공 이력        ${result.plan.successfulAttempts}건`);
  console.log(`§2 Product      ${result.plan.productId ?? "없음 → 새로 만듭니다"}`);
  console.log(`§3 ChannelProduct  ${channel} · ${externalProductId} · status=UNKNOWN`);

  if (!result.applied) {
    console.log("\ndry-run 이라 아무것도 쓰지 않았습니다. 실제로 이으려면 --apply 를 붙이세요.");
    return;
  }

  console.log("\n§6 검증");
  console.log(`  snapshot.product_id   ${result.verification.snapshotProductId ?? "🔴 NULL"}`);
  for (const cp of result.verification.channelProducts) {
    const ok = cp.productId === result.verification.snapshotProductId;
    console.log(`  ${ok ? "✅" : "🔴"} product=${cp.productId} channel=${cp.channel} external=${cp.externalProductId} status=${cp.status}`);
  }
  console.log("\n🔴 registration_attempts 는 한 행도 건드리지 않았습니다(이력 재작성 아님).");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
