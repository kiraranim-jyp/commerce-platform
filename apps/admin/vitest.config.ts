import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // N-4.18-Q3 PART H-3-6 — tsconfig.json의 "@/*" -> "./src/*" 경로 별칭을
    // vitest에도 그대로 반영한다(그전까지는 이 별칭을 쓰는 모듈을 import하는
    // 테스트가 전부 "Failed to load url @/..." 로 실패했다). 별칭 매핑 자체를
    // tsconfig와 동일하게 옮기는 것뿐이라 테스트 대상 코드/로직에는 영향 없음.
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    // SITE-EXTENSION-IMPLEMENTATION-1(2026-09-08) — packages/crawler에는 테스트
    // 러너가 없다(커스텀 node 스크립트만 있다). 사이트 전략처럼 순수 함수로
    // 검증 가능한 코드는 이 프로젝트의 유일한 vitest에서 함께 돌린다 — 러너를
    // 하나 더 만들면 "어디서 도는 테스트인지" 갈라져 빠뜨리기 쉽다.
    include: [
      "src/**/__tests__/**/*.test.ts",
      "../../packages/crawler/src/**/__tests__/**/*.test.ts",
      "../../packages/pricing/src/**/__tests__/**/*.test.ts",
      // MI-DOMESTIC-FIX-1(2026-09-09) — shared는 그동안 한 번도 실행되지 않고
      // 있었다. 검색어 생성 정책이 여기 살기 때문에 회귀를 여기서 잡아야 한다.
      "../../packages/shared/src/**/__tests__/**/*.test.ts",
      // TTAEJYO 2.0(2026-09-12) — category도 crawler와 같은 처지다(테스트 러너
      // 없음). 카테고리 프로필은 "아동 동작이 한 점도 안 바뀐다"를 증명해야 하는
      // 코드라 회귀를 반드시 여기서 잡는다.
      "../../packages/category/src/**/__tests__/**/*.test.ts",
    ],
  },
});
