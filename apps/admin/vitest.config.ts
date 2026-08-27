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
    include: ["src/**/__tests__/**/*.test.ts"],
  },
});
