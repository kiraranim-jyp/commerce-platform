import type { HTMLAttributes } from "react";

/**
 * N-3.15 Phase 2(CPO 지시: "공통 Width System") — Landing/Form/Settings는
 * 960~1100px, Product Editor는 1200~1440px(권장 1360px)를 새 기준으로 삼는다.
 * `sm`/`editor`를 새 토큰으로 추가하되 기존 md/lg/xl/2xl은 그대로 둔다 — 이
 * 값을 쓰는 화면(Settings=lg, 상품 Editor=xl 등)을 실제로 새 토큰으로 옮기는
 * 작업은 Phase 3+(화면 개편)에서 하고, Phase 2는 "기존 기능을 바꾸지 않고
 * 기반만 만든다"는 원칙을 지킨다.
 */
const SIZE_CLASS = {
  sm: "max-w-[1000px]",
  md: "max-w-[1200px]",
  lg: "max-w-[1400px]",
  editor: "max-w-[1360px]",
  xl: "max-w-[1800px]",
  "2xl": "max-w-[1920px]",
} as const;

export interface PageContainerProps extends HTMLAttributes<HTMLDivElement> {
  size?: keyof typeof SIZE_CLASS;
}

export function PageContainer({ size = "xl", className, ...props }: PageContainerProps) {
  return (
    <div
      className={["mx-auto w-full px-8 py-6", SIZE_CLASS[size], className]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
}
