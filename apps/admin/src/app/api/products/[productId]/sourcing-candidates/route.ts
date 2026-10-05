import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  CANDIDATE_MUTABLE_FIELDS,
  checkCandidateAccess,
  checkCandidateValues,
  checkCreateProvenance,
  parseSourceKind,
} from "@/lib/sourcing-candidate-policy";
import {
  PG_CHECK_VIOLATION,
  PG_UNIQUE_VIOLATION,
  listCandidates,
  loadProductOwnership,
  loadSnapshotProductId,
  toCandidate,
  toColumnPatch,
  type CandidateRow,
} from "@/app/api/products/_lib/sourcing-candidate-store";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * PIVOT-03-B ② — SourcingCandidate 목록 / 생성
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **경로가 Product 아래다.** `/api/sourcing-candidates?productId=` 가 아니다 —
 * 그러면 productId 가 «body/query 값» 이 되고, 그것을 권한 근거로 쓰지 않는다는
 * require-user.ts 의 절대 규칙과 매번 싸워야 한다. 경로에 두면 소유자 확인이
 * 구조적으로 «먼저» 일어난다(CPO 지시 1 — ownership 이 최우선).
 *
 * 🔴 판단은 전부 `sourcing-candidate-policy.ts` 에 있다. 이 파일은 순서만 지킨다:
 *
 *     ① ownership   — body 를 «읽기 전에» 끝낸다
 *     ② 입력 모양    — 모르는 칸은 거절한다(조용히 버리지 않는다)
 *     ③ provenance  — 077 이 CHECK 로 못 지키는 쪽(생성 시점 규칙)
 *     ④ 쓰기
 *
 * 🔴 이 파일은 SmartStore/Coupang 등록 경로를 «건드리지 않는다»(CPO 범위 확정).
 */

/** CREATE 가 받는 칸. 🔴 목록 밖의 키는 조용히 버리지 않고 거절한다. */
const CREATE_ALLOWED_FIELDS: readonly string[] = [
  ...CANDIDATE_MUTABLE_FIELDS,
  "sourceKind",
  "originatingSnapshotId",
];

export async function GET(_request: Request, { params }: { params: Promise<{ productId: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { productId } = await params;

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    /* 🔴 「후보 없음」으로 내려보내지 않는다 — 화면이 「조사해 보니 없다」로 읽는다. */
    return NextResponse.json({ ok: false, error: "저장소에 접근하지 못했습니다." }, { status: 503 });
  }

  const product = await loadProductOwnership(supabase, productId, auth.user.workspaceId);
  const access = checkCandidateAccess({
    requesterWorkspaceId: auth.user.workspaceId,
    productId,
    productWorkspaceId: product?.workspaceId,
  });
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: access.status });

  const rows = await listCandidates(supabase, productId, auth.user.workspaceId);
  return NextResponse.json({
    ok: true,
    candidates: rows.map(toCandidate),
    /* 🔴 선택은 Product 의 칸이다 — 후보 쪽에 `isSelected` 를 박지 않는다.
       두 곳에 적으면 한쪽이 낡는다. 화면이 이 id 와 대조한다. */
    selectedCandidateId: product?.selectedCandidateId ?? null,
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ productId: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { productId } = await params;

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "저장소에 접근하지 못했습니다." }, { status: 503 });
  }

  /* ── ① ownership — 🔴 body 를 읽기 «전» 이다 ─────────────────────────────── */
  const product = await loadProductOwnership(supabase, productId, auth.user.workspaceId);
  const access = checkCandidateAccess({
    requesterWorkspaceId: auth.user.workspaceId,
    productId,
    productWorkspaceId: product?.workspaceId,
  });
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: access.status });

  /* ── ② 입력 모양 ────────────────────────────────────────────────────────── */
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ ok: false, error: "요청 내용을 읽지 못했습니다." }, { status: 400 });
  }
  const unknownFields = Object.keys(body).filter((key) => !CREATE_ALLOWED_FIELDS.includes(key));
  if (unknownFields.length > 0) {
    /* 🔴 모르는 칸을 버리고 201 을 주면 화면은 「저장됐다」고 말하고 값은 없다.
       body 의 productId/workspaceId 도 여기서 걸린다 — 권한 근거로 쓰지 않는다. */
    return NextResponse.json({ ok: false, error: "저장할 수 없는 항목이 포함됐습니다." }, { status: 422 });
  }

  const kind = parseSourceKind(body.sourceKind);
  if (!kind.ok) return NextResponse.json({ ok: false, error: kind.error }, { status: kind.status });

  const sourceUrl = typeof body.sourceUrl === "string" ? body.sourceUrl.trim() : "";
  const sourceSite = typeof body.sourceSite === "string" ? body.sourceSite.trim() : "";
  if (!sourceUrl || !sourceSite) {
    return NextResponse.json({ ok: false, error: "소싱처 주소와 사이트 이름이 필요합니다." }, { status: 400 });
  }

  const values = checkCandidateValues(body);
  if (!values.ok) return NextResponse.json({ ok: false, error: values.error }, { status: values.status });

  /* ── ③ provenance — 🔴 생성 «시점» 규칙 ──────────────────────────────────
     DISCOVERED 면 snapshot 이 있어야 하고, 그 snapshot 이 같은 Product 의 것이어야
     한다. CHECK 로는 표현할 수 없다 — snapshot 삭제 후의 `DISCOVERED + NULL` 은
     정상이기 때문이다(077 주석). */
  const originatingSnapshotId =
    typeof body.originatingSnapshotId === "string" && body.originatingSnapshotId.trim()
      ? body.originatingSnapshotId.trim()
      : null;

  const snapshotProductId = originatingSnapshotId
    ? await loadSnapshotProductId(supabase, originatingSnapshotId, auth.user.workspaceId)
    : null;

  const provenance = checkCreateProvenance({
    sourceKind: kind.sourceKind,
    originatingSnapshotId,
    snapshotProductId,
    productId,
  });
  if (!provenance.ok) {
    return NextResponse.json({ ok: false, error: provenance.error }, { status: provenance.status });
  }

  /* ── ④ 쓰기 ─────────────────────────────────────────────────────────────── */
  const { data, error } = await supabase
    .from("sourcing_candidates")
    .insert({
      ...toColumnPatch({ ...body, sourceUrl, sourceSite }),
      product_id: productId,
      /* 🔴 세션의 workspace 만 쓴다. body 값을 쓰지 않는다(require-user.ts 절대 규칙). */
      workspace_id: auth.user.workspaceId,
      source_kind: kind.sourceKind,
      originating_snapshot_id: originatingSnapshotId,
    })
    .select(
      "id, product_id, originating_snapshot_id, source_kind, source_url, source_site, source_country, " +
        "price_amount, currency, availability, shipping_note, identity_match_truth, observed_at, created_at, updated_at",
    )
    .single();

  if (error) {
    if (error.code === PG_UNIQUE_VIOLATION) {
      /* 075 의 `UNIQUE(product_id, source_url)`. 🔴 「가격이 바뀌면 행을 더하지 않고
         그 행을 갱신한다」가 그 제약의 뜻이므로, 셀러에게 그 길을 알려 준다. */
      return NextResponse.json(
        { ok: false, error: "같은 소싱처가 이미 등록돼 있습니다 — 그 후보의 가격을 수정하세요." },
        { status: 409 },
      );
    }
    if (error.code === PG_CHECK_VIOLATION) {
      /* 🔴 제약 위반 문구를 그대로 내보내지 않는다 — 내부 제약명이 노출된다. */
      return NextResponse.json({ ok: false, error: "저장할 수 없는 값이 있습니다." }, { status: 422 });
    }
    console.warn("[sourcing-candidate] 생성 실패:", error.message);
    return NextResponse.json({ ok: false, error: "소싱 후보를 저장하지 못했습니다." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, candidate: toCandidate(data as unknown as CandidateRow) }, { status: 201 });
}
