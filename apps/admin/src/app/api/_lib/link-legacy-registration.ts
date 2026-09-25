import type { getSupabaseAdmin } from "@/lib/supabase-admin";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-CHANNEL-03 F-12a(CTO 지시) — **기존 등록 하나를 새 Identity 구조에 «잇는다».**
 * ════════════════════════════════════════════════════════════════════════════
 *
 *     기존 Snapshot → Product → ChannelProduct(channel, external_product_id)
 *
 * 🔴 왜 라이브러리로 뺐나: 같은 일을 스크립트(service-role 키 필요)와 라우트
 * (로그인한 관리자)가 «둘 다» 해야 하는데, 두 벌로 두면 한쪽에만 안전 검사가
 * 빠진다. 이 스프린트가 내내 고쳐 온 실수가 정확히 그것이다. 검사는 여기 한 곳에.
 *
 * ── 🔴 하지 않는 것(CTO 금지선을 코드로 못 박는다) ──────────────────────
 *   · source URL 기반 매칭 — 근거는 `registration_attempts.external_product_id`
 *     하나뿐이다. URL 은 «보지도 않는다»(PHASE D-2: URL 은 식별자가 아니다).
 *   · 다른 snapshot 자동 연결 · 중복 상품 병합 · attempts 일괄 backfill
 *   · 기존 Production 상품 재등록 · previous_external_product_id 추가
 *   · 🔴 기존 행의 «의미» 변경 — 이것은 «현재 상태» 복구이지 이력 재작성이 아니다.
 *
 * ── 🔴 기본은 계획만 세운다 ─────────────────────────────────────────────
 * `apply` 를 «명시» 해야 쓴다. Production DB 에 쓰는 코드의 기본값은
 * 「안 쓴다」여야 한다 — 실수로 부르는 일은 반드시 한 번 생긴다.
 */

type Db = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

export interface LegacyLinkPlan {
  snapshotId: string;
  snapshotTitle: string | null;
  workspaceId: string | null;
  /** 이미 있으면 그 id, 없으면 null(새로 만들어야 한다). */
  productId: string | null;
  successfulAttempts: number;
}

export type LegacyLinkResult =
  /** 🔴 한 줄이라도 어긋나면 여기서 끝난다. 「대충 맞으니 진행」이 중복을 만든다. */
  | { ok: false; stop: string }
  /** 할 일이 없다 — 이미 이어져 있다. */
  | { ok: true; alreadyLinked: true; plan: LegacyLinkPlan }
  /** 계획만 세웠다(쓰지 않았다). */
  | { ok: true; alreadyLinked: false; applied: false; plan: LegacyLinkPlan }
  /** 실제로 이었다. */
  | {
      ok: true;
      alreadyLinked: false;
      applied: true;
      plan: LegacyLinkPlan;
      verification: {
        snapshotProductId: string | null;
        channelProducts: { productId: string; channel: string; externalProductId: string; status: string }[];
      };
    };

const stop = (reason: string): LegacyLinkResult => ({ ok: false, stop: reason });

/**
 * @param expectWorkspaceId 있으면 그 워크스페이스의 snapshot 이 아닐 때 멈춘다.
 *   🔴 라우트(로그인 사용자)가 «남의» 상품을 잇지 못하게 하는 자물쇠다.
 *   스크립트(service-role)는 생략할 수 있다.
 */
export async function linkLegacyRegistration(
  db: Db,
  input: {
    externalProductId: string;
    channel: string;
    apply?: boolean;
    expectWorkspaceId?: string;
  },
): Promise<LegacyLinkResult> {
  const { externalProductId, channel, apply = false } = input;

  /* ── §1 대상 Snapshot 특정 — 근거는 «등록 이력» 하나뿐 ─────────────────
     🔴 source_url 로 찾지 않는다. URL 로 찾으면 중복 6건 중 엉뚱한 것을 집는다. */
  const { data: attempts, error: attemptErr } = await db
    .from("registration_attempts")
    .select("id, snapshot_id")
    .eq("external_product_id", externalProductId)
    .eq("platform", channel)
    .eq("status", "SUBMITTED");
  if (attemptErr) return stop(`등록 이력 조회 실패: ${attemptErr.message}`);
  if (!attempts?.length) {
    return stop(`${externalProductId} 로 성공한 등록 이력이 없습니다 — 연결할 근거가 없습니다.`);
  }
  const snapshotIds = [...new Set(attempts.map((a) => a.snapshot_id).filter(Boolean))] as string[];
  if (snapshotIds.length === 0) {
    return stop("성공 이력에 snapshot_id 가 없습니다 — 어느 상품인지 특정할 수 없습니다.");
  }
  if (snapshotIds.length > 1) {
    /* 🔴 여러 snapshot 이 같은 외부 상품을 가리키면 «사람이» 골라야 한다.
       재분석으로 갈라진 경우가 이것이고, 자동으로 고르면 그 선택이 영구 연결이 된다. */
    return stop(`같은 외부 상품을 가리키는 snapshot 이 ${snapshotIds.length}개입니다 — 사람이 골라야 합니다: ${snapshotIds.join(", ")}`);
  }
  const snapshotId = snapshotIds[0]!;

  const { data: snapRow, error: snapErr } = await db
    .from("product_snapshots")
    .select("id, product_id, workspace_id, title")
    .eq("id", snapshotId)
    .maybeSingle();
  if (snapErr) return stop(`snapshot 조회 실패: ${snapErr.message}`);
  if (!snapRow) return stop(`snapshot ${snapshotId} 을(를) 찾지 못했습니다.`);
  const snap = snapRow as { id: string; product_id: string | null; workspace_id: string | null; title: string | null };

  /* 🔴 소유권 — 남의 상품을 잇지 못한다. 라우트에서 반드시 넘긴다. */
  if (input.expectWorkspaceId && snap.workspace_id !== input.expectWorkspaceId) {
    return stop("이 상품은 현재 워크스페이스의 것이 아닙니다.");
  }

  const plan: LegacyLinkPlan = {
    snapshotId,
    snapshotTitle: snap.title,
    workspaceId: snap.workspace_id,
    productId: snap.product_id,
    successfulAttempts: attempts.length,
  };

  /* ── §5 충돌 검사 — «쓰기 전에» 전부 본다 ──────────────────────────────
     🔴 같은 external_product_id 가 다른 Product 에 붙어 있으면 절대 덮지 않는다. */
  const { data: sameExternal, error: sameErr } = await db
    .from("channel_products")
    .select("id, product_id")
    .eq("channel", channel)
    .eq("external_product_id", externalProductId);
  if (sameErr) return stop(`기존 연결 조회 실패: ${sameErr.message}`);
  if (sameExternal?.length) {
    const others = sameExternal.filter((r) => r.product_id !== snap.product_id);
    if (others.length) {
      return stop(`${externalProductId} 이(가) 이미 다른 Product 에 연결돼 있습니다 — 덮어쓰지 않습니다: ${others.map((r) => r.product_id).join(", ")}`);
    }
    return { ok: true, alreadyLinked: true, plan };
  }

  /* 🔴 이 Product 가 이미 «다른» 외부 상품에 연결돼 있으면 멈춘다 —
     덮으면 지금 팔리고 있는 상품과의 연결이 끊긴다. */
  if (snap.product_id) {
    const { data: otherLink, error: otherErr } = await db
      .from("channel_products")
      .select("external_product_id")
      .eq("product_id", snap.product_id)
      .eq("channel", channel);
    if (otherErr) return stop(`연결 조회 실패: ${otherErr.message}`);
    if (otherLink?.length) {
      return stop(`이 상품은 이미 ${channel} 의 다른 외부 상품에 연결돼 있습니다 — 덮어쓰지 않습니다: ${otherLink.map((r) => r.external_product_id).join(", ")}`);
    }
  }

  if (!snap.product_id && !snap.workspace_id) {
    /* 🔴 소유자를 모르는 Product 를 만들지 않는다 — 누구 것인지 알 수 없는
       행이 영구히 남는다(066 이 소유자를 필수로 만든 이유). */
    return stop("snapshot 에 workspace_id 가 없습니다 — 소유자를 모르는 Product 를 만들지 않습니다.");
  }

  if (!apply) return { ok: true, alreadyLinked: false, applied: false, plan };

  /* ── §2 Product ─────────────────────────────────────────────────────── */
  let productId = snap.product_id;
  if (!productId) {
    const { data: created, error: createErr } = await db
      /* 🔴 `products` 다 — `"Product"` 가 아니다.
         migration 065 가 `ALTER TABLE "Product" RENAME TO products` 로 바꿨는데
         이 파일이 옛 이름을 쓰고 있었다. Production 에서 실제로
         「Could not find the table 'public.Product'」로 터졌고, 그 바람에
         레거시 연결 복구가 «전부» 막혔다.
         🔴 타입 검사가 잡아 주지 않는 자리다 — Supabase 클라이언트는 테이블명을
         문자열로 받는다. 그래서 아래 테이블명 회귀 테스트로 대신 못 박았다
         (p0channel03-table-names.test.ts). */
      .from("products")
      .insert({
        /* 🔴 sourceUrl 을 채우지 않는다 — 식별자가 아니고, 채우면 다음 사람이
           그것으로 매칭하고 싶어진다(PHASE D-2 §2·3). */
        title: snap.title ?? "(제목 없음)",
        workspace_id: snap.workspace_id,
      })
      .select("id")
      .single();
    if (createErr || !created) return stop(`Product 생성 실패: ${createErr?.message}`);
    productId = (created as { id: string }).id;
    const { error: linkErr } = await db
      .from("product_snapshots")
      .update({ product_id: productId })
      .eq("id", snapshotId)
      /* 🔴 아직 NULL 일 때만 쓴다 — 그 사이 누가 이었으면 덮지 않는다. */
      .is("product_id", null);
    if (linkErr) return stop(`snapshot → Product 연결 실패: ${linkErr.message}`);
  }

  /* ── §3 ChannelProduct ──────────────────────────────────────────────── */
  const { error: cpErr } = await db.from("channel_products").insert({
    product_id: productId,
    channel,
    external_product_id: externalProductId,
    /* 🔴 status 를 지정하지 않는다 — DB 기본값 UNKNOWN 이 남는다. 외부 상태를
       조회하는 코드가 없으므로 LIVE 라고 적지 않는다. */
  });
  if (cpErr) return stop(`ChannelProduct 생성 실패: ${cpErr.message}`);

  /* ── §6 검증 — 쓴 뒤 «다시 읽어서» 확인한다 ────────────────────────── */
  const { data: verifySnap } = await db
    .from("product_snapshots")
    .select("product_id")
    .eq("id", snapshotId)
    .maybeSingle();
  const { data: cps } = await db
    .from("channel_products")
    .select("product_id, channel, external_product_id, status")
    .eq("channel", channel)
    .eq("external_product_id", externalProductId);

  return {
    ok: true,
    alreadyLinked: false,
    applied: true,
    plan: { ...plan, productId },
    verification: {
      snapshotProductId: (verifySnap as { product_id?: string | null } | null)?.product_id ?? null,
      channelProducts: ((cps ?? []) as { product_id: string; channel: string; external_product_id: string; status: string }[]).map(
        (r) => ({
          productId: r.product_id,
          channel: r.channel,
          externalProductId: r.external_product_id,
          status: r.status,
        }),
      ),
    },
  };
  /* 🔴 registration_attempts 는 한 행도 건드리지 않았다(이력 재작성 아님). */
}
