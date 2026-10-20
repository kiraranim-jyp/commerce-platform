import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { backfillCanonicalProduct, buildProductIdentityDna } from "@commerce/shared";
import { getSnapshot } from "../../../snapshots/_lib/snapshot";
import {
  isHumanVerdict,
  listCandidateReviews,
  saveHumanVerdict,
  type ReviewSource,
} from "../../_lib/candidate-review";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-131 — **후보 검토 이력 / 셀러 판단** API
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **판정을 하지 않는다.** MI 산출(`system_*`)은 읽어서 그대로 돌려주고,
 *    사람 판단(`human_verdict`)만 쓴다. 둘은 서로 덮지 않는다.
 * 🔴 가격은 **표시용** 으로만 실린다 — 집계·판정·alert 에 들어가지 않는다(§13).
 * 🔴 인증·소유권은 기존 경로와 **같은 함수** 를 쓴다(`requireUser` + `getSnapshot`) —
 *    새 보안 규칙을 만들지 않는다.
 */

/**
 * 🔴🔴 **원상품 축이 둘인 이유.** 과거 Human GT 중에는 원상품 snapshot 이 **없던** 것이
 *    있다(WU-131 §2 — B226AC010 21건). 그 행들은 `origin_code` 로만 매달려 있으므로,
 *    지금 열린 스냅샷의 **품번** 을 같이 넘겨야 그 이력이 화면에 올라온다.
 * 🟢 품번은 **새로 계산하지 않는다** — 운영 `buildProductIdentityDna` 가 낸 값을 읽는다.
 */
async function resolveOrigin(snapshotId: string, workspaceId: string) {
  const snapshot = await getSnapshot(snapshotId, workspaceId);
  if (!snapshot) return null;
  const product = backfillCanonicalProduct(snapshot.workspace.canonicalProduct);
  const dna = buildProductIdentityDna(product);
  /** 🔴 대문자로 맞춘다 — fixture 의 GT 는 `B226AC009` 처럼 대문자이고 URL 은 소문자다. */
  return { originCode: dna.brandModelCode ? dna.brandModelCode.toUpperCase() : null };
}

export async function GET(_request: Request, { params }: { params: Promise<{ snapshotId: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { snapshotId } = await params;

  const origin = await resolveOrigin(snapshotId, auth.user.workspaceId);
  if (!origin) {
    return NextResponse.json({ ok: false, error: "스냅샷을 찾을 수 없습니다." }, { status: 404 });
  }

  const reviews = await listCandidateReviews({
    snapshotId,
    originCode: origin.originCode,
    workspaceId: auth.user.workspaceId,
  });
  /**
   * 🟢 「판단이 있는 것」과 「본 적만 있는 것」을 **가른다** — 화면이 두 구역을 그린다.
   * 🔴 개수를 합치지 않는다. 합치면 「검토 이력 N건」이 거짓이 된다.
   */
  return NextResponse.json({
    ok: true,
    originCode: origin.originCode,
    reviews,
    reviewedCount: reviews.filter((r) => r.humanVerdict != null).length,
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ snapshotId: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { snapshotId } = await params;

  const body = (await request.json().catch(() => null)) as
    | { candidateUrl?: unknown; humanVerdict?: unknown; humanNote?: unknown; source?: unknown }
    | null;

  const candidateUrl = typeof body?.candidateUrl === "string" ? body.candidateUrl.trim() : "";
  if (!candidateUrl) {
    return NextResponse.json({ ok: false, error: "candidateUrl이 필요합니다." }, { status: 400 });
  }
  /** 🔴 네 상태 **밖** 의 값을 저장하지 않는다 — DB check 가 막기 «전» 에 여기서 막는다. */
  if (!isHumanVerdict(body?.humanVerdict)) {
    return NextResponse.json(
      { ok: false, error: "humanVerdict는 SAME/SIMILAR/DIFFERENT/UNDECIDED 중 하나여야 합니다." },
      { status: 400 },
    );
  }

  const origin = await resolveOrigin(snapshotId, auth.user.workspaceId);
  if (!origin) {
    return NextResponse.json({ ok: false, error: "스냅샷을 찾을 수 없습니다." }, { status: 404 });
  }

  const saved = await saveHumanVerdict({
    snapshotId,
    originCode: origin.originCode,
    workspaceId: auth.user.workspaceId,
    candidateUrl,
    humanVerdict: body.humanVerdict,
    humanNote: typeof body?.humanNote === "string" ? body.humanNote : null,
    source: typeof body?.source === "string" ? (body.source as ReviewSource) : undefined,
  });
  if (!saved) {
    return NextResponse.json({ ok: false, error: "판단을 저장하지 못했습니다." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, review: saved });
}
