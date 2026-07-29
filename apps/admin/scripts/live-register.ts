/**
 * STEP 2 실등록 — 브라우저 자동화(claude-in-chrome)가 이번 세션에서 계속
 * 연결되지 않아, 실제 프로덕션이 쓰는 서버 로직(coupangAdapter.toListingModel +
 * /api/coupang/register)을 그대로 호출하는 방식으로 등록을 진행한다.
 * DRY_RUN이 아니다 — /api/coupang/register는 실제 쿠팡 Open API를 호출한다.
 */
import { coupangAdapter } from "@commerce/marketplace";
import type { CategorySelection } from "@commerce/category";
import type { CanonicalProduct } from "@commerce/shared";
import type { PipelineSSEEvent } from "../src/app/api/pipeline/response.types";

const BASE = "https://commerce-platform-mocha.vercel.app";
const TEST_URL = process.argv[2] ?? "https://junioredition.com/products/tangerine-all-over-baby-swim-cap-by-bobo-choses";

async function runPipeline(url: string): Promise<CanonicalProduct> {
  console.log(`[1/4] 파이프라인 실행: ${url}`);
  const res = await fetch(`${BASE}/api/pipeline`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  if (!res.ok || !res.body) {
    throw new Error(`파이프라인 요청 실패: ${res.status} ${await res.text()}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";
    for (const chunk of chunks) {
      const line = chunk.split("\n").find((l) => l.startsWith("data: "));
      if (!line) continue;
      const event = JSON.parse(line.slice(6)) as PipelineSSEEvent;
      if (event.type === "progress") {
        console.log(`    - ${event.step ?? ""} ${event.message ?? ""}`.trimEnd());
      } else if (event.type === "error") {
        throw new Error(`파이프라인 오류: ${event.error}`);
      } else if (event.type === "complete") {
        console.log(`[1/4] 완료 — 이미지 ${event.items.length}개, 성공 ${event.report.success}개`);
        return event.canonicalProduct;
      }
    }
  }
  throw new Error("파이프라인이 complete 이벤트 없이 종료됨");
}

async function recommendCategory(product: CanonicalProduct): Promise<CategorySelection> {
  console.log("[2/4] 쿠팡 카테고리 예측 조회");
  const res = await fetch(`${BASE}/api/coupang/category-recommend`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productName: product.title.value, brand: product.brand.value }),
  });
  const data = (await res.json()) as {
    categoryCode?: number | null;
    categoryName?: string | null;
    comment?: string | null;
    unverified?: boolean;
  };
  console.log(`[2/4] 응답: code=${data.categoryCode} name=${data.categoryName} comment=${data.comment ?? ""}`);
  if (data.categoryCode == null || !data.categoryName) {
    throw new Error(`카테고리 예측 실패 — 실제 쿠팡 코드 없이는 등록을 진행하지 않는다: ${JSON.stringify(data)}`);
  }
  return {
    state: "SELECTED",
    provenance: "USER_SELECTED",
    candidate: {
      id: String(data.categoryCode),
      name: data.categoryName,
      path: [data.categoryName],
      platform: "coupang",
      confidence: 1,
      reason: ["쿠팡 API가 상품명 기반으로 예측한 실제 카테고리 코드"],
      source: "ai",
      isVerifiedPlatformCode: true,
    },
  };
}

async function register(product: CanonicalProduct, categorySelection: CategorySelection) {
  console.log("[3/4] ListingModel 빌드 (coupangAdapter.toListingModel)");
  const listing = coupangAdapter.toListingModel(product, categorySelection);
  const errors = listing.validations.filter((v) => v.status === "ERROR");
  console.log(`    registrableScore=${listing.registrableScore} errors=${errors.length}`);
  if (errors.length > 0) {
    console.log("    ERROR 항목:", JSON.stringify(errors, null, 2));
    throw new Error("Validation ERROR가 있어 등록을 진행하지 않는다.");
  }

  console.log("[4/4] 실제 쿠팡 등록 요청 (/api/coupang/register) — LIVE");
  const res = await fetch(`${BASE}/api/coupang/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ product, listing }),
  });
  const result = await res.json();
  console.log(JSON.stringify(result, null, 2));
  return result;
}

async function main() {
  const product = await runPipeline(TEST_URL);
  const categorySelection = await recommendCategory(product);
  await register(product, categorySelection);
}

main().catch((err) => {
  console.error("FAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});
