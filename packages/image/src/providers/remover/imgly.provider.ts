import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import type { BackgroundRemoverProvider } from "../../types/provider.types";

const execFileAsync = promisify(execFile);

// @imgly는 리소스 경로를 기본적으로 process.cwd() 기준 상대경로로 계산한다.
// require.resolve()는 Next.js(Turbopack/webpack) 번들링 하에서 실제 파일시스템
// 경로 대신 가상 모듈 경로를 반환하므로 쓸 수 없다. 대신 몇 가지 후보 위치(cwd,
// 실행 스크립트 위치)와 그 상위 디렉터리에서 실제 node_modules/@imgly를 직접 찾는다.
// 어디서도 못 찾으면 publicPath를 지정하지 않고 라이브러리의 기본 동작에 맡긴다
// (서버리스 런타임처럼 cwd 자체가 정확히 들어맞는 환경에서는 기본값으로도 동작한다).
function hasResources(distDir: string): boolean {
  return fs.existsSync(path.join(distDir, "resources.json"));
}

/** Next.js가 만드는 "flattened" node_modules/@imgly 사본에는 실행에 필요한
 * 리소스 파일이 빠져 있을 수 있다. pnpm의 .pnpm 저장소 쪽 원본 사본도 함께 찾는다. */
function findInPnpmStore(nodeModulesDir: string): string | undefined {
  const pnpmDir = path.join(nodeModulesDir, ".pnpm");
  if (!fs.existsSync(pnpmDir)) return undefined;

  const match = fs
    .readdirSync(pnpmDir)
    .find((name) => name.startsWith("@imgly+background-removal-node@"));
  if (!match) return undefined;

  const candidate = path.join(
    pnpmDir,
    match,
    "node_modules",
    "@imgly",
    "background-removal-node",
    "dist",
  );
  return hasResources(candidate) ? candidate : undefined;
}

function findImglyDistDir(): string | undefined {
  const roots = [process.cwd(), process.argv[1] ? path.dirname(process.argv[1]) : undefined].filter(
    (value): value is string => Boolean(value),
  );

  for (const root of roots) {
    let dir = root;
    for (let i = 0; i < 6; i++) {
      const nodeModulesDir = path.join(dir, "node_modules");

      const direct = path.join(nodeModulesDir, "@imgly", "background-removal-node", "dist");
      if (hasResources(direct)) return direct + path.sep;

      const viaPnpmStore = findInPnpmStore(nodeModulesDir);
      if (viaPnpmStore) return viaPnpmStore + path.sep;

      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  return undefined;
}

const imglyDistDir = findImglyDistDir();
const PUBLIC_PATH = imglyDistDir ? pathToFileURL(imglyDistDir).href : undefined;
const IMGLY_CJS_ENTRY = imglyDistDir
  ? path.join(imglyDistDir, "index.cjs")
  : "@imgly/background-removal-node";

/**
 * @imgly는 자기 pnpm 격리 node_modules 안에 onnxruntime-node/sharp의 심링크(직접
 * 의존성)를 갖고 있지만, 그 실제 대상은 133MB짜리 onnxruntime-node .so 바이너리처럼
 * 커서 bundle-imgly-deps.cjs로도 복사해 넣지 않았다(이미 별도 outputFileTracingIncludes
 * 글롭으로 최상위 pnpm 저장소 경로에 포함되어 있으므로, 거기에 또 복사하면 중복으로
 * 배포 용량 한도를 넘긴다). 대신 Node의 NODE_PATH(레거시 폴백 검색 경로)를 이용해서
 * 자식 프로세스가 "onnxruntime-node"/"sharp"를 bare specifier로 require할 때, 정상
 * node_modules 탐색이 실패하면 여기 지정한 디렉터리도 추가로 뒤지도록 한다 — 이미
 * 존재하는 최상위 사본을 가리키기만 하면 되므로 파일을 하나도 새로 옮기지 않는다.
 *
 * process.cwd()에서부터 다시 걸어 올라가는 방식은 Vercel 배포 환경에서 실패했다
 * (cwd가 로컬과 다른 위치인 것으로 보인다). 대신 이미 정확하게 resolve된 것으로
 * 확인된 imglyDistDir 자체의 경로에서 ".pnpm" 세그먼트를 찾아 pnpm 저장소 루트를
 * 역산한다 — @imgly가 성공적으로 로드되고 있다는 사실 자체가 이 경로의 정확성을
 * 보장해준다.
 */
function findPnpmStoreRootFromImglyDistDir(): string | undefined {
  if (!imglyDistDir) return undefined;
  const segments = imglyDistDir.split(path.sep);
  const pnpmIndex = segments.lastIndexOf(".pnpm");
  if (pnpmIndex === -1) return undefined;
  return segments.slice(0, pnpmIndex + 1).join(path.sep);
}

function findPackageNodeModulesDirInPnpmStore(
  pnpmStoreRoot: string,
  pkgName: string,
): string | undefined {
  if (!fs.existsSync(pnpmStoreRoot)) return undefined;
  const escaped = pkgName.replace("/", "+");
  const match = fs.readdirSync(pnpmStoreRoot).find((name) => name.startsWith(`${escaped}@`));
  if (!match) return undefined;
  const candidateNodeModules = path.join(pnpmStoreRoot, match, "node_modules");
  return fs.existsSync(path.join(candidateNodeModules, pkgName)) ? candidateNodeModules : undefined;
}

const pnpmStoreRoot = findPnpmStoreRootFromImglyDistDir();
const EXTRA_NODE_PATH = pnpmStoreRoot
  ? [
      findPackageNodeModulesDirInPnpmStore(pnpmStoreRoot, "onnxruntime-node"),
      findPackageNodeModulesDirInPnpmStore(pnpmStoreRoot, "sharp"),
    ]
      .filter((value): value is string => Boolean(value))
      .join(path.delimiter)
  : "";
console.log(
  `[imgly-provider] imglyDistDir=${imglyDistDir ?? "(none)"} pnpmStoreRoot=${pnpmStoreRoot ?? "(none)"} EXTRA_NODE_PATH=${EXTRA_NODE_PATH || "(empty)"}`,
);

/**
 * @imgly의 removeBackground()는 onnxruntime 세션을 config 기준으로 memoize해서
 * 재사용한다(같은 config로 두 번째 이미지를 처리해도 세션은 새로 안 만들고 재사용).
 * 그런데 이 "재사용된 세션으로 두 번째 추론을 실행"하는 시점에 Vercel 서버리스
 * 환경에서만 프로세스가 JS로 catch 불가능하게 죽는 현상이 있었다(로컬 Windows에서는
 * 재현 안 됨). onnxruntime-node의 네이티브 addon에 정확히 어떤 상태가 재사용 시
 * 깨지는지 라이브러리 밖에서는 알 수도 고칠 수도 없으므로, 이미지 한 장의 배경제거를
 * 완전히 독립된 자식 프로세스에서 실행해 워커가 죽어도 부모(요청을 처리 중인 함수)는
 * 영향받지 않고, 매 이미지마다 깨끗한 네이티브 힙에서 시작하도록 한다.
 *
 * 워커는 별도 파일로 컴파일해서 배포할 필요 없이 `node -e`로 인라인 실행한다 —
 * Next.js가 packages/image의 다른 .ts 파일들을 트레이싱/번들링하지 않아도 되고,
 * @imgly의 실제 CJS 진입 파일(findImglyDistDir로 찾은 경로)을 그대로 require한다.
 */
const WORKER_SCRIPT = `
const fs = require("fs");
(async () => {
  const [imglyCjsPath, inputPath, outputPath, publicPath, model] = process.argv.slice(1);
  const { removeBackground } = require(imglyCjsPath);
  const blob = await removeBackground(inputPath, {
    output: { format: "image/png" },
    publicPath: publicPath || undefined,
    model: model || "small",
  });
  const buffer = Buffer.from(await blob.arrayBuffer());
  fs.writeFileSync(outputPath, buffer);
})().catch((err) => {
  console.error(err && err.stack ? err.stack : String(err));
  process.exit(1);
});
`;

/**
 * 무료/로컬 배경제거 Provider. ONNX 모델을 로컬에서 실행하므로 API 비용이 없다.
 * 사용량이 늘어나면 remove.bg / PhotoRoom 등 유료 API Provider로 교체할 수 있다.
 */
export class ImglyRemoverProvider implements BackgroundRemoverProvider {
  async remove(inputPath: string, outputPath: string): Promise<void> {
    const model = process.env.IMGLY_MODEL ?? "small";
    try {
      await execFileAsync(
        process.execPath,
        [
          "-e",
          WORKER_SCRIPT,
          "--",
          IMGLY_CJS_ENTRY,
          inputPath,
          outputPath,
          PUBLIC_PATH ?? "",
          model,
        ],
        {
          maxBuffer: 1024 * 1024 * 16,
          timeout: 120_000,
          env: {
            ...process.env,
            NODE_PATH: [EXTRA_NODE_PATH, process.env.NODE_PATH].filter(Boolean).join(path.delimiter),
          },
        },
      );
    } catch (err) {
      const stderr = (err as { stderr?: string; message?: string }).stderr;
      throw new Error(`배경제거 하위 프로세스 실패: ${stderr || String(err)}`);
    }
  }
}
