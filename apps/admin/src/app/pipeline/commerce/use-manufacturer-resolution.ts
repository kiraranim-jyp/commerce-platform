"use client";

import { useEffect, useState } from "react";
import {
  isProductLevelManufacturer,
  resolveManufacturer,
  type ManufacturerOrigin,
  type ManufacturerResolution,
} from "@commerce/listing";
import type { InputMode } from "@commerce/shared";

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
 * ── 한 라우트만 읽는다 ──────────────────────────────────────────────────
 *   /api/settings/coupang/brand-profiles 브랜드별 제조사
 *
 * 🔴 PIVOT NEXT-04c-2 — 여기 있던 `/api/settings/seller-settings` 조회가
 * 사라졌다. 그 값(판매자 공통 제조사)은 실제로는 «판매 사업자»(규하맘샵)이고,
 * 어느 채널도 그것을 제조사로 쓰라고 하지 않는다. 단계가 없어졌으니 조회도
 * 없앤다 — 남겨 두면 언제든 다시 배선된다.
 *
 * 🔴 PIVOT-03 0-4+2-B — 그 전에도 한 번 바뀌었던 자리다. 판매자 제조사를
 * `/api/settings/coupang/profiles`(배송 프로필 «목록»)에서 꺼내
 * `find(isDefault) ?? list[0]` 으로 «골랐다». 서버 등록 경로에는 그런 규칙이
 * 없어서 화면과 등록값이 갈라질 수 있었다.
 *
 * 브랜드 프로필 경로에 coupang이 들어 있는 것은 저장소가 처음 만들어진 자리
 * 때문이고, 담긴 값은 채널 중립이다(네이버 resolve-context.ts · 롯데ON
 * build-context.ts도 서버에서 같은 저장소를 읽는다).
 *
 * ── 판정은 여기서 하지 않는다 ────────────────────────────────────────────
 * 우선순위는 `@commerce/listing`의 공통 `resolveManufacturer()` 하나가 정한다 —
 * payload가 쓰는 그 함수다. 이 훅은 값을 모아 그 함수에 넘길 뿐이다.
 */

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
}

/**
 * 서버(`findBrandProfileByName` → `normalizeBrandKey`)와 **같은 매칭 규칙**:
 * 유니코드 정규화(NFKC) + 앞뒤 공백 제거 + 연속 공백 한 칸 + 대소문자 무시
 * **정확 일치**. 부분 일치는 쓰지 않는다("Play"가 "Play Up"에 붙는 사고를
 * 서버가 이미 한 번 막았다 — brand-profile.ts 주석).
 *
 * REWORK-13A(CEO 지시, 2026-09-15) — 예전에는 여기가 `trim().toLowerCase()`,
 * 서버는 Postgres `ilike`였다. 두 규칙이 미묘하게 달라서(저장된 이름 쪽 공백은
 * 아무도 다듬지 않았고, `ilike`는 이름 안의 `%`·`_`를 와일드카드로 읽었다)
 * 같은 브랜드에 대해 화면과 서버가 다른 답을 낼 수 있었다. 규칙을 한 글자로
 * 맞춘다 — 없는 값을 찾아내려는 fuzzy 매칭이 아니라, **같은 이름을 같은 이름으로
 * 읽게** 하는 정규화다.
 */
export function normalizeBrandKey(name: string): string {
  return name.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

function findBrandManufacturer(rows: BrandProfileRow[], brandName: string): string | null {
  const key = normalizeBrandKey(brandName);
  if (!key) return null;
  const hit = rows.find((row) => normalizeBrandKey(row.name ?? "") === key);
  return hit?.manufacturer ?? null;
}

/**
 * REWORK-13A — 상품이 들고 있는 제조사를 5단계의 ①·②·⑤ 중 어디로 셀지.
 *
 * 하위호환: 첫 인자로 **문자열**을 그대로 넘기던 기존 호출부(CommerceWorkspace)는
 * 그대로 동작한다 — 그때는 출처를 알 수 없으므로 ②(원본 상품정보)로 센다.
 * 필드 자체(provenance 포함)를 넘기면 ⑤(직접 입력)과 ①(원본 명시)까지 정확히
 * 갈린다.
 */
export type ProductManufacturerInput =
  | string
  | { value: string; source: string; origin?: ManufacturerOrigin; inputMode?: InputMode };

function splitProductManufacturer(input: ProductManufacturerInput) {
  if (typeof input === "string") return { productInfoManufacturer: input };
  /* 🔴 PIVOT NEXT-04c — 입력 «방식» 을 잃지 않는다.
     이 화면이 P0 를 드러낸 자리다: 값이 비었다는 이유로 {} 를 돌려주면
     resolver 가 판매자 기본값까지 내려가 「규하맘샵」을 말하는데, 바로 아래
     고시정보는 「상세페이지 참조」를 말했다. 두 곳이 같은 필드의 다른 면을
     본 것이다. 이제 같은 사실을 넘긴다. */
  const inputMode: InputMode | undefined =
    input.inputMode ?? (input.source === "DETAIL_PAGE_REFERENCE" ? "DETAIL_REFERENCE" : undefined);
  const value = (input.value ?? "").trim();
  if (!value) return inputMode ? { productInputMode: inputMode } : {};
  if (input.source === "USER_EDITED") return { manualManufacturer: value };
  if (input.origin === "SOURCE_URL") return { sourceUrlManufacturer: value };
  return { productInfoManufacturer: value };
}

export function useManufacturerResolution(
  productManufacturer: ProductManufacturerInput,
  brandName: string,
): ManufacturerResolutionState {
  const [lookup, setLookup] = useState<ProfileLookup>({ brand: null, brandDefault: null });

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/settings/coupang/brand-profiles")
      .then((res) => res.json())
      .then((data: { profiles?: BrandProfileRow[] }) => findBrandManufacturer(data.profiles ?? [], brandName))
      .catch(() => null)
      .then((brandDefault) => {
        if (cancelled) return;
        setLookup({ brand: brandName, brandDefault });
      });
    return () => {
      cancelled = true;
    };
  }, [brandName]);

  /* 상품이 이미 제조사를 들고 있으면(①·②·⑤) 폴백을 기다릴 이유가 없다.
     그 외에는 이 브랜드에 대한 조회가 끝났을 때만 확정된 판정을 말한다. */
  const answered = lookup.brand === brandName;
  const productLevel = splitProductManufacturer(productManufacturer);
  /* 🔴 PIVOT NEXT-04c-2 — 판매자 기본정보 단계가 사라지고 «브랜드명» 이 그
     자리에 왔다. 이 화면이 「규하맘샵」을 제조사로 보여 주던 자리다.

     🔴 brandName 을 여기서도 넘기는 이유: 3커머스 payload 가 전부 이 대체를
     쓴다(CPO 확정 — 실제 제조사 → 브랜드명 → 확인 필요). 화면만 빼면 칸에는
     「제조사 미확인」이 뜨는데 등록에는 브랜드명이 나간다 — 방금 닫은 그
     P0(화면과 payload 가 같은 필드의 다른 면을 보던 것)를 다시 여는 것이다. */
  const resolution = resolveManufacturer({
    ...productLevel,
    brandProfileManufacturer: answered ? lookup.brandDefault : null,
    brandName,
  });
  return {
    ...resolution,
    loading: !isProductLevelManufacturer(resolution.source) && !answered,
    brand: brandName,
  };
}
