import { fetchHtmlDirect } from "./direct-html-fetch";
import { CRAWLER_USER_AGENT } from "./user-agent";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P5.6 P2(CPO 결정, 2026-10-09) — **수집을 늘리기 전에 robots 를 «먼저» 본다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 브랜드 공식몰에서 제조국을 확인하려면 지금까지 긁지 않던 도메인을 받아야 한다.
 * 그 전에 막혀 있던 것이 이것이다 — 이 저장소에는 **robots.txt 를 확인하는 코드가
 * 한 줄도 없었다**(전수 확인). 지금까지는 「우리가 이미 아는 판매처」만 받았기
 * 때문에 그 사실이 드러나지 않았다.
 *
 * ── 🔴 왜 robots 가 먼저인가 ──────────────────────────────────────────────
 * `price-source-adapter.ts` 가 적은 STOP 기준이 그것이다 — 「robots 가 해당 경로를
 * 차단」하면 수집하지 않는다. 그리고 [[auto-source-adoption-standard]] 의 채택
 * 기준도 「우리 UA 가 robots 에서 허용되는가」 하나다.
 *
 * 🔴 **robots 허용 ≠ 약관 허용.** 이 함수는 robots 한 축만 본다. 약관 판단은
 *    사람이 하고(그 기준이 price-source-adapter 에 적혀 있다), 여기서 자동화하지
 *    않는다. 그래서 반환값 이름이 `ALLOWED` 가 아니라 `NOT_DISALLOWED` 다.
 *
 * ── 🔴 하지 않는 것 ──────────────────────────────────────────────────────
 *   · 우회하지 않는다. `Disallow` 면 받지 않는다 — UA 를 바꿔 다시 시도하지 않는다.
 *   · robots 를 못 읽었을 때 「허용」으로 읽지 않는다. 모르면 받지 않는다.
 *   · `Crawl-delay` 를 무시하지 않는다 — 값이 있으면 그대로 돌려주고, 호출부가
 *     기존 도메인 레이트리미터에 그 값을 쓴다(여기서 sleep 하지 않는다).
 *   · 와일드카드 패턴을 «완전히» 해석하지 않는다. `*` 와 `$` 만 다룬다 — 그
 *     밖의 확장 문법은 「모른다」로 보수적으로 차단한다.
 */

export type RobotsVerdict =
  /** robots 가 이 경로를 막지 «않았다». 🔴 「약관상 허용」이 아니다. */
  | { state: "NOT_DISALLOWED"; crawlDelaySeconds: number | null; evidence: string }
  /** robots 가 막았다. 받지 않는다. */
  | { state: "DISALLOWED"; rule: string; evidence: string }
  /** robots 를 읽지 못했다. 🔴 모르면 받지 않는다. */
  | { state: "UNKNOWN"; reason: string };

interface RobotsGroup {
  agents: string[];
  disallow: string[];
  allow: string[];
  crawlDelay: number | null;
}

/** robots.txt 본문 → 그룹 목록. 🔴 파서를 관대하게 만들지 않는다. */
export function parseRobotsTxt(body: string): RobotsGroup[] {
  const groups: RobotsGroup[] = [];
  let current: RobotsGroup | null = null;
  /* 🔴 같은 블록 안에서 User-agent 가 여러 줄 연속되면 «하나의 그룹» 이다
     (표준). 규칙 줄이 나온 뒤의 User-agent 는 새 그룹이다. */
  let sawRuleInCurrent = false;

  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const at = line.indexOf(":");
    if (at < 0) continue;
    const field = line.slice(0, at).trim().toLowerCase();
    const value = line.slice(at + 1).trim();

    if (field === "user-agent") {
      if (!current || sawRuleInCurrent) {
        current = { agents: [], disallow: [], allow: [], crawlDelay: null };
        groups.push(current);
        sawRuleInCurrent = false;
      }
      current.agents.push(value.toLowerCase());
      continue;
    }
    if (!current) continue;
    if (field === "disallow") {
      sawRuleInCurrent = true;
      /* 🔴 `Disallow:`(빈 값)는 「아무것도 막지 않는다」는 뜻이다 — 전체 차단이
         아니다. 반대로 읽으면 멀쩡한 사이트가 전부 막힌 것으로 보인다. */
      if (value) current.disallow.push(value);
      continue;
    }
    if (field === "allow") {
      sawRuleInCurrent = true;
      if (value) current.allow.push(value);
      continue;
    }
    if (field === "crawl-delay") {
      sawRuleInCurrent = true;
      const n = Number(value);
      if (Number.isFinite(n) && n >= 0) current.crawlDelay = n;
    }
  }
  return groups;
}

/** 우리 UA 에 적용되는 그룹 — 정확히 일치하는 것이 있으면 그것, 없으면 `*`. */
export function groupForAgent(groups: RobotsGroup[], userAgent: string): RobotsGroup | null {
  const ua = userAgent.toLowerCase();
  /* 🔴 토큰 포함 판정이다 — robots 의 User-agent 는 보통 짧은 토큰(`googlebot`)
     이고 우리 UA 는 긴 문자열이라, 양방향 포함을 다 본다. */
  const exact = groups.find((g) => g.agents.some((a) => a !== "*" && (ua.includes(a) || a.includes(ua))));
  return exact ?? groups.find((g) => g.agents.includes("*")) ?? null;
}

/** robots 패턴 → 정규식. `*` 와 `$` 만 다룬다. */
function patternToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  /* 끝의 `$` 는 escape 된 상태로 남아 있으므로 복원한다. */
  const anchored = escaped.endsWith("\\$") ? `${escaped.slice(0, -2)}$` : escaped;
  return new RegExp(`^${anchored}`);
}

/**
 * 🔴 표준대로 «가장 긴 일치» 가 이긴다. Allow 가 더 길면 허용이다 —
 * 그 규칙이 없으면 `Disallow: /` + `Allow: /products/` 사이트가 전부 막힌다.
 */
export function pathDisallowed(group: RobotsGroup, path: string): { blocked: boolean; rule: string } {
  let longestDisallow = "";
  for (const rule of group.disallow) {
    if (patternToRegExp(rule).test(path) && rule.length > longestDisallow.length) longestDisallow = rule;
  }
  if (!longestDisallow) return { blocked: false, rule: "" };
  let longestAllow = "";
  for (const rule of group.allow) {
    if (patternToRegExp(rule).test(path) && rule.length > longestAllow.length) longestAllow = rule;
  }
  return longestAllow.length >= longestDisallow.length
    ? { blocked: false, rule: longestAllow }
    : { blocked: true, rule: longestDisallow };
}

/**
 * 이 URL 을 우리 UA 로 받아도 되는지 robots 기준으로 본다.
 *
 * 🔴 robots.txt 를 받는 것 자체는 HTTP 1회다. 호출부가 도메인당 한 번만 묻도록
 *    캐시한다(아래 `robotsGateFor` 가 그 캐시다) — 상품마다 다시 묻지 않는다.
 */
export async function checkRobots(targetUrl: string): Promise<RobotsVerdict> {
  let url: URL;
  try {
    url = new URL(targetUrl);
  } catch {
    return { state: "UNKNOWN", reason: "URL 형식이 아닙니다." };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { state: "UNKNOWN", reason: `지원하지 않는 프로토콜입니다(${url.protocol}).` };
  }

  const robotsUrl = `${url.origin}/robots.txt`;
  const res = await fetchHtmlDirect(robotsUrl, 3, { Accept: "text/plain,*/*" });
  if (!res) return { state: "UNKNOWN", reason: "robots.txt 를 받지 못했습니다(네트워크)." };

  /* 🔴 404 는 「robots 가 없다」이고, 표준상 그때는 제한이 없다. 그러나 5xx 는
     「서버가 지금 답하지 못한다」이고 허용으로 읽으면 안 된다 — 모르는 것이다. */
  if (res.status >= 500) {
    return { state: "UNKNOWN", reason: `robots.txt 응답 ${res.status} — 지금은 판단하지 않습니다.` };
  }
  if (res.status === 404 || res.status === 410) {
    return {
      state: "NOT_DISALLOWED",
      crawlDelaySeconds: null,
      evidence: `${robotsUrl} → ${res.status}(robots 없음)`,
    };
  }
  if (res.status !== 200) {
    return { state: "UNKNOWN", reason: `robots.txt 응답 ${res.status} — 판단하지 않습니다.` };
  }

  const groups = parseRobotsTxt(res.html);
  const group = groupForAgent(groups, CRAWLER_USER_AGENT);
  if (!group) {
    return {
      state: "NOT_DISALLOWED",
      crawlDelaySeconds: null,
      evidence: `${robotsUrl} → 우리 UA 에 적용되는 규칙 없음`,
    };
  }
  const path = `${url.pathname}${url.search}`;
  const verdict = pathDisallowed(group, path);
  if (verdict.blocked) {
    return {
      state: "DISALLOWED",
      rule: verdict.rule,
      evidence: `${robotsUrl} → Disallow: ${verdict.rule}`,
    };
  }
  return {
    state: "NOT_DISALLOWED",
    crawlDelaySeconds: group.crawlDelay,
    evidence: `${robotsUrl} → 차단 규칙 없음${group.crawlDelay != null ? ` · Crawl-delay ${group.crawlDelay}s` : ""}`,
  };
}
