import type { CanonicalProduct, PlatformId, ProductMetadata } from "@commerce/shared";
import type { ProcessingReport, WorkspaceItem } from "../../pipeline/response.types";

/**
 * "최근 작업" 스냅샷 하나의 전체 워크스페이스 상태 — pipeline/page.tsx가 이미
 * sessionStorage에 저장하던 것과 거의 같은 모양이다(url/result/product/items/
 * representativeId/excludedIds). items는 반드시 stripHeavyDataUrls()를 거친
 * 뒤(base64 제거, Supabase 공개 URL만 유지) 저장한다 — sessionStorage와 같은
 * 이유(용량)뿐 아니라 DB jsonb 컬럼에도 base64를 넣지 않기 위함이다.
 *
 * platformSettings.coupang의 필드들은 현재 CommerceWorkspace 내부 로컬
 * state(categoryMappings/categoryMeta)라 세션 저장/복원 대상이 아니다(오늘도
 * 새로고침하면 카테고리 추천이 처음부터 다시 계산된다 — 회귀가 아니라 기존
 * 동작 그대로). 스키마 모양만 미리 잡아두고 이번 스프린트는 항상 null로 둔다 —
 * 다음 스프린트에서 CommerceWorkspace 상태를 끌어올릴 때 스키마 변경 없이 채울
 * 수 있게 하기 위함이다.
 */
export interface SnapshotWorkspaceState {
  url: string;
  pipelineResponse: {
    metadata: ProductMetadata;
    report: ProcessingReport;
    storageNote: string;
  };
  canonicalProduct: CanonicalProduct;
  items: WorkspaceItem[];
  /** 800x800로 미리 리사이즈된 정사각 미리보기(item.id -> data URI) — 기존
   * sessionStorage 복원과 같은 이유로 그대로 저장/복원한다. 복원 시
   * precomputeThumbnails()를 다시 돌리지 않아도 되게 한다(원본이 이미 공개
   * URL로 치환된 뒤라 재계산이 애매해진다 — 애초에 필요 없다). */
  thumbnails: Record<string, string>;
  representativeId: string | null;
  excludedIds: string[];
  activeTab: "source" | "content" | PlatformId;
  developerMode: boolean;
  platformSettings: {
    coupang?: {
      sellerProfileId: string | null;
      descriptionTemplateId: string | null;
      /** CategorySelection(@commerce/category) — 아직 세션에 안 채움, 위 주석 참고. */
      categorySelection: unknown | null;
      /** CoupangCategoryMeta(@commerce/listing) — 아직 세션에 안 채움, 위 주석 참고. */
      categoryMeta: unknown | null;
    };
  };
}

export interface ProductSnapshot {
  id: string;
  sourceUrl: string;
  title: string | null;
  thumbnailUrl: string | null;
  status: "IN_PROGRESS" | "REGISTERED";
  workspace: SnapshotWorkspaceState;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string;
}

/** 목록 화면(최근 작업)은 workspace 전체를 안 내려준다 — 카드 하나에 대표
 * 이미지/제목/상태/시간만 필요한데 CanonicalProduct+WorkspaceItem[] 전체를
 * 매번 직렬화하면 목록 API 응답이 불필요하게 커진다. */
export interface ProductSnapshotSummary {
  id: string;
  sourceUrl: string;
  title: string | null;
  thumbnailUrl: string | null;
  status: "IN_PROGRESS" | "REGISTERED";
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string;
}
