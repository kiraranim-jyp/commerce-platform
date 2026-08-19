import { getSupabaseAdmin } from "@/lib/supabase-admin";

/** Sprint B-1(CPO 지시) — "JOB-260819-001" 형식. 날짜는 KST 기준(한국 셀러가
 * 보는 날짜와 어긋나면 자정 근처에 번호가 헷갈린다) — UTC 자정이 아니라
 * Asia/Seoul 자정에 카운터가 넘어가야 한다. */
function kstDateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}${get("month")}${get("day")}`;
}

/** 같은 날짜(KST) 안에서 1부터 증가하는 번호를 원자적으로 채번한다 —
 * next_job_key_counter()(마이그레이션 025)가 Postgres
 * INSERT ... ON CONFLICT DO UPDATE ... RETURNING으로 동시 요청에서도 중복을
 * 만들지 않는다(애플리케이션에서 SELECT COUNT 후 +1 하는 방식은 두 요청이
 * 동시에 같은 카운트를 읽으면 같은 번호를 낼 수 있어 쓰지 않았다).
 *
 * Supabase가 설정되어 있지 않거나(로컬 개발) RPC가 실패하면(마이그레이션
 * 미실행 등) null을 반환한다 — 호출부가 job_key 없이도 스냅샷 저장 자체는
 * 계속 진행하게 한다(job_key는 추적 편의 기능이지 저장을 막는 필수 관문이
 * 아니다).
 */
export async function generateJobKey(date: Date = new Date()): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const dateKey = kstDateKey(date);
  const { data, error } = await supabase.rpc("next_job_key_counter", { p_date_key: dateKey });
  if (error || typeof data !== "number") {
    console.warn("[job-key] 채번 실패:", error?.message);
    return null;
  }
  return `JOB-${dateKey}-${String(data).padStart(3, "0")}`;
}
