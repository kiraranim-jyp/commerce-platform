/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 CORE-2G — **목록 «텍스트» 로 상세 URL 을 고른다**(2-hop · 품번 변형 허용)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * CPO 지시(2026-10-23) — 「목록 HTML → href 수집 → **품번/상품명/브랜드 관련 문자열
 * 탐색** → 후보 상세 URL 선별 → **필요한 URL 만 Fetch**」 ·
 * 「🔴 **무조건 모든 상세상품을 Fetch 하는 방식은 금지**」 ·
 * 「목표는 B226AC009 상세 URL 확보이지 **Dono Kids 전체 크롤링이 아니다**」.
 *
 * ── 🔴🔴 CORE-2F 가 0 을 낸 «이유» 가 여기서 밝혀졌다 ──────────────────────
 * ```
 * CORE-2F 의 선별기는 **URL slug** 에서 품번을 찾았다. 🔴 도노키즈 목록 URL 은
 * `shopdetail.html?branduid=3362785` 로 **품번이 없다** ⟹ 구조적으로 0 이다.
 * 🟢🟢 그런데 목록 **HTML 텍스트** 에는 있었다(실측):
 *      `<li class="dsc">[보보쇼즈] Hug Hairy Monster T-shirt  #226AC009`
 *      `biginProduct.name = "[보보쇼즈] Hug Hairy Monster T-shirt  #226AC009"`
 * 🔴🔴 그리고 **품번을 「226AC009」로 적는다 — 선행 `B` 가 없다.**
 *    ⟹ `B226AC009` 로만 찾으면 **영원히 0** 이다. 이것이 CORE-2F 의 진짜 원인이다.
 * ```
 *
 * ── 🔴 품번 변형을 «지어내지» 않는다 — 두 꼴만 본다 ───────────────────────
 * ```
 * 🟢 원형 그대로            `B226AC009`
 * 🟢 선행 영문자를 뗀 꼴     `226AC009`   ← **실측된 표기** 다(도노키즈)
 * 🔴 그 외 변형(하이픈 삽입·자리 바꿈·부분 일치)은 **만들지 않는다** —
 *    오탐이 바로 「다른 상품을 국내 가격대에 넣는 것」이 된다
 * 🔴 짧은 꼴은 거부한다(`MIN_CODE_LENGTH`) — 짧은 토큰은 어디에나 끼어든다
 * ```
 *
 * ── 🔴 이 모듈이 «하지 않는» 것 ──────────────────────────────────────────
 * ```
 * 🔴 **운영 호출부 0**(CORE-2F 와 같다) — 배선은 CPO 결정이다
 * 🔴 MI·가격·시장 분류·Adapter·Registry **0** · 다른 사이트로 확장 **0**
 * 🔴 **상세를 전수 Fetch 하지 않는다** — 목록 텍스트로 **먼저 고르고** 그것만 연다
 * 🔴 URL 을 **만들지 않는다** — 목록의 실제 `href` 중에서 고른다
 * ```
 */

/** 🔴 품번이 이보다 짧으면 쓰지 않는다(CORE-2F 와 같은 기준). */
export const MIN_CODE_LENGTH = 4;
/** 🔴 한 목록에서 고를 상세 URL 상한 — 색상별로 여러 개일 수 있다. */
export const PICK_LIMIT = 10;

/**
 * 🟢 품번의 **관측된 표기 변형** 을 만든다. 🔴 **두 꼴뿐이다.**
 *
 * 🔴 「선행 영문자를 뗀 꼴」은 **도노키즈에서 실측된 표기** 다(`#226AC009`).
 *    추측이 아니라 **관측** 이고, 그래서 이 함수가 존재한다.
 */
export function codeVariants(code: string | null | undefined): string[] {
  const raw = (code ?? "").trim();
  if (raw.length < MIN_CODE_LENGTH) return [];
  const out = new Set<string>([raw.toLowerCase()]);
  /** 🟢 `B226AC009` → `226AC009`. 🔴 선행 영문자가 **하나뿐일 때만** 뗀다. */
  const m = /^[a-z](\d.*)$/i.exec(raw);
  if (m && m[1].length >= MIN_CODE_LENGTH) out.add(m[1].toLowerCase());
  return [...out];
}

/** 🟢 목록 HTML 의 한 상품 블록 — 실제 href 와 그 옆 텍스트. */
export interface ListingEntry {
  href: string;
  /** 🔴 블록 텍스트. 품번/상품명이 여기 있다(URL 에는 없다). */
  text: string;
}

/**
 * 🟢 목록 HTML 을 **상품 블록** 으로 쪼갠다.
 *
 * 🔴 **사이트 전용 선택자를 박지 않는다** — `href` 하나하나를 기준으로 그 **주변
 *    텍스트 창** 을 블록으로 본다. 그래서 다른 목록 마크업에서도 같은 함수가 돈다.
 * 🔴 창 크기를 키우면 **옆 상품의 품번** 을 집는다 ⟹ 좁게 둔다(계약이 그것을 문다).
 */
export const BLOCK_WINDOW = 1200;

export function collectListingEntries(html: string, baseUrl: string, detailMarker: string): ListingEntry[] {
  const out: ListingEntry[] = [];
  const re = new RegExp(`href\\s*=\\s*"([^"]*${detailMarker}[^"]*)"`, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const rawHref = m[1].replace(/&amp;/g, "&").trim();
    let abs = "";
    try {
      abs = new URL(rawHref, baseUrl).toString();
    } catch {
      continue;
    }
    /**
     * 🔴🔴 **같은 href 를 «중복제거하지 않는다» — 1차 하니스가 여기서 틀렸다.**
     *
     * 도노키즈는 한 상품이 **두 번** 링크된다(썸네일 + 이름). 그 둘은 **같은 문자열**
     * 이므로 href 로 먼저 dedupe 하면 **더 이른 썸네일 위치만** 남고, 그 창에는
     * **상품명이 없다** ⟹ 실측에서 **품번 일치 0** 이 나왔다(그런데 HTML 에는 있었다).
     * 🔴 그대로 보고했으면 「도노키즈에서 상세 URL 을 못 찾는다」는 **거짓 결론** 이었다.
     * 🟢 그래서 **등장마다 블록을 만들고** 중복 제거는 **`pickByListingText` 가** 한다
     *    (그 함수가 이미 href 로 dedupe 한다 — 사본 0).
     * 🔴 텍스트 창은 href **양쪽** 을 본다(마크업 순서가 사이트마다 다르다).
     */
    const at = m.index;
    const text = html.slice(Math.max(0, at - BLOCK_WINDOW), Math.min(html.length, at + BLOCK_WINDOW));
    out.push({ href: abs, text });
  }
  return out;
}

/** 🟢 고유 상세 URL 수 — 「블록 수」와 **다르다**(한 상품이 여러 번 링크된다). */
export function uniqueHrefCount(entries: readonly ListingEntry[]): number {
  return new Set(entries.map((e) => e.href)).size;
}

/**
 * 🟢 **블록 텍스트에 품번이 있는** 상세 URL 만 고른다.
 *
 * 🔴 URL 을 만들지 않는다 · 중복 제거 · 상한 적용 · 품번이 없으면 **빈 배열**.
 */
export function pickByListingText(entries: readonly ListingEntry[], code: string | null): string[] {
  const variants = codeVariants(code);
  if (variants.length === 0) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const e of entries) {
    const hay = e.text.toLowerCase();
    if (!variants.some((v) => hay.includes(v))) continue;
    if (seen.has(e.href)) continue;
    seen.add(e.href);
    out.push(e.href);
    if (out.length >= PICK_LIMIT) break;
  }
  return out;
}

/**
 * 🟢 목록 HTML 에서 **페이지네이션 링크** 를 읽는다.
 *
 * 🔴 **번호를 만들지 않는다** — 그 페이지가 내놓은 `page=N` 링크만 쓴다.
 * 🔴 상한을 둔다 — 목록이 100페이지면 전수 크롤링이 된다(CPO 금지).
 */
export const MAX_PAGES = 6;

export function extractPageLinks(html: string, baseUrl: string): string[] {
  const nums = new Set<number>();
  const re = /[?&]page=(\d{1,3})\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const n = Number(m[1]);
    if (Number.isInteger(n) && n >= 1 && n <= MAX_PAGES) nums.add(n);
  }
  const out: string[] = [];
  for (const n of [...nums].sort((a, b) => a - b)) {
    try {
      const u = new URL(baseUrl);
      u.searchParams.set("page", String(n));
      out.push(u.toString());
    } catch {
      /* baseUrl 이 깨졌으면 아무것도 만들지 않는다 */
    }
  }
  return out;
}
