/**
 * N-3.24(CPO 지시, 2026-08-13) — TTAEJYO 브랜드 리뉴얼의 Symbol Mark(제안 3안
 * "전용 심볼" 패널: 돋보기 + 체크, Deep Navy 배경/#0A1F44)를 코드로 재현한다.
 * 첨부 시안은 이미지 파일로 제공되지 않아 새로 디자인하지 않고 시안에 보이는
 * 도형(라운드 사각 배경 + 흰색 돋보기 + 초록 체크)을 그대로 SVG로 옮겼다 —
 * 파비콘(app/icon.svg)과 헤더/사이드바가 전부 이 컴포넌트 하나를 공유해
 * 심볼이 화면마다 따로 그려지는 것을 막는다.
 */
export function BrandMark({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <rect width="32" height="32" rx="8" fill="#0A1F44" />
      <circle cx="13.5" cy="13.5" r="6.5" stroke="white" strokeWidth="2.2" />
      <line x1="18.2" y1="18.2" x2="23" y2="23" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
      <path
        d="M10.5 13.7L12.6 15.9L17 10.8"
        stroke="#00E676"
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
