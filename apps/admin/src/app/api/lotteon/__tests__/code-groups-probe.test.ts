import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * LOTTEON-PD-ARTL-02 조사 라우트(88) — **허용 조건을 코드로 못 박는다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CPO 가 좁은 범위로 승인한 조사용 라우트다(2026-09-28). 조건이 말로만 남으면
 * 다음 사람이 여기에 기능을 붙인다. 그래서 조건 «자체» 를 검사한다 —
 *
 *   비인증 접근 금지 · 읽기 하나뿐 · 파라미터 없음 · 저장 없음 · 최소 필드
 *
 * 🔴 그리고 이 라우트가 존재하는 이유도 함께 고정한다: 89 를 «지어낸 그룹
 * 이름» 으로 부르던 것을 그만두기 위해서다.
 */

const requireUser = vi.fn();
const runLotteOnRead = vi.fn();

vi.mock("@/lib/auth/require-user", () => ({ requireUser: () => requireUser() }));
vi.mock("../_lib/request", () => ({ runLotteOnRead: (args: unknown) => runLotteOnRead(args) }));

function authed() {
  requireUser.mockResolvedValue({ ok: true, user: { userId: "u1", workspaceId: "w1" } });
}

beforeEach(() => {
  vi.resetModules();
  requireUser.mockReset();
  runLotteOnRead.mockReset();
});

describe("① 🔴 비로그인은 막는다", () => {
  it("requireUser 가 거절하면 롯데ON 을 «부르지 않는다»", async () => {
    requireUser.mockResolvedValue({ ok: false, response: new Response(null, { status: 401 }) });
    const { GET } = await import("../code-groups/route");
    const res = (await GET()) as Response;
    expect(res.status).toBe(401);
    /* 🔴 핵심은 상태코드가 아니라 «우리 API Key 로 외부 호출이 일어나지
       않았다» 는 것이다. 인증 실패자가 외부 호출을 일으키게 두지 않는다. */
    expect(runLotteOnRead).not.toHaveBeenCalled();
  });
});

describe("② 🔴 읽기 하나뿐 · 파라미터 없음", () => {
  it("88 그룹조회를 GET 으로 «한 번만» 부르고 query 를 넘기지 않는다", async () => {
    authed();
    runLotteOnRead.mockResolvedValue({ ok: true, result: { data: [] } });
    const { GET } = await import("../code-groups/route");
    await GET();

    expect(runLotteOnRead).toHaveBeenCalledTimes(1);
    const args = runLotteOnRead.mock.calls[0][0] as Record<string, unknown>;
    expect(args.method).toBe("GET");
    expect(args.path).toBe("/v1/openapi/bocommon/v1/code/getGroupCodeList");
    /* 🔴 query 가 없다 — 셀러/호출자가 넣은 값이 롯데ON 으로 흘러가는 길
       자체를 만들지 않는다(common-codes 가 화이트리스트로 막아야 했던 그 길). */
    expect(args.query).toBeUndefined();
  });

  it("🔴 쓰기 경로를 부르지 않는다", async () => {
    authed();
    runLotteOnRead.mockResolvedValue({ ok: true, result: { data: [] } });
    const { GET } = await import("../code-groups/route");
    await GET();
    const paths = runLotteOnRead.mock.calls.map((call) => String((call[0] as { path: string }).path));
    for (const path of paths) {
      expect(path).not.toContain("registration");
      expect(path).not.toContain("update");
      expect(path).not.toContain("delete");
    }
  });
});

describe("③ 🔴 조회 실패를 «0건» 으로 바꿔 말하지 않는다", () => {
  it("실패 응답을 그대로 돌려준다", async () => {
    authed();
    const failure = new Response(JSON.stringify({ ok: false }), { status: 502 });
    runLotteOnRead.mockResolvedValue({ ok: false, response: failure });
    const { GET } = await import("../code-groups/route");
    const res = (await GET()) as Response;
    expect(res.status).toBe(502);
    /* 🔴 이 구분이 이 라우트의 존재 이유다 — 「닿지 않았다」와 「없다」는 다르다.
       그 둘을 섞어 읽은 것이 PD_ARTL_CD rowCount 0 판정의 잘못이었다. */
  });
});

describe("④ 응답은 코드 메타데이터 «최소» 만 담는다", () => {
  it("grpCd · grpCdNm · grpCdEpn 세 칸만 나간다", async () => {
    authed();
    runLotteOnRead.mockResolvedValue({
      ok: true,
      result: {
        data: [
          { grpCd: "OPLC_CD", grpCdNm: "원산지코드", grpCdEpn: "국가", somethingElse: "버려진다" },
          { grpCd: "", grpCdNm: "이름만 있고 코드가 없다" },
        ],
      },
    });
    const { GET } = await import("../code-groups/route");
    const json = (await (await GET()).json()) as {
      ok: boolean;
      readOnly: boolean;
      probeOnly: boolean;
      count: number;
      groups: Record<string, string>[];
    };

    expect(json.ok).toBe(true);
    expect(json.readOnly).toBe(true);
    /* 🔴 조사용이라는 표시를 응답 자체에 남긴다 — 나중에 이 라우트가 «기능» 인
       줄 알고 화면이 붙는 일을 막는다. */
    expect(json.probeOnly).toBe(true);
    /* 코드가 빈 줄은 버린다 — 값을 만들지 않는다. */
    expect(json.count).toBe(1);
    expect(Object.keys(json.groups[0]).sort()).toEqual(["grpCd", "grpCdEpn", "grpCdNm"]);
    expect(json.groups[0].grpCd).toBe("OPLC_CD");
  });
});
