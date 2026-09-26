import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P0-CHANNEL-03 F-14(CTO 기준 아키텍처 확정, 2026-09-26)
 * **수정 대상의 기준은 Snapshot 이 아니라 «Commerce 등록 ID» 다.**
 * ════════════════════════════════════════════════════════════════════════════
 *
 *     Product ─┬─ Snapshot            «그때 우리가 가지고 있던 상태»
 *              └─ ChannelProduct      «지금 그 커머스에 실제로 있는 등록상품»
 *                     └─ external_product_id  ← 수정 기준
 *                                │
 *                     Commerce GET → EditModel → UPDATE → «같은» external id
 *
 * 🔴 이 파일이 지키는 다섯:
 *   ① 최근작업 → 반드시 ChannelProduct 를 «거쳐» 등록 ID 를 얻는다.
 *   ② 편집 기준값은 그 ID 로 GET 한 «현재 등록정보» 다 — Snapshot 이 아니다.
 *   ③ UPDATE 대상 ID 를 Snapshot 이나 클라이언트에서 «재추론하지» 않는다.
 *   ④ 🔴 화면이 본 ID 와 지금 연결된 ID 가 다르면 «보내지 않는다».
 *   ⑤ 등록이 성공하면 ChannelProduct 가 «반드시» 생기거나 갱신된다.
 */

function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
const ROUTE = codeOnly(readFileSync(join(__dirname, "../register/route.ts"), "utf8"));
const EDIT_ROUTE = codeOnly(readFileSync(join(__dirname, "../registered-product/route.ts"), "utf8"));
const EXECUTOR = codeOnly(
  readFileSync(
    join(__dirname, "../../../../../../../packages/listing/src/executors/smartstore.executor.ts"),
    "utf8",
  ),
);
const WORKSPACE = codeOnly(readFileSync(join(__dirname, "../../../pipeline/CommerceWorkspace.tsx"), "utf8"));

describe("① 🔴 최근작업 → ChannelProduct 를 «거친다»", () => {
  it("편집 기준값 라우트는 snapshotId 로 ChannelProduct 를 찾는다", () => {
    expect(EDIT_ROUTE).toContain('findChannelProductBySnapshot(snapshotId, "smartstore")');
  });

  it("🔴 Snapshot 에 저장된 상품정보를 편집 기준으로 쓰지 않는다", () => {
    /* 「예전 등록 당시 payload」나 「snapshot 의 상품정보」로 수정하면, 실제
       커머스의 현재 상태와 달라진 채로 전체 교체가 나간다. */
    expect(EDIT_ROUTE).not.toContain("product_snapshots");
    expect(EDIT_ROUTE).not.toContain("snapshot.payload");
    expect(EDIT_ROUTE).toContain("fetchRegisteredProduct(token.accessToken, link.externalProductId)");
  });
});

describe("② 🔴 편집 기준값은 그 ID 로 GET 한 현재 등록정보다", () => {
  it("GET → 기준값 → 화면 순서가 고정돼 있다", () => {
    const iLink = EDIT_ROUTE.indexOf("findChannelProductBySnapshot(");
    const iGet = EDIT_ROUTE.indexOf("fetchRegisteredProduct(");
    const iModel = EDIT_ROUTE.indexOf("buildChannelEditModel(");
    expect(iLink).toBeLessThan(iGet);
    expect(iGet).toBeLessThan(iModel);
  });

  it("기준값의 출처가 «그 등록 ID» 로 박혀 있다", () => {
    expect(EDIT_ROUTE).toContain('externalProductId: link.externalProductId');
    expect(EDIT_ROUTE).toContain('kind: "CHANNEL_GET"');
  });
});

describe("③ 🔴 UPDATE 대상 ID 를 재추론하지 않는다", () => {
  it("UPDATE 는 ChannelProduct 가 가리키는 그 번호로 나간다", () => {
    const iUpdate = ROUTE.indexOf("await updateRegisteredProduct(");
    const call = ROUTE.slice(iUpdate, iUpdate + 200);
    expect(call).toContain("existing.externalProductId");
    /* 🔴 snapshotId 로 대상을 만들지 않는다. */
    expect(call).not.toContain("snapshotId");
  });

  it("🔴 응답 번호가 같은지까지 확인한 뒤에만 성공이다", () => {
    const UPDATER = codeOnly(readFileSync(join(__dirname, "../_lib/update-product.ts"), "utf8"));
    expect(UPDATER).toContain("isSameOriginProduct(originProductNo, responded)");
  });

  it("성공 기록도 «같은» 번호와 그 ChannelProduct 를 남긴다", () => {
    expect(ROUTE).toContain("externalProductId: updated.originProductNo,");
    expect(ROUTE).toContain("await touchChannelProduct(existing.id);");
    expect(ROUTE).toContain('operation: "UPDATE",');
    expect(ROUTE).toContain("channelProductId: existing.id,");
  });
});

describe("④ 🔴 화면이 본 ID 와 다르면 보내지 않는다", () => {
  it("화면은 «실제로 GET 한» 번호를 실어 보낸다", () => {
    expect(WORKSPACE).toContain("expectedExternalProductId:");
    expect(WORKSPACE).toContain("channelEdit?.model.source.externalProductId");
    expect(EXECUTOR).toContain("expectedExternalProductId: context?.expectedExternalProductId,");
  });

  it("서버는 그것으로 «대상을 정하지 않는다» — 대조만 한다", () => {
    const iFind = ROUTE.indexOf("const existing = await findChannelProductBySnapshot(");
    const iGuard = ROUTE.indexOf("expectedExternalProductId !== existing.externalProductId");
    /* 🔴 대상을 먼저 찾고, 그 다음에 대조한다. 순서가 뒤집히면 클라이언트가
       보낸 번호가 대상을 «정하게» 된다. */
    expect(iFind).toBeGreaterThan(-1);
    expect(iFind).toBeLessThan(iGuard);
    expect(ROUTE).not.toContain("findChannelProduct(expectedExternalProductId");
  });

  it("🔴 다르면 네이버를 부르기 «전» 에 멈춘다", () => {
    const iGuard = ROUTE.indexOf("expectedExternalProductId !== existing.externalProductId");
    expect(iGuard).toBeLessThan(ROUTE.indexOf("await fetchRegisteredProduct("));
    expect(iGuard).toBeLessThan(ROUTE.indexOf("await updateRegisteredProduct("));
    const guard = ROUTE.slice(iGuard, ROUTE.indexOf("await fetchRegisteredProduct("));
    expect(guard).toContain("return NextResponse.json(result);");
    /* 아무것도 하지 않았으므로 operation 을 적지 않는다. */
    expect(guard).toContain("await logRegistrationAttempt(result, undefined, snapshotId, jobKey);");
  });

  it("보내지 않은 이유를 셀러의 말로 남긴다", () => {
    expect(ROUTE).toContain("달라 보내지 않았습니다");
    expect(ROUTE).toContain("다시 불러온 뒤 수정해주세요");
  });

  it("🔴 값이 없으면 대조하지 않는다 — 없는 번호를 지어내지 않는다", () => {
    /* 불러오지 않은 화면(기존 등록 흐름)은 이 값을 보내지 않는다. 그 경우까지
       막으면 예전 경로가 통째로 끊긴다. */
    expect(ROUTE).toContain("if (expectedExternalProductId && expectedExternalProductId !== existing.externalProductId)");
    expect(WORKSPACE).toContain('platform === "smartstore" ? channelEdit?.model.source.externalProductId : undefined');
  });
});

describe("⑤ 🔴 등록이 성공하면 ChannelProduct 가 남는다", () => {
  it("CREATE 성공 → 연결을 만든다", () => {
    expect(ROUTE).toContain("channelProductId = await linkSmartStoreChannelProduct(snapshotId, result.externalProductId);");
  });

  it("RECREATE 성공 → 연결을 «갈아끼운다»(새로 만들지 않는다)", () => {
    expect(ROUTE).toContain("replaceChannelProductLink(existing.id, result.externalProductId)");
  });

  it("🔴 연결을 남기지 «못하면» 그 사실을 보고한다 — 조용히 넘어가지 않는다", () => {
    expect(ROUTE).toContain("if (!channelProductId) {");
    expect(ROUTE).toContain("연결 정보를 남기지 못했습니다");
  });
});

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ⑥ P0-CHANNEL-03 F-14-7 — **보내는 payload 도 「지금 등록된 값 + 고친 것」**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 화면이 「상품명 하나만 바뀝니다」라고 말해도, 실제로 나가는 payload 가 Master
 * 값으로 가득하면 아무것도 고쳐지지 않은 것이다. 화면과 전송이 «같은 규칙» 을
 * 쓰는지는 여기서 고정한다.
 */
describe("⑥ 🔴 F-14-7 — 고치지 않은 값은 그대로 나간다", () => {
  it("UPDATE payload 에 되돌리기를 «적용» 한다", () => {
    expect(ROUTE).toContain("preserveRegisteredValues(payload, current.snapshot, editedFields)");
    expect(ROUTE).toContain("payload = preservation.payload;");
  });

  it("🔴 되돌리는 값은 «서버가 읽은» 스냅샷에서만 온다", () => {
    /* 클라이언트가 준 것은 「어느 칸을 고쳤는지」라는 이름뿐이다. */
    expect(ROUTE).toContain("current.snapshot, editedFields");
    expect(ROUTE).toContain("typeof field === \"string\"");
    /* 값을 받아 쓰는 형태가 아니다. */
    expect(ROUTE).not.toContain("body.editedValues");
    expect(ROUTE).not.toContain("body.baseline");
  });

  it("🔴 되돌리지 못하는 칸이 있으면 «보내지 않는다»", () => {
    const iBlock = ROUTE.indexOf("if (preservation.unpreservable.length > 0)");
    expect(iBlock).toBeGreaterThan(-1);
    expect(iBlock).toBeLessThan(ROUTE.indexOf("await updateRegisteredProduct("));
    const block = ROUTE.slice(iBlock, ROUTE.indexOf("if (!confirmUpdate) {"));
    expect(block).toContain("return NextResponse.json(result);");
    expect(block).toContain("그대로 보내면 그 값이 바뀝니다");
  });

  it("되돌리기가 확인 화면·손실검사 «앞» 이다 — 본 것과 나간 것이 같다", () => {
    const iPreserve = ROUTE.indexOf("preserveRegisteredValues(");
    expect(iPreserve).toBeLessThan(ROUTE.indexOf("if (!confirmUpdate) {"));
    expect(iPreserve).toBeLessThan(ROUTE.indexOf("detectUpdateDataLoss(current.snapshot, payload)"));
  });

  it("🔴 목록을 «보내지 않은» 화면은 예전 그대로다", () => {
    /* 「빈 배열」과 「안 보냄」은 다른 뜻이다 — 전자는 「하나도 안 고쳤다」. */
    expect(ROUTE).toContain("if (editedFields) {");
    expect(ROUTE).toContain("? body.editedFields.filter(");
    expect(ROUTE).toContain(": undefined;");
  });

  it("화면과 executor 도 같은 이름을 실어 보낸다", () => {
    expect(WORKSPACE).toContain("editedFields: platform === \"smartstore\" ? channelEditInput?.edited : undefined");
    expect(EXECUTOR).toContain("editedFields: context?.editedFields,");
  });
});
