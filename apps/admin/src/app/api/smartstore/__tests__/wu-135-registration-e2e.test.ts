import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { UNRESOLVED_CATEGORY } from "@commerce/category";
import { PLATFORM_ADAPTERS } from "@commerce/marketplace";
import { buildNaverProductPayload, validateNaverPayload } from "@commerce/listing";
import { backfillCanonicalProduct, buildProductIdentityDna } from "@commerce/shared";
import type { CanonicalProduct } from "@commerce/shared";
import { shopifySiteStrategy } from "@commerce/crawler/src/site-strategies/shopify.site-strategy";
import { buildCanonicalProduct } from "../../pipeline/canonical-product";
import type { ExtractedProductData, ProductDataSource } from "@commerce/crawler";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-135 — **원상품 → MI → 가격비교 → «상품등록 payload»** 까지 한 상품으로 (E2E)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 CPO 지시(2026-10-20): 「전략 변경 금지. 검증된 흐름을 **상품등록까지 연결**
 *    해서 판매 가능한 상태를 만든다. MI 를 다시 뜯지 않는다.」
 *
 * 🔴🔴 **이 파일이 «하지 않는» 것 — 실제 채널 등록(STEP 5/6)**
 * ```
 * 실제 등록은 **외부로 나가는 되돌리기 어려운 상업 행위** 다(라이브 스토어에
 * 공개 상품이 생긴다). 🔴 헌장 §12 가 「실등록은 STOP」을 유지 포인터로 두고
 * §3 이 사업적 승인을 CEO 에게 두므로 **CTO 가 임의로 실행하지 않는다.**
 * 🔴 그리고 기술적으로도 이 환경에서 호출할 수 없다 —
 *    `requireRegistrationAccess`(로그인 세션) + egress 프록시가 앞에 있고
 *    CTO 는 Production 화면을 몰 수 없다(메모 `production-payload-is-unreachable`).
 * 🟢 그래서 **등록 «직전» 까지** 를 전부 실측하고, 막는 것을 정확히 적는다.
 * ```
 *
 * ── 🟢 이 파일이 실측하는 것 ───────────────────────────────────────────────
 * ```
 * ① 원상품 URL 을 **실제로 다시 추출** 한다(WU-134 의 브랜드 복구가 여기서 발화)
 * ② 그 산출로 **화면이 쓰는 그 함수** 로 ListingModel → Naver payload 를 만든다
 * ③ 운영 `validateNaverPayload` 를 **그대로** 돌린다
 * ④ MI 가 확정한 정보(브랜드·제목·이미지·가격)가 payload 까지 **살아 있는지** 본다
 * ```
 * 🔴 **가격 정책을 건드리지 않는다**(CPO STEP 3) — MI SAME 가격을 등록가로
 *    덮어쓰지 않는다. 손실·오매핑만 본다.
 */

const LIVE = process.env.WU_135_PROBE === "1";
const OUT = process.env.MI_P0_02_OUT_DIR ?? path.join(process.env.TEMP ?? ".", "mi-p0-02");
const ORIGIN = "https://bobochoses.com/ko-kr/products/b226ac009-hug-hairy-monster-t-shirt";
/* eslint-disable no-console */
const log = (s: string) => console.log(s);

/** 🔴 화면이 ListingModel 을 만드는 **그 함수** 다(`CommerceWorkspace.listingModelFor`). */
const listingFor = (product: CanonicalProduct) =>
  PLATFORM_ADAPTERS.smartstore.toListingModel(product, UNRESOLVED_CATEGORY, undefined, "smartstore");

/**
 * 🔴 **운영이 넘기는 그 컨텍스트 모양** 이다(`resolveNaverContext` 산출 · 선례
 *    `n05-step4-payload-identity`). 🔴 값을 지어낸 것이 아니라 **그 하니스의 것을
 *    그대로** 쓴다 — 이 파일이 재는 것은 「상품 데이터가 살아남는가」이고
 *    주소록/배송비는 셀러 설정이라 이 측정의 대상이 아니다.
 */
const NAVER_CONTEXT = {
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
} as const;

interface Snap {
  source_url: string;
  title: string;
  workspace: { canonicalProduct: unknown };
}

/**
 * 🟢 payload 의 **어느 칸** 에 무엇이 들어갔는지 사람이 읽게 적는다.
 *
 * 🔴🔴 **칸 이름을 추측하지 않는다 — 1차에 틀렸다.** `brandName` 을
 *    `originProduct.brandName` 으로 읽었는데 실제 자리는
 *    **`originProduct.detailAttribute.naverShoppingSearchInfo.brandName`**
 *    (`build-payload.ts:994`)이고, 그래서 「브랜드가 사라졌다」는 **거짓 결론** 이
 *    나올 뻔했다. 🔴 이 트랙에서 같은 실수가 스무 번 넘게 났다 — owner 를 읽는다.
 */
function describePayload(p: unknown) {
  const x = p as {
    originProduct?: {
      name?: string;
      salePrice?: number;
      stockQuantity?: number;
      images?: { representativeImage?: { url?: string }; optionalImages?: { url?: string }[] };
      detailContent?: string;
      detailAttribute?: {
        naverShoppingSearchInfo?: { brandName?: string; manufacturerName?: string; modelName?: string };
        [k: string]: unknown;
      };
    };
  };
  const o = x.originProduct ?? {};
  return {
    name: o.name ?? null,
    /** 🟢 owner 가 적는 그 자리다(`naverShoppingSearchInfo`). */
    brandName: o.detailAttribute?.naverShoppingSearchInfo?.brandName ?? null,
    manufacturerName: o.detailAttribute?.naverShoppingSearchInfo?.manufacturerName ?? null,
    salePrice: o.salePrice ?? null,
    stockQuantity: o.stockQuantity ?? null,
    representativeImage: o.images?.representativeImage?.url || null,
    optionalImages: o.images?.optionalImages?.length ?? 0,
    detailContentLength: typeof o.detailContent === "string" ? o.detailContent.length : 0,
    detailAttributeKeys: Object.keys(o.detailAttribute ?? {}).length,
  };
}

describe("WU-135 — 등록 payload E2E (게이트 없으면 SKIP)", () => {
  it.runIf(LIVE)(
    "원상품 재추출 → ListingModel → Naver payload → 운영 validation",
    async () => {
      /* ───── ① 원상품을 실제 경로로 다시 추출(WU-134 복구가 여기서 발화) ───── */
      const extracted = await shopifySiteStrategy.extract(ORIGIN);
      expect(extracted).not.toBeNull();
      const live = buildCanonicalProduct(
        ORIGIN,
        extracted!.productData as ExtractedProductData,
        {} as Record<string, ProductDataSource>,
        [],
      );
      const dna = buildProductIdentityDna(live);
      log(`\n① 원상품 재추출 — brand=${JSON.stringify(dna.brand)} · code=${dna.brandModelCode}`);
      /** 🟢 WU-134 baseline — 이 값이 깨지면 등록 payload 의 브랜드가 비어 버린다. */
      expect(live.brand.value).toBe("Bobo Choses");

      /* ───── ② 저장된 스냅샷과 «같은 상품» 을 비교 — 재추출의 효과를 숫자로 ───── */
      const twoPath = path.join(OUT, "wu130-two.json");
      const stored: CanonicalProduct | null = existsSync(twoPath)
        ? backfillCanonicalProduct(
            (JSON.parse(readFileSync(twoPath, "utf8")) as { s2: Snap }).s2.workspace.canonicalProduct as never,
          )
        : null;
      if (stored) {
        log(
          `② 저장된 스냅샷 brand=${JSON.stringify(stored.brand.value)} ↔ 재추출 brand=${JSON.stringify(live.brand.value)}`,
        );
        /** 🔴 **기존 스냅샷은 브랜드가 비어 있다** — 등록 전에 재추출이 필요하다는 근거다. */
        expect(stored.brand.value).toBe("");
      }

      /* ───── ③ 화면이 쓰는 그 함수로 payload 를 만든다 ───── */
      const buildFor = (product: CanonicalProduct) =>
        buildNaverProductPayload({ product, listing: listingFor(product), ...NAVER_CONTEXT } as never);

      /**
       * 🔴🔴 **측정 대상 상품을 정확히 적는다.** 1차에 `live`(재추출 산출)로 payload 를
       *    만들었더니 **대표이미지가 비었다** — 🔴 그건 제품 결함이 **아니고**, 이미지는
       *    라우트가 만드는 `WorkspaceItem[]` 에서 오는데 내가 `[]` 를 넘겨서다(하니스 결함).
       *
       * 🟢 그래서 **실제 스냅샷(이미지·옵션·가격·상세가 다 있는 그 상품)** 을 쓰고,
       *    거기에 **재추출로 복구된 브랜드만** 얹는다 — 그것이 재추출 «후» 운영이
       *    실제로 갖게 되는 상태이고, 이 WU 가 묻는 「연결에서 정보가 사라지는가」를
       *    그 상태로 재는 것이 정확하다. 🔴 다른 칸은 **한 글자도 만들지 않았다.**
       */
      const target: CanonicalProduct | null = stored
        ? ({ ...stored, brand: { ...stored.brand, value: live.brand.value, source: "ORIGINAL" } } as CanonicalProduct)
        : null;
      if (!target) throw new Error("선행 덤프 없음: wu130-two.json(실제 스냅샷이 필요하다)");

      const payload = buildFor(target);
      log(`③ payload(실제 스냅샷 + 복구 브랜드) — ${JSON.stringify(describePayload(payload), null, 1)}`);
      /** 🔴 복구 «전» 과 비교한다 — 브랜드 칸이 실제로 달라지는지 본다. */
      log(`③ payload(복구 전) brandName = ${JSON.stringify(describePayload(buildFor(stored!)).brandName)}`);

      /* ───── ④ 운영 validation 을 그대로 돌린다 ───── */
      /**
       * 🔴 인자가 **넷** 이다(`validate-payload.ts:147`) — `as never` 로 2개만 넘겼더니
       *    typecheck 가 잡았다. 🟢 세 번째는 **카테고리가 어린이인증을 요구하는가** 이고
       *    이 측정의 컨텍스트와 **같은 값** 을 쓴다(지어내지 않는다).
       */
      const verdict = validateNaverPayload(
        payload,
        { product: target, ...NAVER_CONTEXT } as never,
        NAVER_CONTEXT.categoryRequiresChildCertification,
      );
      /**
       * 🔴🔴 **칸 이름을 또 틀렸다(두 번째) — 기록해 둔다.** `checks` 로 읽어서
       *    「항목 0」이 나왔다. 실제 칸은 **`fields`** 이고 요약 수는 owner 가
       *    **이미 세어 둔다**(`readyCount`/`missingCount`/`blockedCount` ·
       *    `validate-payload.ts:99`). 🔴 내가 다시 세지 않는다.
       */
      const v = verdict as {
        ok: boolean;
        readyCount: number;
        missingCount: number;
        blockedCount: number;
        fields: { field: string; status: string; reason?: string }[];
      };
      const checks = v.fields ?? [];
      const byStatus = { READY: v.readyCount, MISSING: v.missingCount, BLOCKED: v.blockedCount };
      log(`④ validation — ok=${v.ok} · 항목 ${checks.length} · ${JSON.stringify(byStatus)}`);
      /** 🔴 **통과하지 못한 항목을 전부 적는다** — 「PASS」만 적으면 무엇이 남았는지 사라진다. */
      for (const c of checks.filter((x) => x.status !== "READY")) {
        log(`   🔴 ${c.field} = ${c.status} · ${(c.reason ?? "").slice(0, 110)}`);
      }

      /* ───── ⑤ MI 가 확정한 정보가 payload 까지 «살아 있는가» ───── */
      const d = describePayload(payload);
      const survived = {
        브랜드: d.brandName === "Bobo Choses",
        상품명: Boolean(d.name && d.name.length > 0),
        대표이미지: Boolean(d.representativeImage),
        상세정보: d.detailContentLength > 0,
        재고: d.stockQuantity != null,
        판매가: d.salePrice != null,
      };
      log(`⑤ MI → 등록 데이터 생존 — ${JSON.stringify(survived)}`);
      writeFileSync(
        path.join(OUT, "wu-135-registration.json"),
        JSON.stringify({ describe: d, survived, verdict }, null, 2),
        "utf8",
      );

      /**
       * 🔴🔴 **브랜드가 payload 까지 가는 것이 이 WU 의 핵심 연결이다.**
       *    WU-134 가 복구한 값이 등록 칸에서 사라지면 그 작업이 제품에 닿지 않는다.
       */
      expect(d.brandName).toBe("Bobo Choses");
      expect(survived.상품명).toBe(true);
      expect(survived.대표이미지).toBe(true);
    },
    900_000,
  );
});
