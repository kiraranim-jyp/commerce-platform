/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 CASE-01 실행단위 1 — **브라우저 후보 입력 관측 계약**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **왜 이 계측이 필요했나.** AI Search 는 **사용자 브라우저에서** 일어나고 서버는
 *    `candidateUrls[]` **만** 받는다(`pipeline/page.tsx:309`). 검색 원문을 저장하는 칸은
 *    **코드에 없다**(전수 grep 0). ⟹ 「국내 상세 URL 이 검색 결과에 있었는가」를 볼 수 있는
 *    **유일한 지점이 `/check` 진입부** 이고, 그것이 없어서 CASE-01 의 ①이 측정불가였다.
 *
 * 🟢 이 파일은 그 계측의 **성질** 을 잠근다 — 일회성 console 출력으로 끝내지 않는다(§4).
 * 🔴 **임시 계측이다** — 원인이 확정되면 이 계약과 함께 제거한다(MI-CASE-INPUT 선례).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROUTE = path.join(process.cwd(), "src", "app", "api", "price-history", "check", "route.ts");
/** 🔴 주석을 벗긴다 — 주석 속 예시가 「구현됐다」로 세어지는 함정(이 트랙이 여덟 번 걸렸다). */
const bare = () =>
  readFileSync(ROUTE, "utf8").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");

describe("CASE-01 실행단위 1 — 후보 입력 관측", () => {
  it("A-1 🟢 `[CASE-01-INPUT]` 이 `/check` 진입부에 있다", () => {
    const src = bare();
    expect(src).toContain("[CASE-01-INPUT]");
    /** 🔴 `candidateUrls` 정규화 «뒤» 여야 한다 — 앞이면 필터 전 숫자를 세게 된다. */
    const norm = src.indexOf("candidateUrls = body.candidateUrls");
    const log = src.indexOf("[CASE-01-INPUT]");
    expect(norm).toBeGreaterThan(0);
    expect(log, "🔴 정규화 앞에서 세면 필터 전 개수가 찍힌다").toBeGreaterThan(norm);
  });

  it("A-2 🟢 세는 칸이 **셋**이다(들어온 것의 개수와 «성질» 만)", () => {
    const src = bare();
    const at = src.indexOf("[CASE-01-INPUT]");
    /**
     * 🔴 **로그 블록만 잘라낸다.** 1차 구현은 400자를 잘랐는데 그 창이 블록을 넘어
     *    뒤의 `getSnapshot(snapshotId, …)` 를 읽어 **거짓 FAIL** 이 났다 — 가드가 맞았고
     *    내 창이 거칠었다. 🟢 `JSON.stringify` 의 닫는 `})}` 까지만 본다.
     */
    const end = src.indexOf("})}", at);
    expect(end, "🔴 로그 블록의 끝을 못 찾았다").toBeGreaterThan(at);
    const seg = src.slice(at, end);
    for (const k of ["total", "hosts", "kr"]) {
      expect(seg, `🔴 ${k} 가 없다 — 들어온 수량을 봐야 원인이 갈린다`).toContain(k);
    }
  });

  /**
   * 🔴🔴🔴 **라우트는 «판정» 을 하지 않는다 — 이 계약이 그것을 잠근다.**
   *
   * 1차 구현이 이 자리에서 `classifyUrlShape` 를 불러 detail/listing 을 셌고
   * `wu-024-url-candidate-pool` 이 **FAIL** 했다 — 「입력 경계는 pool 이 소유한다」.
   * 🟢 가드를 풀지 않고 **분류를 뺐다.** 그리고 그것이 더 정확하다 — 상세/목록 분류의
   *    실제 결과는 `collectUrlCandidatePool` 의 산출이고, 라우트가 또 세면 **두 벌** 이 된다.
   * 🔴 되살아나면 이 단언과 wu-024 가 **둘 다** FAIL 한다(양방향 잠금).
   */
  it("A-2b 🔴🔴 라우트가 URL 을 **분류하지 않는다**(pool 소유 경계 보존)", () => {
    const src = bare();
    expect(src, "🔴 라우트가 다시 분류를 하고 있다").not.toContain("classifyUrlShape");
    expect(src).not.toContain("PRODUCT_PAGE");
    expect(src).not.toContain("LISTING_PAGE");
  });

  /**
   * 🔴🔴🔴 **이 단언이 가장 중요하다 — 로그는 고객 데이터 저장소가 아니다.**
   *
   * URL 원문·상품명·사용자/워크스페이스 식별자가 들어가면 런타임 로그가 고객 데이터
   * 사본이 된다. CPO 가 MI-CASE-INPUT 에서 고정한 그 기준을 그대로 적용한다.
   */
  it("A-3 🔴🔴 로그에 **URL 원문·식별자가 없다**", () => {
    const src = bare();
    const at = src.indexOf("[CASE-01-INPUT]");
    /**
     * 🔴 **로그 블록만 잘라낸다.** 1차 구현은 400자를 잘랐는데 그 창이 블록을 넘어
     *    뒤의 `getSnapshot(snapshotId, …)` 를 읽어 **거짓 FAIL** 이 났다 — 가드가 맞았고
     *    내 창이 거칠었다. 🟢 `JSON.stringify` 의 닫는 `})}` 까지만 본다.
     */
    const end = src.indexOf("})}", at);
    expect(end, "🔴 로그 블록의 끝을 못 찾았다").toBeGreaterThan(at);
    const seg = src.slice(at, end);
    for (const banned of ["url:", "urls:", "snapshotId", "workspaceId", "hostname:", "title"]) {
      expect(seg, `🔴 로그에 ${banned} 가 섞였다`).not.toContain(banned);
    }
    /** 🔴 호스트 «이름» 을 적지 않는다 — 개수(`hosts.size`)만 센다. */
    expect(seg).toContain("hosts: hosts.size");
  });

  it("A-4 🔴 국내 신호는 **`.kr` 단독** 이다(통화·추측으로 국내를 만들지 않는다)", () => {
    const src = bare();
    expect(src).toContain('h.endsWith(".kr")');
    /**
     * 🔴 통화나 도메인 추측으로 국내를 세지 않는다 — `classifyCandidateMarket` 의
     *    보호 계약(「통화 단독 KR 결정 금지」)과 같은 방향이다. 이 계측은 **관측** 이고
     *    시장 «판정» 이 아니므로 `.kr` 한 축만 센다.
     */
    const at = src.indexOf("[CASE-01-INPUT]");
    const seg = src.slice(Math.max(0, at - 700), at);
    expect(seg).not.toContain("KRW");
    expect(seg).not.toContain("classifyCandidateMarket");
  });

  it("A-5 🔴 URL 파싱 실패를 **국내로 몰지 않는다**(추측 금지)", () => {
    const src = bare();
    const at = src.indexOf("[CASE-01-INPUT]");
    /** 🟢 try/catch 가 있고 catch 에서 kr 을 올리지 않는다. */
    const seg = src.slice(Math.max(0, at - 900), at);
    expect(seg).toContain("} catch {");
    const c = seg.slice(seg.indexOf("} catch {"));
    expect(c.slice(0, 120)).not.toContain("kr +=");
  });

  it("A-6 🟢 후보가 **없으면 찍지 않는다**(빈 로그를 만들지 않는다)", () => {
    const src = bare();
    expect(src).toContain("if (candidateUrls && candidateUrls.length > 0) {");
  });
});

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 CASE-01 실행단위 2 — **탈락은 «어디서» 났는지와 함께 적는다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 `__url_candidates__` 가 CASE-01 의 **주경로** 다(브라우저 AI Search → candidateUrls).
 *    그 풀의 탈락 로그가 **`reason` 만** 이라 「국내가 빠졌나 해외가 빠졌나」를 **가를 수
 *    없었다** ⟹ 「국내 소싱 후보 0」의 원인이 ②인지 ③인지 구조적으로 미측정이었다.
 * 🟢 형제 생산자 `[SP07-pool]` 은 처음부터 `host:reason` 을 찍고 있었다 — 같은 모양으로 맞췄다.
 * 🔴 이 계약은 **두 생산자를 같이** 본다. 한쪽만 되돌리면 FAIL 한다.
 */
describe("CASE-01 실행단위 2 — 탈락 관측의 모양", () => {
  const RUNNER = path.join(
    process.cwd(),
    "src", "app", "api", "price-history", "_lib", "run-domestic-price-check.ts",
  );
  const runner = () =>
    readFileSync(RUNNER, "utf8").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");

  /** 🟢 주경로와 형제 생산자가 **둘 다** host 를 붙인다. */
  it.each([
    ["[WU-024-urlpool]", "__url_candidates__ — CASE-01 주경로"],
    ["[SP07-pool]", "__web_search__ — 형제 생산자"],
  ])("B-1 %s 의 dropped 가 **host 와 함께** 적힌다 (%s)", (tag) => {
    const src = runner();
    const at = src.indexOf(tag);
    expect(at, `🔴 ${tag} 로그가 사라졌다`).toBeGreaterThan(0);
    const end = src.indexOf("})}", at);
    const seg = src.slice(at, end > at ? end : at + 2500);
    expect(seg, `🔴 ${tag} 이 dropped 를 안 적는다`).toContain("dropped:");
    expect(seg, `🔴 ${tag} 이 host 없이 reason 만 적는다 — 원인이 안 갈린다`).toContain(
      "new URL(d.url).hostname",
    );
    expect(seg).toContain("${host}:${d.reason}");
  });

  /** 🔴🔴 URL 원문을 로그에 싣지 않는다 — host 까지다. */
  it("B-2 🔴🔴 dropped 에 **URL 원문을 그대로 싣지 않는다**", () => {
    const src = runner();
    const at = src.indexOf("[WU-024-urlpool]");
    const end = src.indexOf("})}", at);
    const seg = src.slice(at, end);
    expect(seg, "🔴 d.url 을 그대로 내보내고 있다").not.toMatch(/=>\s*d\.url\b/);
    expect(seg).not.toContain("d.url}:");
  });

  /** 🔴 파싱 실패를 **조용히 버리지 않는다** — 그것도 관측값이다. */
  it("B-3 🔴 파싱 실패한 URL 을 탈락 목록에서 **지우지 않는다**", () => {
    const src = runner();
    const at = src.indexOf("[WU-024-urlpool]");
    const end = src.indexOf("})}", at);
    const seg = src.slice(at, end);
    const c = seg.slice(seg.indexOf("} catch {"));
    expect(seg).toContain("let host = d.url;");
    expect(c.slice(0, 160), "🔴 catch 에서 걸러내면 분모가 줄어든다").not.toContain("return null");
  });
});
