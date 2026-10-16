import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * WU-030 — **A → B → C 연속 분석**: 오염 경로를 하나씩 막는다
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 CPO 가 지정한 검증 항목(§4)을 **하나도 빼지 않고** 잠근다:
 * ```
 * A 의 category 가 B 에 남지 않음        A 의 detailBlocks 가 B 에 남지 않음
 * A 의 URL 이 B 스냅샷에 저장되지 않음    A 의 transient 후보가 B 에 나타나지 않음
 * B/C 가 각각 독립 스냅샷을 만든다        기존 A 데이터는 보존된다
 * 새로고침과 「새 상품 분석」의 의미가 섞이지 않는다
 * ```
 *
 * 🔴 **왜 state 머신을 «소스» 로 보는가** — `PipelinePage` 는 fetch·SSE·sessionStorage·
 *    Supabase 를 동시에 쓰는 화면이라 전체 마운트는 네트워크 없이는 의미 있는 A→B→C 를
 *    만들지 못한다. 🟢 그래서 **오염이 실제로 일어나는 지점**(저장 payload ↔ 리셋 목록)을
 *    계약으로 고정한다 — 그 둘이 어긋나는 순간이 곧 오염이고, 이번 결함도 정확히 그것이었다.
 * 🔴 Production 실사용(A→B→C)은 CEO 테스트가 닫는다 — 여기서 「확인했다」로 적지 않는다.
 */

const PAGE = readFileSync(path.join(__dirname, "..", "page.tsx"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\/\/.*$/gm, "");

const RESET_BODY = (() => {
  const start = PAGE.indexOf("function resetWorkspace()");
  expect(start).toBeGreaterThan(-1);
  const rest = PAGE.slice(start);
  return rest.slice(0, rest.indexOf("\n  }") + 4);
})();

/** 스냅샷 저장 payload(`workspace: { … }`) — B 의 서버 기록에 실제로 들어가는 것. */
const SAVE_PAYLOAD = (() => {
  const at = PAGE.indexOf("workspace: {");
  expect(at).toBeGreaterThan(-1);
  const rest = PAGE.slice(at);
  return rest.slice(0, rest.indexOf("}),"));
})();

/* ══════════════ ① 🔴 A 의 값이 B 의 «스냅샷» 에 저장되지 않는다 ══════════════ */

describe("① 저장되는 상품별 값은 전부 리셋된다", () => {
  /**
   * 🔴🔴 이것이 이번 결함의 **근본 형태** 다 — 「저장되는 목록」과 「리셋되는 목록」이
   *    따로 자라면 갈라지고, 갈라진 칸이 곧 A→B 오염이다. 두 목록을 **맞댄다**.
   */
  it.each([
    ["url", "setUrl", "A 의 URL 이 B 스냅샷에 저장되지 않는다"],
    ["categoryMappings", "setCategoryMappings", "A 의 채널 카테고리가 B 에 남지 않는다"],
    ["detailOverride", "setDetailOverride", "A 의 상세(detailBlocks) override 가 B 에 남지 않는다"],
    ["marketCategoryProfileId", "setMarketCategoryId", "A 의 조사 카테고리가 B 에 남지 않는다"],
    ["representativeId", "setRepresentativeId", "A 의 대표 이미지가 B 에 남지 않는다"],
    ["canonicalProduct", "setProduct", "A 의 상품 사실이 B 에 남지 않는다"],
    ["items", "setItems", "A 의 이미지 작업본이 B 에 남지 않는다"],
  ])("저장 payload 의 %s 는 리셋된다 — %s", (field, setter) => {
    expect(SAVE_PAYLOAD, `${field} 가 저장 payload 에 없다`).toContain(field);
    expect(RESET_BODY, `${setter} 가 리셋에 없다`).toContain(`${setter}(`);
  });
});

/* ══════════════ ② 🔴 B/C 가 «각각» 독립 스냅샷을 만든다 ══════════════ */

describe("② 새 상품은 새 스냅샷을 만든다", () => {
  it("스냅샷 식별자와 생성 lock 이 전부 풀린다", () => {
    for (const marker of [
      "setSnapshotId(null)",
      "setProductId(null)",
      "setJobKey(null)",
      "snapshotIdRef.current = null",
      "creatingSnapshotRef.current = false",
    ]) {
      expect(RESET_BODY).toContain(marker);
    }
  });

  /**
   * 🔴 A 의 저장 POST 가 아직 떠 있을 수 있다. 세대를 올리지 않으면 **그 응답이
   *    B 의 스냅샷 id 를 덮어쓴다** — 그러면 B 가 A 의 행에 저장된다.
   */
  it("세대를 올려 A 의 늦은 응답이 B 를 덮지 못하게 한다", () => {
    expect(RESET_BODY).toContain("sessionGenerationRef.current += 1");
    expect(PAGE).toContain("startGeneration");
  });
});

/* ══════════════ ③ 🔴 A 의 transient 후보가 B 에 나타나지 않는다 ══════════════ */

describe("③ 일시 후보는 상품을 넘어가지 않는다", () => {
  const PANEL = readFileSync(
    path.join(__dirname, "..", "commerce", "DomesticPriceIntelligencePanel.tsx"),
    "utf8",
  )
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");

  /**
   * 🟢 구조적으로 넘어갈 수 없다 — 일시 후보는 **DB 에 저장되지 않고**(WU-024 불변식)
   *    패널의 state 에만 살며, 그 state 는 **snapshotId 가 바뀌면 다시 받는다**.
   * 🔴 그리고 「지금 확인」 응답을 받을 때마다 **덮어쓴다**(이전 확인 결과를 남기지 않는다).
   */
  it("transient state 는 확인할 때마다 덮어쓴다 — 누적되지 않는다", () => {
    expect(PANEL).toContain("setGeminiEvidence(json.domesticShop?.geminiEvidence ?? null)");
    expect(PANEL).toContain("setUrlCandidateEvidence(json.domesticShop?.urlCandidateEvidence ?? null)");
    /** 🔴 누적(append)하는 코드가 없어야 한다. */
    expect(PANEL).not.toMatch(/setGeminiEvidence\(\s*\(prev\)/);
    expect(PANEL).not.toMatch(/setUrlCandidateEvidence\(\s*\(prev\)/);
  });

  it("🔴 입력칸도 상품을 넘어가지 않는다(새 상품에 A 의 URL 이 남지 않는다)", () => {
    /** 🟢 패널은 snapshotId 로 키가 갈리고, 입력 state 는 그 패널 안에 산다. */
    expect(PANEL).toContain("const [candidateUrlsText, setCandidateUrlsText] = useState(\"\")");
  });
});

/* ══════════════ ④ 🔴 기존 A 데이터는 보존된다 ══════════════ */

describe("④ 「새 상품」은 교체이지 삭제가 아니다", () => {
  it("리셋이 서버를 호출하지 않는다(삭제 0)", () => {
    expect(RESET_BODY).not.toMatch(/fetch\(|DELETE|deleteSnapshot/);
  });

  /** 🟢 지우는 것은 **브라우저 세션 저장소와 URL 쿼리** 뿐이다. */
  it("지우는 대상이 브라우저 쪽으로 한정된다", () => {
    expect(RESET_BODY).toContain("sessionStorage.removeItem");
    expect(RESET_BODY).toContain('url.searchParams.delete("resume")');
  });
});

/* ══════════════ ⑤ 🔴 새로고침과 「새 상품 분석」이 섞이지 않는다 ══════════════ */

describe("⑤ 두 행동의 의미가 다르다", () => {
  /**
   * 새로고침 = **같은 상품을 다시 그린다**(세션 저장소/`?resume=` 에서 복원).
   * 새 상품 분석 = **작업 context 를 비운다**(복원 근거를 먼저 지운다).
   * 🔴 그래서 리셋은 «복원 근거부터» 지워야 한다 — 안 지우면 새로고침이 방금
   *    비운 화면을 A 로 되돌린다.
   */
  it("리셋이 복원 근거(세션 저장소 · resume)를 먼저 지운다", () => {
    const storageAt = RESET_BODY.indexOf("sessionStorage.removeItem");
    const stateAt = RESET_BODY.indexOf("setUrl(\"\")");
    expect(storageAt).toBeGreaterThan(-1);
    expect(stateAt).toBeGreaterThan(storageAt);
  });

  it("새로고침 복원 경로가 그대로 살아 있다(기능을 없애지 않았다)", () => {
    expect(PAGE).toContain("WORKSPACE_STORAGE_KEY");
    expect(PAGE).toMatch(/resume/);
  });
});
