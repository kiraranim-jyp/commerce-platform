import type { DetailPageBlock } from "@commerce/listing";

/** N-4.08 P1-1(대표님 지시: "상품별 예외 UX") — id는 블록 인스턴스마다 새로
 * 발급되는 값이라(newBlockId(), defaultDetailBlocks()의 내부 카운터) "같은
 * 구성인지"를 판단할 때는 무시한다. 순서 + kind + enabled + 그 외 필드(위치/
 * 섹션/텍스트)가 전부 같아야 "기본 설정 사용 중"이다. 별도 파일로 분리한 이유:
 * DetailPageEditor.tsx는 "@/components/ui/*"를 가져오는 "use client" 컴포넌트라
 * vitest(경로 alias 미설정)에서 직접 import할 수 없다 — 이 비교 로직만 alias
 * 의존성 없는 순수 함수로 떼어내 정상적으로 회귀 테스트한다. */
export function blockSignature(block: DetailPageBlock): string {
  const { id: _id, ...rest } = block;
  return JSON.stringify(rest);
}

export function blocksMatchDefault(blocks: DetailPageBlock[], defaults: DetailPageBlock[]): boolean {
  if (blocks.length !== defaults.length) return false;
  return blocks.every((block, index) => blockSignature(block) === blockSignature(defaults[index]));
}
