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
    /**
     * ════════════════════════════════════════════════════════════════════════
     * P0-CHANNEL-03 F-12a 후속(2026-09-25) — **5초는 이 스위트의 현실이 아니다.**
     * ════════════════════════════════════════════════════════════════════════
     *
     * 289개 파일이 병렬로 도는데 그중 상당수가 화면을 통째로 렌더한다
     * (CommerceWorkspace · 설정 화면 등). 그 파일들이 기본값 5초의 «경계» 에
     * 걸쳐 있어서, 머신에 다른 프로세스가 하나만 떠 있어도 무더기로 타임아웃이
     * 난다 — 이 세션에서 실제로 37건까지 났고, 그 파일들을 단독으로 돌리면
     * 전부 통과했다.
     *
     * 🔴 «실패를 숨기는» 변경이 아니다. 단언은 한 글자도 바꾸지 않았고, 로직
     * 실패는 그대로 실패한다. 바꾸는 것은 「얼마나 기다려 줄 것인가」뿐이다.
     * 근거: --testTimeout=15000 으로 돌리면 3,886개가 전부 통과한다.
     *
     * 🔴 대가도 적는다 — 진짜로 멈춘 테스트가 드러나는 데 3배 걸린다. 그 값을
     * 치르는 이유는, 「빨간 스위트」가 일상이 되면 아무도 빨간색을 보지 않게
     * 되기 때문이다. 렌더 테스트가 가벼워지면 이 값을 도로 내린다.
     */
    testTimeout: 15_000,
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
      // COUPANG-REAL-OPTION-01(2026-09-22) — listing도 같은 처지였다. 실제 쿠팡
      // LIVE 등록이 이 패키지의 payload 빌더에서 죽었는데(attempt a7572b88 ·
      // API005), 여기 이미 있던 notice-regression.test.ts는 러너에 잡히지 않아
      // **한 번도 실행된 적이 없었다**. 등록 payload를 만드는 코드는 회귀가 곧
      // 실제 등록 실패라 반드시 여기서 잡는다.
      "../../packages/listing/src/**/__tests__/**/*.test.ts",
    ],
  },
});
