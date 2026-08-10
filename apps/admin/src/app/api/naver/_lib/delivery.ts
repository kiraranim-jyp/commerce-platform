import { callNaverApi } from "./client";

/**
 * Sprint N-3.3 — `GET /v2/product-delivery-info/return-delivery-companies`
 * (공식 OpenAPI 스펙, commerce-api-naver/commerce-api docs/2.0.0-RC.js에서
 * 발견 — N-2.5가 찾던 "택배사 코드 조회 API"는 이 경로였다. N-2.5의 3개
 * 후보는 전부 잘못된 경로였을 뿐 API 자체가 없었던 게 아니다). 실제
 * production 계정으로 호출해서 판매자가 등록해 둔 반품 택배사 목록(id/name/
 * priorityType)을 확인했다 — 이건 "반품/교환 택배사"용이지 일반 출고
 * 택배사(deliveryInfo.deliveryCompany) 조회 API는 아니다(스펙에 별도로
 * 존재하지 않음, 여전히 BLOCKED).
 *
 * 카테고리 캐시(category.ts)와 같은 이유로 짧게 캐시한다 — 판매자가 Wing에서
 * 반품 택배사를 바꾸면 다음 캐시 만료 후 자동으로 반영된다.
 */
export interface NaverReturnDeliveryCompany {
  id: number;
  name: string;
  priorityType: string;
}

let cache: { fetchedAt: number; companies: NaverReturnDeliveryCompany[] } | null = null;
const CACHE_TTL_MS = 10 * 60 * 1000;

interface RawReturnDeliveryCompany {
  id?: number;
  name?: string;
  returnDeliveryCompanyPriorityType?: string;
}

export async function fetchNaverReturnDeliveryCompanies(
  accessToken: string,
): Promise<NaverReturnDeliveryCompany[] | null> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.companies;
  }
  const result = await callNaverApi(accessToken, {
    method: "GET",
    path: "/v2/product-delivery-info/return-delivery-companies",
  });
  if (!result.ok || result.status !== 200) return null;
  const body = result.body as { returnDeliveryCompanies?: RawReturnDeliveryCompany[] };
  const companies: NaverReturnDeliveryCompany[] = (body.returnDeliveryCompanies ?? [])
    .filter((c) => c.id != null && c.name && c.returnDeliveryCompanyPriorityType)
    .map((c) => ({ id: c.id as number, name: c.name as string, priorityType: c.returnDeliveryCompanyPriorityType as string }));
  cache = { fetchedAt: Date.now(), companies };
  return companies;
}

/** 우선순위 타입 PRIMARY를 가진 택배사를 우선 선택한다 — 스펙 원문("미입력 시
 * 기본 반품 택배사(PRIMARY)로 설정됩니다")과 일치하는 기본 동작. 목록이
 * 비어 있으면(판매자가 반품 택배사를 하나도 등록 안 했으면) null — 이 경우
 * returnDeliveryCompanyPriorityType 자체를 채우지 않는다(추측 금지). */
export function resolvePrimaryReturnCompany(
  companies: NaverReturnDeliveryCompany[],
): NaverReturnDeliveryCompany | null {
  return companies.find((c) => c.priorityType === "PRIMARY") ?? companies[0] ?? null;
}
