import { getSupabaseAdmin } from "@/lib/supabase-admin";
/* 🔴 형제 탐색 기준을 복제하지 않는다 — 중복 차단이 쓰는 그 함수를 그대로 부른다. */
import { resolveSameSourceSnapshotIds } from "@/app/api/snapshots/_lib/attempts-summary";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-CHANNEL-03 F-5(CPO 확정, 2026-09-25) — **현재 연결을 한 곳에서 다룬다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 세 채널 어댑터가 각자 DB 를 건드리면 「쿠팡만 ChannelProduct 를 안 만드는」
 * 같은 상태가 생긴다. 등록 결과를 DB 에 반영하는 일은 이 파일에만 있다.
 *
 * ── 🔴 ChannelProduct 와 RegistrationAttempt 는 다른 것이다 ────────────────
 *     ChannelProduct        «지금» 어느 외부 상품과 연결돼 있는가  (상태)
 *     RegistrationAttempt   무엇을 시도했는가                     (이력)
 * 「마지막 attempt = 현재 상태」라는 가정이 SmartStore 외부번호 6개를 만들었다.
 *
 * ── 🔴 성공했을 때만 «현재 연결» 이 된다 ──────────────────────────────────
 * 실패한 시도는 attempt 에만 남고 ChannelProduct 를 만들지도 바꾸지도 않는다.
 * 실패를 연결로 기록하면 다음에 CREATE 가 막혀 셀러가 영영 등록하지 못한다.
 */

export interface ChannelProductRow {
  id: string;
  productId: string;
  channel: string;
  externalProductId: string;
  /** 🔴 기본값 UNKNOWN. 외부 상태를 «조회하는 코드가 없다» — 모르는 것을
   *  LIVE 라고 적지 않는다(API 성공 ≠ 마켓에서 판매 중). */
  status: string;
}

/** 이 상품 × 이 채널로 지금 나가 있는 외부 상품. 없으면 null. */
export async function findChannelProduct(
  productId: string,
  channel: string,
): Promise<ChannelProductRow | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("channel_products")
    .select("id, product_id, channel, external_product_id, status")
    .eq("product_id", productId)
    .eq("channel", channel)
    /* 🔴 UNIQUE(product_id, channel) 을 «아직» 걸지 않았다(기존 중복 9건 때문).
       그래서 여러 행이 나올 수 있다 — 가장 최근 것을 «현재» 로 본다.
       single() 을 쓰면 그 경우 에러가 나서 등록 자체가 막힌다. */
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as {
    id: string; product_id: string; channel: string; external_product_id: string; status: string;
  };
  return {
    id: row.id,
    productId: row.product_id,
    channel: row.channel,
    externalProductId: row.external_product_id,
    status: row.status,
  };
}

/**
 * CREATE 성공 — 새 연결을 만든다.
 *
 * 🔴 성공했을 때만 부른다. 실패한 시도로 연결을 만들면 다음 CREATE 가 막힌다.
 */
export async function linkChannelProduct(input: {
  productId: string;
  channel: string;
  externalProductId: string;
}): Promise<ChannelProductRow | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("channel_products")
    .insert({
      /* 🔴 F-12d — `id` 를 «직접» 채운다. 063 이 `id TEXT PRIMARY KEY` 로
         만들었고 DEFAULT 가 없다(product_snapshots 와 달리 gen_random_uuid()
         가 붙어 있지 않다). 비우면 NOT NULL 위반으로 «항상» 실패하고, 아래
         에서 console.warn 후 null 을 내므로 조용히 지나간다 —
         그래서 ChannelProduct 가 지금까지 «한 건도» 만들어지지 않았다. */
      id: crypto.randomUUID(),
      product_id: input.productId,
      channel: input.channel,
      external_product_id: input.externalProductId,
      /* 🔴 status 를 LIVE 로 적지 않는다 — 등록 성공이 「판매 중」을 뜻하지
         않는다(검수중일 수 있다). 외부 상태 조회가 생기면 그때 채운다. */
    })
    .select("id, product_id, channel, external_product_id, status")
    .single();
  if (error || !data) {
    console.warn("[channel-product] link 실패:", error?.message);
    return null;
  }
  const row = data as {
    id: string; product_id: string; channel: string; external_product_id: string; status: string;
  };
  return {
    id: row.id, productId: row.product_id, channel: row.channel,
    externalProductId: row.external_product_id, status: row.status,
  };
}

/**
 * RECREATE 성공 — «현재» 연결을 새 외부 상품으로 갈아끼운다.
 *
 * 🔴 옛 external_product_id 를 지우지 않는다. 그 값은
 * `registration_attempts`(operation='RECREATE' 행)에 그대로 남아 있고, 그것이
 * 이력이다. 별도 previous_* 칸을 두면 3회 이상 재등록 시 가장 오래된 번호를
 * 잃는다(CPO 확정).
 *
 * 🔴 외부 상품 자체는 «지우지 않는다». 옛 상품은 마켓에 그대로 있고, 그것을
 * 어떻게 할지는 셀러의 사업 판단이다.
 */
export async function replaceChannelProductLink(
  channelProductId: string,
  newExternalProductId: string,
): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return false;
  const { error } = await supabase
    .from("channel_products")
    .update({
      external_product_id: newExternalProductId,
      status: "UNKNOWN",
      updated_at: new Date().toISOString(),
    })
    .eq("id", channelProductId);
  if (error) console.warn("[channel-product] replace 실패:", error.message);
  return !error;
}

/** UPDATE 성공 — 외부 상품은 그대로이고 «시각만» 갱신한다. */
export async function touchChannelProduct(channelProductId: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return false;
  const { error } = await supabase
    .from("channel_products")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", channelProductId);
  return !error;
}

/**
 * P0-CHANNEL-03 F-5 후속 — snapshot 으로부터 «현재 연결» 을 찾는다.
 *
 * 🔴 라우트가 이 한 함수만 부르면 된다. 세 채널이 각자
 * 「snapshot → product_id → channel_products」를 다시 짜면 한 채널만 빠뜨리는
 * 일이 생긴다.
 *
 * 🔴 `product_id` 가 없으면(기존 381 snapshot) `null` 을 낸다 — 연결이 없는
 * 것이지 오류가 아니다. 그 상품은 예전과 똑같이 CREATE 경로를 탄다.
 */
export async function findChannelProductBySnapshot(
  snapshotId: string | null | undefined,
  channel: string,
): Promise<ChannelProductRow | null> {
  if (!snapshotId) return null;
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const { data } = await supabase
    .from("product_snapshots")
    .select("product_id")
    .eq("id", snapshotId)
    .maybeSingle();
  const productId = (data as { product_id?: string | null } | null)?.product_id;
  if (!productId) return null;
  return findChannelProduct(productId, channel);
}

/**
 * P0-CHANNEL-03 F-10 — 이 snapshot 의 «모든 채널» 연결을 한 번에.
 *
 * 🔴 화면이 세 채널을 각각 물으면 쿼리가 세 번 나가고, 그보다 나쁜 것은 한
 * 채널만 빠뜨리기 쉬워진다는 것이다. 한 번에 읽어 한 번에 준다.
 *
 * 🔴 `hasProductIdentity` 를 «같이» 낸다. 연결이 없다는 사실만으로는
 * 「이 채널에 안 나가 있다」와 「애초에 정체성이 없어 연결할 수단이 없었다」
 * (기존 381건)를 구분할 수 없는데, 화면은 그 둘에 다르게 반응해야 한다.
 */
export interface SnapshotChannelProducts {
  /** 🔴 이 snapshot 이 Product 에 속해 있는가. 기존 381건은 false. */
  hasProductIdentity: boolean;
  /** 채널 → 현재 연결. 🔴 없는 채널은 «키 자체가 없다» — 없는 것을 값으로 만들지 않는다. */
  byChannel: Record<string, ChannelProductRow>;
}

export async function findChannelProductsBySnapshot(
  snapshotId: string | null | undefined,
): Promise<SnapshotChannelProducts> {
  const empty: SnapshotChannelProducts = { hasProductIdentity: false, byChannel: {} };
  const productId = await findProductIdBySnapshot(snapshotId);
  if (!productId) return empty;

  const supabase = getSupabaseAdmin();
  if (!supabase) return empty;
  const { data, error } = await supabase
    .from("channel_products")
    .select("id, product_id, channel, external_product_id, status")
    .eq("product_id", productId)
    /* 🔴 UNIQUE(product_id, channel) 을 아직 걸지 않았다(기존 중복 9건).
       채널마다 «가장 최근» 한 건을 현재로 본다 — findChannelProduct 와 같은 규칙. */
    .order("updated_at", { ascending: false });

  if (error) {
    /* 🔴 조회 실패를 「연결 없음」으로 내려보내면 이미 등록된 상품이 화면에서
       「미등록」이 되고 셀러가 두 번 등록한다. 호출부가 실패를 «실패로» 다룰 수
       있어야 하므로 여기서 삼키지 않고 던진다. */
    console.warn("[channel-product] snapshot 연결 조회 실패:", error.message);
    throw new Error(error.message);
  }

  const byChannel: Record<string, ChannelProductRow> = {};
  for (const raw of (data ?? []) as {
    id: string; product_id: string; channel: string; external_product_id: string; status: string;
  }[]) {
    if (byChannel[raw.channel]) continue; // 이미 더 최근 것을 봤다(내림차순 전제).
    byChannel[raw.channel] = {
      id: raw.id,
      productId: raw.product_id,
      channel: raw.channel,
      externalProductId: raw.external_product_id,
      status: raw.status,
    };
  }
  return { hasProductIdentity: true, byChannel };
}

/**
 * ════════════════════════════════════════════════════════════════════════════
 * A-IMPLEMENT(CPO 승인, 2026-10-08) — **「이미 등록됨」 다음 칸을 만든다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 고치는 것은 중복 «감지» 가 아니다. 감지는 정확히 동작했다(Production 실측:
 *    JOB-261008-003 이 BLOCKED_PRIOR_SUCCESS 로 막혔고, 그게 맞았다). 문제는
 *    **두 질문의 축이 달랐다** 는 것이다:
 *
 *      중복 감지   source URL 키 × workspace × platform  → 형제 전수를 본다 (넓다)
 *      연결 탐색   snapshot → product_id → channel_products → 자기만 본다 (좁다)
 *
 *    그래서 「이미 나가 있다」는 알아도 「어디에 나가 있는지」는 말할 수 없었다.
 *    실측: 74개 (JOB, 채널) 쌍 · 36 JOB 이 이 상태다.
 *
 * 🔴 **새 기준을 만들지 않는다.** `resolveSameSourceSnapshotIds` 를 그대로 쓴다 —
 *    중복 차단이 쓰는 그 함수다. 두 벌이 되면 한쪽만 조용히 느슨해진다.
 * 🔴 **Product 를 합치지 않는다.** 자동 merge 금지(CPO 확정)는 그대로다. 여기서
 *    하는 일은 연결을 «찾아 보여주는» 것뿐이고, 실제 연결은 셀러가 누른다.
 */
/**
 * 🔴 CPO 결정 ㉮(2026-10-08) — **연결을 «옮기지» 않고, 기존 작업으로 보낸다.**
 *
 * 처음엔 「찾은 외부번호로 link 라우트를 호출한다」로 설계했는데 **틀렸다**.
 * `linkLegacyRegistration` 은 외부번호로 대상 snapshot 을 고르고(의도된 설계),
 * 그 번호는 이미 형제 Product 에 물려 있어 `alreadyLinked` 로 끝난다. 그리고
 * 억지로 옮기면 두 Product 가 한 외부상품을 가리켜 다음 UPDATE 가 어느 기준으로
 * 나갈지 알 수 없게 된다 — 함수가 그것을 막는 것이 옳다.
 *
 * 🟢 쓰기가 «필요 없는» 길이 있다: 형제 JOB 은 연결을 이미 다 갖고 있어
 *    `resolveLifecycle` 이 바로 UPDATE 로 간다. 그 작업으로 **이동** 시킨다.
 */
export interface SiblingConnectionTarget {
  connection: ChannelProductRow;
  /** 🔴 셀러가 «이동할» 작업. 이것이 없으면 안내할 곳이 없다. */
  jobKey: string | null;
  snapshotId: string;
}

export type SiblingConnectionScan =
  /** 형제에도 이 채널 연결이 없다 — 수동 복구가 필요하다. */
  | { state: "NONE" }
  /** 🔴 후보가 «정확히 하나». 이것만 이동 안내로 보낸다. */
  | { state: "FOUND"; connection: ChannelProductRow; target: SiblingConnectionTarget }
  /** 🔴 후보가 둘 이상 — 어느 쪽이 맞는지 «우리가 정하지 않는다». */
  | { state: "AMBIGUOUS"; connections: ChannelProductRow[] }
  /** 🔴 확인하지 «못했다». 모르는 것을 「없다」로 적지 않는다. */
  | { state: "UNKNOWN" };

export async function findSiblingChannelConnections(
  snapshotId: string | null | undefined,
  channel: string,
): Promise<SiblingConnectionScan> {
  const scan = await resolveSameSourceSnapshotIds(snapshotId);
  if (scan.state === "UNKNOWN") return { state: "UNKNOWN" };
  /* 자기 자신만 있으면 형제가 없다 — 조회할 것이 없다. */
  const siblingIds = scan.snapshotIds.filter((id) => id !== snapshotId);
  if (siblingIds.length === 0) return { state: "NONE" };

  const supabase = getSupabaseAdmin();
  if (!supabase) return { state: "UNKNOWN" };

  const { data: snaps, error: snapError } = await supabase
    .from("product_snapshots")
    /* 🔴 `job_key` 를 «같이» 읽는다 — 셀러에게 「어느 작업으로 가라」를 말하려면
       번호만으로는 부족하다(CPO ㉮). 없으면 null 로 남긴다, 지어내지 않는다. */
    .select("id, product_id, job_key")
    .in("id", siblingIds)
    /* 가장 최근 형제를 먼저 본다 — 같은 외부상품을 가리키는 형제가 여럿이면
       최신 작업으로 안내하는 것이 셀러가 기대하는 쪽이다. */
    .order("created_at", { ascending: false });
  if (snapError) {
    console.warn("[channel-product] 형제 snapshot 조회 실패:", snapError.message);
    return { state: "UNKNOWN" };
  }
  const ownProductId = await findProductIdBySnapshot(snapshotId);
  const siblingRows = ((snaps ?? []) as { id: string; product_id?: string | null; job_key?: string | null }[]).filter(
    (row) => Boolean(row.product_id) && row.product_id !== ownProductId,
  );
  /** productId → 그 상품이 속한 형제 작업. 🔴 이동 안내의 근거다. */
  const originByProduct = new Map<string, { jobKey: string | null; snapshotId: string }>();
  for (const row of siblingRows) {
    if (originByProduct.has(row.product_id!)) continue; // 이미 더 최근 것을 봤다.
    originByProduct.set(row.product_id!, { jobKey: row.job_key ?? null, snapshotId: row.id });
  }
  const productIds = [...originByProduct.keys()];
  if (productIds.length === 0) return { state: "NONE" };

  const { data, error } = await supabase
    .from("channel_products")
    .select("id, product_id, channel, external_product_id, status")
    .in("product_id", productIds)
    .eq("channel", channel)
    .order("updated_at", { ascending: false });
  if (error) {
    console.warn("[channel-product] 형제 연결 조회 실패:", error.message);
    return { state: "UNKNOWN" };
  }

  return classifySiblingConnectionRows(
    (data ?? []) as {
      id: string; product_id: string; channel: string; external_product_id: string; status: string;
    }[],
    originByProduct,
  );
}

/**
 * 🔴 **순수 함수로 뽑아 둔다.** DB 모킹 없이 「후보를 무엇으로 세는가」를 동작으로
 *    검증할 수 있어야 한다 — 소스 문자열 검사로는 이 규칙이 깨져도 통과한다
 *    (실제로 mutation M4 가 그걸 증명했다).
 *
 * 🔴 **외부 상품번호로 센다**, 행 수로 세지 않는다. 형제 Product 가 여러 개여도
 *    같은 외부 상품을 가리키면 후보는 «하나» 다 — 실측이 바로 그 모양이다
 *    (JOB-260928-006 의 형제 다수 → smartstore 13719076772 «한 번호»). 행으로
 *    세면 멀쩡한 1건이 AMBIGUOUS 로 막혀 셀러가 또 막다른 길에 선다.
 *
 * 🔴 입력은 `updated_at` 내림차순 전제다 — 같은 번호가 여러 행이면 «가장 최근» 을
 *    남긴다(`findChannelProduct` 와 같은 규칙).
 */
export function classifySiblingConnectionRows(
  rows: { id: string; product_id: string; channel: string; external_product_id: string | null; status: string }[],
  /** productId → 그 상품이 속한 형제 작업. 🔴 FOUND 의 «이동 목적지» 근거다. */
  originByProduct?: Map<string, { jobKey: string | null; snapshotId: string }>,
): SiblingConnectionScan {
  const byExternalId = new Map<string, ChannelProductRow>();
  for (const raw of rows) {
    if (!raw.external_product_id) continue;
    if (byExternalId.has(raw.external_product_id)) continue; // 더 최근 것을 이미 봤다.
    byExternalId.set(raw.external_product_id, {
      id: raw.id,
      productId: raw.product_id,
      channel: raw.channel,
      externalProductId: raw.external_product_id,
      status: raw.status,
    });
  }
  const connections = [...byExternalId.values()];
  if (connections.length === 0) return { state: "NONE" };
  if (connections.length === 1) {
    const only = connections[0];
    const origin = originByProduct?.get(only.productId);
    /* 🔴 이동할 곳을 모르면 FOUND 로 올리지 않는다. 「찾았다」고 말하고 갈 곳을
       안 주면 셀러는 또 막다른 길에 선다 — 그건 고치기 전과 같은 상태다. */
    if (!origin) return { state: "AMBIGUOUS", connections };
    return { state: "FOUND", connection: only, target: { connection: only, ...origin } };
  }
  return { state: "AMBIGUOUS", connections };
}

/**
 * snapshot 이 속한 Product. 없으면 null(기존 381건).
 * 🔴 여기서 «만들지» 않는다 — Product 발급은 최초 수집 한 곳에만 있다.
 */
export async function findProductIdBySnapshot(
  snapshotId: string | null | undefined,
): Promise<string | null> {
  if (!snapshotId) return null;
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const { data } = await supabase
    .from("product_snapshots")
    .select("product_id")
    .eq("id", snapshotId)
    .maybeSingle();
  return (data as { product_id?: string | null } | null)?.product_id ?? null;
}
