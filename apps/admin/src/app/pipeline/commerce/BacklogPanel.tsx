"use client";

/* LOTTEON COMMERCE SPRINT 3(CEO 확정, 2026-09-14) — "11번가 등록"을 이 목록에서
   뺐다. 상품등록 화면의 채널은 스마트스토어 · 쿠팡 · 롯데ON 셋이고, 11번가는
   화면에서 빠졌다(코드는 그대로 있다). 탭에서는 사라졌는데 Backlog에는 남아
   있으면 "곧 나온다"는 약속을 화면 아래에서 계속 하게 된다. */
const BACKLOG_ITEMS = [
  "스마트스토어 등록",
  "AI 상품 콘텐츠 생성",
  "AI 브랜드 추천 고도화",
  "쿠팡 카테고리 검색 고도화",
  "AI 누끼/이미지 개선 기능",
  "커머스별 이미지 정책 고도화",
];

/** 이번 스프린트에서 의도적으로 미룬 기능 목록 — 탭의 SOON 배지와 짝을 이룬다.
 * "아직 안 만든 게 아니라 다음에 만들기로 정한 것"이라는 걸 명시적으로 보여준다. */
export function BacklogPanel() {
  return (
    <section className="rounded-lg border border-dashed border-border p-4 text-sm">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">Backlog</h3>
      <ul className="mt-2 grid grid-cols-1 gap-1.5 text-xs text-text-secondary sm:grid-cols-2">
        {BACKLOG_ITEMS.map((label) => (
          <li key={label} className="flex items-center gap-1.5">
            <span className="text-text-tertiary">–</span>
            {label}
          </li>
        ))}
      </ul>
    </section>
  );
}
