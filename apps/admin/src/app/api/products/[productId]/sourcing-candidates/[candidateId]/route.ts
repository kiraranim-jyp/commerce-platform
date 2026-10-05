import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireUser, type AuthedUser } from "@/lib/auth/require-user";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  checkCandidateAccess,
  checkCandidateDelete,
  checkCandidateValues,
  checkUpdatePatch,
} from "@/lib/sourcing-candidate-policy";
import {
  PG_UNIQUE_VIOLATION,
  loadCandidate,
  loadProductOwnership,
  toCandidate,
  toColumnPatch,
  type CandidateRow,
  type ProductOwnership,
} from "@/app/api/products/_lib/sourcing-candidate-store";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * PIVOT-03-B ② — SourcingCandidate 단건 조회 / 수정 / 삭제
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 세 handler 가 «같은 순서» 로 시작한다. 그 순서가 계약이다(CPO 지시 1):
 *
 *     ① 세션       requireUser()
 *     ② Product    loadProductOwnership + checkCandidateAccess
 *     ③ Candidate  loadCandidate + checkCandidateAccess(candidateProductId)
 *     ④ 그 다음에야 force / patch 같은 «요청의 의도» 를 본다
 *
 * 🔴 **force 는 ④ 다.** ①~③ 을 통과하지 못하면 `force=true` 는 읽히지도 않는다 —
 * `checkCandidateDelete()` 가 workspace/productId 를 «받지 않는» 이유가 그것이다.
 * 그 함수가 소유권을 다시 보지 않으므로, 순서가 뒤바뀌면 우회가 된다.
 */

/**
 * ①②③ 공통. 🔴 세 handler 가 각자 쓰면 한 곳이 빠진다 — 한 번만 적는다.
 *
 * 🔴 반환 타입을 «명시» 한다. 생략하면 TypeScript 가 여러 object literal 반환을
 * 합치면서 없는 속성을 `optional undefined` 로 보정해 버리고, 그러면 `"failed" in ctx`
 * 가 판별자로 동작하지 않아 성공 분기에서도 `undefined` 가 섞인다(tsc 로 확인했다).
 * 태그(`ok`)로 가르는 것은 `requireUser()` 가 이미 쓰는 방식이다 — 같은 모양을 쓴다.
 */
type Resolved =
  | { ok: false; response: NextResponse }
  | {
      ok: true;
      user: AuthedUser;
      supabase: SupabaseClient;
      product: ProductOwnership | null;
      candidate: CandidateRow;
    };

async function resolve(productId: string, candidateId: string): Promise<Resolved> {
  const auth = await requireUser();
  if (!auth.ok) return { ok: false, response: auth.response };

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: "저장소에 접근하지 못했습니다." }, { status: 503 }),
    };
  }

  const product = await loadProductOwnership(supabase, productId, auth.user.workspaceId);
  const productAccess = checkCandidateAccess({
    requesterWorkspaceId: auth.user.workspaceId,
    productId,
    productWorkspaceId: product?.workspaceId,
  });
  if (!productAccess.ok) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: productAccess.error }, { status: productAccess.status }),
    };
  }

  const candidate = await loadCandidate(supabase, productId, candidateId, auth.user.workspaceId);
  const candidateAccess = checkCandidateAccess({
    requesterWorkspaceId: auth.user.workspaceId,
    productId,
    productWorkspaceId: product?.workspaceId,
    /* 🔴 `null` 을 넘긴다 — `undefined` 는 「후보를 지정하지 않은 요청」이라는
       다른 뜻이고, 그러면 이 검사가 조용히 통과한다. */
    candidateProductId: candidate?.product_id ?? null,
  });
  if (!candidateAccess.ok) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: candidateAccess.error }, { status: candidateAccess.status }),
    };
  }

  /* 여기 도달하면 candidate 는 반드시 있다 — 없으면 위에서 404 로 끝났다. */
  return { ok: true, user: auth.user, supabase, product, candidate: candidate as CandidateRow };
}

export async function GET(_request: Request, { params }: { params: Promise<{ productId: string; candidateId: string }> }) {
  const { productId, candidateId } = await params;
  const ctx = await resolve(productId, candidateId);
  if (!ctx.ok) return ctx.response;

  return NextResponse.json({
    ok: true,
    candidate: toCandidate(ctx.candidate),
    isSelected: ctx.product?.selectedCandidateId === ctx.candidate.id,
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ productId: string; candidateId: string }> }) {
  const { productId, candidateId } = await params;
  const ctx = await resolve(productId, candidateId);
  if (!ctx.ok) return ctx.response;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ ok: false, error: "요청 내용을 읽지 못했습니다." }, { status: 400 });
  }

  /* 🔴 provenance(sourceKind / originatingSnapshotId / productId / id)는 read-only 다
     — 셀러가 `DISCOVERED → SELLER_ENTERED` 로 바꾸거나 남의 snapshot 을 붙이는
     우회를 막는다(CPO 지시 8). 모르는 칸과 빈 수정도 여기서 거절된다. */
  const patch = checkUpdatePatch(body);
  if (!patch.ok) return NextResponse.json({ ok: false, error: patch.error }, { status: patch.status });

  const values = checkCandidateValues(body);
  if (!values.ok) return NextResponse.json({ ok: false, error: values.error }, { status: values.status });

  const { data, error } = await ctx.supabase
    .from("sourcing_candidates")
    .update({
      ...toColumnPatch(body),
      /* 🔴 Prisma 의 `@updatedAt` 은 Prisma 경로에서만 돈다. Supabase 로 쓰면
         아무도 갱신하지 않으므로 여기서 직접 찍는다 — 안 찍으면 「언제 바뀐
         값인가」가 거짓이 된다. */
      updated_at: new Date().toISOString(),
    })
    .eq("id", candidateId)
    .eq("product_id", productId)
    .eq("workspace_id", ctx.user.workspaceId)
    .select(
      "id, product_id, originating_snapshot_id, source_kind, source_url, source_site, source_country, " +
        "price_amount, currency, availability, shipping_note, identity_match_truth, observed_at, created_at, updated_at",
    )
    .single();

  if (error) {
    if (error.code === PG_UNIQUE_VIOLATION) {
      return NextResponse.json(
        { ok: false, error: "같은 소싱처가 이미 등록돼 있습니다." },
        { status: 409 },
      );
    }
    console.warn("[sourcing-candidate] 수정 실패:", error.message);
    return NextResponse.json({ ok: false, error: "소싱 후보를 수정하지 못했습니다." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, candidate: toCandidate(data as unknown as CandidateRow) });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ productId: string; candidateId: string }> }) {
  const { productId, candidateId } = await params;

  /* 🔴 ①②③ 이 «먼저» 다. force 는 아래에서 읽는다. */
  const ctx = await resolve(productId, candidateId);
  if (!ctx.ok) return ctx.response;

  const isSelected = ctx.product?.selectedCandidateId === ctx.candidate.id;

  /* 🔴 `=== "true"` 로만 받는다 — `?force=1` 이나 `?force` 는 force 가 아니다.
     정책 쪽도 `!== true` 로 보므로 HTTP 경계와 판정이 같은 엄격도를 쓴다. */
  const force = new URL(request.url).searchParams.get("force") === "true";

  const decision = checkCandidateDelete({ isSelected, force });
  if (!decision.ok) {
    return NextResponse.json({ ok: false, error: decision.error }, { status: decision.status });
  }

  const { error } = await ctx.supabase
    .from("sourcing_candidates")
    .delete()
    .eq("id", candidateId)
    .eq("product_id", productId)
    .eq("workspace_id", ctx.user.workspaceId);
  if (error) {
    console.warn("[sourcing-candidate] 삭제 실패:", error.message);
    return NextResponse.json({ ok: false, error: "소싱 후보를 삭제하지 못했습니다." }, { status: 500 });
  }

  /* ── 🔴 「풀렸다」를 «단정하지 않고 확인한다» ───────────────────────────────
     075/076 의 `ON DELETE SET NULL` 이 선택을 풀어 주지만, 그것은 마이그레이션이
     적용돼 있다는 «가정» 이다. 이 저장소의 기준은 「응답만으로 단정하지 않는다」라
     지웠다고 말하기 전에 다시 읽는다. 적용돼 있으면 한 번 더 읽는 비용뿐이고,
     적용돼 있지 «않으면» dangling 을 여기서 잡는다. */
  let selectedCleared = decision.selectedCleared;
  if (isSelected) {
    const after = await loadProductOwnership(ctx.supabase, productId, ctx.user.workspaceId);
    if (after?.selectedCandidateId === candidateId) {
      /* FK 가 풀어 주지 않았다 = dangling. 조용히 두면 화면이 「선택됨」이라고
         말하면서 그 후보를 찾지 못한다. 명시적으로 푼다. */
      const { error: clearError } = await ctx.supabase
        .from("products")
        .update({ selected_sourcing_candidate_id: null })
        .eq("id", productId)
        .eq("workspace_id", ctx.user.workspaceId);
      selectedCleared = !clearError;
      if (clearError) console.warn("[sourcing-candidate] 선택 해제 실패:", clearError.message);
    }
  }

  /* 🔴 「삭제했고 선택도 풀렸다」를 응답에 «명시» 한다(CPO 지시). 조용히 풀면
     셀러는 Master 가 왜 미확정으로 돌아갔는지 모른다. */
  return NextResponse.json({ ok: true, selectedCleared });
}
