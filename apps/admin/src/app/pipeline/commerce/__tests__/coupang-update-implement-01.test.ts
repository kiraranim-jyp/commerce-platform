import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { editAdapterFor, editUnavailableNote } from "../edit-adapters";
import {
  CHANNEL_CAPABILITY,
  resolveLifecycle,
  resolveSavedScopedUpdate,
  type ChangeSet,
} from "../channel-lifecycle";
import { channelEditScope, fieldCapability } from "../channel-field-capability";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * COUPANG-UPDATE-IMPLEMENT-01 — **확인한 만큼만 말하는가**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 형제 파일(`packages/listing/.../coupang-update-baseline.test.ts`)이 overlay 와
 * 손실 가드를 잰다. 이 파일이 재는 것은 **경계** 다 —
 *
 *   🔴 「쿠팡 상품 수정 지원」이라고 말하지 «않는가».
 *   🔴 승인된 상품을 임시저장 규칙으로 다루지 «않는가».
 *   🔴 Master 재생성 경로가 «열려 있지 않은가».
 */

const DIR = join(__dirname, "..");
const codeOf = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const read = (...p: string[]) => readFileSync(join(DIR, ...p), "utf8").replace(/\r\n/g, "\n");

const change = (over: Partial<ChangeSet> = {}): ChangeSet => ({
  fields: ["name"],
  category: false,
  categoryUnknown: false,
  comparedEverything: true,
  ...over,
});


/* ════════════════════════════════════════════════════════════════════════════
   🔴 ① capability — 「지원됨」이라고 말하지 않는다
   ════════════════════════════════════════════════════════════════════════════ */
describe("🔴 ① capability 는 «조건부» 다", () => {
  /**
   * 🔴 값은 «아직» 올리지 않았다 — 올리면 화면이 고칠 수 있다고 말하는데
   * 배선이 없어 누를 곳이 없다. 대신 «올릴 값이 무엇인지» 를 여기서 고정한다:
   * 조건부이지 SUPPORTED 가 아니다.
   */
  it("🔴 아직 UNKNOWN 이다 — capability·어댑터·배선은 같은 커밋에서 오른다", () => {
    expect(CHANNEL_CAPABILITY.coupang.update).toBe("UNKNOWN");
  });

  it("🔴 올릴 값은 SUPPORTED 가 «아니라» 조건부다 — lifecycle 이 그것을 다룰 수 있다", () => {
    const saved = resolveLifecycle("coupang", true, change());
    const approved = resolveLifecycle("coupang", true, change());
    /* 지금은 둘 다 UNKNOWN 분기라 BLOCKED 다. 조건부 분기 자체의 동작은 아래
       ②에서 SUPPORTED_WHEN_SAVED 채널을 «직접» 만들어 잰다. */
    expect(saved.operation).toBe("BLOCKED");
    expect(approved.operation).toBe("BLOCKED");
  });

  it("🔴 카테고리 변경은 그대로 NOT_SUPPORTED — 이번 작업이 건드리지 않았다", () => {
    expect(CHANNEL_CAPABILITY.coupang.categoryUpdate).toBe("NOT_SUPPORTED");
    expect(fieldCapability("coupang", "category")).toBe("RECREATE_ONLY");
  });

  it("🔴 다른 채널의 capability 를 건드리지 않았다", () => {
    expect(CHANNEL_CAPABILITY.smartstore.update).toBe("SUPPORTED");
    expect(CHANNEL_CAPABILITY.lotteon.update).toBe("UNKNOWN");
    expect(CHANNEL_CAPABILITY.elevenst.update).toBe("UNKNOWN");
  });

  it("🔴 화면은 아직 「확인되지 않았다」고 말한다 — 배선 전에 ○ 로 바꾸지 않는다", () => {
    expect(fieldCapability("coupang", "name")).toBe("UNKNOWN");
    expect(channelEditScope("coupang").unknown).toContain("salePrice");
  });
});

/* ════════════════════════════════════════════════════════════════════════════
   🔴 ② 상태 게이트 — lifecycle 이 승인 상품을 막는다 (CPO Phase 4 표)
   ════════════════════════════════════════════════════════════════════════════ */
describe("🔴 ② 조건부 분기 — 확인한 범위 밖으로 나가지 않는다 (CPO Phase 4 표)", () => {
  it("SAVED → UPDATE", () => {
    expect(resolveSavedScopedUpdate(change(), "SAVED")).toMatchObject({ operation: "UPDATE" });
  });

  it.each([["승인완료", "APPROVED"], ["판매중", "ON_SALE"], ["심사중", "IN_REVIEW"]])(
    "%s → BLOCKED — 승인 후 규칙은 재 본 적이 없다",
    (_l, status) => {
      const d = resolveSavedScopedUpdate(change(), status);
      expect(d.operation).toBe("BLOCKED");
      expect(d.needsAttention).toBe(true);
    },
  );

  it.each([["상태 미전달", undefined], ["상태 null", null], ["상태 공백", "  "]])(
    "%s → BLOCKED — 모르면 막는다",
    (_l, status) => {
      expect(resolveSavedScopedUpdate(change(), status).operation).toBe("BLOCKED");
    },
  );

  it("🔴 셀러에게 내부 상태코드를 보이지 않는다", () => {
    const d = resolveSavedScopedUpdate(change(), "APPROVED");
    expect(d.reason).not.toContain("APPROVED");
    expect(d.reason).not.toContain("SAVED");
  });

  it("🔴 「안 된다」가 아니라 「확인되지 않았다」로 말한다", () => {
    expect(resolveSavedScopedUpdate(change(), "APPROVED").reason).toContain("확인되지 않았");
  });

  it("🔴 지금은 쿠팡이 이 분기를 «고르지 않는다» — capability 가 아직 UNKNOWN 이다", () => {
    expect(resolveLifecycle("coupang", true, change()).operation).toBe("BLOCKED");
  });

  it("🔴 카테고리 변경은 상태와 무관하게 RECREATE — 기존 판단 그대로", () => {
    expect(resolveLifecycle("coupang", true, change({ category: true }))).toMatchObject({
      operation: "RECREATE",
    });
  });

  it("🔴 SmartStore 는 상태 인자 없이도 전과 똑같이 동작한다", () => {
    expect(resolveLifecycle("smartstore", true, change()).operation).toBe("UPDATE");
  });
});

/* ════════════════════════════════════════════════════════════════════════════
   🔴 ④ Master 재생성 경로가 열려 있지 않은가 (CPO 최우선 금지)
   ════════════════════════════════════════════════════════════════════════════ */
describe("🔴 ④ Master → payload 재생성 → PUT 의 길이 «없다»", () => {
  const UPDATER = read("..", "..", "api", "coupang", "_lib", "update-product.ts");

  it("수정 실행부가 빌더를 부르지 않는다", () => {
    const code = codeOf(UPDATER);
    expect(code).not.toContain("buildCoupangPayload");
    expect(code).not.toContain("toListingModel");
    expect(code).not.toContain("CanonicalProduct");
  });

  it("보낼 전문은 baseline 에서만 나온다", () => {
    const code = codeOf(UPDATER);
    expect(code).toContain("const outgoing = applyCoupangEdits(baseline, edits);");
    expect(code).toContain("body: outgoing");
  });

  it("🔴 순서가 지켜진다 — GET → 상태 → overlay → 손실검사 → PUT", () => {
    const code = codeOf(UPDATER);
    const at = (s: string) => code.indexOf(s);
    expect(at("fetchCoupangBaseline")).toBeGreaterThan(-1);
    expect(at("coupangUpdateGate(baseline)")).toBeGreaterThan(at("fetchCoupangBaseline"));
    expect(at("applyCoupangEdits(baseline, edits)")).toBeGreaterThan(at("coupangUpdateGate(baseline)"));
    expect(at("detectCoupangUpdateLoss(baseline, outgoing)")).toBeGreaterThan(at("applyCoupangEdits(baseline, edits)"));
    expect(at('method: "PUT"')).toBeGreaterThan(at("detectCoupangUpdateLoss(baseline, outgoing)"));
  });

  it("🔴 baseline 없이 PUT 하지 않는다", () => {
    const code = codeOf(UPDATER);
    expect(code).toContain('return { ok: false, step: "FETCH", message: fetched.message };');
    expect(code).toContain("쿠팡 응답에서 상품 정보를 찾지 못했습니다");
  });

  it("🔴 응답 상품번호가 다르면 성공이라고 말하지 않는다", () => {
    expect(codeOf(UPDATER)).toContain('step: "VERIFY"');
  });

  it("🔴 client 가 DELETE 를 허용하지 않는다", () => {
    const client = read("..", "..", "api", "coupang", "_lib", "client.ts");
    expect(codeOf(client)).toContain('method: "GET" | "POST" | "PUT";');
    expect(codeOf(client)).not.toContain("DELETE");
  });
});
