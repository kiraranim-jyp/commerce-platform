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
  outputFileTracingIncludes: {
    "/api/pipeline": [
      "../../node_modules/.pnpm/onnxruntime-node@*/node_modules/onnxruntime-node/bin/**/*",
      "../../node_modules/.pnpm/@imgly+background-removal-node@*/node_modules/@imgly/background-removal-node/dist/**/*",
      "../../node_modules/.pnpm/playwright-core@*/node_modules/playwright-core/**/*",
      "../../node_modules/.pnpm/@sparticuz+chromium@*/node_modules/@sparticuz/chromium/**/*",
    ],
  },
};

export default nextConfig;
