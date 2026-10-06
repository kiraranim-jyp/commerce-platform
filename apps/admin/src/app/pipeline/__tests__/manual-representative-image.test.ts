import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * STEP 2-D — **셀러의 대표이미지 수동 경로를 «먼저» 고정한다.** (CPO 승인 2026-10-06)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * ── 왜 이 파일이 먼저인가 ─────────────────────────────────────────────────
 * 자동 수집에서 대표이미지가 안 잡히는 경우가 확인됐다(AI 분류가 PRODUCT 를 하나도
 * 내지 못하면 `thumbnail=""` → `isRepresentative` 전부 false). 그때 셀러가 쓸 수
 * 있는 **유일한 탈출구가 이 수동 경로** 다(`addImage` · `setRepresentative`).
 *
 * 🔴 그런데 그 경로를 지키는 테스트가 «하나도 없었다». 분류/readiness 를 고치는
 * 과정에서 조용히 깨지면 셀러가 아무것도 할 수 없게 된다. 그래서 고치기 «전» 에
 * 고정한다 — 이 파일은 수정의 전제다.
 *
 * ── 🔴 소스 계약 테스트다. 그 한계를 숨기지 않는다 ────────────────────────
 * 이 불변식들은 `page.tsx` 의 **client 컴포넌트 인라인 핸들러** 안에 있다
 * (`addImage` · `setRepresentative` · `removeImage`). 순수 함수로 꺼내면 테스트할
 * 수 있지만, 이번 단계는 **로직 변경이 금지** 돼 있다(CPO). 그래서 소스를 읽어
 * 계약을 고정한다.
 *
 * 🔴 소스 검사는 «리팩터에 약하다» — 같은 뜻으로 고쳐 써도 깨진다. 깨지면 회귀가
 * 아니라 「계약이 옮겨갔다」는 신호이고, 그때 이 파일을 그 자리로 따라가게 고친다.
 * 🔴 그리고 **주석을 벗기고** 본다. 이 저장소에서 반복해 걸린 함정이라, 벗기는
 * 것이 실제로 됐는지도 아래에서 검사한다(§0).
 */

const PAGE = join(__dirname, "..", "page.tsx");

/** 주석을 벗긴 «코드» 만. 설명문이 계약으로 세어지지 않게 한다. */
const code = readFileSync(PAGE, "utf8")
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^[ \t]*\/\/.*$/gm, "");

describe("§0 🔴 측정 자체가 성립하는가", () => {
  it("파일을 읽었고 코드가 남아 있다", () => {
    expect(code.length).toBeGreaterThan(5000);
    expect(code).toContain("function addImage");
  });

  it("🔴 주석 제거가 «실제로» 됐다 — 안 됐으면 아래 전부가 설명문을 세게 된다", () => {
    /* 717행 주석의 문구. 벗겼으면 코드에 남아 있지 않아야 한다. */
    expect(code, "주석이 그대로 남아 있다 — strip 이 동작하지 않았다").not.toContain(
      "반드시 공개 URL이어야 한다",
    );
    /* 대조군: 주석 밖의 식별자는 남아 있어야 한다. */
    expect(code).toContain("detailPublicUrl");
  });
});

describe("① 🔴 수동 업로드가 «기존 대표를 덮지 않는다»", () => {
  it("대표 여부는 «상품 이미지가 비어 있었는가» 로만 정해진다", () => {
    expect(code).toContain("const wasEmpty = (product?.images.length ?? 0) === 0;");
    expect(code).toContain("isRepresentative: wasEmpty,");
  });

  it("🔴 `isRepresentative: true` 를 무조건 넣지 않는다", () => {
    /* `wasEmpty` 를 거치지 않고 참을 박으면 두 번째 업로드가 대표를 가로챈다. */
    expect(code).not.toContain("isRepresentative: true,");
  });

  it("비어 있지 않았을 때만 representativeId 를 바꾸지 않는다 — 조건부다", () => {
    expect(code).toContain("if (wasEmpty) setRepresentativeId(id);");
  });
});

describe("② 🔴 수동 경로는 AI 분류를 거치지 않는다", () => {
  it("업로드한 이미지는 PRODUCT 로 들어간다 — 그래서 대표 후보가 된다", () => {
    /* 자동 경로의 후보는 `type === "PRODUCT"` 뿐이다(image-pipeline). 수동 경로가
       UNKNOWN 으로 들어가면 탈출구가 탈출구가 아니게 된다. */
    expect(code).toContain('classification: "PRODUCT",');
  });
});

describe("③ 🔴 수동 업로드가 «등록 가능한» URL 을 만든다", () => {
  it("URL 은 업로드 API 응답에서 온다 — 로컬 data: URI 가 아니다", () => {
    expect(code).toContain('await fetch("/api/pipeline/upload-image"');
    expect(code).toContain("const url = data.url;");
  });

  it("🔴 업로드가 실패하면 «이미지를 추가하지 않는다» — early return", () => {
    /* 실패한 채로 넘어가면 빈 값이나 로컬 URL 이 대표로 앉는다. */
    expect(code).toContain("if (!data.ok || !data.url) {");
  });

  it("🔴 payload 가 읽는 칸(detailPublicUrl)에 그 공개 URL 이 들어간다", () => {
    /* 마켓플레이스 payload 가 실제로 읽는 값이 detailPublicUrl 이다.
       여기에 data: 가 들어가면 getRegistrationImageUrl 이 걸러 대표가 사라진다. */
    expect(code).toContain("detailPublicUrl: url,");
  });
});

describe("④ 🔴 대표 전환은 «화면과 등록 데이터를 함께» 바꾼다", () => {
  it("setRepresentative 가 UI state 와 product.images 를 같은 액션에서 갱신한다", () => {
    /* 과거 버그: representativeId(카드 표시용)만 바꾸고 product.images 는 그대로여서
       대표를 바꿔도 등록 payload 가 «이전 이미지» 를 계속 대표로 썼다. */
    expect(code).toContain("setRepresentativeId(itemId);");
    expect(code).toContain(
      "images: prev.images.map((img) => ({ ...img, isRepresentative: img.id === itemId })),",
    );
  });
});

describe("⑤ 🔴 대표를 삭제하면 대표가 «없는 상태로 남지 않는다»", () => {
  it("남은 것의 첫 장으로 승격한다 — 남은 것이 없으면 null", () => {
    expect(code).toContain(
      "const newRepresentativeId = wasRepresentative ? (remaining[0]?.id ?? null) : representativeId;",
    );
  });

  it("대표가 아닌 것을 지우면 대표가 바뀌지 않는다 — 삼항의 else 가 그것이다", () => {
    expect(code).toContain("? (remaining[0]?.id ?? null) : representativeId;");
  });
});

describe("⑥ 🔴 representativeId 가 저장되고 복원된다", () => {
  it("저장 payload 에 실린다 — 두 곳(세션 캐시 · 스냅샷)", () => {
    const occurrences = (code.match(/^\s+representativeId,$/gm) ?? []).length;
    expect(occurrences, "저장 자리가 줄었다 — 새로고침하면 대표가 사라진다").toBeGreaterThanOrEqual(2);
  });

  it("복원 경로가 둘 다 있다 — 스냅샷과 세션 캐시", () => {
    expect(code).toContain("setRepresentativeId(ws.representativeId);");
    expect(code).toContain("setRepresentativeId(saved.representativeId ?? null);");
  });
});
