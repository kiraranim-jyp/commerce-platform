import type { CoupangCredentials } from "./env";
import { callCoupangApi } from "./client";

/**
 * 출고지(발송지) 조회 + 상품 소싱 국가에 맞는 출고지 자동 선택 — settings/shipping-places
 * 라우트(UI 드롭다운용)와 register 라우트(실제 등록 시 자동 선택용) 둘 다 이 로직을
 * 공유한다. CartPilot 계정은 `해외구매대행`(AGENT_BUY)만 등록하므로 출고지는 항상
 * 해외 주소이고(Wing 정책 문서로 확인됨), 상품마다 원산지 국가가 다를 수 있어
 * Settings에 고정값 하나만 저장해두는 방식으로는 정확할 수 없다 — 등록 시점에
 * 매번 최신 목록을 조회해서 상품의 소싱 국가와 맞는 출고지를 고른다.
 */
const SHIPPING_PLACE_PATH = "/v2/providers/marketplace_openapi/apis/api/v2/vendor/shipping-place/outbound";

interface RawShippingPlace {
  [key: string]: unknown;
}

export interface ShippingPlaceOption {
  code: number | null;
  name: string;
  countryCode: string | null;
  usable: boolean;
  createdAt: string | null;
  raw: RawShippingPlace;
}

/** 실제 계정 응답 모양: {code, message, data: {content: [...], pagination}} —
 * data 자체가 배열이 아니라 그 안에 content가 있다(실측 확인, return-centers와 동일). */
function extractList(body: unknown): RawShippingPlace[] {
  if (!body || typeof body !== "object") return [];
  const obj = body as Record<string, unknown>;
  const data = obj.data;
  if (data && typeof data === "object" && Array.isArray((data as Record<string, unknown>).content)) {
    return (data as Record<string, unknown>).content as RawShippingPlace[];
  }
  const candidate = obj.content ?? data ?? obj.result ?? obj.shippingPlaces;
  if (Array.isArray(candidate)) return candidate as RawShippingPlace[];
  return [];
}

function firstAddress(item: RawShippingPlace): Record<string, unknown> | null {
  const addresses = item.placeAddresses;
  if (Array.isArray(addresses) && addresses.length > 0) return addresses[0] as Record<string, unknown>;
  return null;
}

function toOption(item: RawShippingPlace): ShippingPlaceOption {
  const code =
    (item.outboundShippingPlaceCode as number | undefined) ??
    (item.shippingPlaceCode as number | undefined) ??
    (item.code as number | undefined) ??
    null;
  const name =
    (item.shippingPlaceName as string | undefined) ??
    (item.name as string | undefined) ??
    (code != null ? `출고지 #${code}` : "이름 없음");
  const address = firstAddress(item);
  return {
    code,
    name,
    countryCode: (address?.countryCode as string | undefined) ?? null,
    usable: item.usable !== false,
    createdAt: (item.createDate as string | undefined) ?? null,
    raw: item,
  };
}

export interface ShippingPlaceListResult {
  options: ShippingPlaceOption[];
  error?: string;
  raw?: unknown;
}

export async function fetchShippingPlaces(credentials: CoupangCredentials): Promise<ShippingPlaceListResult> {
  try {
    // pageNum/pageSize(또는 placeCodes/placeNames) 중 하나는 반드시 있어야 하고,
    // pageSize는 1~50만 허용한다(둘 다 실제 계정 호출로 확인된 INVALID_ARGUMENT
    // 메시지 그대로).
    const response = await callCoupangApi(credentials, {
      method: "GET",
      path: SHIPPING_PLACE_PATH,
      query: `vendorId=${encodeURIComponent(credentials.vendorId)}&pageNum=1&pageSize=50`,
    });
    if (!response.ok) {
      return { options: [], error: `쿠팡이 출고지 조회를 거부했습니다 (HTTP ${response.status}).`, raw: response.body };
    }
    const options = extractList(response.body).map(toOption);
    return options.length > 0 ? { options } : { options, raw: response.body };
  } catch (error) {
    return { options: [], error: error instanceof Error ? error.message : "쿠팡 서버에 연결할 수 없습니다." };
  }
}

/** 상품 원본 URL의 호스트네임으로 소싱 국가를 추정한다 — 크롤러가 이미 사이트별로
 * 알고 있는 국가 정보를 별도로 안 만들고, 여기서는 등록 단계에서 필요한 최소한의
 * 추정만 한다. 모르는 호스트는 null(아래 selectOutboundShippingPlace가 국가 무관
 * 최신 usable 출고지로 폴백한다). */
const HOST_COUNTRY_HINTS: [string, string][] = [
  [".co.uk", "GB"],
  [".uk", "GB"],
  ["junioredition.com", "GB"],
  [".de", "DE"],
  [".jp", "JP"],
  [".pt", "PT"],
  [".fr", "FR"],
  [".it", "IT"],
  [".es", "ES"],
  [".se", "SE"],
  [".nl", "NL"],
];

export function inferSourceCountry(sourceUrl: string | undefined): string | null {
  if (!sourceUrl) return null;
  try {
    const hostname = new URL(sourceUrl).hostname.toLowerCase();
    for (const [hint, country] of HOST_COUNTRY_HINTS) {
      if (hostname.includes(hint)) return country;
    }
  } catch {
    // 잘못된 URL이면 그냥 모른다고 취급 — 아래 폴백이 처리한다.
  }
  return null;
}

/**
 * 소싱 국가에 맞는 출고지를 고른다 — 같은 나라 주소가 여러 개면(실제로 흔함,
 * 배치로 반복 등록되는 패턴이 확인됨) 가장 최근 생성된 usable=true 항목을
 * 쓴다(오래된 중복은 usable=false로 바뀌는 패턴이 실제 계정에서 확인됨). 국가를
 * 못 알아냈거나 그 나라 출고지가 없으면, 전체 중 가장 최근 usable 항목으로
 * 폴백한다 — AGENT_BUY는 어차피 해외 주소만 허용되므로 국가가 정확히 안
 * 맞아도 "완전히 틀린 값"보다는 "동작하는 값"을 우선한다.
 */
export function selectOutboundShippingPlace(
  sourceCountry: string | null,
  options: ShippingPlaceOption[],
): ShippingPlaceOption | null {
  const usable = options.filter((o) => o.usable && o.code != null);
  const byRecency = (a: ShippingPlaceOption, b: ShippingPlaceOption) =>
    new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();

  if (sourceCountry) {
    const matches = usable.filter((o) => o.countryCode === sourceCountry).sort(byRecency);
    if (matches.length > 0) return matches[0];
  }
  const fallback = usable.sort(byRecency);
  return fallback[0] ?? null;
}
