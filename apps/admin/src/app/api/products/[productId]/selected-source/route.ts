import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireUser, type AuthedUser } from "@/lib/auth/require-user";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { computeMasterReady, type MasterReadyResult } from "@/lib/master-ready";
import { CANDIDATE_AVAILABILITY_VALUES, checkCandidateAccess } from "@/lib/sourcing-candidate-policy";
import { parseRegistrationReady, parseSelectionBody } from "@/lib/selected-source-policy";
import {
  listCandidates,
  loadCandidate,
  loadProductOwnership,
  toCandidate,
  type CandidateRow,
  type ProductOwnership,
} from "@/app/api/products/_lib/sourcing-candidate-store";
import { writeSelectedCandidate } from "@/app/api/products/_lib/selected-source-store";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * PIVOT-03-B ④ — Selected Source. **「어디서 사올지」를 셀러가 정하는 command.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 *   GET     지금 무엇이 선택돼 있고 Master 가 어디까지 왔는가
 *   PUT     선택을 «바꾼다» — 칸 하나만 쓴다
 *   DELETE  선택을 «푼다»
 *
 * 🔴 ②(CRUD)와 **경로부터 다르다**. `/sourcing-candidates` 는 후보 데이터이고
 * `/selected-source` 는 Product 의 의사표시다. PATCH 하나가 선택까지 바꿔 버리는
 * 일이 없도록 command 를 갈라 둔다(CPO 지시).
 *
 * 🔴 소유권 판단은 ②의 `checkCandidateAccess()` 를 «그대로» 쓴다. 새로 쓰면 두 벌이
 * 되고, 두 벌이 되면 한쪽에 검사가 빠진다.
 *
 * ── 🔴 이 라우트가 하지 «않는» 것 ─────────────────────────────────────────
 * · 새 후보가 생겼을 때 자동으로 고르지 않는다 — 선택은 사람의 의사표시다.
 * · 품절이어도 선택을 풀지 않는다 — 경고만 올린다(PIVOT-02 Case 4).
 * · 재분석(snapshot 추가)을 «보지 않는다» — 선택은 Product 의 칸이다.
 * · 등록 readiness 를 계산하지 않는다 — 받는다(master-ready.ts 의 결정).
 * · Commerce / ChannelProduct 를 건드리지 않는다.
 */

type Resolved =
  | { ok: false; response: NextResponse }
  | { ok: true; user: AuthedUser; supabase: SupabaseClient; product: ProductOwnership };

/** 🔴 반환 타입을 명시한다 — 생략하면 object literal 합집합이 판별되지 않는다. */
async function resolveProduct(productId: string): Promise<Resolved> {
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
  const access = checkCandidateAccess({
    requesterWorkspaceId: auth.user.workspaceId,
    productId,
    productWorkspaceId: product?.workspaceId,
  });
  if (!access.ok) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: access.error }, { status: access.status }),
    };
  }

  return { ok: true, user: auth.user, supabase, product: product as ProductOwnership };
}

/** 🔴 어휘 밖의 문자열을 availability 로 «믿지 않는다» — 모르면 UNKNOWN 이다. */
function asAvailability(value: string | null): MasterReadyInputAvailability {
  if (value != null && (CANDIDATE_AVAILABILITY_VALUES as readonly string[]).includes(value)) {
    return value as MasterReadyInputAvailability;
  }
  return null;
}
type MasterReadyInputAvailability = "IN_STOCK" | "OUT_OF_STOCK" | "INVALID" | "UNKNOWN" | null;

interface SelectionView {
  selectedCandidateId: string | null;
  selectedCandidate: ReturnType<typeof toCandidate> | null;
  candidateCount: number;
  masterReady: MasterReadyResult;
  /** 🔴 `false` 면 `masterReady.stage` 를 「등록 준비 미완」으로 읽지 말아야 한다. */
  registrationReadyEvaluated: boolean;
}

/**
 * 🔴 Master Ready 를 **다시 구현하지 않는다** — 기존 순수 함수에 넘긴다. 입력만
 * 모은다. 판정을 두 곳에서 구현하면 화면과 서버가 다른 말을 한다(CP001 사고).
 */
async function buildView(
  supabase: SupabaseClient,
  productId: string,
  workspaceId: string,
  selectedCandidateId: string | null,
  registrationReady: { evaluated: boolean; passed: boolean },
): Promise<SelectionView> {
  const rows: CandidateRow[] = await listCandidates(supabase, productId, workspaceId);
  const selected = selectedCandidateId ? (rows.find((row) => row.id === selectedCandidateId) ?? null) : null;

  return {
    selectedCandidateId,
    selectedCandidate: selected ? toCandidate(selected) : null,
    candidateCount: rows.length,
    masterReady: computeMasterReady({
      hasProduct: true,
      candidateCount: rows.length,
      selectedCandidateId,
      selectedAvailability: asAvailability(selected?.availability ?? null),
      registrationReadyRequiredPassed: registrationReady.passed,
    }),
    registrationReadyEvaluated: registrationReady.evaluated,
  };
}

export async function GET(request: Request, { params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  const ctx = await resolveProduct(productId);
  if (!ctx.ok) return ctx.response;

  const ready = parseRegistrationReady(new URL(request.url).searchParams.get("registrationReady"));
  if (!ready.ok) return NextResponse.json({ ok: false, error: ready.error }, { status: ready.status });

  const view = await buildView(
    ctx.supabase,
    productId,
    ctx.user.workspaceId,
    ctx.product.selectedCandidateId,
    ready,
  );
  return NextResponse.json({ ok: true, ...view });
}

export async function PUT(request: Request, { params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;

  /* 🔴 소유권이 «먼저» 다 — body 를 읽기 전이다. */
  const ctx = await resolveProduct(productId);
  if (!ctx.ok) return ctx.response;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const parsed = parseSelectionBody(body);
  if (!parsed.ok) return NextResponse.json({ ok: false, error: parsed.error }, { status: parsed.status });

  const ready = parseRegistrationReady(body?.registrationReady);
  if (!ready.ok) return NextResponse.json({ ok: false, error: ready.error }, { status: ready.status });

  /* 🔴 「그 후보가 이 Product 의 것인가」를 ②의 판정으로 본다. 없는 후보와 남의
     후보가 «같은» 404 다 — 존재 여부를 알려주지 않는다. */
  const candidate = await loadCandidate(ctx.supabase, productId, parsed.candidateId, ctx.user.workspaceId);
  const access = checkCandidateAccess({
    requesterWorkspaceId: ctx.user.workspaceId,
    productId,
    productWorkspaceId: ctx.product.workspaceId,
    candidateProductId: candidate?.product_id ?? null,
  });
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: access.status });

  /* 🔴 품절이어도 «막지 않는다». 판매 여부는 셀러가 정한다 — 우리는 사실만 말하고
     경고는 masterReady.warning 으로 올린다(PIVOT-02 Case 4). */
  const written = await writeSelectedCandidate(ctx.supabase, productId, ctx.user.workspaceId, parsed.candidateId);
  if (!written) {
    return NextResponse.json({ ok: false, error: "소싱처 선택을 저장하지 못했습니다." }, { status: 500 });
  }
  if (written.selectedCandidateId !== parsed.candidateId) {
    /* 🔴 다시 읽어 보니 반영되지 않았다 — 「저장됐다」고 말하지 않는다.
       076 의 복합 FK 가 거절한 경우가 여기로 온다. */
    return NextResponse.json({ ok: false, error: "소싱처 선택이 반영되지 않았습니다." }, { status: 409 });
  }

  const view = await buildView(ctx.supabase, productId, ctx.user.workspaceId, written.selectedCandidateId, ready);
  return NextResponse.json({ ok: true, ...view });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  const ctx = await resolveProduct(productId);
  if (!ctx.ok) return ctx.response;

  const ready = parseRegistrationReady(new URL(request.url).searchParams.get("registrationReady"));
  if (!ready.ok) return NextResponse.json({ ok: false, error: ready.error }, { status: ready.status });

  /* 🔴 후보를 «지우지 않는다» — 선택만 푼다. 둘을 섞으면 셀러가 「다시 고르려고
     풀었을 뿐인데 후보가 사라졌다」를 겪는다(②의 삭제는 별도 command 다). */
  const written = await writeSelectedCandidate(ctx.supabase, productId, ctx.user.workspaceId, null);
  if (!written || written.selectedCandidateId !== null) {
    return NextResponse.json({ ok: false, error: "소싱처 선택을 해제하지 못했습니다." }, { status: 500 });
  }

  const view = await buildView(ctx.supabase, productId, ctx.user.workspaceId, null, ready);
  return NextResponse.json({ ok: true, ...view });
}
