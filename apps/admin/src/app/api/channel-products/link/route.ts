import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { linkLegacyRegistration } from "@/app/api/_lib/link-legacy-registration";
import { recordAuditLog } from "@/lib/audit-log";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-CHANNEL-03 F-12a — **기존 등록을 현재 연결로 «복구» 한다(로그인 경로).**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * migration 063 «이전» 에 등록된 상품은 ChannelProduct 가 없다. 그래서
 * register 라우트가 UPDATE 경로에 들어가지 못하고, F-12(첫 PUT)를 할 수 없다.
 * 그 연결을 «한 건씩» 복구한다.
 *
 * ── 🔴 왜 스크립트가 아니라 라우트인가 ──────────────────────────────────
 * 같은 일을 하는 스크립트(scripts/p0channel03-f12a-link-legacy-registration.ts)
 * 는 Supabase service-role 키를 «사람 손에» 쥐여 줘야 돈다. 그 키는 모든 RLS 를
 * 우회하는 열쇠라 화면 하나 고치자고 돌려쓸 물건이 아니다.
 * 이 라우트는 이미 로그인한 관리자의 세션으로 «자기 워크스페이스의» 상품만
 * 잇는다 — 열쇠를 옮기지 않고 같은 일을 한다.
 *
 * 🔴 판단과 검사는 «전부» `linkLegacyRegistration()` 안에 있다. 여기서 다시
 * 쓰지 않는다 — 두 벌이 되면 한쪽에만 안전 검사가 빠진다.
 *
 * ── 🔴 기본은 dry-run 이다 ──────────────────────────────────────────────
 *   POST { externalProductId, channel }              → 무엇을 할지 «보여만» 준다
 *   POST { ..., apply: true }                        → 실제로 잇는다
 * 쓰기가 기본값이면 실수로 부르는 순간 되돌릴 수 없다.
 */
export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as {
    externalProductId?: string;
    channel?: string;
    apply?: boolean;
  } | null;

  const externalProductId = body?.externalProductId?.trim();
  const channel = body?.channel?.trim();
  if (!externalProductId || !channel) {
    return NextResponse.json(
      { ok: false, error: "externalProductId 와 channel 이 필요합니다." },
      { status: 400 },
    );
  }
  /* 🔴 `=== true` 로만 받는다 — 문자열 "false" 나 0 이 실행으로 읽히면 안 된다. */
  const apply = body?.apply === true;

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    /* 🔴 「연결 없음」으로 내려보내지 않는다. 확인하지 못한 것을 확인했다고
       말하면 호출부가 그 답을 근거로 무언가를 한다. */
    return NextResponse.json({ ok: false, error: "저장소에 접근하지 못했습니다." }, { status: 503 });
  }

  const result = await linkLegacyRegistration(supabase, {
    externalProductId,
    channel,
    apply,
    /* 🔴 세션의 워크스페이스만 넘긴다. body 의 workspaceId 같은 값을 권한
       근거로 쓰지 않는다(require-user.ts 의 절대 규칙). */
    expectWorkspaceId: auth.user.workspaceId,
  });

  if (!result.ok) {
    /* 🔴 STOP 은 «실패» 가 아니라 「그렇게 하면 안 된다」이다. 400 으로 주고
       이유를 그대로 전한다 — 화면이 문구를 지어내지 않게. */
    return NextResponse.json({ ok: false, stop: result.stop }, { status: 400 });
  }

  /* 🔴 실제로 이었을 때만 감사 기록을 남긴다. dry-run 은 아무 일도 일어나지
     않았으므로 기록하지 않는다 — 기록이 있으면 나중에 「했다」로 읽힌다. */
  if ("applied" in result && result.applied) {
    await recordAuditLog({
      eventType: "MARKETPLACE_REGISTERED",
      snapshotId: result.plan.snapshotId,
      marketplace: channel,
      afterValue: {
        operation: "LEGACY_LINK",
        externalProductId,
        productId: result.plan.productId,
      },
      reason: `기존 등록(${externalProductId})을 현재 연결로 복구했습니다 — 새 상품을 만들지 않았습니다.`,
    });
  }

  /* 🔴 `{ ok: true, ...result }` 로 펼치지 않는다 — result 에도 `ok` 가 있어
     덮어쓰기가 되고, 나중에 result.ok 의 뜻이 바뀌면 조용히 틀린 값이 나간다.
     결과는 «한 칸 안에» 그대로 넣는다. */
  return NextResponse.json({ ok: true, result });
}
