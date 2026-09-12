/**
 * 배치 규칙을 소스 텍스트로 검사하는 테스트들이 함께 쓰는 읽기 도구.
 *
 * ── 왜 필요한가 ──────────────────────────────────────────────────────────
 * 이 폴더의 여러 테스트(price-single-surface / price-display-layout /
 * price-hierarchy-ui / price-judgement-card)는 "무엇이 어느 화면에 있는가"를
 * 파일 내용으로 확인한다. 배치 규칙은 순수 함수로 표현할 수가 없기 때문이다.
 *
 * 그런데 이 저장소의 주석은 "왜 그렇게 했나"를 길게 설명한다. 그래서 금지어가
 * 주석에 등장하는 것은 정상이고(예: "예전에는 여기서 computePriceBreakdown을
 * 불렀다"), 막아야 하는 것은 **실제 호출과 렌더**뿐이다. 그 구분을 세 파일이
 * 각자 구현하면 언젠가 한 곳만 고쳐진다.
 */
import { readFileSync } from "node:fs";

/** 줄바꿈은 정규화한다 — 이 저장소의 작업 트리는 CRLF라, 여러 줄짜리 배치
 * 검사를 그냥 하면 "코드가 맞는데 테스트만 실패"하는 위장 실패가 난다. */
export function readSourceAt(url: URL): string {
  return readFileSync(url, "utf8").replace(/\r\n/g, "\n");
}

/**
 * MI 패널에서 **셀러가 아무것도 누르지 않고 보는 부분**의 소스.
 *
 * ── 왜 정의를 한 곳으로 모았나(MI-UX-FINAL-REVIEW, CEO 지시 2026-09-12) ──────
 * 지금까지 두 테스트(mi-simplify / mi-polish)가 각자 "본문"을 잘라 썼고, 둘 다
 * 판정 카드 안쪽(`{hasAnyData && (` ~ 재조회 주석)까지만 잘랐다. 그런데 실제
 * 화면에서는 그 카드 **아래**로 재조회 버튼 · 기회 카드 · 국내 비교상품 블록 ·
 * 동일상품 근거 · 안내 두 문단이 접힘 없이 계속 서 있었다 — 잘라낸 구간 밖이라
 * 어떤 테스트도 보지 못했고, 그래서 "본문을 줄였다"는 보고와 "화면은 여전히
 * 길다"는 실물이 갈라졌다.
 *
 * 그래서 정의를 뒤집는다: 본문은 "카드 안쪽"이 아니라 **FULL 렌더 전체에서
 * 「왜 이렇게 판단했나요?」 접힘 블록만 들어낸 나머지**다. 새 블록이 패널
 * 어디에 서든 이 구간에 들어오므로, 다음 사람이 카드 밖에 무언가를 세워도
 * 검사를 피할 자리가 없다.
 *
 * 화면 자체의 증명은 mi-ux-final.test.ts가 react-dom/server로 패널을 통째로
 * 그려서 한다 — 여기는 배치 규칙(무엇이 어느 층에 적혀 있는가)만 본다.
 */
export function miBodySource(panel: string): string {
  const startAt = panel.lastIndexOf('<CollapsibleSection title="Market Intelligence" defaultOpen>');
  const detailAt = panel.indexOf("{showMarketDetail && (", startAt);
  if (startAt < 0 || detailAt < 0) {
    throw new Error("MI 패널의 본문 구간을 찾지 못했다 — 구조가 바뀌었으면 이 함수를 먼저 고쳐야 한다.");
  }
  let depth = 0;
  let detailEndAt = -1;
  for (let i = detailAt; i < panel.length; i++) {
    if (panel[i] === "{") depth++;
    else if (panel[i] === "}") {
      depth--;
      if (depth === 0) {
        detailEndAt = i + 1;
        break;
      }
    }
  }
  if (detailEndAt < 0) throw new Error("「왜 이렇게 판단했나요?」 접힘 블록의 끝을 찾지 못했다.");
  return panel.slice(startAt, detailAt) + panel.slice(detailEndAt);
}

/** 블록 주석(/* *\/, {/* *\/})과 줄 주석(//)을 걷어낸 소스. */
export function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
}
