import type { CategorySelection } from "@commerce/category";
import type { DetailPageBlock } from "@commerce/listing";
import type { CanonicalProduct, PlatformId, ProductMetadata } from "@commerce/shared";
import type { ProcessingReport, WorkspaceItem } from "../../pipeline/response.types";

/**
 * "최근 작업" 스냅샷 하나의 전체 워크스페이스 상태 — pipeline/page.tsx가 이미
 * sessionStorage에 저장하던 것과 거의 같은 모양이다(url/result/product/items/
 * representativeId/excludedIds). items는 반드시 stripHeavyDataUrls()를 거친
 * 뒤(base64 제거, Supabase 공개 URL만 유지) 저장한다 — sessionStorage와 같은
 * 이유(용량)뿐 아니라 DB jsonb 컬럼에도 base64를 넣지 않기 위함이다.
 *
 * N-3.12 Phase 2 P0① — CPO 지시로 categoryMappings를 여기 최상위 필드로 끌어올렸다.
 * 원래는 CommerceWorkspace 내부 로컬 state였고(categoryMeta 포함) 세션 저장/복원
 * 대상이 아니었다 — 그래서 카테고리를 선택해도 페이지를 새로고침하거나 "최근
 * 작업"에서 재오픈하면 "확인 필요" 상태로 초기화되는 실제 버그가 있었다(브라우저
 * 실측으로 확인). CategorySelection(Record<PlatformId, ...>)은 이미 Coupang/Naver가
 * 공통으로 쓰는 타입이라 플랫폼별로 따로 만들지 않고 여기 하나만 둔다.
 * categoryMeta(CoupangCategoryMeta, KC/고시정보 등 API 조회 결과)는 이번 범위에서
 * 제외한다 — 저장된 categoryId로 재오픈 시 다시 조회하면 되는 파생 데이터라
 * 스냅샷에 중복 저장할 필요가 없다.
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
  /** Detail Page Editor(2026-08-04) — 없으면(레거시 세션) defaultDetailBlocks()로
   * 대체한다(apps/admin/src/app/pipeline/commerce/detail-blocks.ts). */
  detailBlocks?: DetailPageBlock[];
  /** N-3.12 Phase 2 P0① — 플랫폼별(coupang/smartstore/elevenst) 카테고리 선택 상태.
   * 없으면(레거시 세션) CommerceWorkspace가 자체 기본값(UNRESOLVED_CATEGORY)으로
   * 대체한다. */
  categoryMappings?: Record<PlatformId, CategorySelection>;
  platformSettings: {
    coupang?: {
      sellerProfileId: string | null;
      descriptionTemplateId: string | null;
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
