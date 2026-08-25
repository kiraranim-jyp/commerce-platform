import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { PriceObservationRecord, PriceObservationSource } from "@commerce/pricing";

/**
 * N-4.01 Part E/I(대표님 지시) — price_observations(마이그레이션
 * 027_price_observations.sql) CRUD. comparison-shop.ts와 같은 패턴(supabase
 * admin 없으면 조용히 빈 배열/실패 반환, 에러는 throw하지 않고 warn만) —
 * 가격 수집 실패가 등록/파이프라인 다른 기능을 절대 막으면 안 된다(PART U
 * "가격 수집 실패 로그" 요구사항과 같은 이유).
 */
interface PriceObservationRow {
  id: string;
  snapshot_id: string;
  source: PriceObservationSource;
  source_label: string | null;
  source_product_url: string | null;
  /** N-4.06 — 마이그레이션 029에서 추가. 컬럼이 아직 반영 안 된 세션(스키마
   * 캐시 지연)에서도 select("*")가 이 필드를 그냥 undefined로 주므로 optional로
   * 받는다 — 없으면 null로 취급한다(크래시 방지). */
  source_ref_id?: string | null;
  currency: string;
  price_amount: number;
  shipping_cost_amount: number | null;
  tax_amount: number | null;
  exchange_rate: number | null;
  price_krw: number;
  /** N-4.18-G STEP G-1 — 마이그레이션 038에서 추가. source_ref_id와 같은
   * 이유로 optional(스키마 캐시 지연 세션에서도 크래시 방지). */
  sale_price_krw?: number | null;
  original_price_krw?: number | null;
  sold_out?: boolean | null;
  checked_at: string;
}

function toRecord(row: PriceObservationRow): PriceObservationRecord {
  return {
    id: row.id,
    snapshotId: row.snapshot_id,
    source: row.source,
    sourceLabel: row.source_label,
    sourceProductUrl: row.source_product_url,
    sourceRefId: row.source_ref_id ?? null,
    currency: row.currency,
    priceAmount: row.price_amount,
    shippingCostAmount: row.shipping_cost_amount,
    taxAmount: row.tax_amount,
    exchangeRate: row.exchange_rate,
    priceKrw: row.price_krw,
    salePriceKrw: row.sale_price_krw ?? null,
    originalPriceKrw: row.original_price_krw ?? null,
    soldOut: row.sold_out ?? null,
    checkedAt: row.checked_at,
  };
}

export interface NewPriceObservation {
  snapshotId: string;
  source: PriceObservationSource;
  sourceLabel?: string | null;
  sourceProductUrl?: string | null;
  /** N-4.06 — DOMESTIC_SHOP일 때 domestic_price_sources.id. */
  sourceRefId?: string | null;
  currency: string;
  priceAmount: number;
  shippingCostAmount?: number | null;
  taxAmount?: number | null;
  exchangeRate?: number | null;
  priceKrw: number;
  /** N-4.18-G STEP G-1 — 실측된 사이트(RULII 등)만 채운다, 없으면 undefined→null. */
  salePriceKrw?: number | null;
  originalPriceKrw?: number | null;
  soldOut?: boolean | null;
}

/** 한 번의 확인(수동 "지금 확인" 또는 daily cron)에서 나온 관측치 여러 개를
 * 한 번에 append한다 — 국내 시장가는 리스팅마다 1행이라 배치 insert가 기본. */
function toBaseRow(o: NewPriceObservation) {
  return {
    snapshot_id: o.snapshotId,
    source: o.source,
    source_label: o.sourceLabel ?? null,
    source_product_url: o.sourceProductUrl ?? null,
    source_ref_id: o.sourceRefId ?? null,
    currency: o.currency,
    price_amount: o.priceAmount,
    shipping_cost_amount: o.shippingCostAmount ?? null,
    tax_amount: o.taxAmount ?? null,
    exchange_rate: o.exchangeRate ?? null,
    price_krw: o.priceKrw,
  };
}

/** N-4.18-G STEP G-1(대표님 명시: "기존 가격비교/마진 계산 회귀가 발생하면
 * 안 됩니다") — 마이그레이션 038(sale_price_krw/original_price_krw/sold_out)이
 * 아직 반영 안 된 세션에서는 이 3개 컬럼을 포함한 insert가 "column not
 * found" 에러로 통째로 실패한다 — RULII뿐 아니라 모든 소스의 가격 저장이
 * 막히는 회귀였다(2026-08-25 프로덕션에서 실측 확인). 그 에러를 감지하면
 * 새 컬럼 없이 base row로 즉시 재시도해 기존 동작을 보존한다 — 마이그레이션
 * 013/014/017과 같은 "코드는 우아하게 저하, 마이그레이션 실행 전까지 새
 * 필드만 비어있음" 원칙. */
function isMissingColumnError(message: string): boolean {
  return /schema cache|column .* does not exist|could not find the .* column/i.test(message);
}

export async function recordPriceObservations(
  observations: NewPriceObservation[],
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  if (observations.length === 0) return { ok: true, count: 0 };
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, error: "Supabase가 설정되어 있지 않습니다." };

  const { error, count } = await supabase
    .from("price_observations")
    .insert(
      observations.map((o) => ({
        ...toBaseRow(o),
        sale_price_krw: o.salePriceKrw ?? null,
        original_price_krw: o.originalPriceKrw ?? null,
        sold_out: o.soldOut ?? null,
      })),
      { count: "exact" },
    );
  if (!error) return { ok: true, count: count ?? observations.length };
  if (!isMissingColumnError(error.message)) return { ok: false, error: error.message };

  const retry = await supabase
    .from("price_observations")
    .insert(observations.map(toBaseRow), { count: "exact" });
  if (retry.error) return { ok: false, error: retry.error.message };
  return { ok: true, count: retry.count ?? observations.length };
}

/** N-4.03 Part 22(대표님 지시) — daily cron이 같은 날 재실행(재시도/재배포 등)돼도
 * 같은 snapshot+source에 대해 중복 관측치를 쌓지 않도록 하는 멱등성 체크.
 * 조회 자체가 실패하면 "오늘 아직 없음"으로 취급한다 — 확인 실패 때문에
 * 정상적인 가격 수집까지 막으면 안 된다(PART U와 같은 원칙). */
export async function hasObservationToday(
  snapshotId: string,
  source: PriceObservationSource,
  now: Date = new Date(),
): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return false;
  const startOfDay = new Date(now);
  startOfDay.setUTCHours(0, 0, 0, 0);
  const { data, error } = await supabase
    .from("price_observations")
    .select("id")
    .eq("snapshot_id", snapshotId)
    .eq("source", source)
    .gte("checked_at", startOfDay.toISOString())
    .limit(1);
  if (error) {
    console.warn("[price-observations] 오늘자 관측 확인 실패:", error.message);
    return false;
  }
  return (data?.length ?? 0) > 0;
}

/** source를 지정하면 그 소스만, 지정하지 않으면 전체 이력을 최신순으로 돌려준다. */
export async function getPriceHistory(
  snapshotId: string,
  source?: PriceObservationSource,
  limit = 60,
): Promise<PriceObservationRecord[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];
  let query = supabase
    .from("price_observations")
    .select("*")
    .eq("snapshot_id", snapshotId)
    .order("checked_at", { ascending: false })
    .limit(limit);
  if (source) query = query.eq("source", source);
  const { data, error } = await query;
  if (error) {
    console.warn("[price-observations] 이력 조회 실패:", error.message);
    return [];
  }
  return (data as PriceObservationRow[]).map(toRecord);
}
