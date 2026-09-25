import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-CHANNEL-03 F-12 추적 — **방금 누른 등록이 «무엇» 이었는가.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 *     최근 attempt → payload 의 salePrice → snapshot → Product
 *                  → ChannelProduct → 실제 외부 상품번호
 *                  → CREATE 인가 UPDATE 인가 → PUT 까지 갔는가
 *
 * ── 🔴 왜 라우트인가 ────────────────────────────────────────────────────
 * 이 역추적은 DB 조회가 전부인데, service-role 키는 모든 RLS 를 우회하는
 * 열쇠라 사람 손에 옮길 물건이 아니다. 이미 로그인한 세션으로 «자기
 * 워크스페이스의» 이력만 읽는다.
 *
 * ── 🔴 읽기 전용이다 ────────────────────────────────────────────────────
 * insert/update/delete 가 한 줄도 없다. 진단하다가 상태를 바꾸면 그 진단은
 * 더 이상 「방금 무슨 일이 있었나」를 말하지 못한다.
 *
 * ── 🔴 판정을 «지어내지» 않는다 ─────────────────────────────────────────
 * operation 컬럼은 라우트가 실제로 한 일을 적은 값이다. 여기서 「external
 * _product_id 가 있으니 UPDATE 였겠지」 같은 추론을 하지 않는다 — 그 추론이
 * 이 스프린트 내내 고쳐 온 실수다. 값이 NULL 이면 NULL 이라고 말한다.
 *
 * 사용법(로그인 상태):
 *   GET /api/registration-attempts/trace?platform=smartstore&limit=5
 *   GET /api/registration-attempts/trace?salePrice=156900
 */

/** payload 깊숙이 있는 판매가를 «있는 그대로» 꺼낸다. 없으면 null. */
function readSalePrice(payload: unknown): number | null {
  const origin = (payload as { originProduct?: { salePrice?: unknown } } | null)?.originProduct;
  return typeof origin?.salePrice === "number" ? origin.salePrice : null;
}

/** 응답에서 네이버가 돌려준 상품번호. 🔴 없으면 없다고 한다. */
function readRespondedProductNo(response: unknown): string | null {
  const no = (response as { originProductNo?: unknown } | null)?.originProductNo;
  return no == null ? null : String(no);
}

export async function GET(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const platform = searchParams.get("platform") ?? "smartstore";
  const limit = Math.min(Number(searchParams.get("limit") ?? 5) || 5, 20);
  const salePriceFilter = searchParams.get("salePrice");

  const db = getSupabaseAdmin();
  if (!db) {
    return NextResponse.json({ ok: false, error: "저장소에 접근하지 못했습니다." }, { status: 503 });
  }

  /* 넉넉히 읽고 «소유한 것만» 남긴다 — 남의 이력이 섞이면 안 된다. */
  const { data: rows, error } = await db
    .from("registration_attempts")
    .select("id, created_at, platform, status, operation, external_product_id, channel_product_id, error_code, snapshot_id, payload, response")
    .eq("platform", platform)
    .order("created_at", { ascending: false })
    .limit(limit * 4);
  if (error) {
    return NextResponse.json({ ok: false, error: `이력 조회 실패: ${error.message}` }, { status: 503 });
  }

  type Row = {
    id: string; created_at: string; platform: string; status: string;
    operation: string | null; external_product_id: string | null; channel_product_id: string | null;
    error_code: string | null; snapshot_id: string | null; payload: unknown; response: unknown;
  };
  const all = (rows ?? []) as Row[];

  /* 🔴 소유권 — snapshot 의 workspace 로 거른다. snapshot_id 가 없는 행은
     소유를 «확인할 수 없으므로» 제외한다(확인 못 한 것을 보여주지 않는다). */
  const snapshotIds = [...new Set(all.map((r) => r.snapshot_id).filter(Boolean))] as string[];
  const ownedSnapshots = new Map<string, { productId: string | null; title: string | null }>();
  if (snapshotIds.length) {
    const { data: snaps } = await db
      .from("product_snapshots")
      .select("id, product_id, title, workspace_id")
      .in("id", snapshotIds)
      .eq("workspace_id", auth.user.workspaceId);
    for (const s of (snaps ?? []) as { id: string; product_id: string | null; title: string | null }[]) {
      ownedSnapshots.set(s.id, { productId: s.product_id, title: s.title });
    }
  }

  const owned = all.filter((r) => r.snapshot_id && ownedSnapshots.has(r.snapshot_id));
  const filtered = salePriceFilter
    ? owned.filter((r) => readSalePrice(r.payload) === Number(salePriceFilter))
    : owned;
  const picked = filtered.slice(0, limit);

  /* 현재 연결 — Product 기준으로 한 번에 읽는다. */
  const productIds = [...new Set(picked.map((r) => ownedSnapshots.get(r.snapshot_id!)?.productId).filter(Boolean))] as string[];
  const linksByProduct = new Map<string, { id: string; externalProductId: string; status: string }[]>();
  if (productIds.length) {
    const { data: cps } = await db
      .from("channel_products")
      .select("id, product_id, channel, external_product_id, status")
      .in("product_id", productIds)
      .eq("channel", platform);
    for (const cp of (cps ?? []) as { id: string; product_id: string; external_product_id: string; status: string }[]) {
      const list = linksByProduct.get(cp.product_id) ?? [];
      list.push({ id: cp.id, externalProductId: cp.external_product_id, status: cp.status });
      linksByProduct.set(cp.product_id, list);
    }
  }

  /**
   * 🔴 필터가 «0건» 이어도 최근 이력을 같이 보여준다.
   *
   * salePrice 필터는 `payload.originProduct.salePrice` 를 읽는데, payload 가
   * 만들어지기 «전» 에 실패한 시도(인증·카테고리·컨텍스트 실패)는 payload 자체가
   * 없어서 절대 매칭되지 않는다. 그 상태로 `matched: 0` 만 보여주면 읽는 사람은
   * 「요청이 서버까지 오지도 않았다」로 결론 내린다 — 실제로는 들어와서 초기에
   * 죽은 것인데. 진단이 잘못된 결론을 «유도하면» 진단이 아니다.
   */
  const fallback =
    salePriceFilter && filtered.length === 0
      ? owned.slice(0, limit)
      : [];

  const describe = (row: Row) => {
    const snap = ownedSnapshots.get(row.snapshot_id!)!;
    const links = snap.productId ? (linksByProduct.get(snap.productId) ?? []) : [];
    return {
      attemptId: row.id,
      at: row.created_at,
      status: row.status,
      /** 🔴 라우트가 «적은» 값 그대로. NULL 이면 NULL 이다 — 추론하지 않는다. */
      operation: row.operation,
      errorCode: row.error_code,
      /** payload 에 실제로 실린 판매가. 🔴 null 이면 payload 이전에 끝난 시도다. */
      sentSalePrice: readSalePrice(row.payload),
      payloadPresent: row.payload != null,
      externalProductId: row.external_product_id,
      respondedProductNo: readRespondedProductNo(row.response),
      channelProductId: row.channel_product_id,
      snapshot: { id: row.snapshot_id, title: snap.title, productId: snap.productId },
      currentLinks: links,
      observed: {
        operationRecorded:
          row.operation ?? "(비어 있음 — CREATE/UPDATE/RECREATE 중 아무것도 실행되지 않았다는 뜻)",
        naverReturnedProductNo: readRespondedProductNo(row.response) !== null,
        linkedToChannelProduct: row.channel_product_id !== null,
      },
    };
  };

  return NextResponse.json({
    ok: true,
    platform,
    /** 필터를 걸었으면 몇 건 중 몇 건인지 그대로 말한다. */
    fetched: all.length,
    scanned: owned.length,
    matched: filtered.length,
    /**
     * 🔴 `scanned: 0` 인데 `fetched > 0` 이면 «소유권에서 걸러진» 것이다.
     * 「이력이 없다」와 「내 것이 아니다」는 전혀 다른 답이라 구분해서 말한다.
     */
    note:
      all.length > 0 && owned.length === 0
        ? "이 플랫폼의 최근 이력은 있으나 현재 워크스페이스 소유가 아니거나 snapshot_id 가 없어 제외했습니다."
        : salePriceFilter && filtered.length === 0
          ? "해당 판매가로 기록된 시도가 없습니다 — payload 가 만들어지기 «전» 에 끝난 시도는 판매가가 없으므로, 아래 recentUnfiltered 를 함께 보세요."
          : undefined,
    /** 🔴 필터가 0건일 때만 채워진다 — 최근 이력 그대로(필터 없음). */
    recentUnfiltered: fallback.map(describe),
    /**
     * 🔴 `describe()` «하나» 로 만든다. 필터 결과와 fallback 이 서로 다른
     * 모양이면 읽는 사람이 두 표를 대조해야 하고, 그 순간 이 진단은 쓸모가
     * 줄어든다. 같은 칸, 같은 이름.
     */
    attempts: picked.map(describe),
  });
}
