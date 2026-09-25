/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-CHANNEL-03 F-12a(CTO 지시, 2026-09-25)
 * **기존 Production 등록 하나를 새 Identity 구조에 «잇는다».**
 * ════════════════════════════════════════════════════════════════════════════
 *
 *     기존 Snapshot → Product → ChannelProduct(smartstore, 13713593585)
 *
 * 왜 필요한가: 13713593585 는 migration 063 «이전» 에 등록돼 ChannelProduct 가
 * 없다. 연결이 없으면 라우트가 UPDATE 경로에 들어가지 못하고, F-12(첫 PUT)를
 * 할 수 없다. 그 연결을 여기서 «한 건만» 복구한다.
 *
 * ── 🔴 하지 않는 것 (CTO 금지선을 코드로 못 박는다) ──────────────────────
 *   · source URL 기반 자동 매칭 — 근거는 `registration_attempts` 의 실제
 *     external_product_id 하나뿐이다. URL 은 «보지도 않는다».
 *   · 다른 snapshot 자동 연결 · 중복 상품 병합 · attempts 일괄 backfill
 *   · 기존 Production 상품 재등록 · previous_external_product_id 추가
 *   · unique 제약 추가
 *   · 🔴 기존 행의 «의미» 변경 — attempts 의 operation/channel_product_id 를
 *     소급해서 채우지 않는다. 이것은 «현재 상태» 복구이지 이력 재작성이 아니다.
 *
 * ── 🔴 기본은 dry-run 이다 ───────────────────────────────────────────────
 * 인자 없이 돌리면 «읽기만» 하고 무엇을 할지 보여준다. 실제 쓰기는 `--apply`
 * 를 명시해야 한다. Production DB 에 쓰는 스크립트의 기본값은 「안 쓴다」여야
 * 한다 — 실수로 돌리는 일이 반드시 한 번은 생긴다.
 *
 * 사용법:
 *   npx tsx scripts/p0channel03-f12a-link-legacy-registration.ts            # dry-run
 *   npx tsx scripts/p0channel03-f12a-link-legacy-registration.ts --apply    # 실제 연결
 *   ... --external=13713593585 --channel=smartstore
 *
 * 필요 환경변수: NEXT_PUBLIC_SUPABASE_URL · SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "@supabase/supabase-js";

export {};

const DEFAULT_EXTERNAL_ID = "13713593585";
const DEFAULT_CHANNEL = "smartstore";

function arg(name: string, fallback: string): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

/** 🔴 한 줄이라도 어긋나면 멈춘다. 「대충 맞으니 진행」이 중복을 만든다. */
function stop(reason: string): never {
  console.error(`\n🔴 STOP — ${reason}`);
  console.error("   아무것도 쓰지 않았습니다.");
  process.exit(1);
}

async function linkLegacyRegistration() {
  const externalProductId = arg("external", DEFAULT_EXTERNAL_ID);
  const channel = arg("channel", DEFAULT_CHANNEL);
  const apply = process.argv.includes("--apply");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    stop("Supabase 자격증명이 없습니다(NEXT_PUBLIC_SUPABASE_URL · SUPABASE_SERVICE_ROLE_KEY).");
  }
  const db = createClient(url, key);

  console.log(`대상: channel=${channel} · external_product_id=${externalProductId}`);
  console.log(apply ? "모드: 🔴 APPLY (실제로 씁니다)" : "모드: dry-run (읽기만 합니다)\n");

  /* ── §1 대상 Snapshot 특정 — 근거는 등록 이력 하나뿐 ───────────────────
     🔴 source_url 로 찾지 않는다. URL 은 식별자가 아니라는 것이 PHASE D-2 의
     결론이고, URL 로 찾으면 중복 6건 중 «엉뚱한 것» 을 집을 수 있다. */
  const { data: attempts, error: attemptErr } = await db
    .from("registration_attempts")
    .select("id, snapshot_id, platform, status, created_at")
    .eq("external_product_id", externalProductId)
    .eq("platform", channel)
    .eq("status", "SUBMITTED")
    .order("created_at", { ascending: true });
  if (attemptErr) stop(`등록 이력 조회 실패: ${attemptErr.message}`);
  if (!attempts?.length) stop(`${externalProductId} 로 성공한 등록 이력이 없습니다 — 연결할 근거가 없습니다.`);

  const snapshotIds = [...new Set(attempts.map((a) => a.snapshot_id).filter(Boolean))] as string[];
  console.log(`§1 성공 이력 ${attempts.length}건 · 연결된 snapshot ${snapshotIds.length}개`);
  if (snapshotIds.length === 0) {
    stop("성공 이력에 snapshot_id 가 없습니다 — 어느 상품인지 특정할 수 없습니다.");
  }
  if (snapshotIds.length > 1) {
    /* 🔴 여러 snapshot 이 같은 외부 상품을 가리키면 «사람이» 골라야 한다.
       재분석으로 갈라진 경우가 바로 이것이고, 자동으로 하나를 고르면 그
       선택이 영구 연결이 된다. */
    stop(
      `같은 외부 상품을 가리키는 snapshot 이 ${snapshotIds.length}개입니다 — 사람이 골라야 합니다: ${snapshotIds.join(", ")}`,
    );
  }
  const snapshotId = snapshotIds[0]!;
  console.log(`   → snapshot ${snapshotId}`);

  const { data: snapshot, error: snapErr } = await db
    .from("product_snapshots")
    .select("id, product_id, workspace_id, title")
    .eq("id", snapshotId)
    .maybeSingle();
  if (snapErr) stop(`snapshot 조회 실패: ${snapErr.message}`);
  if (!snapshot) stop(`snapshot ${snapshotId} 을(를) 찾지 못했습니다.`);
  const snap = snapshot as { id: string; product_id: string | null; workspace_id: string | null; title: string | null };
  console.log(`   title=${snap.title ?? "(없음)"} · workspace=${snap.workspace_id ?? "(없음)"} · product_id=${snap.product_id ?? "NULL"}`);

  /* ── §5 중복/충돌 검사 — «쓰기 전에» 전부 본다 ─────────────────────────
     🔴 같은 external_product_id 가 다른 Product 에 붙어 있으면 절대 덮지 않는다. */
  const { data: sameExternal, error: sameErr } = await db
    .from("channel_products")
    .select("id, product_id")
    .eq("channel", channel)
    .eq("external_product_id", externalProductId);
  if (sameErr) stop(`기존 연결 조회 실패: ${sameErr.message}`);
  if (sameExternal?.length) {
    const others = sameExternal.filter((r) => r.product_id !== snap.product_id);
    if (others.length) {
      stop(
        `${externalProductId} 이(가) 이미 다른 Product 에 연결돼 있습니다 — 덮어쓰지 않습니다: ${others
          .map((r) => r.product_id)
          .join(", ")}`,
      );
    }
    console.log("§5 이미 이 Product 에 같은 연결이 있습니다 — 할 일이 없습니다.");
    return;
  }

  /* ── §2 Product 연결 ──────────────────────────────────────────────────── */
  let productId = snap.product_id;
  if (productId) {
    console.log(`§2 Product 가 이미 있습니다(${productId}) — 새로 만들지 않습니다.`);
  } else {
    if (!snap.workspace_id) {
      /* 🔴 소유자를 모르는 Product 를 만들지 않는다 — 만들면 누구의 상품인지
         알 수 없는 행이 영구히 남는다(066 이 소유자를 필수로 만든 이유). */
      stop("snapshot 에 workspace_id 가 없습니다 — 소유자를 모르는 Product 를 만들지 않습니다.");
    }
    console.log(`§2 Product 없음 → 새로 만듭니다(workspace=${snap.workspace_id}).`);
    if (apply) {
      const { data: created, error: createErr } = await db
        .from("Product")
        .insert({
          /* 🔴 sourceUrl 을 채우지 않는다. 식별자가 아니고, 채우면 다음 사람이
             그것으로 매칭하고 싶어진다(PHASE D-2 §2·3). */
          title: snap.title ?? "(제목 없음)",
          workspace_id: snap.workspace_id,
        })
        .select("id")
        .single();
      if (createErr || !created) stop(`Product 생성 실패: ${createErr?.message}`);
      productId = (created as { id: string }).id;
      const { error: linkErr } = await db
        .from("product_snapshots")
        .update({ product_id: productId })
        .eq("id", snapshotId)
        /* 🔴 아직 NULL 일 때만 쓴다 — 그 사이에 누가 이었으면 덮지 않는다. */
        .is("product_id", null);
      if (linkErr) stop(`snapshot → Product 연결 실패: ${linkErr.message}`);
      console.log(`   → Product ${productId} 생성 · snapshot 연결 완료`);
    }
  }

  /* ── §3 ChannelProduct 연결 ───────────────────────────────────────────── */
  if (productId) {
    const { data: existing, error: existErr } = await db
      .from("channel_products")
      .select("id, external_product_id")
      .eq("product_id", productId)
      .eq("channel", channel);
    if (existErr) stop(`연결 조회 실패: ${existErr.message}`);
    if (existing?.length) {
      /* 🔴 이 Product 가 이미 «다른» 외부 상품에 연결돼 있으면 멈춘다.
         덮으면 지금 팔리고 있는 상품과의 연결이 끊긴다. */
      stop(
        `이 Product 는 이미 ${channel} 에 연결돼 있습니다 — 덮어쓰지 않습니다: ${existing
          .map((r) => r.external_product_id)
          .join(", ")}`,
      );
    }
  }
  console.log(`§3 ChannelProduct 연결: product=${productId ?? "(dry-run: 아직 없음)"} · ${channel} · ${externalProductId} · status=UNKNOWN`);
  if (apply && productId) {
    const { error: cpErr } = await db.from("channel_products").insert({
      product_id: productId,
      channel,
      external_product_id: externalProductId,
      /* 🔴 status 를 지정하지 않는다 — DB 기본값 UNKNOWN 이 남는다.
         외부 상태를 조회하는 코드가 없으므로 LIVE 라고 적지 않는다. */
    });
    if (cpErr) stop(`ChannelProduct 생성 실패: ${cpErr.message}`);
    console.log("   → 연결 완료");
  }

  /* ── §6 검증 — 쓴 뒤에 «다시 읽어서» 확인한다 ────────────────────────── */
  if (!apply) {
    console.log("\ndry-run 이라 아무것도 쓰지 않았습니다. 실제로 이으려면 --apply 를 붙이세요.");
    return;
  }
  const { data: verify } = await db
    .from("product_snapshots")
    .select("product_id")
    .eq("id", snapshotId)
    .maybeSingle();
  const finalProductId = (verify as { product_id?: string | null } | null)?.product_id ?? null;
  const { data: cp } = await db
    .from("channel_products")
    .select("id, product_id, channel, external_product_id, status")
    .eq("channel", channel)
    .eq("external_product_id", externalProductId);

  console.log("\n§6 검증");
  console.log(`  snapshot.product_id      ${finalProductId ?? "🔴 NULL"}`);
  console.log(`  ChannelProduct 행 수      ${cp?.length ?? 0}`);
  for (const row of (cp ?? []) as { product_id: string; channel: string; external_product_id: string; status: string }[]) {
    const ok = row.product_id === finalProductId;
    console.log(`  ${ok ? "✅" : "🔴"} product=${row.product_id} channel=${row.channel} external=${row.external_product_id} status=${row.status}`);
  }
  console.log("\n🔴 registration_attempts 는 한 행도 건드리지 않았습니다(이력 재작성 아님).");
}

linkLegacyRegistration().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
