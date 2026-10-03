import { isEmptyDetailOverride, type ProductDetailOverride } from "@commerce/listing";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * PRODUCT-INFO-UX-06 — 상품별 상세페이지 override 를 «서버가» 읽는다
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 **클라이언트가 보낸 블록을 쓰지 않는다.** N-3.86(대표님 지시: 「설정이 공통
 * 상세페이지의 유일한 기준」)이 `detailBlocks` POST 를 끊은 이유가 그대로 남아
 * 있다 — 화면이 보낸 값으로 등록하면 서버가 무엇을 등록했는지 알 수 없다.
 *
 * 그래서 라우트는 `snapshotId` «하나만» 받고, override 내용은 **서버가 DB 에서
 * 직접 읽는다**. 셀러 기본 블록(`sellerProfile.defaultDetailBlocks`)을 서버가
 * 직접 조회하는 것과 완전히 같은 방식이다.
 *
 * 🔴 새 컬럼을 만들지 않았다. `product_snapshots.workspace`(jsonb)는
 * `categoryMappings`(N-3.12)·`marketCategory`(MARKET-CATEGORY-1)를 이미 같은
 * 이유로 담고 있는 자리다 — migration 없이 키 하나를 더 쓴다.
 */

/** `workspace` jsonb 안에서 override 가 사는 키. 🔴 한 곳에만 적는다. */
export const DETAIL_OVERRIDE_WORKSPACE_KEY = "detailOverride";

/**
 * 스냅샷의 상세페이지 override 를 읽는다. **없으면 `null`** 이고, `null` 이면
 * 호출부는 기존 경로와 «완전히 같은» 블록을 쓴다(byte 동일).
 *
 * 🔴 조회를 `workspace_id` 로 좁힌다. 라우트가 이미 `requireRegistrationAccess`
 * 로 스냅샷 소유권을 보지만, 이 함수만 보고도 「남의 상품 설정을 읽을 수 없다」가
 * 성립해야 한다 — 가드 하나에 의존하지 않는다.
 *
 * 🔴 읽기 실패를 등록 실패로 만들지 «않는다». override 는 셀러의 «추가» 편집이고,
 * 못 읽으면 기존 공통 템플릿으로 등록되는 것이 맞다. 여기서 throw 하면 지금까지
 * 잘 되던 등록이 새 기능 때문에 멈춘다.
 */
export async function loadProductDetailOverride(
  snapshotId: string | null | undefined,
  workspaceId: string | null | undefined,
): Promise<ProductDetailOverride | null> {
  if (!snapshotId) return null;
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  let query = supabase
    .from("product_snapshots")
    .select(`override:workspace->${DETAIL_OVERRIDE_WORKSPACE_KEY}`)
    .eq("id", snapshotId);
  /* 🔴 043 이전 행은 workspace_id 가 null 이다 — requireRegistrationAccess 가
     같은 이유로 그 행을 막지 않는다. 여기서도 막지 않되, 호출자의 워크스페이스가
     있으면 그 값으로 좁힌다. */
  if (workspaceId) query = query.or(`workspace_id.eq.${workspaceId},workspace_id.is.null`);

  const { data, error } = await query.maybeSingle();
  if (error || !data) return null;

  const raw = (data as { override?: unknown }).override;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const override = raw as ProductDetailOverride;
  /* 🔴 빈 껍데기를 «없음» 으로 접는다 — `{}` 를 그대로 흘리면 merge 가 배열을
     새로 만들어 payload 비교가 흔들린다(동일 참조 보장이 깨진다). */
  return isEmptyDetailOverride(override) ? null : override;
}
