import { NextResponse, after } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { runDomesticPriceCheckForNewSnapshot } from "../price-history/_lib/trigger-domestic-price-check";
import { getAttemptsSummaryBySnapshot } from "./_lib/attempts-summary";
import { listRecentSnapshots, saveSnapshot } from "./_lib/snapshot";
import type { SnapshotWorkspaceState } from "./_lib/types";

export const runtime = "nodejs";
/** DOMESTIC-PRICE-TRIGGER-1 — 아래 after() 안에서 도는 국내 가격 조사는 편집샵
 * 여러 곳을 실제로 크롤링한다. 응답은 이미 나간 뒤지만 함수는 살아 있어야 하고,
 * after()는 라우트의 maxDuration을 그대로 상속받는다(Next 문서). 기본값(10~15초)
 * 이면 조사가 중간에 잘려 지금과 똑같이 아무것도 안 남는다 — 배치를 없앤 뒤
 * Production에서 관측된 게 정확히 그 모양이다. 목록 조회(GET)는 이 값과 무관하게
 * 평소대로 빠르게 끝난다(상한이지 예약이 아니다). */
export const maxDuration = 300;

/** Sprint B-2(CPO 지시) — 목록 자체는 기존 listRecentSnapshots() 그대로 두고
 * (스냅샷 목록 조회 로직을 여기서 다시 만들지 않는다), registration_attempts
 * 집계만 한 번의 추가 쿼리로 얹는다.
 *
 * BETA-SECURITY-2 §11(CPO 지시, 2026-09-07) — 이전 버전은 인증 없이 전체
 * 사용자의 스냅샷 목록을 반환했다. 이제 세션 사용자의 workspace로만 좁힌다. */
export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const snapshots = await listRecentSnapshots(auth.user.workspaceId);
  const summaries = await getAttemptsSummaryBySnapshot(snapshots.map((s) => s.id));
  const enriched = snapshots.map((s) => ({
    ...s,
    registeredPlatforms: summaries[s.id]?.registeredPlatforms ?? [],
    hasRegistrationError: summaries[s.id]?.hasError ?? false,
    lastAttemptAt: summaries[s.id]?.lastAttemptAt ?? null,
  }));
  return NextResponse.json({ snapshots: enriched });
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as {
    id?: string;
    sourceUrl?: string;
    title?: string | null;
    thumbnailUrl?: string | null;
    workspace?: SnapshotWorkspaceState;
  } | null;

  if (!body?.sourceUrl || !body?.workspace) {
    return NextResponse.json({ ok: false, error: "sourceUrl과 workspace가 필요합니다." }, { status: 400 });
  }

  // DOMESTIC-PRICE-TRIGGER-1 — "이번 요청이 새 분석의 첫 저장인가"는 body.id가
  // 없다는 사실 하나로 정해진다. pipeline/page.tsx는 분석이 끝난 뒤 id 없이 딱
  // 한 번 POST하고(그 응답이 snapshotId를 채운다), 그 뒤의 모든 편집 저장은
  // 받은 id를 실어 update로 온다. saveSnapshot()의 insert/update 분기 기준과
  // 같은 값이라 "한 번만"을 보장하는 데 새 플래그나 상태가 필요 없다.
  const isNewAnalysis = !body.id;

  // BETA-SECURITY-2 §13 — body에 workspaceId/userId가 섞여 들어와도 읽지
  // 않는다. 소유자는 세션에서만 결정된다.
  const result = await saveSnapshot({
    id: body.id,
    sourceUrl: body.sourceUrl,
    title: body.title ?? null,
    thumbnailUrl: body.thumbnailUrl ?? null,
    workspace: body.workspace,
    workspaceId: auth.user.workspaceId,
  });

  if (isNewAnalysis && result.ok) {
    // 국내 가격 조사는 스냅샷 저장과 **별개의 단계**다. after()로 응답을 먼저
    // 내보낸 뒤에 돌린다 — 조사에 10~30초가 걸리는데 그걸 기다리느라 화면이
    // snapshotId를 못 받으면, 카테고리 추천 예열·자동 가격확인·"최근 작업"
    // 저장이 전부 그만큼 늦어진다. 실패해도 여기까지 올라오지 않는다
    // (runDomesticPriceCheckForNewSnapshot은 throw하지 않는다) — 어차피 응답은
    // 이미 나간 뒤라, 이 단계는 상품 분석의 성공/실패를 뒤집을 수 없다.
    const snapshotId = result.snapshot.id;
    const workspaceId = auth.user.workspaceId;
    const canonicalProduct = body.workspace.canonicalProduct;
    after(() => runDomesticPriceCheckForNewSnapshot({ snapshotId, workspaceId, canonicalProduct }));
  }

  return NextResponse.json(result);
}
