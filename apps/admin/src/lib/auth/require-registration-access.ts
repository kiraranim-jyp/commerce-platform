import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireUser, type AuthedUser } from "./require-user";

/**
 * P0-C PRE-REGISTER SECURITY GATE(CEO 승인, 2026-09-17) — 실제 등록 3개 라우트
 * (`coupang/register`, `smartstore/register`, `lotteon/register`)에 사용자·워크스페이스
 * 검증이 **하나도 없었다**. 세 라우트 모두 `requireUser` import 조차 없었다.
 *
 * 🔴 왜 급한가. 커머스 자격증명이 **전역 싱글턴**이다:
 *      쿠팡    coupang_seller_settings 를 .eq("id","default") 1행으로 읽는다
 *      네이버  commerce_accounts platform='naver'   첫 행
 *      롯데ON  commerce_accounts platform='lotteon' 첫 행
 *    배송/반품 프로필도 마찬가지다 — getDefaultSellerProfile()은 **인자를 받지 않는다**.
 *    그래서 로그인한 다른 워크스페이스 셀러가 등록을 누르면, 그 사람 상품이
 *    **대표 계정으로** 등록된다. 상품이 남의 스토어에 생기고 거기에 대표 계정의
 *    반품주소·연락처·A/S·사업자정보가 붙는다.
 *
 * 🔴 proxy.ts는 이걸 막지 못한다. proxy는 "로그인했는가"만 본다(그리고 그 401은
 *    스스로 적어 뒀듯 optimistic일 뿐이다). 여기서 막는 것은 "로그인한 사람이
 *    **이 자격증명을 쓸 자격이 있는가**"다 — 축이 다르다.
 *
 * 이번 범위는 **게이트 하나**다. 자격증명/프로필의 워크스페이스별 완전 격리
 * (SELLER-PROFILE-ISOLATION-01)는 별도 작업으로 남아 있다. 여기서 소유권 컬럼을
 * 만들지도, 프로필을 마이그레이션하지도 않는다.
 */

/** 등록에 쓸 자격증명을 소유한 워크스페이스. 쉼표로 여러 개.
 *
 * 🔴 DB 컬럼이 아니라 환경변수인 이유: 오늘 자격증명 테이블에는 소유자 칸이
 *    **없다**(004_coupang_seller_profiles.sql에 workspace_id도 user_id도 없고,
 *    이후 어떤 마이그레이션도 추가하지 않았다). 그 칸을 만드는 것이 곧
 *    SELLER-PROFILE-ISOLATION-01이고 이번 범위 밖이다. 그래서 "누가 주인인가"를
 *    코드가 추론하지 않고 **배포 설정으로 선언**하게 했다 — 추론했다가 틀리면
 *    막아야 할 사람을 통과시킨다. */
const OWNER_WORKSPACE_ENV = "COMMERCE_REGISTRATION_WORKSPACE_IDS";

export type RegistrationAccessResult =
  | { ok: true; user: AuthedUser }
  | { ok: false; response: NextResponse };

function deny(message: string, status: 401 | 403, extra?: Record<string, unknown>) {
  return {
    ok: false as const,
    response: NextResponse.json({ ok: false, error: message, ...extra }, { status }),
  };
}

function readOwnerWorkspaceIds(): string[] {
  return (process.env[OWNER_WORKSPACE_ENV] ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

/**
 * 등록을 실행해도 되는 요청인지 판단한다. 세 라우트가 **같은 함수**를 쓴다 —
 * 채널마다 따로 적으면 한 곳을 빠뜨렸을 때 그 채널만 열려 있게 된다.
 *
 * 순서가 중요하다:
 *   1) 로그인했는가            → 아니면 401
 *   2) 이 자격증명의 주인인가   → 아니면 403   ← 전역 싱글턴을 막는 축
 *   3) 이 상품이 내 것인가      → 아니면 403   ← 남의 스냅샷으로 등록하는 축
 *
 * 2번이 없으면 3번만으로는 못 막는다. 다른 셀러는 **자기** 스냅샷을 들고 오기
 * 때문에 3번을 통과하고, 그대로 대표 계정으로 나간다.
 *
 * @param snapshotId "최근 작업" 스냅샷에서 이어서 등록한 경우에만 있다. null이면
 *   3번은 건너뛴다 — 스냅샷 없이 등록하는 기존 흐름을 이번 게이트가 깨지 않는다.
 *   그 경우에도 2번은 그대로 적용되므로 자격증명 축은 열리지 않는다.
 */
export async function requireRegistrationAccess(snapshotId: string | null): Promise<RegistrationAccessResult> {
  const auth = await requireUser();
  if (!auth.ok) return auth;

  // ── 2) 자격증명 소유 워크스페이스 ──────────────────────────────────────
  const ownerWorkspaceIds = readOwnerWorkspaceIds();
  if (ownerWorkspaceIds.length === 0) {
    // 🔴 fail-closed다. "설정이 없으니 일단 열어둔다"는 지금까지 이 라우트들이
    //    무방비였던 이유 그대로다 — proxy.ts도 같은 판단을 적어 뒀다.
    //    응답에 호출자 **자신의** workspaceId를 실어 준다(남의 값이 아니다).
    //    이 값을 그대로 환경변수에 넣으면 되도록 하기 위한 것이고, 이게 없으면
    //    운영자가 자기 워크스페이스 id를 알 방법이 없어 설정 자체를 못 한다.
    return deny(
      `등록 권한이 설정되지 않았습니다. 배포 환경변수 ${OWNER_WORKSPACE_ENV}에 등록을 허용할 워크스페이스 ID를 지정해 주세요.`,
      403,
      { workspaceId: auth.user.workspaceId, requiredEnv: OWNER_WORKSPACE_ENV },
    );
  }
  if (!ownerWorkspaceIds.includes(auth.user.workspaceId)) {
    return deny(
      "이 워크스페이스에는 커머스 등록 권한이 없습니다. 등록에 사용되는 판매자 계정·배송 프로필은 아직 워크스페이스별로 분리되어 있지 않습니다.",
      403,
    );
  }

  // ── 3) 스냅샷 소유권 ──────────────────────────────────────────────────
  if (snapshotId) {
    const supabase = getSupabaseAdmin();
    // Supabase가 없으면 소유권을 **확인할 수 없다**. 확인 못 한 것을 통과시키지
    // 않는다(2번을 이미 통과했더라도, 이 경로는 "모른다"이지 "내 것이다"가 아니다).
    if (!supabase) return deny("스냅샷 소유권을 확인할 수 없어 등록을 중단했습니다.", 403);

    const { data, error } = await supabase
      .from("product_snapshots")
      .select("workspace_id")
      .eq("id", snapshotId)
      .maybeSingle();
    if (error) return deny("스냅샷 소유권을 확인할 수 없어 등록을 중단했습니다.", 403);
    // 🔴 스냅샷이 없으면 막지 않는다. 043 이전에 만들어진 행은 workspace_id가
    //    null이고, 여기서 막으면 대표 계정의 **기존** 등록 흐름이 끊긴다.
    //    이번 게이트의 목적은 그 흐름을 지키면서 다른 셀러만 막는 것이다.
    const ownerWorkspaceId = (data?.workspace_id as string | null | undefined) ?? null;
    if (ownerWorkspaceId && ownerWorkspaceId !== auth.user.workspaceId) {
      return deny("다른 워크스페이스의 상품은 등록할 수 없습니다.", 403);
    }
  }

  return { ok: true, user: auth.user };
}
