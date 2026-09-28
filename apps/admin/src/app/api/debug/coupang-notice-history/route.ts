import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { summarize, toAttemptView, type AttemptRow } from "./summarize";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * KC-COUPANG-02B(CPO 확정, 2026-09-28)
 * **과거 쿠팡 등록 증거를 «CEO 의 SQL 실행 없이» 읽는 통로.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * KC-COUPANG-02A 에서 CTO 가 DB 에 닿는 경로 네 개를 전부 시도했고 전부
 * 막혔다(로컬 env · Supabase CLI · `vercel env pull` · 기존 debug 라우트).
 * 그런데 CEO 에게 SQL 을 넘기는 것은 이 팀의 원칙이 아니다 —
 * 「CEO 에게 개발/SQL 작업을 시키지 않는다」. 그래서 통로를 만든다.
 *
 * ── 🔴 service role 키를 «새로 만들지도 내보내지도» 않는다 ─────────────────
 * `getSupabaseAdmin()` 은 서버에서 `process.env.SUPABASE_SERVICE_ROLE_KEY` 를
 * 읽는다. 그 값은 **이미 Production 에 있고 서버 밖으로 나가지 않는다.**
 * 이 라우트는 기존 서버측 DB 접근 구조를 «그대로» 쓸 뿐, 키를 추가하거나
 * 어디로도 전달하지 않는다(CPO 보안 조건).
 *
 * ── 하는 일과 하지 않는 일 ────────────────────────────────────────────────
 *   한다:    SELECT 한 번. 고시 칸을 «분류» 해서 비교표로 돌려준다.
 *   안 한다: POST · PUT · PATCH · DELETE — 한 줄도 없다.
 *   안 한다: INSERT · UPDATE · DELETE — 쿼리는 `.select()` 하나뿐이다.
 *   안 한다: payload/response 원문 노출(`summarize.ts` 가 막는다).
 *   안 한다: 「그래서 KC 문구가 필수다」라는 판정 — 세는 것까지만.
 *
 * ── 🔴 왜 «분류» 만 돌려주는가 ─────────────────────────────────────────────
 * 고시 칸 중에는 전화번호가 들어가는 칸이 있다(`"소비자상담 관련 전화번호"`).
 * content 를 전부 돌려주는 설계였다면 그 번호가 응답에 실렸을 것이다.
 * `summarize.ts` 주석 참고.
 *
 * ── 실패 응답 ─────────────────────────────────────────────────────────────
 * 토큰 «설정» 이 없으면 404 — 형제 라우트(`coupang-product-get-raw`)와 같은
 * fail-closed 다. 라우트가 «존재하지 않는 것처럼» 닫는다.
 * 토큰이 틀리거나 없으면 401 — CPO 지시 원문 「token 없이는 401」.
 * 🔴 둘 다 «열리지 않는다». 다른 것은 바깥에서 보이는 모양뿐이다.
 */
function authorize(request: Request): "OK" | "NOT_CONFIGURED" | "UNAUTHORIZED" {
  const expected = process.env.DEBUG_COUPANG_PROBE_TOKEN;
  /* 🔴 설정이 없으면 열지 않는다. 「설정이 없으니 일단 통과」는 이 프로젝트가
     이미 한 번 고친 실수다. */
  if (!expected) return "NOT_CONFIGURED";
  return request.headers.get("x-debug-token") === expected ? "OK" : "UNAUTHORIZED";
}

/** 한 번에 읽을 최대 시도 수. 전수 조사용이라 넉넉하되 무제한은 아니다. */
const MAX_LIMIT = 500;

export async function GET(request: Request) {
  const auth = authorize(request);
  if (auth === "NOT_CONFIGURED") return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (auth === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "NOT_CONFIGURED" }, { status: 200 });

  const { searchParams } = new URL(request.url);
  const requested = Number(searchParams.get("limit") ?? MAX_LIMIT);
  const limit = Number.isFinite(requested) ? Math.min(Math.max(1, requested), MAX_LIMIT) : MAX_LIMIT;

  /* 🔴 읽기 전용. 이 파일에 다른 쿼리는 없다. 그리고 `select("*")` 를 쓰지
     않는다 — 필요한 칸만 이름으로 적어야 나중에 칸이 늘어도 조용히 새지 않는다. */
  const { data, error } = await supabase
    .from("registration_attempts")
    .select("id, created_at, status, error_code, payload, response")
    .eq("platform", "coupang")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 200 });

  const views = (data ?? []).map((row) => toAttemptView(row as unknown as AttemptRow));
  return NextResponse.json({ summary: summarize(views), attempts: views });
}
