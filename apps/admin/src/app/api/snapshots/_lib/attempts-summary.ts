import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { PlatformId } from "@commerce/shared";

/**
 * Sprint B-2(CPO 지시: "최근 작업 목록에서 플랫폼/현재상태/오류여부를 확인") —
 * "최근 작업" 목록은 최대 50건까지 한 번에 보여줘야 해서, 상품마다 무거운
 * computeSnapshotReadiness(Naver API 여러 번 호출)를 다시 도는
 * /api/dashboard/readiness 방식은 쓸 수 없다(그건 "오늘의 등록 준비"용으로
 * 이미 최대 20~30개로 제한돼 있다 — N-3.56 STEP1 조사 결과). 대신 이미 쌓여
 * 있는 registration_attempts만 한 번의 쿼리로 읽어서 스냅샷별로 집계한다 —
 * 새 판정 로직이 아니라 기존 이력의 재조합이다.
 */
export interface SnapshotAttemptsSummary {
  /** SUBMITTED 이력이 한 번이라도 있는 플랫폼 — "실제로 등록된 적 있음". */
  registeredPlatforms: PlatformId[];
  /** 플랫폼별 가장 최근 시도가 FAILED인 경우가 하나라도 있으면 true —
   * "지금 이 상품에 뭔가 문제가 있다"를 뜻한다(과거에 실패했다가 나중에
   * 성공한 경우는 최신 시도만 보므로 오류로 잡지 않는다). */
  hasError: boolean;
  /** 이 스냅샷에 연결된 모든 시도(플랫폼 무관) 중 가장 최근 시간. */
  lastAttemptAt: string | null;
}

export interface AttemptRow {
  snapshot_id: string | null;
  platform: string;
  status: "SUBMITTED" | "FAILED";
  created_at: string;
}

/**
 * ════════════════════════════════════════════════════════════════════════════
 * N-06-B(CPO 승인, 2026-09-23) — **상품 하나의 «채널별 마지막 시도».**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 위 집계(`aggregateAttemptRows`)는 목록 화면용이라 「등록된 적 있는가」까지만
 * 센다. Master 상태 카드는 그보다 한 칸 더 말해야 한다 — 언제 · 상품번호 ·
 * 마지막에 왜 실패했는가.
 *
 * 🔴 새 판정을 만들지 않는다. 시각 내림차순으로 정렬된 행에서 채널마다 «처음
 * 만나는 행» 이 그 채널의 마지막 시도다 — 위 함수가 쓰는 규칙 그대로다.
 *
 * 🔴 없는 것을 지어내지 않는다. 이력이 없는 채널은 키 자체가 없고, 화면은 그때
 * 「미등록」이라고만 말한다(「등록 실패」가 아니다 — 시도한 적이 없다).
 */
export interface LastAttempt {
  status: "SUBMITTED" | "FAILED";
  at: string;
  externalProductId: string | null;
  errorCode: string | null;
}

export interface LastAttemptRow extends AttemptRow {
  external_product_id: string | null;
  error_code: string | null;
}

/** 채널 키는 `PlatformId` 가 아니라 DB 의 platform 문자열 그대로다 — 롯데ON 포함. */
export function latestAttemptByPlatform(rows: LastAttemptRow[]): Record<string, LastAttempt> {
  const out: Record<string, LastAttempt> = {};
  for (const row of rows) {
    if (out[row.platform]) continue; // 이미 더 최근 것을 봤다(내림차순 정렬 전제).
    out[row.platform] = {
      status: row.status,
      at: row.created_at,
      externalProductId: row.external_product_id ?? null,
      errorCode: row.error_code ?? null,
    };
  }
  return out;
}

/**
 * Sprint D(CPO 지시: "SmartStore/Coupang 실제 등록 상태 분리") — 스냅샷 하나가
 * 두 플랫폼 모두에 시도 이력을 가질 수 있고, 한쪽만 성공/실패해도 서로 절대
 * 섞이면 안 된다(플랫폼별 registeredPlatforms/hasError가 독립적으로 계산돼야
 * 함). DB 조회를 순수 집계 로직에서 분리해서 검증 가능하게 만든다
 * (apps/admin/scripts/verify-attempts-summary.ts에서 단위 검증).
 */
export function aggregateAttemptRows(rows: AttemptRow[]): Record<string, SnapshotAttemptsSummary> {
  const result: Record<string, SnapshotAttemptsSummary> = {};
  // created_at 내림차순으로 이미 정렬돼 있으므로, (snapshot_id, platform) 쌍을
  // 처음 만나는 순간이 그 플랫폼의 "가장 최근 시도"다.
  const seenPlatformPerSnapshot = new Set<string>();
  for (const row of rows) {
    if (!row.snapshot_id) continue;
    const platformKey = `${row.snapshot_id}:${row.platform}`;
    const isLatestForPlatform = !seenPlatformPerSnapshot.has(platformKey);
    if (isLatestForPlatform) seenPlatformPerSnapshot.add(platformKey);

    const entry = (result[row.snapshot_id] ??= {
      registeredPlatforms: [],
      hasError: false,
      lastAttemptAt: null,
    });
    if (!entry.lastAttemptAt || row.created_at > entry.lastAttemptAt) entry.lastAttemptAt = row.created_at;
    if (row.status === "SUBMITTED" && !entry.registeredPlatforms.includes(row.platform as PlatformId)) {
      entry.registeredPlatforms.push(row.platform as PlatformId);
    }
    if (isLatestForPlatform && row.status === "FAILED") entry.hasError = true;
  }
  return result;
}

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-CHANNEL-03 F-12 후속(2026-09-25) — **연결이 없어도 «이미 나가 있을» 수 있다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * F-12 준비 중 발견한 구멍이다. 지금까지 세 register 라우트는 중복을
 * `channel_products` 하나로만 막았다. 그런데 연결이 «없는데» 이미 마켓에 나가
 * 있는 상품이 실재한다:
 *
 *   ① 기존 381 snapshot — product_id 가 NULL 이라 연결을 «가질 수 없다».
 *      🔴 13713593585 가 바로 이 경우다(063 마이그레이션 이전 등록).
 *   ② 연결 기록 유실 — 등록은 성공했는데 ChannelProduct insert 가 실패한 경우.
 *      라우트가 «조용히» 지나가도록 설계돼 있어서 실제로 생길 수 있다.
 *
 * 그 상태로 등록을 다시 부르면 `findChannelProductBySnapshot` 이 null 을 내고,
 * 라우트는 「안 나가 있다」고 읽어 **CREATE 로 내려간다** — 마켓에 상품이 하나
 * 더 생긴다. SmartStore 외부번호 6개가 만들어진 경로 그대로다.
 *
 * 🔴 화면(F-10 `ATTEMPT_ONLY`)은 이미 이것을 막고 있었다. 그러나 서버는 이력을
 * «읽지도 않았다» — 마지막 방어선이 화면에만 있으면 그것은 방어선이 아니다.
 *
 * 🔴 「마지막 시도」가 아니라 «한 번이라도 성공했는가» 를 본다. 화면보다
 * 엄격하다(화면은 최신 시도만 본다). 성공 뒤 실패가 이어져도 상품은 이미
 * 마켓에 있기 때문이다.
 *
 * 🔴 이력과 상태를 «섞는 것이 아니다». 상태의 근거는 여전히 ChannelProduct 다.
 * 이력은 오직 「막는 쪽으로만」 일한다 — 이 함수가 내는 답은 CREATE 를
 * «허용» 하는 데 쓰이지 않는다(true·null 이면 막고, false 일 때만 지나간다).
 */
export async function hasPriorSuccessfulAttempt(
  snapshotId: string | null | undefined,
  platform: string,
): Promise<boolean | null> {
  /* 🔴 snapshot 이 없으면 «이 스냅샷으로» 성공한 적이 있는지 물을 수 없다.
     여기서 null(확인 불가)을 내면 스냅샷 없이 등록하는 기존 흐름이 전부
     막힌다 — 이 함수가 고치려는 문제가 아니다. false 를 낸다. */
  if (!snapshotId) return false;
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("registration_attempts")
    .select("id")
    .eq("snapshot_id", snapshotId)
    .eq("platform", platform)
    .eq("status", "SUBMITTED")
    .limit(1);
  /* 🔴 조회 실패를 「성공한 적 없다」로 내려보내지 않는다. 그렇게 하면 DB 가
     흔들릴 때마다 중복 등록의 문이 열린다 — 확인하지 «못했다» 고 말한다. */
  if (error) {
    console.warn("[attempts-summary] 기등록 확인 실패:", error.message);
    return null;
  }
  return (data?.length ?? 0) > 0;
}

export async function getAttemptsSummaryBySnapshot(
  snapshotIds: string[],
): Promise<Record<string, SnapshotAttemptsSummary>> {
  if (snapshotIds.length === 0) return {};
  const supabase = getSupabaseAdmin();
  if (!supabase) return {};

  const { data, error } = await supabase
    .from("registration_attempts")
    .select("snapshot_id, platform, status, created_at")
    .in("snapshot_id", snapshotIds)
    .order("created_at", { ascending: false });
  if (error || !data) {
    if (error) console.warn("[attempts-summary] 조회 실패:", error.message);
    return {};
  }
  return aggregateAttemptRows(data as AttemptRow[]);
}
