import { CATEGORY_PROFILE_LIST, selectedMarketSourceScopes, sourceFitsScopes } from "@commerce/category";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { listDomesticPriceSources } from "../domestic-price-sources/_lib/domestic-price-source";

export const runtime = "nodejs";

/**
 * MARKET-CATEGORY-1(CEO 확정, 2026-09-15) — 상품 검색 화면의 [대상 카테고리]
 * 목록. **카탈로그 실측 기반이다.**
 *
 * ── 왜 상수 목록을 그대로 내려주지 않나 ──────────────────────────────────
 * 이름만 내려주면 셀러가 "골프용품"을 고르는 순간 조사 대상이 0곳이 된다 —
 * 그리고 화면은 그 결과를 "국내 비교상품 없음"이라고 말한다. 사실은 "뒤질 곳이
 * 한 곳도 없었다"인데 말이다(049 주석이 예고한 실패 모드 그대로).
 * 그래서 이름 옆에 **지금 이 워크스페이스가 그 카테고리로 검색하면 실제로 몇
 * 곳을 뒤지는가**를 같이 센다.
 *
 * ── 골프용품을 코드로 막지 않는다(CTO 확정) ──────────────────────────────
 * "골프용품"이라는 문자열은 이 파일 어디에도 없다. 잠그는 규칙은 하나뿐이다:
 * **카탈로그에 이 카테고리 소스가 0개면 선택 불가.** CEO가 승인한 골프 사이트가
 * domestic_price_sources에 들어오는 순간(SQL 한 줄), 이 라우트는 코드 변경 없이
 * 그 카테고리를 선택 가능으로 돌려주기 시작한다. 반대로 오늘 0개인 다른
 * 카테고리(여성 패션·패션 잡화·라이프스타일)도 같은 규칙으로 함께 잠긴다 —
 * 골프만 특별 취급하면 그건 또 하나의 하드코딩이다.
 *
 * ── 판정을 두 번 구현하지 않는다 ─────────────────────────────────────────
 * 세는 식(sourceFitsScopes + enabled + status==="ACTIVE")은 실제 조사 경로
 * (run-domestic-price-check.ts / domestic-price-sources/search)와 **같은 함수·
 * 같은 조건**이다. 화면이 "16곳"이라고 말하는데 실제로는 3곳만 뒤지는 종류의
 * 거짓말을 구조적으로 막는다.
 */
export interface MarketCategoryOption {
  id: string;
  label: string;
  /** 이 워크스페이스가 이 카테고리로 검색하면 실제로 뒤지는 판매처 수
   * (카탈로그 ON && 셀러 ON && ACTIVE && 카테고리 적합). */
  sourceCount: number;
  /** 셀러 on/off를 빼고 **카탈로그에 준비돼 있는** 판매처 수. 선택 가능 여부는
   * 이 값으로 정한다 — 셀러가 자기 목록에서 전부 꺼 둔 것과 "우리가 아직 사이트를
   * 확보하지 못한 것"은 완전히 다른 사실이고, 후자만 "준비중"이다. */
  catalogSourceCount: number;
  /** false면 화면에서 선택 불가("준비중"). */
  available: boolean;
}

export async function GET() {
  // 이 목록은 워크스페이스별 편집샵 설정을 읽는다 — 익명에게 열지 않는다.
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const sources = await listDomesticPriceSources(auth.user.workspaceId);

  const categories: MarketCategoryOption[] = CATEGORY_PROFILE_LIST.map((profile) => {
    // 셀러가 고른 카테고리를 조사 범위로 바꾸는 그 함수를 그대로 쓴다
    // (여기서 marketSourceScopes를 직접 펼치면 두 곳이 언젠가 어긋난다).
    const scopes = selectedMarketSourceScopes(profile.id);
    const fitting = sources.filter(
      (s) => s.status === "ACTIVE" && sourceFitsScopes(s.categoryScope, scopes),
    );
    const catalogSourceCount = fitting.filter((s) => s.catalogEnabled).length;
    return {
      id: profile.id,
      label: profile.label,
      sourceCount: fitting.filter((s) => s.enabled).length,
      catalogSourceCount,
      available: catalogSourceCount > 0,
    };
  });

  return NextResponse.json({ ok: true, categories });
}
