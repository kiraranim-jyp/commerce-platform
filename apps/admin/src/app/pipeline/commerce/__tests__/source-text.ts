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

/** 블록 주석(/* *\/, {/* *\/})과 줄 주석(//)을 걷어낸 소스. */
export function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
}
