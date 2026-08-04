import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { uploadPublicImage } from "@/lib/image-storage";

export interface ImageAsset {
  id: string;
  url: string;
  storageKey: string;
  fileName: string | null;
  tags: string[];
  createdAt: string;
}

interface ImageAssetRow {
  id: string;
  url: string;
  storage_key: string;
  file_name: string | null;
  tags: string[] | null;
  created_at: string;
}

function toAsset(row: ImageAssetRow): ImageAsset {
  return {
    id: row.id,
    url: row.url,
    storageKey: row.storage_key,
    fileName: row.file_name,
    tags: row.tags ?? [],
    createdAt: row.created_at,
  };
}

/** uploadPublicImage()는 공개 URL만 돌려주고 실제 스토리지 키는 내부에서만
 * 쓰인다 — 함수 시그니처를 바꾸면 기존 호출부(common-images 라우트, 파이프라인
 * 업로드)까지 건드리게 되므로, URL에서 버킷 이후 경로만 잘라내 키로 쓴다
 * (`.../object/public/product-images/{key}` 형태 — image-storage.ts의 버킷명과
 * 항상 일치한다). */
function extractStorageKey(url: string): string {
  const marker = "/product-images/";
  const idx = url.indexOf(marker);
  return idx === -1 ? url : url.slice(idx + marker.length);
}

export async function listAssets(tagFilter?: string): Promise<ImageAsset[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];
  let query = supabase.from("image_assets").select("*").order("created_at", { ascending: false });
  if (tagFilter) {
    query = query.contains("tags", [tagFilter]);
  }
  const { data, error } = await query;
  if (error) {
    console.warn("[asset] 목록 조회 실패:", error.message);
    return [];
  }
  return (data as ImageAssetRow[]).map(toAsset);
}

export async function createAsset(
  file: File,
  tags: string[],
): Promise<{ ok: true; asset: ImageAsset } | { ok: false; error: string }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, error: "Supabase가 설정되어 있지 않습니다." };

  const buffer = Buffer.from(await file.arrayBuffer());
  const url = await uploadPublicImage(buffer, file.name, file.type);
  if (!url) return { ok: false, error: "업로드에 실패했습니다." };

  const { data, error } = await supabase
    .from("image_assets")
    .insert({
      url,
      storage_key: extractStorageKey(url),
      file_name: file.name,
      tags,
    })
    .select()
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, asset: toAsset(data as ImageAssetRow) };
}

/** 라이브러리에서 제거 — 메타데이터 행만 지운다. Storage 파일은 지우지 않는다:
 * 여러 프로필이 같은 자산의 URL을 이미 저장해뒀을 수 있어서(FK는 ON DELETE SET
 * NULL로 asset_id만 끊어질 뿐 프로필의 url 컬럼은 그대로 남는다) 파일까지
 * 지우면 그 화면들의 이미지가 깨진다. */
export async function deleteAsset(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, error: "Supabase가 설정되어 있지 않습니다." };
  const { error } = await supabase.from("image_assets").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
