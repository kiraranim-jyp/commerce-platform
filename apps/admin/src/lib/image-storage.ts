import { getSupabaseAdmin } from "./supabase-admin";

/**
 * 쿠팡 등록 payload의 items[].images[].vendorPath는 "판매자가 이미 공개
 * 호스팅해둔 이미지 URL"이어야 한다(실제 등록 시도로 확인: base64 data URI를
 * 그대로 보내면 "업체이미지경로 최대 길이(200자) 초과"로 거부됨) — 쿠팡 Open
 * API에는 별도 이미지 업로드 엔드포인트가 없다(공식 문서 103개 엔드포인트 전체
 * 확인, image 관련 없음). 그래서 CartPilot이 직접 공개 스토리지에 올리고 그
 * URL을 넘겨야 한다.
 *
 * 실패해도 파이프라인 전체를 막지 않는다 — 업로드 실패 시 null을 반환하고
 * 호출부가 기존 data URL로 폴백한다(등록 시점에 vendorPath 검증에서 다시
 * 걸리겠지만, 그건 이미지 미리보기 자체는 계속 동작해야 한다는 원칙과 같다).
 */
const BUCKET = "product-images";
let bucketEnsured = false;

async function ensureBucket(): Promise<void> {
  if (bucketEnsured) return;
  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  const { data: buckets } = await supabase.storage.listBuckets();
  if (!buckets?.some((b) => b.name === BUCKET)) {
    const { error } = await supabase.storage.createBucket(BUCKET, { public: true });
    if (error && !error.message.includes("already exists")) {
      console.warn("[image-storage] 버킷 생성 실패:", error.message);
      return;
    }
  }
  bucketEnsured = true;
}

export async function uploadPublicImage(
  buffer: Buffer,
  fileName: string,
  contentType: string,
): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  try {
    await ensureBucket();
    const key = `${crypto.randomUUID()}-${fileName}`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(key, buffer, { contentType, upsert: false });
    if (error) {
      console.warn("[image-storage] 업로드 실패:", error.message);
      return null;
    }
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(key);
    return data.publicUrl;
  } catch (error) {
    console.warn("[image-storage] 업로드 예외:", error instanceof Error ? error.message : error);
    return null;
  }
}
