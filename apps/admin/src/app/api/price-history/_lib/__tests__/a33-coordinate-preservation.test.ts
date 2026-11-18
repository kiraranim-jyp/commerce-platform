/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 A 과제 — **A군 33 좌표 보존 + 덮어쓰기 위험 «차단»**(네트워크 0 · 쓰기 0)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **왜 필요했나.** A군 33쌍의 유일한 좌표(`candidateUrl` 33/33)가
 *    `docs/MI-REEVAL-STEP5-SHADOW.json` 에만 있는데, `mi-reeval-05-shadow.test.ts:366`
 *    이 그 파일을 **`writeFileSync` 로 덮어쓴다.** 그리고 그 산출물은 지금 **사용자
 *    수정 상태(` M`)** 다 ⟹ 그 하니스를 돌리면 **사용자 수정이 날아간다.**
 *    🟢 메모 `measurement-harness-must-not-rewrite-existing-artifacts` 가 적어 둔 함정이고
 *    `MI-KIDS-TRIAGE-V2.json`(untracked)에서 **실제로 한 번 실현됐다.**
 *
 * 🔴 **그 하니스를 고치지도 돌리지도 않았다** — 사용자 수정 상태이므로 CPO 가 금지했다.
 * 🟢 **대신 좌표를 쓰기 주체가 «없는» 자리로 복사했다** — 원본이 덮어써져도 좌표는 산다.
 *
 * 🔴 복사한 것은 **좌표뿐** 이다 — `pairId · domain · originUrl · candidateUrl`.
 *    설명문·원문·판정 수치(`axes` · `shadowV1/V2` · `priorGt` · `ceoLatest`)는 **넣지 않았다**
 *    (사용자 제약 「불필요한 상품 원문 전체 저장 금지」 · 그리고 판정 수치가 둘이 되면
 *     어느 쪽이 정본인지 모르게 된다).
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.join(process.cwd(), "..", "..");
/**
 * 🔴🔴 **`fixtures/` 가 아니라 `preserved/` 다 — 가드가 그것을 가르쳐 줬다.**
 *
 * 1차 구현이 이것을 `fixtures/` 에 넣었고 **사용자 테스트가 FAIL** 했다 —
 * `core-same06-safety-gt-search` 의 「🔴 미분류 fixture 가 있으면 검색 범위를 «전수» 로
 * 보고하지 않는다」. 🟢 **그 가드가 맞다**: `fixtures/` 는 **GT 라벨 후보 집합** 이고
 * 그 전수 분류가 측정 분모의 근거다. 좌표 사본은 **GT 가 아니므로** 거기 있으면 안 된다.
 * 🔴 그 테스트는 **사용자 수정 상태** 라 분류표를 고칠 수 없다 ⟹ **가드를 풀지 않고
 *    내 파일을 옮겼다.** 그리고 경로가 성격을 말한다 — `preserved/` = 쓰기 주체 0 인 사본.
 */
const FIXTURE = path.join(
  process.cwd(),
  "src", "app", "api", "price-history", "_lib", "__tests__", "preserved",
  "a33-candidate-coordinates.json",
);
const SHADOW = path.join(ROOT, "docs", "MI-REEVAL-STEP5-SHADOW.json");

type Pair = { pairId: string; domain: string; originUrl: string; candidateUrl: string };
const backup = () =>
  JSON.parse(readFileSync(FIXTURE, "utf8")) as { count: number; pairs: Pair[] };

describe("A 과제 — A군 33 좌표 보존", () => {
  it("P-1 🟢 좌표 **33쌍** 이 보존돼 있다", () => {
    const b = backup();
    expect(b.count).toBe(33);
    expect(b.pairs).toHaveLength(33);
    expect(b.pairs.every((p) => p.candidateUrl.startsWith("http"))).toBe(true);
  });

  /**
   * 🔴🔴 **드리프트 감지.** 원본이 바뀌면(정상 재측정이든 덮어쓰기든) 이 단언이 FAIL 해서
   *    **사람이 보게 된다.** 🟢 그것이 목적이다 — 조용히 갈라지는 것을 막는다.
   * 🔴 원본을 **읽기만** 한다. 자동으로 맞추지 않는다(자동 동기화는 사고를 숨긴다).
   */
  it("P-2 🔴🔴 원본 `pairsA` 와 좌표가 **일치** 한다(갈라지면 FAIL)", () => {
    const b = backup();
    const live = (JSON.parse(readFileSync(SHADOW, "utf8")) as { pairsA: Pair[] }).pairsA;
    expect(live, "🔴 원본에 pairsA 가 없다 — 덮어써졌을 수 있다").toHaveLength(33);
    const key = (p: Pair) => `${p.pairId}|${p.candidateUrl}`;
    expect(new Set(live.map(key))).toEqual(new Set(b.pairs.map(key)));
  });

  it("P-3 🔴 사본에 **원문·판정 수치가 없다**(사본이 정본을 흉내내지 않는다)", () => {
    const raw = readFileSync(FIXTURE, "utf8");
    for (const banned of ["description", "axes", "shadowV1", "shadowV2", "priorGt", "ceoLatest"]) {
      expect(raw, `🔴 ${banned} 가 사본에 섞였다 — 정본이 둘이 된다`).not.toContain(`"${banned}"`);
    }
  });

  /**
   * 🔴🔴🔴 **이것이 실제 «차단» 이다 — 쓰기 주체를 고정한다.**
   *
   * 지금 그 산출물을 쓰는 하니스는 **하나** 다(`mi-reeval-05-shadow`). 🔴 두 번째가
   * 생기면 어느 쪽이 정본인지 모르게 되고, 사용자 수정이 날아가는 경로가 **배로** 늘어난다.
   * 🟢 그래서 **개수를 세어 잠근다** — 새 쓰기 주체가 늘면 FAIL 하고 사람이 판단한다.
   * 🔴 사본(`a33-candidate-coordinates.json`)의 쓰기 주체는 **0** 이어야 한다.
   */
  it("P-4 🔴🔴 그 산출물의 **쓰기 주체가 하나** 이고 사본의 쓰기 주체는 **0** 이다", () => {
    const dir = path.join(
      process.cwd(), "src", "app", "api", "price-history", "_lib", "__tests__",
    );
    const files = readdirSync(dir).filter((f) => f.endsWith(".ts"));
    let writesShadow = 0;
    let writesBackup = 0;
    for (const f of files) {
      const src = readFileSync(path.join(dir, f), "utf8");
      /** 🔴 주석이 아니라 **실제 쓰기 호출** 만 센다. */
      const bare = src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
      if (/writeFileSync\([^)]*MI-REEVAL-STEP5-SHADOW/.test(bare)) writesShadow += 1;
      if (/writeFileSync\([^)]*a33-candidate-coordinates/.test(bare)) writesBackup += 1;
    }
    expect(writesShadow, "🔴 그 산출물을 쓰는 하니스가 하나가 아니다").toBe(1);
    expect(writesBackup, "🔴 좌표 사본에 쓰기 주체가 생겼다 — 사본이 흔들린다").toBe(0);
  });

  /**
   * 🟡 **26 GET 의 실제 상한을 좌표로 고정한다** — CPO 결정 입력이다.
   * 🔴 기존 제약으로 **사전 배제되는 7건** 을 숫자로 잠근다(그 숫자가 흔들리면 FAIL).
   */
  it("P-5 🟡 사전 배제 **7** · 미확인 **26**(CPO 결정 입력)", () => {
    const b = backup();
    const host = (p: Pair) => new URL(p.candidateUrl).hostname;
    const excludedBrand = b.pairs.filter((p) => host(p) === "main-story.com").length;
    const robotsBlocked = b.pairs.filter((p) => host(p) === "www.wconcept.co.kr").length;
    /** 🟢 CASE-01 이 HTTP 429 → TimeoutError 로 확정한 접근 제한. */
    const accessDenied = b.pairs.filter((p) => host(p) === "global.trenbe.com").length;
    expect({ excludedBrand, robotsBlocked, accessDenied }).toEqual({
      excludedBrand: 3,
      robotsBlocked: 1,
      accessDenied: 3,
    });
    expect(33 - (excludedBrand + robotsBlocked + accessDenied)).toBe(26);
  });
});
