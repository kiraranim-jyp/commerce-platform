import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { removeBackground } from "@imgly/background-removal-node";
import type { BackgroundRemoverProvider } from "../../types/provider.types";

interface OnnxSession {
  release: () => Promise<void>;
}
interface OnnxInferenceSessionClass {
  create: (...args: unknown[]) => Promise<OnnxSession>;
  __patchedToReleasePrevious?: boolean;
}

/**
 * @imgly는 remove() 호출마다 새 onnxruntime InferenceSession을 만들지만
 * 이전 세션을 명시적으로 release()하지 않는다. onnxruntime-node의 세션은
 * V8 GC가 회수하지 않는 네이티브(WASM 밖) 메모리를 붙잡고 있어서, 같은
 * 프로세스(서버리스 warm invocation)에서 이미지 2장째부터 네이티브 메모리가
 * 누적되어 OOM으로 프로세스가 죽는다(JS에서 catch 불가능한 크래시로 관측됨).
 *
 * onnxruntime-node는 onnxruntime-common의 InferenceSession 클래스 객체를
 * 그대로 재노출(live re-export)하므로, 우리가 import한 것과 @imgly 내부가
 * require("onnxruntime-node")로 가져온 것은 동일한 클래스 객체를 참조한다.
 * 따라서 여기서 static create()를 한 번만 감싸서 "새 세션을 만들기 전에
 * 직전 세션을 release()"하도록 패치하면 @imgly의 호출에도 그대로 적용된다.
 * (호출 시점에 patch가 되어 있으면 되므로, 최초 remove() 호출 직전에 지연 적용한다.)
 */
let patchPromise: Promise<void> | undefined;
function ensureInferenceSessionPatched(): Promise<void> {
  if (!patchPromise) {
    patchPromise = (async () => {
      // onnxruntime-node는 이 pnpm 레이아웃에서 .d.ts가 실제로 배포되지 않아
      // (package.json은 dist/index.d.ts를 가리키지만 파일 자체가 없다) 타입 없이 값만 가져온다.
      const mod = (await import("onnxruntime-node")) as unknown as {
        InferenceSession: OnnxInferenceSessionClass;
      };
      const SessionClass = mod.InferenceSession;
      if (SessionClass.__patchedToReleasePrevious) return;

      let activeSession: OnnxSession | undefined;
      const originalCreate = SessionClass.create.bind(SessionClass);
      SessionClass.create = async (...args: unknown[]) => {
        if (activeSession) {
          try {
            await activeSession.release();
          } catch {
            // 이미 해제되었거나 해제 불가한 상태 — 무시하고 새 세션 생성을 계속한다.
          }
          activeSession = undefined;
        }
        const session = await originalCreate(...args);
        activeSession = session;
        return session;
      };
      SessionClass.__patchedToReleasePrevious = true;
    })();
  }
  return patchPromise;
}

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
    await ensureInferenceSessionPatched();
    const blob = await removeBackground(inputPath, {
      output: { format: "image/png" },
      publicPath: PUBLIC_PATH,
      // 서버리스 함수의 메모리 제약 때문에 기본(medium) 모델보다 가벼운 모델을 쓴다.
      model: (process.env.IMGLY_MODEL as "small" | "medium" | "large" | undefined) ?? "small",
    });
    const buffer = Buffer.from(await blob.arrayBuffer());
    fs.writeFileSync(outputPath, buffer);
  }
}
