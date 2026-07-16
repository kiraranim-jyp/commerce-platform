import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { removeBackground } from "@imgly/background-removal-node";
import type { BackgroundRemoverProvider } from "../../types/provider.types";

// @imgly는 리소스 경로를 기본적으로 process.cwd() 기준 상대경로로 계산하므로,
// 이 패키지가 아닌 다른 위치(예: scripts/)에서 실행하면 리소스를 못 찾는다.
// require.resolve로 실제 설치 위치를 찾아 publicPath를 절대경로로 고정한다.
const require = createRequire(import.meta.url);
const imglyDistDir = path.dirname(require.resolve("@imgly/background-removal-node")) + "/";
const PUBLIC_PATH = `file://${imglyDistDir.replace(/\\/g, "/")}`;

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
