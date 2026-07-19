/**
 * 이진 마스크(1=전경, 0=배경) 위에서 4-neighbor BFS로 connected component를 찾는
 * 공용 유틸. product-processor(가장 큰 덩어리만 남기기)와 quality-score(파편화/구멍
 * 측정) 양쪽에서 같은 라벨링 로직을 재사용한다.
 */
export interface ComponentLabels {
  labels: Int32Array;
  sizes: number[];
}

export function labelComponents(binary: Uint8Array, width: number, height: number): ComponentLabels {
  const labels = new Int32Array(width * height).fill(-1);
  const queue = new Int32Array(width * height);
  const sizes: number[] = [];

  for (let start = 0; start < binary.length; start++) {
    if (binary[start] === 0 || labels[start] !== -1) continue;

    const label = sizes.length;
    let qHead = 0;
    let qTail = 0;
    queue[qTail++] = start;
    labels[start] = label;
    let size = 0;

    while (qHead < qTail) {
      const idx = queue[qHead++];
      size++;
      const x = idx % width;
      const y = (idx - x) / width;

      if (x > 0 && binary[idx - 1] && labels[idx - 1] === -1) {
        labels[idx - 1] = label;
        queue[qTail++] = idx - 1;
      }
      if (x < width - 1 && binary[idx + 1] && labels[idx + 1] === -1) {
        labels[idx + 1] = label;
        queue[qTail++] = idx + 1;
      }
      if (y > 0 && binary[idx - width] && labels[idx - width] === -1) {
        labels[idx - width] = label;
        queue[qTail++] = idx - width;
      }
      if (y < height - 1 && binary[idx + width] && labels[idx + width] === -1) {
        labels[idx + width] = label;
        queue[qTail++] = idx + width;
      }
    }

    sizes.push(size);
  }

  return { labels, sizes };
}

/** sizes가 가장 큰 컴포넌트의 라벨 번호를 반환한다. 컴포넌트가 없으면 -1. */
export function largestComponentLabel(sizes: number[]): number {
  if (sizes.length === 0) return -1;
  let largest = 0;
  for (let i = 1; i < sizes.length; i++) {
    if (sizes[i] > sizes[largest]) largest = i;
  }
  return largest;
}

/**
 * 배경(0) 픽셀 중 이미지 테두리에서 flood-fill로 도달 가능한 영역을 먼저 찾고,
 * 도달하지 못한 배경 컴포넌트 개수를 센다 — 이게 실루엣 내부에 "갇힌 구멍"이다
 * (테두리와 이어진 배경은 정상적인 바깥 배경이므로 구멍이 아니다).
 */
export function countEnclosedHoles(binary: Uint8Array, width: number, height: number): number {
  const reachable = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let qHead = 0;
  let qTail = 0;

  const tryEnqueue = (idx: number) => {
    if (binary[idx] === 0 && reachable[idx] === 0) {
      reachable[idx] = 1;
      queue[qTail++] = idx;
    }
  };

  for (let x = 0; x < width; x++) {
    tryEnqueue(x);
    tryEnqueue((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    tryEnqueue(y * width);
    tryEnqueue(y * width + width - 1);
  }

  while (qHead < qTail) {
    const idx = queue[qHead++];
    const x = idx % width;
    const y = (idx - x) / width;
    if (x > 0) tryEnqueue(idx - 1);
    if (x < width - 1) tryEnqueue(idx + 1);
    if (y > 0) tryEnqueue(idx - width);
    if (y < height - 1) tryEnqueue(idx + width);
  }

  const enclosedBackground = new Uint8Array(width * height);
  for (let i = 0; i < binary.length; i++) {
    enclosedBackground[i] = binary[i] === 0 && reachable[i] === 0 ? 1 : 0;
  }

  return labelComponents(enclosedBackground, width, height).sizes.length;
}
