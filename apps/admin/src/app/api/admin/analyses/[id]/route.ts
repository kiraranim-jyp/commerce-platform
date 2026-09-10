import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

/**
 * CS-OBSERVABILITY-1(CPO 지시, 2026-09-10) — 분석 하나의 상세.
 *
 * CS 흐름의 종점이다: 사용자 → 최근 분석 → **원본 URL** → 당시 추출 결과.
 * 이 화면이 있어야 "아까 그 상품 가격이 이상했다"는 문의에 URL을 되묻지 않는다.
 *
 * 상품 정보(제목/브랜드/가격/통화/SKU/옵션)는 저장 당시의 workspace jsonb 안에
 * 들어 있다(016의 `workspace` 컬럼 — 파이프라인이 만든 결과 전체). 구조가 시기에
 * 따라 다를 수 있으므로 **없으면 없는 대로 둔다** — 모양을 지어내지 않는다.
 *
 * 접근 통제는 proxy의 관리자 세션 검사(/api/admin/*)에 의존한다.
 */
type Json = Record<string, unknown>;
const obj = (v: unknown): Json | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : null);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);

/** 저장 형태가 시기마다 달라서 후보 경로를 순서대로 본다. 못 찾으면 null. */
function pickProduct(workspace: Json | null): Json | null {
  if (!workspace) return null;
  return obj(workspace.canonicalProduct) ?? obj(workspace.product) ?? obj(workspace.productData) ?? null;
}
function fieldValue(product: Json | null, key: string): string | null {
  if (!product) return null;
  const raw = product[key];
  if (typeof raw === "string") return str(raw);
  // ProvenanceField<T> — { value, source, confidence }
  const wrapped = obj(raw);
  return wrapped ? str(wrapped.value) : null;
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ ok: false, error: "unavailable" }, { status: 503 });

  const { data: snap, error } = await supabase
    .from("product_snapshots")
    .select("id, job_key, source_url, title, status, workspace_id, workspace, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (!snap) return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });

  const workspace = obj((snap as Json).workspace);
  const product = pickProduct(workspace);
  const price = obj(product?.price);
  const optionGroups = Array.isArray(product?.optionGroups) ? (product.optionGroups as Json[]) : [];

  // 이 분석에 붙은 감사 기록 — 등록 시도/가격 변경 등이 있었는지 함께 본다.
  const { data: events } = await supabase
    .from("audit_log")
    .select("id, event_type, actor, field, before_value, after_value, reason, created_at")
    .eq("snapshot_id", id)
    .order("created_at", { ascending: false })
    .limit(50);

  return NextResponse.json({
    ok: true,
    analysis: {
      analysisId: snap.id,
      jobKey: snap.job_key ?? null,
      sourceUrl: snap.source_url ?? null,
      title: fieldValue(product, "title") ?? str(snap.title),
      brand: fieldValue(product, "brand"),
      sku: fieldValue(product, "sku"),
      priceAmount: typeof price?.amount === "number" ? price.amount : null,
      priceCurrency: str(price?.currency),
      optionGroups: optionGroups.map((g) => ({
        name: str(g.name),
        values: Array.isArray(g.values) ? (g.values as unknown[]).filter((v): v is string => typeof v === "string") : [],
      })),
      status: snap.status ?? null,
      workspaceId: snap.workspace_id ?? null,
      createdAt: snap.created_at ?? null,
      updatedAt: snap.updated_at ?? null,
      // 상품 정보를 못 읽었으면 그 사실을 화면이 알 수 있어야 한다.
      productDataAvailable: product !== null,
    },
    events: events ?? [],
  });
}
