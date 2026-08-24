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

/**
 * N-4.13-P0-REOPEN(대표님 실측 재현: "파일선택 -> 업로드중 -> 이미지 그대로")
 * 근본 원인 — 한글/공백 외 특수문자가 포함된 원본 파일명(카카오톡/다운로드로
 * 저장된 실제 파일 다수가 이런 이름)이 그대로 Supabase Storage 키에 들어가면
 * 스토리지가 업로드 자체를 거부한다(실측: "반품교환안내.png" 500 실패,
 * "kakao_image_2026.png"는 성공). 확장자만 보존하고 나머지는 ASCII로
 * 정규화한다 — 어차피 키 앞에 randomUUID가 붙어 충돌 걱정은 없다.
 */
function sanitizeStorageFileName(fileName: string): string {
  const dotIndex = fileName.lastIndexOf(".");
  const ext = dotIndex > 0 ? fileName.slice(dotIndex + 1).replace(/[^a-zA-Z0-9]/g, "").toLowerCase() : "";
  const base = (dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName)
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const safeBase = base || "image";
  return ext ? `${safeBase}.${ext}` : safeBase;
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
    const key = `${crypto.randomUUID()}-${sanitizeStorageFileName(fileName)}`;
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
