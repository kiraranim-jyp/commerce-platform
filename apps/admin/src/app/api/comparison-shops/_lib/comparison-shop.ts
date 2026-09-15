import { getSupabaseAdmin } from "@/lib/supabase-admin";

/**
 * Sprint B-0 — 가격 비교 대상 해외 편집샵 관리. 이 파일은 크롤링/파싱을 전혀
 * 하지 않는다 — "어떤 사이트를 비교 대상으로 쓸지" 메타데이터 CRUD만 담당한다.
 * SYSTEM(추천 seed)/USER(직접 추가) 구분은 삭제 가능 여부에만 쓰인다 —
 * SYSTEM 사이트는 활성/비활성만, USER 사이트는 삭제까지 가능하다.
 */
/**
 * GOLF-01 축 A(CEO 지시, 2026-09-15) — "등록됨"과 "수집 성공"은 다른 사실이다.
 *
 * 마이그레이션 051. 사람이 직접 열어 본 결과만 들어간다:
 *   "OK"              열리고 실제 값을 확인했다
 *   "BLOCKED"         WAF/봇차단으로 접근 자체가 막혔다
 *   "LOGIN_REQUIRED"  로그인 없이는 값을 볼 수 없다
 *   null              이번에 확인하지 않았다 — 🔴 "수집 가능"이 아니다
 *
 * GOLF-01.5 축 A(CEO 지시, 2026-09-16) — 네 번째 값이 필요해졌다:
 *   "API_DISCONTINUED"  가격을 주던 공식 경로가 **없어졌다**
 *
 * 🔴 왜 LOGIN_REQUIRED로 계속 두면 안 되나. 그 문구는 셀러에게 "로그인하면
 *    된다"고 말한다. 네이버 쇼핑 검색 API는 2026-07-31에 종료됐고(NAVER API
 *    HUB로 이전하지 않고 종료), 셀러가 로그인해도 가격 수집이 열리지 않는다.
 *    해결할 수 없는 일을 셀러에게 시키는 UX는 거짓말과 같은 비용을 낸다.
 *    https://developers.naver.com/notice/article/32564
 *
 * collectionStrategy(국내)/파서 존재 여부(해외)와 섞지 않는다. "열리는가"와
 * "우리가 자동으로 읽을 수 있는가"는 다른 질문이고, 다나와처럼 열리지만 파서가
 * 없는 사이트가 실제로 있다.
 */
export type MarketSourceAccessStatus = "OK" | "BLOCKED" | "LOGIN_REQUIRED" | "API_DISCONTINUED";

/**
 * GOLF-01.5 축 A(CEO 지시, 2026-09-16) — "이 소스는 무엇을 해 주는 소스인가".
 * 지금까지 화면은 소스를 **세기만** 했다("국내 2곳 · 해외 3곳"). 그래서 네이버
 * 쇼핑처럼 가격을 주지 않는 소스와 다나와처럼 가격을 주는 소스가 같은 숫자에
 * 들어갔다.
 *
 *   "PRICE_COMPARISON"  여러 판매자의 값을 한자리에 모아 주는 가격비교 매체
 *   "PRICE_COLLECTION"  그 자리에서 파는 가격 자체를 얻는 판매처/마켓플레이스
 *   "DEMAND_DATA"       가격이 아니라 수요·검색 트렌드를 주는 소스
 *   null                아직 분류하지 않았다 — 🔴 화면은 아무 말도 하지 않는다
 *
 * 🔴 accessStatus(열리는가)·collectionStrategy(읽을 수 있는가)와 **세 번째로
 *    다른 축**이다. 역할이 DEMAND_DATA라는 것은 "가격을 못 가져온다"가 아니라
 *    "애초에 가격을 가지러 가지 않는다"는 뜻이다.
 */
export type MarketSourceRole = "PRICE_COMPARISON" | "PRICE_COLLECTION" | "DEMAND_DATA";

/** 이 판매처를 지금 실제로 호출해도 되는가. 🔴 막힌 사이트를 반복 호출하지
 * 않는다(CEO 명시) — 조사 대상을 고르는 모든 자리가 이 함수 하나를 쓴다.
 * null(확인 안 함)은 오늘까지의 동작 그대로 통과시킨다: 기존 16행·25행이
 * 전부 null이라, 여기서 null을 막으면 그 순간 모든 조사가 멈춘다.
 *
 * GOLF-01.5 — API_DISCONTINUED도 막는다. 공식 경로가 없어진 소스를 매번 다시
 * 두드리는 것은 BLOCKED를 두드리는 것과 같은 낭비다. */
export function isCollectableAccess(status: MarketSourceAccessStatus | null | undefined): boolean {
  return status !== "BLOCKED" && status !== "LOGIN_REQUIRED" && status !== "API_DISCONTINUED";
}

export interface ComparisonShop {
  id: string;
  name: string;
  domain: string;
  url: string;
  country: string | null;
  currency: string | null;
  /** 마이그레이션 051. 국내(domestic_price_sources.category_scope)와 **같은
   * 어휘·같은 판정 함수(sourceFitsScopes)**를 쓴다 — 해외용 카테고리 체계를
   * 따로 만들지 않는다. 051이 기존 25행에 KIDS_FASHION을 명시적으로 넣었다:
   * 비워 두면 "빈 배열 = 모든 카테고리" 규칙 때문에 아동복 편집샵 25곳이
   * 골프 조사에 전부 따라붙는다. */
  categoryScope: string[];
  accessStatus: MarketSourceAccessStatus | null;
  /** 그 판정의 근거 한 줄(사람이 읽는다). 차단 사유와, 있으면 우회 경로. */
  accessNote: string | null;
  /** GOLF-01.5 축 A(마이그레이션 053). 분류하지 않았으면 null이다. */
  role: MarketSourceRole | null;
  /**
   * GOLF-01.5 축 A(CEO 지시, 2026-09-16) — 같은 **사업자**가 운영하는 채널끼리
   * 묶는 열쇠. 값이 같으면 "같은 회사가 파는 곳"이라는 뜻이고, 그게 전부다.
   *
   * 🔴 이 값이 같다고 가격을 합치지 않는다. CEO 판단 그대로: 채널별로
   *    할인·쿠폰·포인트·재고·배송비·캠페인·취급상품·아웃렛·회원혜택이 달라서
   *    GDO 본점 ¥110,000 · GDO Rakuten ¥99,000 · Yahoo GDO ¥105,000 이 전부
   *    **서로 다른 관측값**이다. 보여주려는 것은 "하나의 값"이 아니라
   *    "동일 판매자가 채널마다 얼마에 파는가"다.
   *    → 이 필드를 집계 키로 쓰는 코드는 이 저장소에 없어야 한다.
   *      (검증: golf015-operator-channel.test.ts)
   */
  operatorKey: string | null;
  source: "SYSTEM" | "USER";
  isActive: boolean;
  createdAt: string;
}

interface ComparisonShopRow {
  id: string;
  name: string;
  domain: string;
  url: string;
  country: string | null;
  currency: string | null;
  source: "SYSTEM" | "USER";
  is_active: boolean;
  /** 마이그레이션 051이 아직 실행되지 않은 세션에서도 select("*")가 깨지지
   * 않도록 optional로 받는다(domestic-price-source.ts의 source_type/032의
   * last_checked_at과 정확히 같은 패턴). 실행 전에는 categoryScope가 빈
   * 배열이라 sourceFitsScopes가 전부 통과시킨다 = 오늘 동작 그대로. */
  category_scope?: string[] | null;
  access_status?: MarketSourceAccessStatus | null;
  access_note?: string | null;
  /** 마이그레이션 053. 051의 세 컬럼과 정확히 같은 이유로 optional이다 —
   * 미실행 세션에서도 select("*")가 깨지지 않고 role/operatorKey만 비어 있다. */
  source_role?: MarketSourceRole | null;
  operator_key?: string | null;
  created_at: string;
}

function toShop(row: ComparisonShopRow): ComparisonShop {
  return {
    id: row.id,
    name: row.name,
    domain: row.domain,
    url: row.url,
    country: row.country,
    currency: row.currency,
    categoryScope: row.category_scope ?? [],
    accessStatus: row.access_status ?? null,
    accessNote: row.access_note ?? null,
    role: row.source_role ?? null,
    operatorKey: row.operator_key ?? null,
    source: row.source,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

export async function listComparisonShops(): Promise<ComparisonShop[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("comparison_shops")
    .select("*")
    .order("source", { ascending: true })
    .order("name", { ascending: true });
  if (error) {
    console.warn("[comparison-shop] 목록 조회 실패:", error.message);
    return [];
  }
  return (data as ComparisonShopRow[]).map(toShop);
}

/** http(s) URL만 허용하고 도메인을 뽑아낸다 — 프로토콜 없이 입력해도(예:
 * "example.com") 자동으로 https://를 붙여 한 번 더 시도한다. */
function parseShopUrl(raw: string): { url: string; domain: string } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  for (const candidate of [trimmed, `https://${trimmed}`]) {
    try {
      const parsed = new URL(candidate);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") continue;
      const domain = parsed.hostname.replace(/^www\./, "").toLowerCase();
      if (!domain) continue;
      return { url: parsed.toString(), domain };
    } catch {
      continue;
    }
  }
  return null;
}

/** N-3.11 Part A/B — country/currency는 선택 입력이다(둘 다 없으면 이전처럼
 * null로 저장 — "확인 못하면 MISSING" 원칙, 추측으로 채우지 않는다). 호출하는
 * 쪽(관리자 API)이 실제 사이트 조사(footer 등록정보 등)로 확인한 값만 넘겨야
 * 한다 — 이 함수는 그 값을 검증 없이 그대로 저장만 한다. */
export async function createComparisonShop(
  urlInput: string,
  nameInput?: string,
  isActiveInput?: boolean,
  countryInput?: string | null,
  currencyInput?: string | null,
  /** GOLF-01 축 A — 설정 화면에서 카테고리를 고른 채로 추가하면 그 카테고리에
   * 연결된다. 🔴 사이트를 카테고리마다 중복 생성하지 않는다(CEO 명시): 행은
   * 하나이고 이 배열이 연결이다(Site Master → Category ↔ Site).
   * 비워서 부르면 예전과 같이 빈 배열 = 모든 카테고리에서 보인다. */
  categoryScopeInput?: string[],
): Promise<{ ok: true; shop: ComparisonShop } | { ok: false; error: string }> {
  const parsed = parseShopUrl(urlInput);
  if (!parsed) {
    return { ok: false, error: "올바른 URL이 아닙니다(http/https만 허용됩니다)." };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, error: "Supabase가 설정되어 있지 않습니다." };

  const { data: existing } = await supabase
    .from("comparison_shops")
    .select("id")
    .eq("domain", parsed.domain)
    .maybeSingle();
  if (existing) {
    return { ok: false, error: "이미 등록된 도메인입니다." };
  }

  const { data, error } = await supabase
    .from("comparison_shops")
    .insert({
      name: nameInput?.trim() || parsed.domain,
      domain: parsed.domain,
      url: parsed.url,
      source: "USER",
      is_active: isActiveInput ?? true,
      country: countryInput ?? null,
      currency: currencyInput ?? null,
      // 마이그레이션 051 미실행 세션에서 INSERT 자체가 실패하지 않도록, 값이
      // 있을 때만 컬럼을 보낸다(읽기 쪽 optional 처리와 같은 이유).
      ...(categoryScopeInput && categoryScopeInput.length > 0 ? { category_scope: categoryScopeInput } : {}),
    })
    .select()
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, shop: toShop(data as ComparisonShopRow) };
}

export async function setComparisonShopActive(
  id: string,
  isActive: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, error: "Supabase가 설정되어 있지 않습니다." };
  const { error } = await supabase
    .from("comparison_shops")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** N-3.11 Part B — 실제 판매처 등록정보(footer/Terms/Companies House 등)로 확인한
 * country/currency만 여기로 갱신한다 — 이 함수 자체는 검증하지 않으므로 호출하는
 * 쪽이 "확인 못하면 null(MISSING)"을 지켜야 한다. */
export async function updateComparisonShopCountry(
  id: string,
  country: string | null,
  currency: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, error: "Supabase가 설정되어 있지 않습니다." };
  const { error } = await supabase
    .from("comparison_shops")
    .update({ country, currency, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** SYSTEM(추천) 사이트는 삭제하지 않는다 — 활성/비활성만 지원(CPO 지시). */
export async function deleteComparisonShop(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { ok: false, error: "Supabase가 설정되어 있지 않습니다." };

  const { data: existing, error: fetchError } = await supabase
    .from("comparison_shops")
    .select("source")
    .eq("id", id)
    .maybeSingle();
  if (fetchError) return { ok: false, error: fetchError.message };
  if (!existing) return { ok: false, error: "사이트를 찾을 수 없습니다." };
  if ((existing as { source: string }).source === "SYSTEM") {
    return { ok: false, error: "추천 사이트는 삭제할 수 없습니다 — 비활성화해주세요." };
  }

  const { error } = await supabase.from("comparison_shops").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
