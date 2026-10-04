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

describe("② 🔴 P2-1 B — 채널별 「대표 이미지 포함」 옵션은 «폐기됐다»", () => {
  /* ══ CPO 확정 2026-10-04 — N-07-01 의 그 옵션을 뒤집는다 ═══════════════════
     🔴 이 describe 는 원래 그 옵션이 «존재함» 을 소스 문자열로 못박고 있었다.
     정책이 바뀌었으므로 단정을 «뒤집는다» — 테스트를 지우지 않는다. 지우면
     다음 사람이 같은 옵션을 다시 만들어도 아무것도 걸리지 않는다.

     폐기 이유: 그 옵션은 「모든 이미지를 보낸다」가 아니라 **스마트스토어 추가
     이미지에 대표를 한 번 더 넣는 것** 이었다. 세 채널 모두 이미 대표를 싣는다. */

  it("🔴 상태도 UI 도 남아 있지 않다", () => {
    expect(WORKSPACE).not.toContain("setIncludeRepresentativeInAdditional");
    expect(WORKSPACE).not.toContain("대표 이미지 포함</b>");
  });

  it("🔴 채널 분기가 사라졌다 — listingModelFor 가 어댑터 결과를 그대로 돌려준다", () => {
    expect(WORKSPACE).not.toContain('platformId !== "smartstore") return model;');
    expect(WORKSPACE).not.toContain("additionalImages: [model.representativeImage, ...model.additionalImages]");
  });

  it("🔴 어댑터 계약은 여전히 그대로다 — 갤러리 축을 건드리지 않았다", () => {
    const adapter = readFileSync(
      join(__dirname, "../../../../../../../packages/marketplace/src/adapters/smartstore.adapter.ts"),
      "utf8",
    );
    /* 스마트스토어는 representativeImage 칸이 따로 있으므로 추가 목록에서 대표를
       제외하는 것이 «맞다». 거기에 또 넣으면 중복 전송이다. */
    expect(adapter).toContain("!img.isRepresentative && img.useInProductGallery");
    expect(adapter).not.toContain("includeRepresentative");
  });

  it("🔴 단독 등록과 다중 등록이 여전히 같은 함수를 지난다", () => {
    expect(WORKSPACE).toContain("const listingModelFor = useCallback(");
    expect(WORKSPACE).toContain("const listing = listingModelFor(platform);");
  });

  it("snapshot 에 그 칸이 생긴 적이 없다 — 폐기 후에도 없다", () => {
    const types = readFileSync(join(__dirname, "../../../api/snapshots/_lib/types.ts"), "utf8");
    expect(types).not.toContain("includeRepresentative");
    const page = readFileSync(join(__dirname, "../../page.tsx"), "utf8");
    expect(page).not.toContain("includeRepresentative");
  });

  it("🔴 대신 상세설명이 «전체» 를 받는다 — 공통 지점 한 곳에서 정한다", () => {
    const canonical = readFileSync(join(__dirname, "../../../api/pipeline/canonical-product.ts"), "utf8");
    expect(canonical).toContain("useInDescription: true,");
    /* 🔴 **주석을 벗기고** 본다. 옛 기본값을 «설명하는» 주석이 그 파일에 들어
       있어서, 벗기지 않으면 그 설명문이 걸려 거짓 실패한다 — 이 저장소에서
       열 번째로 걸린 함정이다. 가드가 실패하면 주석부터 의심한다. */
    const code = canonical
      .split(String.fromCharCode(10))
      .filter((line) => {
        const t = line.trimStart();
        return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
      })
      .join(String.fromCharCode(10));
    expect(code).not.toContain("useInDescription: !item.isRepresentative");
  });
});
