import path from "path";
import type { NextConfig } from "next";

const monorepoRoot = path.join(__dirname, "..", "..");

const nextConfig: NextConfig = {
  turbopack: {
    root: monorepoRoot,
  },
  // 네이티브 바이너리/런타임 리소스를 파일시스템에서 직접 읽는 패키지들은
  // 번들링하면 경로가 깨지므로(webpack/turbopack 가상 경로) 번들 대상에서 제외한다.
  serverExternalPackages: [
    "@imgly/background-removal-node",
    "onnxruntime-node",
    "sharp",
    "playwright-core",
    "@sparticuz/chromium",
  ],
  outputFileTracingRoot: monorepoRoot,
  // onnxruntime-node의 .so 바이너리 등은 정적 require로 잡히지 않아
  // 서버리스 함수 번들에서 자동으로 누락된다. 명시적으로 포함시킨다.
  //
  // 배경제거는 자식 프로세스(`node -e`)에서 @imgly를 require()하는데, 이 require는
  // 런타임 문자열 안에 있어서 Next.js의 빌드 타임 트레이싱(NFT)에 전혀 보이지 않는다.
  // 그래서 @imgly 자신이 필요로 하는 하위 의존성(lodash/ndarray/zod)까지도 여기서
  // 전부 명시적으로 포함시켜야 한다 — 안 그러면 "Cannot find module 'lodash'"처럼
  // 자식 프로세스에서만 나는 모듈 누락 에러가 배포 후에야 드러난다.
  outputFileTracingIncludes: {
    "/api/pipeline": [
      "../../node_modules/.pnpm/onnxruntime-node@*/node_modules/onnxruntime-node/bin/**/*",
      // dist뿐 아니라 @imgly 자신의 pnpm 격리 node_modules 전체(하위 의존성 심링크 포함)를 담는다.
      "../../node_modules/.pnpm/@imgly+background-removal-node@*/node_modules/**/*",
      "../../node_modules/.pnpm/lodash@*/node_modules/lodash/**/*",
      "../../node_modules/.pnpm/ndarray@*/node_modules/ndarray/**/*",
      "../../node_modules/.pnpm/zod@*/node_modules/zod/**/*",
      "../../node_modules/.pnpm/sharp@*/node_modules/sharp/**/*",
      "../../node_modules/.pnpm/playwright-core@*/node_modules/playwright-core/**/*",
      "../../node_modules/.pnpm/@sparticuz+chromium@*/node_modules/@sparticuz/chromium/**/*",
    ],
  },
};

export default nextConfig;
