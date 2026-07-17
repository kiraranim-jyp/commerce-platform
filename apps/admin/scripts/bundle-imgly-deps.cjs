#!/usr/bin/env node
/**
 * 배경제거는 자식 프로세스(`node -e`)에서 @imgly/background-removal-node를
 * require()하는데, 이 require는 런타임 문자열 안에 있어서 Next.js의 빌드 타임
 * 파일 트레이싱(NFT)에 전혀 보이지 않는다. 그래서 @imgly가 필요로 하는 순수 JS
 * 하위 의존성들(lodash, ndarray, ndarray의 하위 의존성인 iota-array/is-buffer,
 * zod, onnxruntime-node의 하위 의존성인 onnxruntime-common 등)을 outputFileTracingIncludes
 * 글롭으로 하나씩 담아봤지만, 애초에 @imgly 자신의 pnpm 격리 node_modules 안에는
 * "직접" 의존하는 패키지의 심링크만 있고 간접 의존(예: iota-array)은 아예 존재하지
 * 않아서 글롭이 매칭할 대상 자체가 없었다.
 *
 * 그래서 `next build`가 실행되기 전에, @imgly 자신의 pnpm 격리 node_modules 폴더
 * 안에 필요한 모든 순수 JS 의존성(간접 의존 포함)을 실제 디렉터리로 복사해 넣는다.
 * 이렇게 하면 기존 outputFileTracingIncludes 글롭("@imgly.../node_modules/<이름>/**")이
 * 실제로 매칭할 파일을 갖게 되고, 그 이후 흐름은 이미 검증된 방식 그대로 동작한다.
 *
 * onnxruntime-node와 sharp는 일부러 건드리지 않는다 — 둘 다 자체 네이티브 바이너리가
 * 커서(onnxruntime-node는 133MB) 여기에 다시 복사하면 이미 별도 글롭으로 포함시킨
 * 최상위 pnpm 저장소 사본과 중복되어 배포 용량 한도를 넘긴다. 두 패키지는 원래
 * 방식(정적 import로 트레이싱됨) 그대로 최상위 경로에서 resolve되길 기대한다.
 */
const fs = require("fs");
const path = require("path");

const SKIP_PACKAGES = new Set(["@imgly", "@types", "onnxruntime-node", "sharp"]);

function hasResources(distDir) {
  return fs.existsSync(path.join(distDir, "resources.json"));
}

function findInPnpmStore(nodeModulesDir) {
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

/**
 * imgly.provider.ts의 findImglyDistDir()는 flattened 사본에 resources.json이
 * 있으면 그걸 우선한다(로컬 Windows에서는 실제로 그렇다). 하지만 outputFileTracingIncludes
 * 글롭은 처음부터 pnpm 저장소 경로(.pnpm 밑의 @imgly+background-removal-node 폴더)만
 * 지정했고, Vercel 배포에서 실제로 크래시 로그에 찍힌 require 스택도 이 pnpm 저장소
 * 경로였다(flattened 사본은 배포에서 resources.json이 없거나 아예 존재하지 않는 것으로
 * 보인다). 그래서 이 스크립트는 로컬 조건에 흔들리지 않도록 pnpm 저장소 경로를 고정으로
 * 찾는다.
 */
function findImglyDistDir() {
  const roots = [process.cwd(), __dirname].filter(Boolean);
  for (const root of roots) {
    let dir = root;
    for (let i = 0; i < 8; i++) {
      const nodeModulesDir = path.join(dir, "node_modules");
      const viaPnpmStore = findInPnpmStore(nodeModulesDir);
      if (viaPnpmStore) return viaPnpmStore;
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  return undefined;
}

function findNodeModulesDir(pkgRealDir) {
  let dir = pkgRealDir;
  while (path.basename(dir) !== "node_modules") {
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
  return dir;
}

function resolveDepDir(fromNodeModulesDir, depName) {
  const candidate = path.join(fromNodeModulesDir, ...depName.split("/"));
  if (fs.existsSync(candidate)) return fs.realpathSync(candidate);
  return null;
}

/** depName을 @imgly 자신의 격리 node_modules 밑에 실제 디렉터리로 복사해 넣고,
 * 그 패키지의 의존성도 재귀적으로 같은 자리에 형제 디렉터리로 채운다. */
function vendorInto(imglyNodeModulesDir, depName, depRealDir, visited) {
  if (visited.has(depName)) return;
  visited.add(depName);

  const destDir = path.join(imglyNodeModulesDir, ...depName.split("/"));
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(path.dirname(destDir), { recursive: true });
    fs.cpSync(depRealDir, destDir, { recursive: true, dereference: true });
  }

  const pkgJsonPath = path.join(depRealDir, "package.json");
  if (!fs.existsSync(pkgJsonPath)) return;
  const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
  const deps = Object.assign({}, pkgJson.dependencies || {});
  const fromNodeModulesDir = findNodeModulesDir(depRealDir);
  if (!fromNodeModulesDir) return;

  for (const nextDepName of Object.keys(deps)) {
    if (SKIP_PACKAGES.has(nextDepName.split("/")[0])) continue;
    const nextDepRealDir = resolveDepDir(fromNodeModulesDir, nextDepName);
    if (nextDepRealDir) vendorInto(imglyNodeModulesDir, nextDepName, nextDepRealDir, visited);
  }
}

function main() {
  const imglyDistDir = findImglyDistDir();
  if (!imglyDistDir) {
    console.warn("[bundle-imgly-deps] @imgly/background-removal-node를 찾지 못해 건너뜁니다.");
    return;
  }
  const imglyPkgDir = path.dirname(imglyDistDir);
  const imglyNodeModulesDir = findNodeModulesDir(imglyPkgDir);
  if (!imglyNodeModulesDir) {
    console.warn("[bundle-imgly-deps] @imgly의 node_modules 위치를 찾지 못해 건너뜁니다.");
    return;
  }

  const pkgJsonPath = path.join(imglyPkgDir, "package.json");
  const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
  const deps = Object.assign({}, pkgJson.dependencies || {});
  const visited = new Set();

  for (const depName of Object.keys(deps)) {
    if (SKIP_PACKAGES.has(depName.split("/")[0])) continue;
    const depRealDir = resolveDepDir(imglyNodeModulesDir, depName);
    if (!depRealDir) {
      console.warn(`[bundle-imgly-deps] ${depName}을(를) @imgly 옆에서 찾지 못했습니다.`);
      continue;
    }
    vendorInto(imglyNodeModulesDir, depName, depRealDir, visited);
  }

  console.log(
    `[bundle-imgly-deps] 완료: ${[...visited].join(", ")} 을(를) ${imglyNodeModulesDir}에 채워넣음`,
  );
}

main();
