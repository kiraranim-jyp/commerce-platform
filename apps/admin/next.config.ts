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
      "../../node_modules/.pnpm/onnxruntime-node@*/node_modules/onnxruntime-node/dist/**/*",
      // package.json이 없으면 require("onnxruntime-node")가 bare specifier로 NODE_PATH를
      // 통해 찾아갈 때 "main"/"exports"를 읽을 수 없어 실패한다 — bin/dist만으로는 부족했다.
      "../../node_modules/.pnpm/onnxruntime-node@*/node_modules/onnxruntime-node/package.json",
      // onnxruntime-node 자신도 onnxruntime-common에 의존한다(자기 격리 node_modules 안의
      // 형제 심링크로 풀린다 — @imgly의 lodash/ndarray/zod와 같은 패턴).
      "../../node_modules/.pnpm/onnxruntime-node@*/node_modules/onnxruntime-common/**/*",
      "../../node_modules/.pnpm/onnxruntime-common@*/node_modules/onnxruntime-common/**/*",
      "../../node_modules/.pnpm/@imgly+background-removal-node@*/node_modules/@imgly/background-removal-node/dist/**/*",
      // @imgly 자신의 pnpm 격리 node_modules 안에 있는 순수 JS 하위 의존성들의 심링크.
      // node_modules/**처럼 재귀 와일드카드로 통째로 담으면 그 안의 onnxruntime-node 심링크를
      // 타고 133MB짜리 .so 바이너리 전체가 (위에서 이미 담은 것과) 중복으로 다시 잡혀 배포
      // 용량 한도를 넘긴다(outputFileTracingExcludes로는 안 빠짐 — includes로 명시된 파일에는
      // 적용되지 않는 것으로 보인다). onnxruntime-node/sharp는 제외하고 작은 순수 JS 패키지만
      // 이름으로 하나씩 나열한다. ndarray는 자체적으로 iota-array/is-buffer에 의존한다.
      // Vercel의 출력 트레이싱은 심링크를 그대로 두지 않고 해당 상대 경로에 실제
      // 파일로 "평탄화"해서 복사한다. 그래서 @imgly의 require("iota-array")는(ndarray를
      // 거쳐 왔더라도) pnpm 저장소 상의 원래 위치가 아니라, @imgly 자신의 node_modules
      // 바로 밑(형제 디렉터리)에서 풀린다 — lodash/ndarray/zod와 같은 레벨이다.
      "../../node_modules/.pnpm/@imgly+background-removal-node@*/node_modules/lodash/**/*",
      "../../node_modules/.pnpm/@imgly+background-removal-node@*/node_modules/ndarray/**/*",
      "../../node_modules/.pnpm/@imgly+background-removal-node@*/node_modules/iota-array/**/*",
      "../../node_modules/.pnpm/@imgly+background-removal-node@*/node_modules/is-buffer/**/*",
      "../../node_modules/.pnpm/@imgly+background-removal-node@*/node_modules/zod/**/*",
      "../../node_modules/.pnpm/lodash@*/node_modules/lodash/**/*",
      "../../node_modules/.pnpm/ndarray@*/node_modules/ndarray/**/*",
      "../../node_modules/.pnpm/iota-array@*/node_modules/iota-array/**/*",
      "../../node_modules/.pnpm/is-buffer@*/node_modules/is-buffer/**/*",
      "../../node_modules/.pnpm/zod@*/node_modules/zod/**/*",
      "../../node_modules/.pnpm/sharp@*/node_modules/sharp/**/*",
      "../../node_modules/.pnpm/playwright-core@*/node_modules/playwright-core/**/*",
      "../../node_modules/.pnpm/@sparticuz+chromium@*/node_modules/@sparticuz/chromium/**/*",
    ],
  },
};

export default nextConfig;
