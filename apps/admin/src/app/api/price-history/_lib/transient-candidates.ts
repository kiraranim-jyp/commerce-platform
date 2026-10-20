import type { ComparisonCandidate, ComparisonSearchResult } from "@commerce/crawler";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-024 — **「일시 후보」의 공용 primitive** (leaf 모듈 · 의존 0)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 왜 이 파일이 생겼나 — WU-023 이 찾은 구조적 병목이 이것이었다:
 *
 *   > 「transient consumer 는 이미 Registry 를 우회할 수 있지만, 그 consumer 에
 *   >   후보를 공급하는 «생산자 계약» 이 Gemini 에 종속되어 있다.」
 *
 * 즉 **소비자는 열려 있는데 생산자가 하나뿐** 이었다. 생산자를 하나 더 붙이려면
 * 두 생산자가 **공유해야 하는 것**(일시 샵 id · 저장 차단 판별 · host 묶기)이
 * 어느 한쪽 생산자 파일 «안» 에 있어서는 안 된다 — 그러면 순환 import 가 되거나
 * 사본이 생긴다. 그래서 **아무것도 import 하지 않는 leaf** 로 뺐다.
 *
 * 🔴 **새 판정 규칙이 아니다.** 이 파일은 점수도 verdict 도 가격도 만들지 않는다.
 * 🔴 **저장하지 않는다.** DB 클라이언트를 import 하지 않는다(테스트가 그것을 잠근다).
 */

/** 🔴 등록부에 없는 가상 샵이다 — 호출부가 이 id 로 「저장하지 않을 것」을 가린다. */
export const GEMINI_VIRTUAL_SHOP_ID = "__gemini_discovery__";
export const GEMINI_VIRTUAL_SHOP_NAME = "Gemini Web Discovery(일시)";

/**
 * 🔴🔴 WU-024 — **두 번째 일시 샵.** Gemini 와 **섞지 않는다.**
 *
 * 왜 같은 id 를 재사용하지 않았나: 저장 차단에는 아무 id 나 써도 되지만, 화면과
 * 보고서가 **출처를 그대로 말해야** 한다(§7 「출처를 잃지 않는다」). 셀러가 직접
 * 넣은 URL 을 「Gemini Web Discovery」로 적으면 그건 거짓이다. 🔴 그래서 id 를
 * 가르고, **저장 차단은 아래 술어 하나로** 모은다.
 */
export const TRANSIENT_URL_SHOP_ID = "__url_candidates__";
export const TRANSIENT_URL_SHOP_NAME = "직접 입력 후보(일시)";

/**
 * 🔴🔴 WU-130 — **세 번째 일시 샵.** 해외 비교 판매처 등록부(`comparison_shops`)를
 *    `/check` 가 **스스로** 뒤진 결과다(지금까지 그 검색은 화면에서만 돌았다).
 *
 * ── 🔴🔴🔴 왜 «일시» id 가 반드시 필요한가 (파괴적 함정) ────────────────────
 * ```
 * `searchComparisonShops` 가 돌려주는 shopId 는 **`comparison_shops` 의 실제 id** 다.
 * 그 값을 그대로 `searchResults` 에 넣으면 아래 루프가 비(非)transient 로 보고
 * `upsertDomesticProductLink` 를 부른다 ⟹ **해외 판매처가 «국내» 링크 테이블에
 * 저장된다**(`domestic_product_links.source_id` 는 `domestic_price_sources` FK).
 * 🔴 그 오염은 ⒜ FK/의미 ⒝ 국내 최저가·판정 입력 ⒞ `price_alerts` 오발화 까지 번진다.
 * 🟢 그래서 id 를 일시 샵으로 **갈아** 넣는다 — `isTransientShopId` 가 upsert 앞에서 끊는다.
 * ```
 * 🔴 `domain` 은 **실제 판매처 그대로** 다(위 `groupCandidatesByHost` 주석과 같은 이유 —
 *    품번 추출기 선택과 샵당 대표 선택이 그 값으로 분기한다).
 */
export const OVERSEAS_AUTO_SHOP_ID = "__overseas_auto__";
export const OVERSEAS_AUTO_SHOP_NAME = "해외 자동검색(일시)";

/**
 * 🔴🔴 WU-132 — **네 번째 일시 샵.** 셀러가 **이전에 「동일상품」으로 판단한 URL** 을
 *    다음 조회의 후보로 **되돌려 넣는** 경로다(`candidate_reviews.human_verdict='SAME'`).
 *
 * ── 왜 `__url_candidates__` 를 재사용하지 않았나 ───────────────────────────
 * ```
 * 저장 차단에는 아무 일시 id 나 써도 된다. 가르는 이유는 **화면이 거짓을 말하지
 * 않게** 하는 것 하나다 — 그 id 로 들어온 후보는 화면에서 「🔗 직접 입력한 후보」로
 * 적히고, 셀러는 **자기가 넣지 않은 URL** 을 보며 「내가 넣었나?」로 읽는다.
 * 🔴 WU-130 이 세 번째 id 를 만든 이유와 **같은 이유** 다(§7 출처 보존).
 * ```
 * 🔴 **사람 판단을 MI 판정으로 승격하지 않는다.** 이 경로가 하는 일은 「그 URL 을
 *    **다시 열어 본다**」 뿐이고, SAME/DIFFERENT 는 기존 판정기가 처음부터 다시 낸다.
 * 🔴 과거 `DIFFERENT` 는 **넣지 않는다**(호출부가 `SAME` 만 고른다).
 */
export const REVIEWED_SAME_SHOP_ID = "__reviewed_same__";
export const REVIEWED_SAME_SHOP_NAME = "이전 확인 후보(일시)";

/**
 * 🔴🔴 **저장 차단의 유일한 기준.** 두 호출부(`recordDomesticSourceCheckAttempt`
 *    래퍼 · `upsertDomesticProductLink` 앞 가드)가 **같은 술어** 를 본다.
 *
 * 왜 술어 하나인가 — WU-007A 가 같은 판단을 이미 했다: 두 호출부를 각각 고치면
 * 「같은 건초더미를 보던 둘이 갈라져 화면과 저장이 다른 판정을 낸다」. 일시 샵
 * 목록이 늘어날 때 한쪽만 고쳐지면 **FK 가 없는 id 가 upsert 로 흘러간다.**
 *
 * 🔴 이 집합에 **등록부 id(uuid)를 넣지 않는다** — 넣으면 진짜 샵의 저장이 멈춘다.
 *
 * 🔴🔴 WU-130 — 일시 샵이 **셋** 이 됐다. 생산자를 하나 더 붙일 때 이 집합에 넣는 것을
 *    잊으면 그 후보가 **DB 로 흘러간다** — 그래서 술어를 하나로 모아 두는 것이 계약이다.
 * 🔴🔴 WU-132 — **넷** 이 됐다. 계약 테스트가 이 집합을 **전수 순회** 하므로 숫자만
 *    고쳐 통과시키는 길이 없다(생산자를 더하고 여기에 빼먹으면 그 테스트가 FAIL 한다).
 */
export const TRANSIENT_SHOP_IDS: ReadonlySet<string> = new Set([
  GEMINI_VIRTUAL_SHOP_ID,
  TRANSIENT_URL_SHOP_ID,
  OVERSEAS_AUTO_SHOP_ID,
  REVIEWED_SAME_SHOP_ID,
]);

export function isTransientShopId(shopId: string): boolean {
  return TRANSIENT_SHOP_IDS.has(shopId);
}

/**
 * 🔴 dedupe 키 — 쿼리스트링·해시·트레일링 슬래시를 떼고 호스트를 소문자로.
 *
 * 🔴🔴 **이 키를 국내 Cafe24 계열에 쓰지 않는다.** `search` 를 통째로 버리므로
 *    `shopdetail.html?branduid=A` 와 `?branduid=B` 가 **같은 키** 가 된다 —
 *    서로 다른 상품이 하나로 접힌다. Shopify 처럼 식별자가 **경로** 에 있는
 *    후보(= Gemini 경로의 실측 분포)에서만 안전하다. URL 직접 공급 경로는
 *    `canonicalizeProductUrl`(식별 파라미터를 **보존** 한다)을 쓴다.
 *
 * 🟢 여기 있는 이유는 **원래 자리가 Gemini 전용 파일이었기 때문** 이다. 두 생산자가
 *    같은 primitive 를 보게 하려고 leaf 로 옮겼고, 기존 import 경로는
 *    `gemini-candidate-pool.ts` 가 **그대로 re-export** 한다(호출부/테스트 무변경).
 */
export function normalizeCandidateUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.hash = "";
    u.search = "";
    const host = u.hostname.replace(/^www\./i, "").toLowerCase();
    const path = u.pathname.replace(/\/+$/, "");
    return `${host}${path}`;
  } catch {
    return raw.trim().toLowerCase();
  }
}

/** 🔴 등록부 도메인과 같은 모양으로 맞춘다(www 제거 · 소문자) — 추출기 조회 키다. */
export function hostOfCandidateUrl(raw: string, fallback: string): string {
  try {
    return new URL(raw).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return fallback;
  }
}

export interface HostGroupingOptions {
  /** 🔴 가상 id — 저장 차단의 기준이다. host 별로 **같은 값** 을 쓴다. */
  shopId: string;
  /** 화면에 적히는 이름. `· host` 가 뒤에 붙는다. */
  shopNamePrefix: string;
}

/**
 * 후보 배열 → **host 별** `ComparisonSearchResult[]`.
 *
 * 🔴🔴 **host 별로 쪼개는 것이 계약이다.** 한 덩어리(가상 domain 하나)로 묶으면
 *    `judgeDomesticCandidate(input.domain)` 가 그 값으로 분기하기 때문에 두 가지가
 *    동시에 깨진다(MI-GEMINI-005 에서 실제로 걸렸다):
 *      · `fetchDomesticModelCode(domain, url)` — 도메인별 품번 추출기가 **영구히 null**
 *      · `selectDomesticCandidate(..., domain, ...)` — **샵당 최선 1건** 만 남으므로
 *        서로 다른 판매처의 후보가 한 샵처럼 경쟁해 나머지가 전부 사라진다
 * 🟢 그래서 `domain` 은 **실제 host**, `shopId` 만 가상이다 — 저장 차단은 `shopId`
 *    로 가리므로 그대로 유효하다.
 *
 * 🔴 순서를 **보존** 한다. 호출부의 후보 배열은 `withConfidence` 가 confidence
 *    내림차순으로 정렬해 둔 것일 수 있고(`selectCandidatesForDetailConfirmation`
 *    이 그 순서를 계약으로 쓴다), `Map` 은 **삽입 순서** 를 유지한다.
 */
export function groupCandidatesByHost(
  candidates: readonly ComparisonCandidate[],
  options: HostGroupingOptions,
): ComparisonSearchResult[] {
  const byHost = new Map<string, ComparisonCandidate[]>();
  for (const candidate of candidates) {
    const host = hostOfCandidateUrl(candidate.url, options.shopId);
    const bucket = byHost.get(host);
    if (bucket) bucket.push(candidate);
    else byHost.set(host, [candidate]);
  }
  return [...byHost.entries()].map(
    ([host, group]) =>
      ({
        shopId: options.shopId,
        shopName: `${options.shopNamePrefix} · ${host}`,
        /** 🟢 실제 host — 판정 게이트가 이 값으로 분기한다. */
        domain: host,
        status: "ok",
        candidates: group,
      }) as ComparisonSearchResult,
  );
}
