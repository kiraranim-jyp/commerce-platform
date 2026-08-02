import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export interface DashboardData {
  today: {
    total: number;
    success: number;
    failed: number;
  };
  /** Sprint A-11(작업6 — CPO 지시: "관리자 등록 성공률 Dashboard — 시도/성공/실패/
   * 성공률 + 실패 TOP N 원인") — today는 "오늘 아침에 훑어보는 용도"라 표본이
   * 작을 때가 많다("실제로 등록 성공률이 높은 서비스"인지 판단하려면 더 넓은
   * 창이 필요하다). 최근 30일 전체를 한 번 더 집계한다 — 같은 registration_attempts
   * 테이블, 다른 기간일 뿐이라 today와 계산 로직을 공유한다(CP001류 중복 방지 —
   * 아래 buildWindowStats 한 함수만 쓴다). */
  overall: {
    windowDays: number;
    total: number;
    success: number;
    failed: number;
    successRate: number;
    topFailureCauses: { code: string; count: number }[];
  };
  errorCodeCounts: Record<string, number>;
  categoryResolverKpi: {
    /** 011 마이그레이션(category_resolver_kpi 컬럼)이 아직 실행 안 됐으면 true —
     * 이 경우 이 섹션 전체를 "아직 집계할 수 없음"으로 표시해야 한다. */
    columnMissing: boolean;
    totalWithKpi: number;
    manualOverrideCount: number;
    manualOverrideRate: number;
    /** Sprint A-5(Category Resolver 3.0 KPI) — CPO 요구사항: "Predict
     * Accuracy / Resolver Accuracy / Manual Override / Reject Rate."
     * resolverDecision을 기록해둔 건수 기준으로 계산한다(마이그레이션 전 기록엔
     * 이 값이 없으므로 분모에서 자연히 빠진다). */
    resolverV3: {
      totalWithDecision: number;
      autoSelectCount: number;
      recommendCount: number;
      rejectCount: number;
      rejectRate: number;
      /** AUTO_SELECT + RECOMMEND(=REJECT되지 않고 실제 등록까지 이어진 판단)
       * 비율 — "Resolver가 최종적으로 쓸만한 후보를 냈는가". */
      resolverAccuracy: number;
    };
    recent: {
      createdAt: string;
      predictResult: string | null;
      selectedResult: string | null;
      finalRegistered: string | null;
      manualOverride: boolean;
      resolverDecision: string | null;
      similarityScore: number | null;
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

  const WINDOW_DAYS = 30;
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - WINDOW_DAYS);
  const windowStartIso = windowStart.toISOString();

  const [attemptsRes, inquiriesRes, windowAttemptsRes] = await Promise.all([
    supabase
      .from("registration_attempts")
      .select("status, error_code")
      .gte("created_at", todayStartIso),
    supabase.from("support_inquiries").select("error_code").gte("created_at", todayStartIso),
    supabase
      .from("registration_attempts")
      .select("status, error_code")
      .gte("created_at", windowStartIso),
  ]);

  if (attemptsRes.error) {
    return NextResponse.json({ error: attemptsRes.error.message }, { status: 500 });
  }
  if (inquiriesRes.error) {
    return NextResponse.json({ error: inquiriesRes.error.message }, { status: 500 });
  }
  if (windowAttemptsRes.error) {
    return NextResponse.json({ error: windowAttemptsRes.error.message }, { status: 500 });
  }

  const attempts = attemptsRes.data ?? [];
  const inquiries = inquiriesRes.data ?? [];
  const windowAttempts = windowAttemptsRes.data ?? [];

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

  const overallSuccess = windowAttempts.filter((a) => a.status === "SUBMITTED").length;
  const overallFailed = windowAttempts.filter((a) => a.status === "FAILED").length;
  const overallFailureCounts: Record<string, number> = {};
  for (const a of windowAttempts) {
    if (a.status !== "FAILED") continue;
    const key = a.error_code ?? "미분류";
    overallFailureCounts[key] = (overallFailureCounts[key] ?? 0) + 1;
  }
  const overall: DashboardData["overall"] = {
    windowDays: WINDOW_DAYS,
    total: windowAttempts.length,
    success: overallSuccess,
    failed: overallFailed,
    successRate: windowAttempts.length > 0 ? Math.round((overallSuccess / windowAttempts.length) * 1000) / 10 : 0,
    topFailureCauses: Object.entries(overallFailureCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([code, count]) => ({ code, count })),
  };

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

  const emptyResolverV3 = {
    totalWithDecision: 0,
    autoSelectCount: 0,
    recommendCount: 0,
    rejectCount: 0,
    rejectRate: 0,
    resolverAccuracy: 0,
  };

  const categoryResolverKpi: DashboardData["categoryResolverKpi"] = kpiRes.error
    ? { columnMissing: true, totalWithKpi: 0, manualOverrideCount: 0, manualOverrideRate: 0, resolverV3: emptyResolverV3, recent: [] }
    : (() => {
        const rows = (kpiRes.data ?? []) as {
          created_at: string;
          category_resolver_kpi: {
            predictResult?: { code: number; name: string } | null;
            selectedResult?: { code: number; name: string } | null;
            finalRegistered?: { code: number; name: string } | null;
            manualOverride?: boolean;
            resolverDecision?: "AUTO_SELECT" | "RECOMMEND" | "REJECT" | null;
            similarityScore?: number | null;
          } | null;
        }[];
        const manualOverrideCount = rows.filter((r) => r.category_resolver_kpi?.manualOverride).length;

        // Sprint A-5(Category Resolver 3.0 KPI) — resolverDecision을 기록해둔
        // 건수만 분모로 쓴다(A-5 배포 이전 기록은 이 필드가 없어 자동으로
        // 제외된다 — 없는 값을 0으로 취급해서 Reject Rate를 왜곡하지 않는다).
        const withDecision = rows.filter((r) => r.category_resolver_kpi?.resolverDecision != null);
        const autoSelectCount = withDecision.filter((r) => r.category_resolver_kpi?.resolverDecision === "AUTO_SELECT").length;
        const recommendCount = withDecision.filter((r) => r.category_resolver_kpi?.resolverDecision === "RECOMMEND").length;
        const rejectCount = withDecision.filter((r) => r.category_resolver_kpi?.resolverDecision === "REJECT").length;
        const totalWithDecision = withDecision.length;
        const resolverV3 = {
          totalWithDecision,
          autoSelectCount,
          recommendCount,
          rejectCount,
          rejectRate: totalWithDecision > 0 ? Math.round((rejectCount / totalWithDecision) * 1000) / 10 : 0,
          resolverAccuracy:
            totalWithDecision > 0 ? Math.round(((autoSelectCount + recommendCount) / totalWithDecision) * 1000) / 10 : 0,
        };

        return {
          columnMissing: false,
          totalWithKpi: rows.length,
          manualOverrideCount,
          manualOverrideRate: rows.length > 0 ? Math.round((manualOverrideCount / rows.length) * 1000) / 10 : 0,
          resolverV3,
          recent: rows.slice(0, 10).map((r) => ({
            createdAt: r.created_at,
            predictResult: r.category_resolver_kpi?.predictResult?.name ?? null,
            selectedResult: r.category_resolver_kpi?.selectedResult?.name ?? null,
            finalRegistered: r.category_resolver_kpi?.finalRegistered?.name ?? null,
            manualOverride: r.category_resolver_kpi?.manualOverride ?? false,
            resolverDecision: r.category_resolver_kpi?.resolverDecision ?? null,
            similarityScore: r.category_resolver_kpi?.similarityScore ?? null,
          })),
        };
      })();

  const data: DashboardData = { today, overall, errorCodeCounts, categoryResolverKpi };
  return NextResponse.json(data);
}
