"use client";

import { useEffect, useState } from "react";
import { resolveManufacturer, type ManufacturerResolution } from "@commerce/listing";

/**
 * REWORK-10 A(CEO 지시, 2026-09-15) — **화면이 resolver 결과를 받는 배선.**
 *
 * ── 고치는 버그 ──────────────────────────────────────────────────────────
 * 폴백 사슬(상품 원문 → 브랜드 프로필 → 판매자 기본정보)은 쿠팡·스마트스토어
 * payload에 이미 있었다. 그런데 **화면**은 그 결과를 스마트스토어 탭에서만
 * 받았다 — CommerceWorkspace가 `naverResolved`를 `tab === "smartstore"`일 때만
 * 내려보내기 때문이다(CommerceWorkspace.tsx L2757). 그래서 쿠팡 탭은 브랜드
 * 프로필이 제조사를 채워 주는 상품에서도 "⚠ 제조사 정보가 없습니다"를 띄웠고,
 * 롯데ON 탭은 제조사를 말하는 자리 자체가 없었다.
 *
 * ── 왜 탭과 무관한가 ─────────────────────────────────────────────────────
 * 브랜드 프로필 · 판매자 기본정보는 **채널 데이터가 아니다.** 셀러가 Settings에
 * 한 번 넣으면 세 채널이 같은 값을 쓴다. 그러니 이 조회도 탭이 아니라 **상품**
 * (정확히는 상품의 브랜드명)에만 걸려야 한다.
 *
 * ── 새 API를 만들지 않는다 ───────────────────────────────────────────────
 * 이미 화면이 쓰던 두 라우트를 그대로 읽는다:
 *   /api/settings/coupang/profiles       (SellerProfileSummaryCard가 이미 읽는다)
 *   /api/settings/coupang/brand-profiles (설정 화면의 브랜드 프로필 목록)
 * 경로에 coupang이 들어 있는 것은 저장소가 처음 만들어진 자리 때문이고, 담긴
 * 값은 채널 중립이다(네이버 resolve-context.ts · 롯데ON build-context.ts도
 * 서버에서 같은 두 저장소를 읽는다).
 *
 * ── 판정은 여기서 하지 않는다 ────────────────────────────────────────────
 * 우선순위는 `@commerce/listing`의 공통 `resolveManufacturer()` 하나가 정한다 —
 * payload가 쓰는 그 함수다. 이 훅은 값을 모아 그 함수에 넘길 뿐이다.
 */

interface SellerProfileRow {
  isDefault?: boolean;
  manufacturer?: string | null;
}

interface BrandProfileRow {
  name?: string | null;
  manufacturer?: string | null;
}

export interface ManufacturerResolutionState extends ManufacturerResolution {
  /** 아직 프로필 조회가 끝나지 않았다 — "없다"고 단정하면 안 되는 구간이다. */
  loading: boolean;
  /**
   * REWORK-12 ④(CEO 판정, 2026-09-15: "여전히 제조사 미확인") — **어느 브랜드로
   * 조회했는가.**
   *
   * DB 실측(SELECT only, 2026-09-15): `coupang_brand_profiles` 는 2행뿐이고
   * (Apolina · The Animals Observatory), `coupang_seller_profiles` 3행은 기본
   * 프로필까지 전부 `manufacturer = null` 이다. 즉 대부분의 상품에서 폴백은
   * **실제로 답이 없다**. 그 사실을 "제조사 미확인" 네 글자로만 말하면 셀러는
   * 무엇이 잘못됐는지도, 무엇을 하면 되는지도 알 수 없다.
   *
   * 화면이 «브랜드 X로 찾아봤는데 없었다»라고 말할 수 있도록 조회에 쓴 이름을
   * 결과와 함께 들고 나간다. 판정을 하나도 바꾸지 않는다 — 문장에 쓰는 값이다.
   */
  brand: string;
}

/**
 * 조회 결과와 **그 결과가 어느 브랜드의 것인지**를 함께 들고 있는다.
 *
 * 왜 `loading` 상태를 따로 두지 않는가: effect 본문에서 `setLoading(true)`를
 * 부르면 cascading render가 되고(react-hooks/set-state-in-effect), 무엇보다
 * 브랜드가 바뀐 **첫 렌더**에 아직 옛 브랜드의 값을 "확정된 결과"로 내보내게
 * 된다. 답이 어느 질문에 대한 것인지를 값 안에 넣어 두면 그 창이 없어진다.
 */
interface ProfileLookup {
  brand: string | null;
  brandDefault: string | null;
  sellerDefault: string | null;
}

/**
 * 서버(`findBrandProfileByName`)와 **같은 매칭 규칙**: 공백 제거 + 대소문자
 * 무시 정확 일치. 부분 일치는 쓰지 않는다("Play"가 "Play Up"에 붙는 사고를
 * 서버가 이미 한 번 막았다 — brand-profile.ts 주석).
 */
function findBrandManufacturer(rows: BrandProfileRow[], brandName: string): string | null {
  const key = brandName.trim().toLowerCase();
  if (!key) return null;
  const hit = rows.find((row) => (row.name ?? "").trim().toLowerCase() === key);
  return hit?.manufacturer ?? null;
}

export function useManufacturerResolution(
  productManufacturer: string,
  brandName: string,
): ManufacturerResolutionState {
  const [lookup, setLookup] = useState<ProfileLookup>({
    brand: null,
    brandDefault: null,
    sellerDefault: null,
  });

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      fetch("/api/settings/coupang/profiles")
        .then((res) => res.json())
        .then((data: { profiles?: SellerProfileRow[] }) => {
          const list = data.profiles ?? [];
          return (list.find((p) => p.isDefault) ?? list[0])?.manufacturer ?? null;
        })
        .catch(() => null),
      fetch("/api/settings/coupang/brand-profiles")
        .then((res) => res.json())
        .then((data: { profiles?: BrandProfileRow[] }) => findBrandManufacturer(data.profiles ?? [], brandName))
        .catch(() => null),
    ]).then(([sellerDefault, brandDefault]) => {
      if (cancelled) return;
      setLookup({ brand: brandName, brandDefault, sellerDefault });
    });
    return () => {
      cancelled = true;
    };
  }, [brandName]);

  /* 상품 원문에 제조사가 있으면 폴백을 기다릴 이유가 없다 — ①이 이미 답이다.
     그 외에는 이 브랜드에 대한 조회가 끝났을 때만 확정된 판정을 말한다. */
  const answered = lookup.brand === brandName;
  const resolution = resolveManufacturer({
    productManufacturer,
    brandProfileManufacturer: answered ? lookup.brandDefault : null,
    sellerProfileManufacturer: answered ? lookup.sellerDefault : null,
  });
  return { ...resolution, loading: resolution.source !== "PRODUCT" && !answered, brand: brandName };
}
