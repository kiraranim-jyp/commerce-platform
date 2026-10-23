/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 CORE-2C — **검색 결과 → 북마크 1클릭 → 우리 `/pipeline`** 핸드오프
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * CPO 채택(2026-10-23) — CORE-2B 가 상품 3개에서 「사용자 브라우저 → `candidateUrls[]`
 * → 서버 수신」을 증명했고, 남은 것은 **페이지가 그 파라미터를 읽는 배선 한 곳** 이다.
 *
 * ── 🔴🔴 왜 «내비게이션» 이어야 하는가(CORE-2B 실측이 설계를 강제했다) ──────
 * ```
 * ① CORS   `html.duckduckgo.com` 은 Origin 헤더를 보내면 **403** 이다
 * ② CSP    DDG 는 `connect-src` 를 자기 도메인으로 제한한다 ⟹ bookmarklet 의
 *          `fetch()` 가 우리 서버로 **못 간다**(🟢 andisearch·you.com 은 CSP 가 없다
 *          — 서비스마다 달라서 fetch 에 의존하면 **어디선가 깨진다**)
 * ③ 쿠키   우리 세션 쿠키가 **`sameSite: "lax"`** 다 ⟹ cross-site **POST** 에 안 실린다
 * 🟢 ⟹ **top-level GET 내비게이션** 하나가 셋을 동시에 피한다 —
 *    CORS 무관 · `connect-src` 무관 · 🟢 **Lax 는 top-level 내비게이션에 쿠키를 싣는다**
 *    ⟹ 서버 코드·CORS·인증 **변경 0** 으로 인증이 유지된다
 * ```
 *
 * ── 🔴 이 모듈이 «하지 않는» 것 ────────────────────────────────────────────
 * ```
 * 🔴 MI · SAME · threshold · Price · Adapter/Registry · DB · 검색 API 추가 **0**
 * 🔴 **서버 검증을 복제하지 않는다** — 배열/상한/길이/trim 은 `check/route.ts` 가
 *    이미 한다(`MAX_CANDIDATE_URL_PAYLOAD` · `MAX_CANDIDATE_URL_LENGTH`).
 *    여기서 막는 것은 **브라우저 URL 길이** 라는 다른 제약이다
 * 🔴 **셀러 URL 직접 입력 기능을 되살리지 않는다** — `isSuppliedUrlInputVisible()` 는
 *    그대로 false 다. 이 경로는 **입력칸이 아니라 URL 파라미터** 다
 * 🔴 **후보를 셀러에게 새로 노출하지 않는다** — 새 UI 0. 결과는 기존 MI 패널이
 *    기존 규칙대로 그릴 뿐이다
 * ```
 */

/** 🔴 쿼리 파라미터 이름. 🟢 기존 `resume` 과 **같은 자리** 에서 읽는다. */
export const SUPPLIED_URL_PARAM = "candidateUrls";

/**
 * 🔴 **브라우저 URL 길이 제약** 때문의 상한이다 — 서버 상한과 다른 축이다.
 *    bookmarklet 과 **같은 숫자** 를 쓴다(둘이 갈라지면 조용히 잘린다).
 */
export const MAX_HANDOFF_URLS = 50;

/**
 * 🟢 북마크릿이 넘긴 URL 목록을 읽는다.
 *
 * 🔴 **값을 지어내지 않는다** — 줄바꿈으로 나누고 `http(s)` 가 아닌 것은 버린다.
 * 🔴 중복을 제거한다(같은 상품을 두 번 fetch 하지 않는다).
 * 🔴 `search` 는 `window.location.search` 그대로를 받는다(`?` 포함/미포함 모두).
 */
export function parseSuppliedUrlsParam(search: string): string[] {
  let raw: string | null = null;
  try {
    raw = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search).get(SUPPLIED_URL_PARAM);
  } catch {
    return [];
  }
  if (!raw) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of raw.split(/[\n\r]+/)) {
    const url = line.trim();
    if (!url) continue;
    if (!/^https?:\/\//i.test(url)) continue;
    /** 🔴 모양이 깨진 것은 버린다 — 서버에 쓰레기를 보내지 않는다. */
    try {
      new URL(url);
    } catch {
      continue;
    }
    if (seen.has(url)) continue;
    seen.add(url);
    out.push(url);
    if (out.length >= MAX_HANDOFF_URLS) break;
  }
  return out;
}

/**
 * 🟢 검색 결과 페이지의 링크에서 **다른 판매처 URL 만** 모은다.
 *
 * 🔴 이것이 북마크릿 본체와 **같은 로직** 이고 owner 는 이 함수 하나다
 *    (사본을 만들지 않는다 — 갈라지면 테스트가 증명하는 것과 실제가 달라진다).
 * 🔴 `uddg`(DuckDuckGo 래퍼)를 푼다 · 검색 서비스 **자신의 링크는 제외** 한다 ·
 *    중복 제거 · 상한 `MAX_HANDOFF_URLS` · 비-HTTP 는 버린다.
 */
export function collectFromResultLinks(hrefs: readonly string[], pageOrigin: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const href of hrefs) {
    if (!/^https?:/i.test(href)) continue;
    let raw = href;
    let parsed: URL;
    try {
      parsed = new URL(raw);
      const wrapped = parsed.searchParams.get("uddg");
      if (wrapped) {
        raw = decodeURIComponent(wrapped);
        parsed = new URL(raw);
      }
    } catch {
      continue;
    }
    if (parsed.origin === pageOrigin) continue;
    if (seen.has(raw)) continue;
    seen.add(raw);
    out.push(raw);
  }
  return out.slice(0, MAX_HANDOFF_URLS);
}

/**
 * 🟢🟢 **상품 하나에 묶인 북마크릿** 을 만든다(CPO 허용 범위: 「bookmarklet source 와
 *    실제 제품 URL 의 연결」).
 *
 * 🔴 **왜 `snapshotId` 를 박아야 하는가** — 북마크릿은 **새 탭** 에서 착지하고
 *    그 탭의 `sessionStorage` 는 비어 있다(실측: 복원 순서가 `?resume` → sessionStorage).
 *    ⟹ 스냅샷을 **URL 로 알려주지 않으면 어느 상품인지 알 수 없다.**
 * 🔴 **추측하지 않는다** — `candidateUrls` 만 오고 `resume` 이 없으면 호출부는
 *    **아무것도 하지 않는다**(「최근 상품」으로 넘겨짚으면 엉뚱한 상품에 붙는다).
 * 🔴 `fetch`/`XMLHttpRequest` 를 쓰지 않는다 — 위 ①②③ 때문이다.
 */
export function buildBookmarkletForSnapshot(origin: string, snapshotId: string): string {
  const target = `${origin.replace(/\/$/, "")}/pipeline?resume=${encodeURIComponent(snapshotId)}&${SUPPLIED_URL_PARAM}=`;
  return (
    `javascript:(function(){` +
    `var o=location.origin,s={},r=[],a=document.querySelectorAll('a[href]');` +
    `for(var i=0;i<a.length;i++){var h=a[i].href;if(!/^https?:/i.test(h))continue;` +
    `try{var u=new URL(h);var w=u.searchParams.get('uddg');` +
    `if(w){h=decodeURIComponent(w);u=new URL(h);}` +
    `if(u.origin===o)continue;if(s[h])continue;s[h]=1;r.push(h);}catch(e){}}` +
    `location.href=${JSON.stringify(target)}+encodeURIComponent(r.slice(0,${MAX_HANDOFF_URLS}).join('\\n'));` +
    `})();`
  );
}
