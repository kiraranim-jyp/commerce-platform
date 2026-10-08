import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { PlatformId } from "@commerce/shared";
/* 🔴 COMMERCE-LIFECYCLE-FINAL-02 — 「같은 상품인가」 판정을 새로 만들지 않는다.
   카테고리 추천 캐시가 같은 목적으로 이미 쓰는 정규화를 그대로 부른다. */
import { computeSourceUrlKey } from "./category-recommendation-cache";

/** 기등록 확인을 위해 훑는 스냅샷 창. 🔴 다 채우면 «모른다» 로 간다(아래). */
const SOURCE_SCAN_LIMIT = 1000;

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

  /* 🔴 A-IMPLEMENT(CPO 승인, 2026-10-08) — 형제 탐색을 «여기서 다시 짜지 않는다».
     `resolveSameSourceSnapshotIds` 가 그 일을 하고, 연결 복구(`findSiblingChannelConnections`)도
     «같은 함수» 를 부른다. 중복 차단과 연결 복구가 다른 기준을 쓰면 지금 고치는
     비대칭이 모양만 바뀌어 다시 생긴다. */
  const scan = await resolveSameSourceSnapshotIds(snapshotId);
  /* 🔴 「못 봤다」를 「없다」로 읽지 않는다 — 기존 규약 그대로 null(모른다). */
  if (scan.state === "UNKNOWN") return null;

  const { data, error } = await supabase
    .from("registration_attempts")
    .select("id")
    .in("snapshot_id", scan.snapshotIds)
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

/**
 * 🔴 같은 원본 상품으로 수집된 snapshot 들. **자기 자신을 포함한다.**
 *
 *   RESOLVED  이 목록이 전부다
 *   UNKNOWN   확인하지 «못했다» — 조회 실패 또는 스캔 창 포화
 *
 * 🔴 `UNKNOWN` 을 빈 목록으로 바꾸지 않는다. 못 본 것을 「없다」로 읽으면
 *    중복 차단과 연결 복구가 «동시에» 틀린다.
 */
export type SameSourceSnapshotScan =
  | { state: "RESOLVED"; snapshotIds: string[] }
  | { state: "UNKNOWN" };

export async function resolveSameSourceSnapshotIds(
  snapshotId: string | null | undefined,
): Promise<SameSourceSnapshotScan> {
  if (!snapshotId) return { state: "RESOLVED", snapshotIds: [] };
  const supabase = getSupabaseAdmin();
  if (!supabase) return { state: "UNKNOWN" };

  /* ══ 🔴 COMMERCE-LIFECYCLE-FINAL(CPO P0, 2026-09-29) ══════════════════════
     「이 스냅샷」이 아니라 «이 원본 상품» 으로 성공한 적이 있는가.

     Production 실측: 롯데ON 에 같은 상품이 «하나 더» 등록됐다. 추적해 보니
     버그가 아니라 설계의 빈틈이었다 —

       「새 상품 분석」 → 새 Product 정체성 발급(snapshot.ts 가 sourceUrl 로
       기존 Product 를 찾지 «않는다» — 자동 merge 금지, CPO 확정)
         → 새 Product 에는 channel_products 연결이 없다
         → resolveLifecycle 이 CREATE 로 내려간다
         → 이 함수가 «그 새 스냅샷» 만 보므로 priorSuccess=false
         → resolveCreateGate 가 ALLOW → 중복 등록

     마지막 빗장이 바로 여기였는데 재는 범위가 한 칸 좁았다.

     🔴 자동 merge 를 하는 것이 «아니다». 두 수집을 하나로 묶는 것은 여전히
     사람이 확인할 일이고(연결 복구 도구가 그 자리다), 이 함수는 여전히 «막는
     쪽으로만» 일한다. 바뀐 것은 질문의 범위 하나다.
     🔴 CPO 요구 그대로다: 「과거 등록 성공 기록이 있는데 연결 정보가 없으면,
     무조건 새로 등록해서는 안 된다.」 */
  const { data: snap, error: snapError } = await supabase
    .from("product_snapshots")
    .select("source_url, workspace_id")
    .eq("id", snapshotId)
    .maybeSingle();
  if (snapError) {
    console.warn("[attempts-summary] 원본 상품 확인 실패:", snapError.message);
    return { state: "UNKNOWN" };
  }

  let snapshotIds = [snapshotId];
  const sourceUrl = (snap as { source_url?: string | null } | null)?.source_url ?? null;
  if (sourceUrl) {
    const workspaceId = (snap as { workspace_id?: string | null } | null)?.workspace_id ?? null;
    /* 🔴 COMMERCE-LIFECYCLE-FINAL-02 ① — 문자열이 «똑같을» 때만 보면 우회된다.
       `?utm_source=...` 하나만 붙어도 다른 URL 이 되고, 그 순간 중복 차단이
       열린다(CPO 가 지목한 그 구멍이다).

       🔴 정규화를 새로 만들지 않는다. 같은 폴더의 `computeSourceUrlKey` 가
       이미 그 일을 하고 있고(`normalizeUrl` 이 쿼리스트링을 통째로 지운다 +
       Shopify locale 접두 제거), 카테고리 추천 캐시가 «같은 목적»(동일 상품
       판정)으로 이미 쓰고 있다. 판정 기준이 두 벌이 되면 한쪽만 조용히
       느슨해진다. */
    const key = computeSourceUrlKey(sourceUrl);
    let query = supabase
      .from("product_snapshots")
      .select("id, source_url")
      .order("created_at", { ascending: false })
      .limit(SOURCE_SCAN_LIMIT);
    /* 🔴 워크스페이스가 있으면 그 «안에서만» 본다 — 남의 등록 이력으로 내 등록을
       막지 않는다. 옛 행은 이 칸이 비어 있어 그때는 URL 만으로 본다. */
    if (workspaceId) query = query.eq("workspace_id", workspaceId);
    const { data: siblings, error: siblingError } = await query;
    if (siblingError) {
      console.warn("[attempts-summary] 같은 원본 상품 조회 실패:", siblingError.message);
      return { state: "UNKNOWN" };
    }
    const rows = (siblings ?? []) as { id: string; source_url: string | null }[];
    /* 🔴 창을 다 채웠다 = 더 오래된 것을 «보지 못했다». 못 본 것을 「없다」로
       읽으면 그 순간 중복의 문이 열린다 — 이 파일의 다른 실패 경로와 같은
       규약으로 «모른다»(null)를 낸다. 이 경고가 뜨면 그때가 정규화 컬럼 +
       인덱스를 만들 시점이다(migration 은 별건). */
    if (rows.length >= SOURCE_SCAN_LIMIT) {
      console.warn(`[attempts-summary] 스냅샷 스캔 한도(${SOURCE_SCAN_LIMIT}) 도달 — 기등록 여부를 확정할 수 없다`);
      return { state: "UNKNOWN" };
    }
    const ids = rows.filter((row) => row.source_url && computeSourceUrlKey(row.source_url) === key).map((row) => row.id);
    if (ids.length > 0) snapshotIds = [...new Set([snapshotId, ...ids])];
  }

  return { state: "RESOLVED", snapshotIds };
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
