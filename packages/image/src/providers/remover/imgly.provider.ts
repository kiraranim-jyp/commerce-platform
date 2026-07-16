import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { removeBackground } from "@imgly/background-removal-node";
import type { BackgroundRemoverProvider } from "../../types/provider.types";

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

/**
 * 무료/로컬 배경제거 Provider. ONNX 모델을 로컬에서 실행하므로 API 비용이 없다.
 * 사용량이 늘어나면 remove.bg / PhotoRoom 등 유료 API Provider로 교체할 수 있다.
 */
export class ImglyRemoverProvider implements BackgroundRemoverProvider {
  async remove(inputPath: string, outputPath: string): Promise<void> {
    const blob = await removeBackground(inputPath, {
      output: { format: "image/png" },
      publicPath: PUBLIC_PATH,
    });
    const buffer = Buffer.from(await blob.arrayBuffer());
    fs.writeFileSync(outputPath, buffer);
  }
}
