import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * N-07-01(CEO 확정, 2026-09-24) — **다중 등록 KC 누락 + 대표 이미지 포함 옵션**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── 🔴 왜 KC 누락이 regression 인가 ───────────────────────────────────────
 * 다중 등록 모달에 `smartstoreKcStatus` 를 넘기지 않아서, 모달이 KC 카드를 그리지
 * 못하고 확인 체크박스도 없고 seller_compliance_confirmations 기록도 남지 않았다.
 * 그러면 서버의 isKcStatusRegistrable(SELLER_REVIEW_REQUIRED, null) 이 false 라
 * **단독으로는 되는 상품이 다중으로는 거절된다** — payload 는 같은데 등록 결과가
 * 갈리는 상태였다(Single ≠ Multi). E-1 은 단독 경로였고 인증정보가 이미 채워져
 * 있어 드러나지 않았다.
 *
 * ── 🔴 대표 이미지 포함은 기본 OFF ────────────────────────────────────────
 * 지금 Production 에서 실제로 나가는 모양(대표 1 + 추가 2)을 기본 동작에서
 * 바꾸지 않는다. 그리고 스마트스토어에만 적용한다 — 쿠팡(imageOrder 0 =
 * REPRESENTATION)과 롯데ON(gallery[0], rprtImgYn="Y")은 이미 대표를 목록 맨 앞에
 * 넣고 있어서 또 넣으면 중복이 된다.
 */

function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const WORKSPACE = codeOnly(readFileSync(join(__dirname, "../../CommerceWorkspace.tsx"), "utf8"));

describe("① 🔴 다중 등록도 KC 확인을 거친다", () => {
  const multi = WORKSPACE.slice(
    WORKSPACE.indexOf("{multiConfirmOpen && ("),
    WORKSPACE.indexOf("{confirmingPlatform && listing && ("),
  );

  it("다중 모달이 KC 상태를 받는다", () => {
    expect(multi).toContain("smartstoreKcStatus=");
    expect(multi).toContain("smartstoreCategoryCode=");
  });

  it("🔴 스마트스토어를 «고른 경우에만» 넘긴다", () => {
    // 고르지도 않은 채널의 KC 확인을 셀러에게 요구하지 않는다.
    expect(multi).toContain('selectedCommerces.includes("smartstore")');
  });

  it("단독 등록과 «같은 근거» 를 본다 — 두 화면이 다른 KC 상태를 말하지 않는다", () => {
    const single = WORKSPACE.slice(WORKSPACE.indexOf("{confirmingPlatform && listing && ("));
    expect(multi).toContain("smartStoreValidation?.kcStatus ?? null");
    expect(single).toContain("smartStoreValidation?.kcStatus ?? null");
  });

  it("카테고리 코드도 확정된 스마트스토어 카테고리에서만 가져온다", () => {
    expect(multi).toContain("isVerifiedCategorySelected(categoryMappings.smartstore)");
    expect(multi).toContain('categoryMappings.smartstore.candidate?.platform === "smartstore"');
  });
});

describe("② 대표 이미지 포함 — 기본 OFF · 스마트스토어 한정", () => {
  it("🔴 기본값이 꺼져 있다 — 기존 Production payload 를 바꾸지 않는다", () => {
    expect(WORKSPACE).toContain("useState(false);");
    expect(WORKSPACE).toContain("const [includeRepresentativeInAdditional, setIncludeRepresentativeInAdditional] = useState(false);");
  });

  it("🔴 스마트스토어에만 적용한다 — 쿠팡·롯데ON 은 이미 포함한다", () => {
    expect(WORKSPACE).toContain('if (!includeRepresentativeInAdditional || platformId !== "smartstore") return model;');
  });

  it("🔴 중복해서 넣지 않는다", () => {
    expect(WORKSPACE).toContain("if (model.additionalImages.includes(model.representativeImage)) return model;");
  });

  it("대표 이미지가 없으면 아무것도 하지 않는다 — 빈 값을 넣지 않는다", () => {
    expect(WORKSPACE).toContain("if (!model.representativeImage) return model;");
  });

  it("맨 «앞» 에 넣는다 — 대표가 첫 장이다", () => {
    expect(WORKSPACE).toContain("additionalImages: [model.representativeImage, ...model.additionalImages]");
  });

  it("🔴 어댑터 계약을 바꾸지 않았다 — 어댑터가 낸 결과 위에서 구성만 바꾼다", () => {
    const adapter = readFileSync(
      join(__dirname, "../../../../../../../packages/marketplace/src/adapters/smartstore.adapter.ts"),
      "utf8",
    );
    // 어댑터는 여전히 대표를 추가 목록에서 «제외» 한다(기존 동작 그대로).
    expect(adapter).toContain("!img.isRepresentative && img.useInProductGallery");
    expect(adapter).not.toContain("includeRepresentative");
  });

  it("🔴 단독 등록과 다중 등록이 같은 함수를 지난다 — 구성이 갈리지 않는다", () => {
    // 이 옵션은 listingModelFor 안에 있으므로 두 경로에 똑같이 걸린다.
    expect(WORKSPACE).toContain("const listingModelFor = useCallback(");
    expect(WORKSPACE).toContain("const listing = listingModelFor(platform);");
  });

  it("저장하지 않는다 — snapshot 에 새 칸을 만들지 않았다", () => {
    const types = readFileSync(join(__dirname, "../../../api/snapshots/_lib/types.ts"), "utf8");
    expect(types).not.toContain("includeRepresentative");
    const page = readFileSync(join(__dirname, "../../page.tsx"), "utf8");
    expect(page).not.toContain("includeRepresentative");
  });
});
