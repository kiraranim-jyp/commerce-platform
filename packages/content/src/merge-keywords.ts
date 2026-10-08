/**
 * ════════════════════════════════════════════════════════════════════════════
 * P5.6 Phase 4(CPO 승인, 2026-10-09) — **기존 태그를 «덮지» 않는다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 지금까지 `generateKeywords(product)` 는 기존 태그를 «인자로 받지 않았다».
 *    그래서 「AI 콘텐츠 생성」을 누르면 셀러가 손으로 넣은 태그가 사라졌다.
 *    CPO 정책은 그 반대다 — 기존 태그 + AI 추천을 «합친다».
 *
 * ── 🔴 없는 사실을 태그로 만들지 않는다 ───────────────────────────────────
 * 이 파일은 «합치는» 일만 한다. 태그를 새로 «지어내지» 않는다 — 입력 두 벌을
 * 받아 중복을 걷어낼 뿐이다. 생성 근거는 호출부(provider)가 책임진다.
 *
 * ── 🔴 중복은 「글자가 같다」보다 넓다 ────────────────────────────────────
 * 대소문자 · 앞뒤 공백 · 내부 공백 수 · 전각/반각이 달라도 사람에게는 같은
 * 태그다. 실측 표기 흔들림: "Bobo Choses" / "bobo choses" / "Bobo  Choses".
 * 🔴 다만 **한글/영문은 합치지 않는다** — "원피스"와 "dress"는 검색어가 다르다.
 *    번역 동치를 여기서 판단하면 그것이 「없는 사실 만들기」다.
 */

/** 비교용 열쇠. 🔴 «표시값» 은 바꾸지 않는다 — 이 값은 오직 중복 판정에만 쓴다. */
export function keywordDedupeKey(tag: string): string {
  return tag
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export interface MergeKeywordsResult {
  /** 최종 태그. 🔴 기존이 «앞» 이다 — 셀러가 정한 순서를 AI 가 밀어내지 않는다. */
  merged: string[];
  /** 이번에 «새로» 더해진 것만. 화면이 「무엇이 추가됐는지」 말할 수 있게. */
  added: string[];
  /** 중복이라 버린 AI 후보. 🔴 조용히 사라지지 않게 돌려준다. */
  skipped: string[];
}

/**
 * 기존 태그 + 생성 태그 → 중복 제거된 하나.
 *
 * 🔴 **기존 태그는 한 개도 잃지 않는다.** 그것이 이 함수의 유일한 불변식이다.
 * 🔴 빈 문자열·공백만 있는 값은 태그가 아니다 — 양쪽 모두에서 버린다.
 * 🔴 반복 호출해도 늘어나지 않는다(멱등). 같은 입력을 두 번 합쳐도 결과가 같다.
 */
export function mergeKeywords(existing: string[], generated: string[]): MergeKeywordsResult {
  const merged: string[] = [];
  const seen = new Set<string>();

  for (const raw of existing) {
    const tag = raw.trim();
    if (!tag) continue;
    const key = keywordDedupeKey(tag);
    if (seen.has(key)) continue; // 기존 목록 «안» 의 중복도 걷어낸다.
    seen.add(key);
    merged.push(tag);
  }

  const added: string[] = [];
  const skipped: string[] = [];
  for (const raw of generated) {
    const tag = raw.trim();
    if (!tag) continue;
    const key = keywordDedupeKey(tag);
    if (seen.has(key)) {
      skipped.push(tag);
      continue;
    }
    seen.add(key);
    merged.push(tag);
    added.push(tag);
  }

  return { merged, added, skipped };
}
