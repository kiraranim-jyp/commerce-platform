import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-CHANNEL-03 — **방금 누른 등록이 «무엇» 이었는가를 되짚는 길**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 이 라우트가 지켜야 하는 것은 정확도가 아니라 «말하지 않는 것» 이다.
 * 진단이 스스로 결론을 지어내면, 그 결론이 틀렸을 때 아무도 눈치채지 못한다.
 */

function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
const ROUTE_PATH = join(__dirname, "../registration-attempts/trace/route.ts");
const RAW = readFileSync(ROUTE_PATH, "utf8");
const SRC = codeOnly(RAW);

describe("① 🔴 읽기 전용이다", () => {
  it.each(["insert(", "update(", "upsert(", "delete("])("%s 가 없다", (op) => {
    /* 진단하다가 상태를 바꾸면 그 진단은 「방금 무슨 일이 있었나」를 더 이상
       말하지 못한다. */
    expect(SRC).not.toContain(op);
  });

  it("GET 만 내보낸다 — POST/PUT 핸들러가 없다", () => {
    expect(SRC).toContain("export async function GET(");
    expect(SRC).not.toContain("export async function POST(");
    expect(SRC).not.toContain("export async function PUT(");
  });
});

describe("② 🔴 남의 이력을 보여주지 않는다", () => {
  it("로그인 세션을 요구한다", () => {
    expect(SRC).toContain("requireUser()");
  });

  it("🔴 워크스페이스로 «거른다» — body/query 값을 권한 근거로 쓰지 않는다", () => {
    expect(SRC).toContain('.eq("workspace_id", auth.user.workspaceId)');
    /* query 의 workspaceId 같은 값을 읽는 곳이 없어야 한다. */
    expect(SRC).not.toContain('searchParams.get("workspaceId")');
  });

  it("🔴 소유를 «확인할 수 없는» 행은 제외한다", () => {
    /* snapshot_id 가 없으면 어느 워크스페이스 것인지 알 수 없다 —
       모르는 것을 보여주지 않는다. */
    expect(SRC).toContain("r.snapshot_id && ownedSnapshots.has(r.snapshot_id)");
  });
});

describe("③ 🔴 판정을 지어내지 않는다", () => {
  it("operation 은 «적힌 값 그대로» 낸다", () => {
    expect(SRC).toContain("operation: row.operation,");
  });

  it("🔴 external_product_id 로 operation 을 «추론» 하지 않는다", () => {
    /* 「번호가 있으니 UPDATE 였겠지」가 이 스프린트 내내 고쳐 온 실수다. */
    const code = SRC;
    expect(code).not.toContain('operation = "UPDATE"');
    expect(code).not.toContain('? "UPDATE"');
    expect(code).not.toContain('? "CREATE"');
  });

  it("비어 있으면 «비어 있다» 고 말한다", () => {
    expect(RAW).toContain("비어 있음");
  });

  it("🔴 응답 번호와 기록 번호를 «따로» 낸다 — 다르면 그 자체가 신호다", () => {
    expect(SRC).toContain("externalProductId: row.external_product_id,");
    expect(SRC).toContain("respondedProductNo: readRespondedProductNo(row.response)");
  });

  it("값이 없으면 null 이다 — 지어내지 않는다", () => {
    expect(SRC).toContain("no == null ? null : String(no)");
    expect(SRC).toContain('typeof origin?.salePrice === "number" ? origin.salePrice : null');
  });
});

describe("④ 몇 건을 봤는지 숨기지 않는다", () => {
  it("scanned · matched 를 같이 낸다 — 「없다」와 「못 찾았다」를 구분할 수 있게", () => {
    expect(SRC).toContain("scanned: owned.length");
    expect(SRC).toContain("matched: filtered.length");
  });
});
