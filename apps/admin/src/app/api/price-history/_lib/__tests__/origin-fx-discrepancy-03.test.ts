import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 MI-ORIGIN-FX-DISCREPANCY-03 — **미규명 2건의 원인 확정**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 `-02` 가 금액 불일치 **12건** 중 10건을 「할인 포착 비대칭」으로 닫고 **2건을
 *    미규명으로 남겼다**(관측 **115 GBP** ↔ 추출 **119 GBP** · 할인 플래그 없음 · 같은 날).
 * 🟢 이 파일이 그 2건의 원인을 **운영 데이터와 소스 위치로** 확정한다.
 *
 * ── 🟢🟢 원인 (확신 수준: **확정** · 추측 0) ───────────────────────────────
 * ```
 * 이 상품은 **사이즈마다 가격이 다르다**(운영 variants 전수):
 *    £115 — 21 EUR(UK 4) · 22 EUR(UK 5)                      ← variants[0] 쪽
 *    £119 — 24 · 25 · 26 · 28 · **29 EUR(UK 11)**             ← URL 이 가리키는 그 옵션
 *    £123 — 30 · 31
 *
 * 스냅샷 URL  …/en-kr/products/lulu-t-bar-shoes-in-tobacco-by-pepe?…&**variant=40096037535807**
 *             ⟹ 그 id 가 **29 EUR(UK 11) = £119** 이고 추출가가 정확히 **119** 다
 * 관측 URL    …/products/lulu-t-bar-shoes-in-tobacco-by-pepe**.json**  (로케일·variant **없음**)
 *             ⟹ 「구매 가능한 첫 variant」 = 21 EUR(UK 4) = **£115**
 * ```
 * 🔴🔴 **그러므로 둘 중 하나가 «틀린 값» 이 아니다 — 서로 «다른 옵션» 의 가격이다.**
 *
 * ── 🔴🔴 더 정확한 분류: «같은 수정이 한쪽 경로에만 적용됐다» ─────────────
 * ```
 * 🟢 CEO 지시 **P0-A.29-E ㉮**(2026-09-20 · 커밋 `683d9d83`
 *    「URL 이 «UK 11» 을 가리키는데 «UK 4» 가격을 쓰던 것을 멈춘다」)가
 *    `extractShopifySelectedVariantId`(shopify-product-json.ts:31)를 만들어
 *    **추출 경로** 에서 `?variant=` 를 존중하게 했다.
 *    🟢 그 커밋의 주석이 **이 상품·이 variant id·£115/£119/£123 을 그대로 적어 뒀다**
 *       (shopify-product-json.ts:417-425) — 즉 **이미 알려진 결함의 나머지 반쪽** 이다.
 * 🔴 그런데 **관측(probe) 경로** 는 URL 을 새로 조립한다 —
 *    `shopify-market-probe.ts:31  const url = \`${"${origin}${prefix}/products/${handle}"}\``
 *    ⟹ `?variant=` 가 **거기서 버려진다.** 그 파일의 마지막 변경은 **2026-09-13** 이고
 *       `683d9d83`(2026-09-20)보다 **먼저** 다 ⟹ **그 수정이 이 경로에 오지 않았다.**
 * 🔴 사례 관측 시각이 그것을 증명한다 — **2026-09-20** 과 **2026-10-01**(수정 이후)인데
 *    여전히 115 다.
 * ```
 *
 * ── CPO 6분류 대조 ────────────────────────────────────────────────────────
 * ```
 * ① 사이트 표시가 ↔ 추출가 차이   🔴 아니다 — 사이트는 두 질문에 **정확히** 답했다
 * ② 통화·소수점·반올림            🔴 아니다 — 둘 다 GBP 정수 · 환산 정합 100%
 * ③ **상품 옵션/판매 단위 차이**   🟢🟢 **이것이다**(사이즈별 가격 · URL 이 가리킨 옵션)
 * ④ 관측 시점 ↔ 스냅샷 시점 차이  🔴 아니다 — 같은 분(실측 15초·15초 차)
 * ⑤ 데이터 연결 오류              🟡 **부분** — 원인은 «경로별 URL 조립 비대칭» 이다
 * ⑥ 원인 확인 불가                🔴 아니다 — ③으로 확정됐다
 * ```
 *
 * 🔴 **운영 코드 변경 0 · DB 쓰기 0 · 정책 변경 0**(지시 §3). 이 파일은 원인을 **잠그기만** 한다.
 * 🟢 나중에 probe 경로에 variant 가 배선되면 **C-1 이 FAIL 로 뒤집히고** 그것이 수정의 증거다.
 */

const FIX = path.join(__dirname, "fixtures", "origin-fx-discrepancy-03.json");
const FULL = path.join(__dirname, "fixtures", "origin-fx-accuracy-full.json");

const PINNED_VARIANT_ID = "40096037535807";

interface Variant {
  id: string;
  sku: string | null;
  price: { amount?: number; currency?: string } | null;
  optionValues: Record<string, string> | null;
  stockQuantity: number | null;
}
interface Snap {
  id: string;
  source_url: string;
  title: string | null;
  canonical_price: { value?: { amount?: number; currency?: string } } | null;
  variants: Variant[];
}
interface Obs {
  id: string;
  snapshot_id: string;
  source_label: string | null;
  source_product_url: string | null;
  currency: string;
  price_amount: string | null;
  sale_price_krw: string | null;
  original_price_krw: string | null;
  market_code: string | null;
  checked_at: string;
}

const load = (): { snapshots: Snap[]; observations: Obs[] } =>
  JSON.parse(readFileSync(FIX, "utf8")) as { snapshots: Snap[]; observations: Obs[] };

/** 🔴 소스 문자열 검사는 **주석을 벗기고** 한다(헌장 §5 · 여덟 번 걸린 함정). */
const bareSource = (p: string): string =>
  readFileSync(p, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*\/\/[^\n]*$/gm, " ");

const REPO = path.join(__dirname, "..", "..", "..", "..", "..", "..", "..", "..");
const PROBE = path.join(REPO, "packages", "crawler", "src", "shopify-market-probe.ts");
const JSONSRC = path.join(REPO, "packages", "crawler", "src", "shopify-product-json.ts");

describe("MI-ORIGIN-FX-DISCREPANCY-03 — 미규명 2건의 원인", () => {
  it("A-0 🔴 입력이 저장소 안에 있고 두 사례가 그대로다 — 없으면 FAIL(SKIP 금지)", () => {
    expect(existsSync(FIX), "🔴 증거 fixture 가 없다").toBe(true);
    const { snapshots, observations } = load();
    expect(snapshots, "🔴 사례 스냅샷 2").toHaveLength(2);
    /** 🔴 분모를 못 박는다 — 그 스냅샷의 SELLER_ORIGIN 행 전수 8(= 4 × 2). */
    expect(observations, "🔴 관측 8행").toHaveLength(8);
    for (const s of snapshots) {
      expect(s.variants, "🔴 variants 9개").toHaveLength(9);
      expect(s.canonical_price?.value, "🔴 추출가 119 GBP").toEqual({ amount: 119, currency: "GBP" });
    }
  });

  it("B-1 🟢🟢 이 상품은 «사이즈마다 가격이 다르다» — £115 / £119 / £123", () => {
    const { snapshots } = load();
    for (const s of snapshots) {
      const byPrice = new Map<number, string[]>();
      for (const v of s.variants) {
        const a = v.price?.amount;
        expect(typeof a, `🔴 ${v.id} 가격 없음`).toBe("number");
        expect(v.price?.currency, "🔴 전건 GBP").toBe("GBP");
        if (!byPrice.has(a!)) byPrice.set(a!, []);
        byPrice.get(a!)!.push(v.optionValues?.Size ?? "(no size)");
      }
      /** 🔴 세 가격대가 실재한다 — 「한 상품 한 가격」 전제가 이 상품에서 깨진다. */
      expect([...byPrice.keys()].sort((x, y) => x - y), "🔴 가격대 셋").toEqual([115, 119, 123]);
      expect(byPrice.get(115), "🔴 £115 는 작은 사이즈 둘").toEqual(["21 EUR (UK 4)", "22 EUR (UK 5)"]);
      expect(byPrice.get(119)?.length, "🔴 £119 는 다섯").toBe(5);
      expect(byPrice.get(123)?.length, "🔴 £123 은 둘").toBe(2);
    }
  });

  it("B-2 🟢🟢 스냅샷 URL 이 가리킨 variant 의 가격이 «정확히» 추출가 119 다", () => {
    const { snapshots } = load();
    for (const s of snapshots) {
      const pinned = new URL(s.source_url).searchParams.get("variant");
      expect(pinned, "🔴 스냅샷 URL 이 variant 를 고정한다").toBe(PINNED_VARIANT_ID);
      const v = s.variants.find((x) => String(x.id) === PINNED_VARIANT_ID);
      expect(v, "🔴 그 id 가 variants 안에 있다").toBeTruthy();
      expect(v!.optionValues?.Size, "🟢 그 옵션은 UK 11").toBe("29 EUR (UK 11)");
      expect(v!.price?.amount, "🟢🟢 그 옵션 가격 == 추출가").toBe(s.canonical_price?.value?.amount);
      expect(v!.price?.amount, "🟢 119").toBe(119);
    }
  });

  it("B-3 🟢🟢 관측 URL 은 variant·로케일을 «버린다» — 그래서 115(첫 구매가능 옵션)다", () => {
    const { snapshots, observations } = load();
    const bySnap = new Map(snapshots.map((s) => [s.id, s]));
    const origin = observations.filter((o) => o.source_label === "ORIGIN_FX");
    expect(origin, "🔴 ORIGIN_FX 2행").toHaveLength(2);
    for (const o of origin) {
      const s = bySnap.get(o.snapshot_id)!;
      /** 🔴 관측이 실제로 찌른 URL 에 variant 가 없다. */
      expect(new URL(o.source_product_url!).searchParams.get("variant"), "🔴 variant 가 버려졌다").toBeNull();
      /** 🔴 로케일 프리픽스도 사라졌다 — 스냅샷은 `/en-kr/`, 관측은 없다. */
      expect(new URL(s.source_url).pathname.startsWith("/en-kr/"), "🔴 스냅샷은 en-kr").toBe(true);
      expect(new URL(o.source_product_url!).pathname.startsWith("/products/"), "🔴 관측은 로케일 없음").toBe(true);
      /** 🟢 그 결과 금액이 첫 구매가능 옵션(£115)이다. */
      expect(Number(o.price_amount), "🟢 관측 115").toBe(115);
      expect(o.currency).toBe("GBP");
      /** 🔴 할인이 아니다 — 두 칸이 비어 있다(그래서 `-02` 가 미규명으로 남겼다). */
      expect(o.sale_price_krw, "🔴 할인 플래그 없음").toBeNull();
      expect(o.original_price_krw, "🔴 정가 칸 없음").toBeNull();
      /** 🟢 첫 구매가능 variant 가 실제로 115 인지 데이터로 확인한다(가정하지 않는다). */
      const firstAvailable = s.variants.find((v) => (v.stockQuantity ?? 0) > 0);
      expect(firstAvailable?.price?.amount, "🟢 첫 구매가능 옵션 == 관측가").toBe(Number(o.price_amount));
    }
  });

  it("B-4 🟢 시점 차이가 원인이 «아니다» — 스냅샷과 관측이 같은 분 안이다", () => {
    const { snapshots, observations } = load();
    const bySnap = new Map(snapshots.map((s) => [s.id, s]));
    for (const o of observations.filter((x) => x.source_label === "ORIGIN_FX")) {
      const s = bySnap.get(o.snapshot_id)!;
      /** 🔴 fixture 에 스냅샷 created_at 이 없으므로 전수 fixture 에서 읽는다(지어내지 않는다). */
      const full = JSON.parse(readFileSync(FULL, "utf8")) as { snapshots: { id: string; created_at: string }[] };
      const created = full.snapshots.find((x) => x.id === s.id)!.created_at;
      const gap = Math.abs(new Date(o.checked_at).getTime() - new Date(created).getTime()) / 1000;
      expect(gap, `🔴 ${s.id} 시차 ${gap}s — 가격 변동으로 설명할 간격이 아니다`).toBeLessThan(60);
    }
  });

  /* ── C. 🔴🔴 배선 비대칭 — 같은 수정이 한쪽에만 적용됐다 ─────────────────── */

  it("C-1 🔴🔴 `?variant=` 를 존중하는 곳은 추출 경로뿐 — probe 경로의 URL 조립엔 «없다»", () => {
    /**
     * 🔴 이 단언이 **현재 상태를 사실로 고정** 한다. 나중에 probe 에 variant 가 배선되면
     *    여기가 **FAIL 로 뒤집히고** 그것이 수정의 증거다(쿠팡 고시·WU-076 선례와 같은 모양).
     * 🔴 **고치지 않았다** — 지시 §3 이 운영 코드 변경을 금지했다.
     */
    const jsonSrc = bareSource(JSONSRC);
    const probeSrc = bareSource(PROBE);

    /**
     * 🟢 추출 경로는 `?variant=` 를 읽는다.
     * 🔴🔴 **내 1차 단언이 뚫렸고 그 교훈을 남긴다** — `toContain("extractShopifySelectedVariantId")`
     *    로 썼더니 이름을 `…IdX` 로 바꾸는 변이(M2)가 **통과** 했다(부분 문자열이라 여전히 매칭).
     * 🟢 그래서 **선언 경계까지** 단언한다 — 이름이 바뀌면 FAIL 한다.
     */
    expect(jsonSrc, "🟢 추출 경로에 variant 추출기가 «그 이름으로» 선언돼 있다").toContain(
      "export function extractShopifySelectedVariantId(",
    );
    expect(jsonSrc, "🟢 그 추출기가 실제로 쿼리 파라미터를 읽는다").toContain(
      ["searchParams", '.get("variant")'].join(""),
    );

    /** 🔴 probe 경로는 그것을 **쓰지 않는다** — 어휘 자체가 없다. */
    expect(probeSrc, "🔴 probe 가 variant 추출기를 쓰고 있다면 이 계약을 갱신해야 한다").not.toContain(
      "extractShopifySelectedVariantId",
    );
    expect(probeSrc, "🔴 probe 가 variant 파라미터를 읽고 있다면 이 계약을 갱신해야 한다").not.toContain(
      ["searchParams", '.get("variant")'].join(""),
    );
    /** 🔴 그리고 URL 을 **handle 만으로** 조립한다 — 그 줄이 variant 를 버리는 자리다. */
    expect(probeSrc, "🔴 probe 의 URL 조립 모양").toContain("/products/${handle}`");
  });

  it("C-2 🔴 영향 범위 — ORIGIN_FX 498행 중 variant 지정 9 · 그중 불일치 2(전수 fixture)", () => {
    const full = JSON.parse(readFileSync(FULL, "utf8")) as {
      observations: { snapshot_id: string; source_label: string | null; price_amount: string | null; checked_at: string }[];
      snapshots: { id: string; source_url: string; canonical_price: { value?: { amount?: number } } | null }[];
    };
    const byId = new Map(full.snapshots.map((s) => [s.id, s]));
    const hasVariant = (u: string): boolean => {
      try {
        return new URL(u).searchParams.get("variant") !== null;
      } catch {
        return false;
      }
    };
    let pinned = 0;
    let pinnedMismatch = 0;
    let afterFixMismatch = 0;
    for (const o of full.observations.filter((x) => x.source_label === "ORIGIN_FX")) {
      const s = byId.get(o.snapshot_id);
      const gt = s?.canonical_price?.value?.amount;
      if (!s || typeof gt !== "number") continue;
      if (!hasVariant(s.source_url)) continue;
      pinned += 1;
      if (Number(o.price_amount) !== gt) {
        pinnedMismatch += 1;
        /** 🔴 수정(`683d9d83` · 2026-09-20) «이후» 관측인데도 불일치한다 = 현재 경로의 성질이다. */
        if (String(o.checked_at).slice(0, 10) >= "2026-09-20") afterFixMismatch += 1;
      }
    }
    expect(pinned, "🔴 variant 를 고정한 ORIGIN_FX 행 9").toBe(9);
    expect(pinnedMismatch, "🔴 그중 불일치 2").toBe(2);
    expect(afterFixMismatch, "🔴🔴 둘 다 수정 이후 관측이다 — 과거 잔존이 아니다").toBe(2);
    console.log(`\n═══ C-2 영향 범위(전수 fixture) ═══`);
    console.log(`    ORIGIN_FX 498 중 \`?variant=\` 고정 **${pinned}** · 그중 불일치 **${pinnedMismatch}**`);
    console.log(`    🔴 둘 다 683d9d83(2026-09-20) **이후** 관측 ⟹ **현재 경로에서 재현된다**`);
    console.log(`    🟡 나머지 7은 일치 — 사이즈별 가격이 없는 상품이면 두 규칙이 같은 값을 낸다`);
    console.log(`    🔴 「신발 45%가 사이즈별 가격」은 shopify-product-json.ts:421 의 과거 실측이고`);
    console.log(`       이 입력(canonical_price 만 담았다)으로는 **재측정 불가** 다`);
  });
});
