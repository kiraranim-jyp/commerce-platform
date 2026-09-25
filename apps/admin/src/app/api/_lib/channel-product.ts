import { getSupabaseAdmin } from "@/lib/supabase-admin";

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
