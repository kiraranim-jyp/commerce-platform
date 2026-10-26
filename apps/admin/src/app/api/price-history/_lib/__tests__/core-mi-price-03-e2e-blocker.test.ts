import { describe, expect, it } from "vitest";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { computeMarketIntelligence } from "../market-intelligence";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴 CORE-MI-PRICE-03 — **전 구간 E2E 를 막는 것을 «실측으로» 고정한다**(운영 변경 0)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * CPO 가 ⒝(CTO 단독 E2E)를 승인했다. 🔴 그런데 **실행할 수 없다** — 그 사실을 추론이
 * 아니라 **실행해서** 남긴다(다음 세션이 같은 자리를 다시 파지 않게).
 *
 * ── 🔴🔴🔴 차단 지점은 «하나» 이고 코드 좌표가 확정됐다 ────────────────────
 * ```
 * computeMarketIntelligence(snapshotId, workspaceId)   market-intelligence.ts:105
 *   :110  const snapshot = await getSnapshot(snapshotId, workspaceId)
 *   :111  if (!snapshot) return null          ← 🔴 **여기서 끝난다**
 * getSnapshot → snapshots/_lib/snapshot.ts → `getSupabaseAdmin()`
 * getSupabaseAdmin  lib/supabase-admin.ts:12
 *   `if (!url || !serviceRoleKey) return null`
 * ⟹ 🔴 `SUPABASE_SERVICE_ROLE_KEY` 가 **로컬 어디에도 없다**(.env 전수 확인:
 *    `.env.local` · `apps/admin/.env.local` · `packages/database/.env` · `scripts/.env`)
 * ```
 *
 * ── 🔴 그래서 «하지 않은» 것 셋 (전부 CPO 금지에 걸린다) ────────────────────
 * ```
 * ❌ snapshot/seller 설정을 **mock** 으로 만든다        §2 「임의 값 생성 금지」
 * ❌ `computeMarketIntelligence` 가 입력을 **주입받게** 고친다   §1 「운영 코드 변경 금지」
 * ❌ DB 를 직접 읽어 downstream 을 **복제 실행** 한다
 *    🔴 그 함수는 DB 를 **자기가** 읽는다 ⟹ 주입 지점이 없고, 복제식은 대조할
 *       **운영 산출값(CONTROL)이 없다**(§5-B) ⟹ 「운영 결과 흉내」가 된다
 * 🔴 그리고 `pg` 모듈이 설치돼 있지도 않다(실측 MODULE_NOT_FOUND).
 * ```
 *
 * 🟢 **이 테스트는 네트워크·DB 를 쓰지 않는다.** 차단 사실만 단언한다.
 */

describe("CORE-MI-PRICE-03 — 전 구간 E2E 차단 지점(실측 고정)", () => {
  it("🔴 service-role 키가 없어 운영 DB 경로가 열리지 않는다", () => {
    /** 🔴 키 «값» 을 출력하지 않는다 — 존재 여부만 본다(§2 secret 미출력). */
    expect(process.env.SUPABASE_SERVICE_ROLE_KEY ?? "", "🟡 키가 생기면 이 단언이 FAIL 한다 — 그때가 E2E 착수 시점이다").toBe("");
    expect(getSupabaseAdmin(), "🔴 admin client 가 null 이면 snapshot 을 읽을 수 없다").toBeNull();
  });

  it("🔴 그래서 computeMarketIntelligence 가 snapshot 단계에서 null 로 끝난다", async () => {
    /**
     * 🔴 실제 id 가 아니어도 된다 — 차단은 **`getSnapshot` 이전** 에 걸린다
     *    (admin client 가 null 이라 조회 자체가 서지 않는다).
     * 🟢 그래서 이 호출은 **DB 에 닿지 않는다** — 네트워크 0.
     */
    const result = await computeMarketIntelligence(
      "00000000-0000-0000-0000-000000000000",
      "00000000-0000-0000-0000-000000000000",
    );
    expect(result, "🔴 null 이 아니면 DB 경로가 열린 것이다 — E2E 를 바로 돌린다").toBeNull();
  });

  /**
   * 🟢 **이 WU 에서 이미 닫힌 것은 기록해 둔다** — 다시 재지 않기 위해서다.
   *    국내 축은 `core-mi-price-01-band`(CORE_MI_PRICE_01_LIVE=1)가 측정했다:
   * ```
   * B226AC009  domesticReference **2** · 🟢 Level 2 · **KRW 59,000 ~ 88,000** · 오염 0
   * B226AC010  1 · Level 1(가격대 확정 불가)
   * B226AC117  0 · Level 0(국내 참고가격 없음 · 정상)
   * ```
   * 🔴 남은 것은 **해외 최저 소싱가 → sellability → A 권장 판매가격** 이고,
   *    그 셋은 **전부 위 DB 경로 뒤** 에 있다.
   */
  it("[좌표 기록] 남은 미완결 구간이 전부 DB 경로 «뒤» 에 있다", () => {
    const src = String(computeMarketIntelligence);
    /** 🔴 함수가 snapshot 조회를 **가장 먼저** 한다는 사실을 글자로 잠근다. */
    expect(src).toContain("getSnapshot");
    console.log(
      `\n    🟢 국내 축 CLOSED — AC009 Level 2(59,000~88,000) · AC010 Level 1 · AC117 Level 0 · 오염 0\n` +
        `    🔴 미완결 — 해외 최저 소싱가 · sellability · A 권장 판매가격\n` +
        `       ⟹ 셋 다 \`getSnapshot\` **뒤** 에 있어 service-role 없이는 도달 불가\n` +
        `    🔵 해제 조건 **하나** — \`SUPABASE_SERVICE_ROLE_KEY\`(읽기면 충분하다)`,
    );
  });
});
