import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getSnapshotRaw } from "../../_lib/snapshot";
import { latestAttemptByPlatform, type LastAttemptRow } from "../../_lib/attempts-summary";
import { findChannelProductsBySnapshot } from "@/app/api/_lib/channel-product";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * N-06-B(CPO 승인, 2026-09-23) — **이 상품이 어느 커머스에 «실제로» 올라가 있나.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── 왜 이 라우트가 필요한가 ───────────────────────────────────────────────
 * N-06-A 조사 결과: 등록 사실을 기억하는 곳은 `registration_attempts` 하나뿐이고,
 * 화면 state(listingStates · listingResults · lotteOnRegistered ·
 * registrationHistory)는 전부 세션 한정이라 새로고침하면 방금 등록한 상품도
 * 「미등록」으로 보였다. 그 사실을 화면까지 가져오는 «읽기 경로» 가 없었다.
 *
 * 🔴 새 테이블도 새 컬럼도 만들지 않는다. 이미 쌓여 있는 이력을 그대로 읽는다.
 *
 * ── 🔴 소유권 ────────────────────────────────────────────────────────────
 * 남의 스냅샷 id 로 남의 등록 이력(상품번호 포함)을 읽을 수 있으면 안 된다.
 * 스냅샷 조회와 «같은 규칙» 을 쓴다: 소유가 아니면 403 이 아니라 404 — 403 은
 * 「그건 존재하고 네 것이 아니다」를 알려주는 셈이라 존재 확인 도구가 된다.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  /* 🔴 먼저 소유권부터. 이력 조회는 그 다음이다 — 순서가 바뀌면 남의 스냅샷에
     대해서도 쿼리가 한 번 나간다. getSnapshotRaw 는 last_opened_at 을 건드리지
     않는다(이 조회는 「열었다」가 아니다). */
  const snapshot = await getSnapshotRaw(id, auth.user.workspaceId);
  if (!snapshot) {
    return NextResponse.json({ ok: false, error: "스냅샷을 찾을 수 없습니다." }, { status: 404 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    /* 🔴 조회 실패를 «이력 없음» 으로 내려보내지 않는다. 그러면 이미 등록된
       상품이 화면에서 「미등록」이 되고, 셀러가 두 번 등록할 수 있다. */
    return NextResponse.json({ ok: false, error: "등록 이력을 확인하지 못했습니다." }, { status: 503 });
  }

  const { data, error } = await supabase
    .from("registration_attempts")
    .select("snapshot_id, platform, status, created_at, external_product_id, error_code")
    .eq("snapshot_id", id)
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("[snapshot attempts] 조회 실패:", error.message);
    return NextResponse.json({ ok: false, error: "등록 이력을 확인하지 못했습니다." }, { status: 503 });
  }

  /* ════════════════════════════════════════════════════════════════════════
     P0-CHANNEL-03 F-10 — «현재 연결» 을 같이 내려보낸다.

     🔴 지금까지 화면의 「등록됨」 판정 근거는 이 snapshot 의 마지막 SUBMITTED
     이력 하나였다. 그래서 상품을 재분석하면 새 snapshot 이 생기고, 그 snapshot
     에는 이력이 없어 화면이 「미등록」이라고 말했다 — 셀러가 그 말을 믿고 다시
     누르면 중복이 생긴다. SmartStore 외부번호 6개가 그렇게 만들어졌다.

     🔴 이력(무엇을 시도했는가)과 연결(지금 어디에 나가 있는가)은 «다른 것» 이다.
     둘을 나란히 내려보내고, 판정 규칙은 한 곳(resolveRegistrationState)이 정한다 —
     이 라우트는 사실만 전달한다.
  ════════════════════════════════════════════════════════════════════════ */
  let channelProducts;
  try {
    channelProducts = await findChannelProductsBySnapshot(id);
  } catch {
    /* 🔴 위 이력 조회 실패와 «같은» 취급이다. 연결을 확인하지 못한 것을
       「연결 없음」으로 내려보내면 이미 등록된 상품이 「미등록」이 되고,
       이 라우트가 막으려던 바로 그 중복이 다시 생긴다. */
    return NextResponse.json({ ok: false, error: "등록 상태를 확인하지 못했습니다." }, { status: 503 });
  }

  return NextResponse.json({
    ok: true,
    /** 채널 키는 DB 의 platform 문자열 그대로다 — 'lotteon' 포함. */
    lastAttempts: latestAttemptByPlatform((data ?? []) as LastAttemptRow[]),
    /**
     * 🔴 이 snapshot 이 Product 에 속해 있는가. 기존 381건은 false 이고, 그
     * 상품들은 연결을 «가질 수 없다» — 연결이 없는 이유가 다르다는 것을
     * 화면이 알아야 「미등록」과 「옛 상품」을 구분해 말할 수 있다.
     */
    hasProductIdentity: channelProducts.hasProductIdentity,
    /** 채널 → 지금 나가 있는 외부 상품. 🔴 없는 채널은 키 자체가 없다. */
    connections: Object.fromEntries(
      Object.entries(channelProducts.byChannel).map(([channel, row]) => [
        channel,
        { externalProductId: row.externalProductId, channelProductId: row.id, status: row.status },
      ]),
    ),
  });
}
