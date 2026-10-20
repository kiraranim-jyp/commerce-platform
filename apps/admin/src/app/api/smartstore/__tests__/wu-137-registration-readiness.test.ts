import { describe, expect, it } from "vitest";
import { buildNaverProductPayload, validateNaverPayload } from "@commerce/listing";
/** 🔴 `PLATFORM_ADAPTERS` 의 owner 는 **marketplace** 다(listing 이 아니다 · WU-135 와 같은 import). */
import { PLATFORM_ADAPTERS } from "@commerce/marketplace";
import { UNRESOLVED_CATEGORY } from "@commerce/category";
import { buildCanonicalProduct } from "../../pipeline/canonical-product";
import type { ExtractedProductData, ProductDataSource } from "@commerce/crawler";
import type { CanonicalProduct } from "@commerce/shared";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-137 — **실등록을 막는 칸이 «지금» 몇 개인가** (실제 셀러 설정 기준)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **WU-135 의 「MISSING 7」을 정정하기 위한 측정이다.**
 * ```
 * WU-135 하니스는 선례 컨텍스트를 썼고 **셀러 설정을 읽지 않았다** ⟹ 고시 칸이
 * 전부 비어 MISSING 7 이 나왔다. 🔴 그런데 운영 `resolveNaverContext` 는
 * `loadSellerSettings()` 를 부르고, DB 실측(2026-10-20)으로 그 값이 **이미 있다**:
 *   manufacturer 규하맘샵 · as_company_name 규하맘샵AS · as_phone_number ·
 *   quality_guarantee · as_contact_number
 * ⟹ 그래서 **그 값을 넣고 다시 재야** 「남은 것이 몇 칸인가」가 정확해진다.
 * ```
 * 🔴 `loadSellerSettings()` 를 **직접 부르지 않는다** — `getSupabaseAdmin()` 이
 *    service-role 키를 요구하고 로컬엔 없다(메모 그 함정). 🟢 대신 **운영이 읽는
 *    그 칸을 그대로** 컨텍스트에 넣는다(§5-B 복제식 · 값은 DB 실측값이다).
 * 🔴 **값을 지어내지 않았다** — 아래 상수는 전부 `seller_settings` 실제 행이다.
 * 🔴 게이트 `WU_137_PROBE=1` 없으면 SKIP(외부 HTTP 금지).
 *
 * ── 🔴🔴🔴 **이 파일의 숫자를 «운영 등록 준비 상태» 로 쓰지 않는다** ──────────────
 * ```
 * 운영 라우트는 `resolveNaverContext` 로 컨텍스트를 만든다 — 그 함수는
 *   ⒜ 실제 Naver API(토큰·카테고리·반품택배사·원산지)를 호출하고
 *   ⒝ `loadSellerSettings()`(service-role 키 필요)를 읽고
 *   ⒞ 해결된 **leaf 카테고리** 로 고시 타입을 정한다
 * 🔴 이 하니스는 ⒜⒝를 쓸 수 없고 ⒞ 를 `UNRESOLVED_CATEGORY` 로 둔다 ⟹
 *    아래 MISSING 목록은 **하니스 기준** 이고 **운영 값이 아니다.**
 * 🔴 실제로 이 하니스에 설정 세 칸(품질보증·A/S 책임자·A/S 전화)을 넣어도
 *    MISSING 에 남는다 — 그 원인(카테고리 미해결 ↔ 배선)을 이 세션에서
 *    **가르지 못했다.** 「운영에서도 그 셋이 비어 있다」로 **적지 않는다**.
 * 🟢 이 파일이 **증명하는 것은 하나** 다 — 운영 추출 경로(`universalExtract`)에서
 *    **브랜드가 살아남는다**(그 배선이 WU-137 이 고친 결함이다).
 * ```
 */
const LIVE = process.env.WU_137_PROBE === "1";
const ORIGIN = "https://bobochoses.com/ko-kr/products/b226ac009-hug-hairy-monster-t-shirt";

/** 🔴 DB 실측값(`seller_settings` · scope_key=default). 🔴 지어낸 값 0. */
const SELLER_SETTINGS = {
  manufacturer: "규하맘샵",
  asContactNumber: "해외 구매대행으로 A/S 불가",
  qualityGuarantee: "상품 상세페이지에 기재된 품질보증기준 및 소비자분쟁해결기준에 따릅니다.",
  asCompanyName: "규하맘샵AS",
  asPhoneNumber: "01046458306",
  defaultCountryOfOrigin: "상세설명 참조",
} as const;

/**
 * 🔴 **운영이 넘기는 그 컨텍스트 모양** 이다(선례 하니스 + 위 설정 배선).
 * 🔴 주소록/배송비는 셀러 설정이고 이 측정의 대상이 아니다 — 선례 값 그대로.
 */
const CONTEXT = {
  leafCategoryId: "50000535",
  releaseAddressBookNo: 900000001,
  refundAddressBookNo: 900000002,
  primaryReturnDeliveryCompanyPriorityType: "PRIMARY",
  sellerDeliveryFee: null,
  returnDeliveryFee: 3000,
  exchangeDeliveryFee: 5000,
  childCertificationInfoId: null,
  categoryRequiresChildCertification: false,
  originAreaCode: "00",
  originAreaRequiresContent: false,
  /** 🟢 resolve-context.ts:225·226·506 이 실제로 넣는 세 칸. */
  warrantyPolicy: SELLER_SETTINGS.qualityGuarantee,
  afterServiceDirector: SELLER_SETTINGS.asContactNumber,
  afterServiceTelephoneNumber: SELLER_SETTINGS.asPhoneNumber,
  /**
   * 🔴 `resolvedManufacturer` 는 **설정의 제조사가 아니다** — `resolveManufacturer`
   *    가 「브랜드 프로필 → 상품 브랜드」로 폴백한다(그 파일 주석: 「판매자라는 이유만
   *    으로 제조자가 되지 않는다」). DB 실측 `coupang_brand_profiles` **0행** 이므로
   *    폴백은 **상품 브랜드** 이고, 그것이 WU-137 이 복구한 `Bobo Choses` 다.
   */
  resolvedManufacturer: "Bobo Choses",
} as const;

const listingFor = (product: CanonicalProduct) =>
  PLATFORM_ADAPTERS.smartstore.toListingModel(product, UNRESOLVED_CATEGORY, undefined, "smartstore");

describe("WU-137 — 등록 준비 상태 (실제 셀러 설정 기준)", () => {
  it.runIf(LIVE)("운영 경로로 추출한 상품의 validation 을 다시 센다", async () => {
    const { universalExtract } = await import("@commerce/crawler");
    const r = await universalExtract(ORIGIN, { debug: true });
    const pd = r.productData as ExtractedProductData;
    /**
     * 🔴🔴 **4번째 인자는 이미지가 아니다 — `WorkspaceItem[]` 이다.**
     *    1차에 `r.images` 를 넣었다가 **typecheck 가 잡았다**(`ExtractedImage[]` 는
     *    할당 불가). 🟢 WU-135 하니스의 `[]` 가 처음부터 맞았다.
     * 🔴 그래서 아래 `images=0` 은 **제품 결함이 아니라 이 하니스의 입력** 이다 —
     *    「대표이미지가 없다」로 **적지 않는다**. 운영 라우트는 이미지를 별 경로로
     *    매핑하고(업로드 포함) 이 측정의 대상이 아니다.
     */
    const product = buildCanonicalProduct(
      ORIGIN,
      pd,
      (r.productDataSources ?? {}) as Record<string, ProductDataSource>,
      [],
    );

    /* eslint-disable no-console */
    /** 🔴 `title` 도 **객체** 다(`brand` 와 같은 모양) — 문자열로 가정하지 않는다. */
    console.log(
      `\n① 원상품 — brand=${JSON.stringify(product.brand.value)}` +
        ` title=${JSON.stringify(product.title).slice(0, 90)}`,
    );
    console.log(
      `   material=${JSON.stringify(pd.material ?? null)} price=${JSON.stringify(product.price ?? null)}` +
        ` images=${(product.images ?? []).length}`,
    );
    /** 🟢🟢 이 줄이 WU-137 의 핵심 — 운영 경로에서 브랜드가 살아 있다. */
    expect(product.brand.value).toBe("Bobo Choses");

    const payload = buildNaverProductPayload({
      product,
      listing: listingFor(product),
      ...CONTEXT,
    } as never);
    const verdict = validateNaverPayload(payload as never, { product, listing: listingFor(product) } as never, false);

    const v = verdict as unknown as {
      ok: boolean;
      readyCount: number;
      missingCount: number;
      blockedCount: number;
      /**
       * 🔴🔴 **칸 이름을 추측하지 않는다 — 1차에 또 틀렸다.** `state`/`label`/`path` 로
       *    읽었더니 MISSING 목록이 **빈 채로 출력** 됐다(숫자는 owner 가 맞게 줬다).
       *    실제 모양은 `validate-payload.ts:57` 의 **`{ field, status, reason, code }`** 다.
       * 🔴 그대로 보고했으면 「남은 칸이 없다」는 거짓 결론이었다.
       */
      fields: { field?: string; status?: string; reason?: string; code?: string }[];
    };
    console.log(
      `\n② validation — ok=${v.ok} 항목=${v.fields?.length ?? 0}` +
        ` READY=${v.readyCount} MISSING=${v.missingCount} BLOCKED=${v.blockedCount}`,
    );
    console.log("\n🔴 남은 MISSING:");
    for (const f of v.fields ?? []) {
      if (f.status === "MISSING") console.log(`   · ${f.field ?? "-"}  — ${f.reason ?? "(사유 없음)"}`);
    }
    console.log("\n🔴 BLOCKED:");
    const blocked = (v.fields ?? []).filter((f) => f.status === "BLOCKED");
    for (const f of blocked) console.log(`   · ${f.field ?? "-"}  — ${f.reason ?? "-"}`);
    if (blocked.length === 0) console.log("   (없음)");
    /** 🔴 목록이 숫자와 **일치하는지** 확인한다 — 안 그러면 칸 이름이 또 틀린 것이다. */
    expect((v.fields ?? []).filter((f) => f.status === "MISSING").length).toBe(v.missingCount);

    /**
     * 🔴 **「누락 0」을 단언하지 않는다** — 남은 칸이 무엇인지 «세어 보는» 측정이고,
     *    그 값을 지어내 채우면 그것이 공개 상품의 신고 내용이 된다(CPO §8 금지).
     * 🟢 단 **BLOCKED 는 0 이어야** 한다 — 그것은 스키마/자격증명 결함이고
     *    셀러 입력으로 닫히지 않는다(WU-135 에서도 0 이었다).
     */
    expect(v.blockedCount).toBe(0);
  }, 600000);
});
