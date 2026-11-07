import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { getSnapshot } from "../../../snapshots/_lib/snapshot";
import {
  isCeoJudgmentVerdict,
  listCeoJudgments,
  saveCeoJudgment,
  type CeoJudgmentVerdict,
} from "../../_lib/ceo-judgment";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 **CEO 판단 API**(CPO 승인 2026-11-07 · 범위 ⒞ — **판단 본문만**)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 인증·소유권은 기존 경로와 **같은 함수** 를 쓴다(`requireUser` + `getSnapshot`) —
 *    **새 보안 규칙을 만들지 않는다**(`candidate-reviews/route.ts` 와 같은 순서).
 * 🔴 **축을 받지 않는다** — `axes` 를 보내도 **무시한다**(저장 경로가 없다 ⟹ 후속 RPC 과제).
 *    🟢 축이 없는 판단은 **정상적인 축 미입력** 이다(083 설계).
 * 🔴 `UPDATE` **0** · 동일 내용 비교 **0**(같은 내용도 새 버전) · `rawNote` 자동 생성 **0**.
 * 🔴 기존 `candidate_reviews` · 사람 판단 38행 · GT · 판정/검색/가격 정책 **접근 0**.
 */

/** 🔴 소유권 확인 — 남의 스냅샷에는 쓰지도 읽지도 못한다(없으면 404). */
async function assertOwnedSnapshot(snapshotId: string, workspaceId: string): Promise<boolean> {
  const snapshot = await getSnapshot(snapshotId, workspaceId);
  return Boolean(snapshot);
}

export async function GET(_request: Request, { params }: { params: Promise<{ snapshotId: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { snapshotId } = await params;

  if (!(await assertOwnedSnapshot(snapshotId, auth.user.workspaceId))) {
    return NextResponse.json({ ok: false, error: "스냅샷을 찾을 수 없습니다." }, { status: 404 });
  }

  /**
   * 🔴 **버전 전부** 를 돌려준다. 「최신 고르기」를 서버가 하지 않는다 —
   *    충돌(같은 쌍에 다른 판단)을 화면이 볼 수 있어야 한다.
   */
  const judgments = await listCeoJudgments({ snapshotId });
  return NextResponse.json({
    ok: true,
    judgments,
    /** 🟢 쌍 수와 행 수를 **가른다** — 합치면 「판단 N건」이 거짓이 된다. */
    pairCount: new Set(judgments.map((j) => j.pairId)).size,
    versionCount: judgments.length,
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ snapshotId: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { snapshotId } = await params;

  const body = (await request.json().catch(() => null)) as
    | {
        reviewKey?: unknown;
        pairId?: unknown;
        originUrl?: unknown;
        candidateUrl?: unknown;
        humanVerdict?: unknown;
        rawNote?: unknown;
        decisionContext?: unknown;
      }
    | null;

  /**
   * 🔴 **타입을 믿지 않고 칸마다 검사한다**(기존 경로와 같은 방식). DB 에 그대로 들어가는
   *    칸이라 모양이 틀리면 조용히 거짓 데이터가 된다.
   */
  const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
  const reviewKeyValue = str(body?.reviewKey);
  const pairId = str(body?.pairId);
  const originUrl = str(body?.originUrl);
  const candidateUrl = str(body?.candidateUrl);

  for (const [name, value] of [
    ["reviewKey", reviewKeyValue],
    ["pairId", pairId],
    ["originUrl", originUrl],
    ["candidateUrl", candidateUrl],
  ] as const) {
    if (!value) return NextResponse.json({ ok: false, error: `${name}가 필요합니다.` }, { status: 400 });
  }

  /** 🔴 세 상태 **밖** 의 값을 저장하지 않는다 — DB CHECK 가 막기 «전» 에 여기서 막는다. */
  if (!isCeoJudgmentVerdict(body?.humanVerdict)) {
    return NextResponse.json(
      { ok: false, error: "humanVerdict는 SAME/DIFFERENT/UNDECIDED 중 하나여야 합니다." },
      { status: 400 },
    );
  }

  if (!(await assertOwnedSnapshot(snapshotId, auth.user.workspaceId))) {
    return NextResponse.json({ ok: false, error: "스냅샷을 찾을 수 없습니다." }, { status: 404 });
  }

  const saved = await saveCeoJudgment({
    reviewKey: reviewKeyValue,
    pairId,
    originUrl,
    candidateUrl,
    humanVerdict: body.humanVerdict as CeoJudgmentVerdict,
    /**
     * 🟢 판단자는 **세션에서 온다** — 클라이언트가 보낸 이름을 쓰지 않는다(위장 금지).
     * 🔴 `email` 이 없으면 `userId` 를 쓴다(지어내지 않는다).
     */
    reviewer: auth.user.email || auth.user.userId,
    /** 🔴 **지어내지 않는다** — 문자열이 아니면 `null` 이다(빈 메모와 섞지 않는다). */
    rawNote: typeof body?.rawNote === "string" ? body.rawNote : null,
    decisionContext: typeof body?.decisionContext === "string" ? body.decisionContext : null,
    snapshotId,
  });

  if (!saved) {
    return NextResponse.json({ ok: false, error: "판단을 저장하지 못했습니다." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, judgment: saved });
}
