import type { SupabaseClient } from "@supabase/supabase-js";
import { buildSelectionPatch } from "@/lib/selected-source-policy";
import { loadProductOwnership } from "./sourcing-candidate-store";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * PIVOT-03-B ④ — Selected Source 의 **저장소 접근**. 판단은 여기 없다.
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 ②의 `sourcing-candidate-store.ts` 를 «고치지 않고 가져다 쓴다». 읽기 경로가
 * 두 벌이 되면 한쪽에만 `.eq("workspace_id")` 가 빠진다 — 그것이 이 저장소가
 * 반복해 겪은 유형이다. 쓰기만 이 파일이 맡는다.
 */

export interface SelectionWriteResult {
  /** 🔴 쓰고 나서 «다시 읽은» 값이다. 「썼으니 됐다」로 단정하지 않는다. */
  selectedCandidateId: string | null;
}

/**
 * 선택을 바꾼다. `candidateId = null` 이면 해제다.
 *
 * 🔴 패치를 여기서 «조립하지 않는다» — `buildSelectionPatch()` 가 만든다. 그래서
 * 만질 수 있는 칸이 한 곳에만 적혀 있고, 늘어나면 테스트가 잡는다.
 */
export async function writeSelectedCandidate(
  supabase: SupabaseClient,
  productId: string,
  workspaceId: string,
  candidateId: string | null,
): Promise<SelectionWriteResult | null> {
  const { error } = await supabase
    .from("products")
    .update(buildSelectionPatch(candidateId))
    .eq("id", productId)
    /* 🔴 쓰기에도 workspace 를 붙인다 — 읽기에서 통과했다는 사실에 기대지 않는다. */
    .eq("workspace_id", workspaceId);
  if (error) {
    console.warn("[selected-source] 선택 저장 실패:", error.message);
    return null;
  }

  /* 🔴 다시 읽는다. 076 의 복합 FK 가 «다른 Product 의 후보» 를 DB 에서 거절하는데,
     그 거절이 드라이버에 따라 조용히 0행 갱신으로 보일 수 있다. 응답만 보고
     「선택됐다」고 말하면 화면이 거짓을 띄운다. */
  const after = await loadProductOwnership(supabase, productId, workspaceId);
  if (!after) return null;
  return { selectedCandidateId: after.selectedCandidateId };
}
