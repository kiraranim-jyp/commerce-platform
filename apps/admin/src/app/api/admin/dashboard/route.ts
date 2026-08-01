import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export interface DashboardData {
  today: {
    total: number;
    success: number;
    failed: number;
  };
  errorCodeCounts: Record<string, number>;
  categoryResolverKpi: {
    /** 011 마이그레이션(category_resolver_kpi 컬럼)이 아직 실행 안 됐으면 true —
     * 이 경우 이 섹션 전체를 "아직 집계할 수 없음"으로 표시해야 한다. */
    columnMissing: boolean;
    totalWithKpi: number;
    manualOverrideCount: number;
    manualOverrideRate: number;
    recent: {
      createdAt: string;
      predictResult: string | null;
      selectedResult: string | null;
      finalRegistered: string | null;
      manualOverride: boolean;
    }[];
  };
}

/**
 * "오늘 등록 18건, 성공 15건, 실패 3건" + ErrorCode 집계 — registration_attempts
 * (모든 시도, 사용자가 문의를 안 남겨도 잡힘)와 support_inquiries(사용자가 직접
 * 제출한 것, IMG001처럼 등록 이전 단계 실패도 포함)를 합쳐서 낸다.
 */
export async function GET() {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase가 설정되어 있지 않습니다." }, { status: 503 });
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayStartIso = todayStart.toISOString();

  const [attemptsRes, inquiriesRes] = await Promise.all([
    supabase
      .from("registration_attempts")
      .select("status, error_code")
      .gte("created_at", todayStartIso),
    supabase.from("support_inquiries").select("error_code").gte("created_at", todayStartIso),
  ]);

  if (attemptsRes.error) {
    return NextResponse.json({ error: attemptsRes.error.message }, { status: 500 });
  }
  if (inquiriesRes.error) {
    return NextResponse.json({ error: inquiriesRes.error.message }, { status: 500 });
  }

  const attempts = attemptsRes.data ?? [];
  const inquiries = inquiriesRes.data ?? [];

  const today = {
    total: attempts.length,
    success: attempts.filter((a) => a.status === "SUBMITTED").length,
    failed: attempts.filter((a) => a.status === "FAILED").length,
  };

  const errorCodeCounts: Record<string, number> = {};
  const bump = (code: string | null) => {
    const key = code ?? "미분류";
    errorCodeCounts[key] = (errorCodeCounts[key] ?? 0) + 1;
  };
  for (const a of attempts) {
    if (a.status === "FAILED") bump(a.error_code);
  }
  for (const i of inquiries) {
    bump(i.error_code);
  }

  // Sprint A-2.6(Resolver Accuracy Validation) — CPO 요구사항: "KPI Dashboard에서
  // Accuracy/Manual Override/Failure/Trend를 볼 수 있게 한다." registration_attempts
  // .category_resolver_kpi(Sprint A-2.5에서 등록마다 기록해두는 값)를 최근 50건
  // 모아 Manual Override 비율/최근 판단 이력을 낸다. 011 마이그레이션이 아직 안
  // 돌았으면 컬럼 자체가 없어 이 쿼리가 에러를 내므로, 그 경우 columnMissing:true로
  // 표시하고 나머지 대시보드는 그대로 정상 응답한다.
  const kpiRes = await supabase
    .from("registration_attempts")
    .select("created_at, category_resolver_kpi")
    .not("category_resolver_kpi", "is", null)
    .order("created_at", { ascending: false })
    .limit(50);

  const categoryResolverKpi: DashboardData["categoryResolverKpi"] = kpiRes.error
    ? { columnMissing: true, totalWithKpi: 0, manualOverrideCount: 0, manualOverrideRate: 0, recent: [] }
    : (() => {
        const rows = (kpiRes.data ?? []) as {
          created_at: string;
          category_resolver_kpi: {
            predictResult?: { code: number; name: string } | null;
            selectedResult?: { code: number; name: string } | null;
            finalRegistered?: { code: number; name: string } | null;
            manualOverride?: boolean;
          } | null;
        }[];
        const manualOverrideCount = rows.filter((r) => r.category_resolver_kpi?.manualOverride).length;
        return {
          columnMissing: false,
          totalWithKpi: rows.length,
          manualOverrideCount,
          manualOverrideRate: rows.length > 0 ? Math.round((manualOverrideCount / rows.length) * 1000) / 10 : 0,
          recent: rows.slice(0, 10).map((r) => ({
            createdAt: r.created_at,
            predictResult: r.category_resolver_kpi?.predictResult?.name ?? null,
            selectedResult: r.category_resolver_kpi?.selectedResult?.name ?? null,
            finalRegistered: r.category_resolver_kpi?.finalRegistered?.name ?? null,
            manualOverride: r.category_resolver_kpi?.manualOverride ?? false,
          })),
        };
      })();

  const data: DashboardData = { today, errorCodeCounts, categoryResolverKpi };
  return NextResponse.json(data);
}
