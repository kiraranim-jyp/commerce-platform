import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P1-D ③ 조사 라우트 — **범위를 코드로 못 박는다**
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CPO 가 «예외적으로» 허용한 조사용 라우트다(2026-09-28). 허용 조건이 말로만
 * 남으면 다음 사람이 여기에 기능을 붙인다. 그래서 조건 자체를 검사한다 —
 *
 *   비인증 접근 금지 · 읽기 전용(쓰기 0) · 상품 1건 · 저장 0
 *   판매자 데이터 무제한 노출 금지 · 등록 상품 0건이면 94 를 «부르지 않는다»
 */

const requireUser = vi.fn();
const fetchLotteOnIdentity = vi.fn();
const runLotteOnRead = vi.fn();

vi.mock("@/lib/auth/require-user", () => ({ requireUser: () => requireUser() }));
vi.mock("../_lib/identity", () => ({ fetchLotteOnIdentity: () => fetchLotteOnIdentity() }));
vi.mock("../_lib/request", () => ({ runLotteOnRead: (args: unknown) => runLotteOnRead(args) }));

const IDENTITY = { ok: true, identity: { trGrpCd: "LO", trNo: "LO10179008" } };

function authed() {
  requireUser.mockResolvedValue({ ok: true, user: { id: "u1" } });
}

beforeEach(() => {
  vi.resetModules();
  requireUser.mockReset();
  fetchLotteOnIdentity.mockReset();
  runLotteOnRead.mockReset();
});

describe("① 🔴 비로그인은 막는다", () => {
  it("requireUser 가 거절하면 그 응답을 그대로 돌려주고 롯데ON 을 «부르지 않는다»", async () => {
    requireUser.mockResolvedValue({ ok: false, response: new Response(null, { status: 401 }) });
    const { GET } = await import("../notice-article-probe/route");
    const res = (await GET()) as Response;
    expect(res.status).toBe(401);
    expect(fetchLotteOnIdentity).not.toHaveBeenCalled();
    expect(runLotteOnRead).not.toHaveBeenCalled();
  });
});

describe("② 🔴 등록 상품이 0건이면 94 를 부르지 않는다", () => {
  it("93 에서 멈추고 «없음» 을 결론으로 돌려준다", async () => {
    authed();
    fetchLotteOnIdentity.mockResolvedValue(IDENTITY);
    runLotteOnRead.mockResolvedValue({ ok: true, result: { data: [] } });

    const { GET } = await import("../notice-article-probe/route");
    const json = await (await GET()).json();

    expect(runLotteOnRead).toHaveBeenCalledTimes(1); // 93 만
    expect(runLotteOnRead.mock.calls[0]?.[0]).toMatchObject({ step: "93 상품목록 조회" });
    expect(json.conclusion).toBe("NO_REGISTERED_PRODUCT");
    expect(json.registeredProductCount).toBe(0);
  });
});

describe("③ 읽기 전용 · 1건 · 쓰기 0", () => {
  beforeEach(() => {
    authed();
    fetchLotteOnIdentity.mockResolvedValue(IDENTITY);
  });

  it("93 은 rowsPerPage 1 로만 묻는다", async () => {
    runLotteOnRead.mockResolvedValue({ ok: true, result: { data: [] } });
    const { GET } = await import("../notice-article-probe/route");
    await GET();
    const body = runLotteOnRead.mock.calls[0]?.[0] as { body: Record<string, unknown> };
    expect(body.body.rowsPerPage).toBe(1);
    expect(body.body.pageNo).toBe(1);
  });

  it("🔴 두 호출 모두 읽기 경로다 — 등록/수정 경로를 쓰지 않는다", async () => {
    runLotteOnRead
      .mockResolvedValueOnce({ ok: true, result: { data: [{ spdNo: "S1" }] } })
      .mockResolvedValueOnce({ ok: true, result: { data: [{ pdItmsCd: "23", pdItmsArtlLst: [] }] } });
    const { GET } = await import("../notice-article-probe/route");
    await GET();
    const paths = runLotteOnRead.mock.calls.map((c) => (c[0] as { path: string }).path);
    expect(paths).toEqual(["/v1/openapi/product/v1/product/list", "/v1/openapi/product/v1/product/detail"]);
    for (const p of paths) {
      expect(p).not.toMatch(/register|update|modify|delete/i);
    }
  });
});

describe("④ 🔴 판매자 데이터를 «무제한 노출하지» 않는다", () => {
  it("고시 부분과 «키 이름» 만 나간다 — 상품명·가격·주소는 값으로 나가지 않는다", async () => {
    authed();
    fetchLotteOnIdentity.mockResolvedValue(IDENTITY);
    runLotteOnRead
      .mockResolvedValueOnce({ ok: true, result: { data: [{ spdNo: "S1" }] } })
      .mockResolvedValueOnce({
        ok: true,
        result: {
          data: [
            {
              pdItmsCd: "23",
              pdItmsArtlLst: [{ pdArtlCd: "0020", pdArtlCnts: "네이비" }],
              /* 조사에 필요 없는 판매자 데이터 — 값이 새어 나가면 안 된다. */
              spdNm: "테리 버뮤다 반바지",
              slPrc: 128000,
              owhpNo: "PLO3837441",
            },
          ],
        },
      });

    const { GET } = await import("../notice-article-probe/route");
    const json = await (await GET()).json();
    const serialized = JSON.stringify(json);

    expect(json.conclusion).toBe("ARTICLES_FOUND");
    expect(json.articlesKey).toBe("pdItmsArtlLst");
    expect(json.articleCount).toBe(1);
    expect(json.articles[0]).toMatchObject({ pdArtlCd: "0020", pdArtlCnts: "네이비" });

    /* 🔴 구조는 알아야 하니 «키 이름» 은 나간다. 값은 나가지 않는다. */
    expect(json.detailTopLevelKeys).toContain("spdNm");
    expect(serialized).not.toContain("테리 버뮤다 반바지");
    expect(serialized).not.toContain("128000");
    expect(serialized).not.toContain("PLO3837441");
  });
});

describe("⑤ 키 이름을 «하나만» 추측하지 않는다", () => {
  /* 205 에서 pd_itms_list / pd_Itms_list 가 갈렸던 전례가 있다. */
  it.each([["pd_itms_artl_lst"], ["pdItmsArtlList"], ["pdArtlLst"]])("%s 로 와도 읽는다", async (key) => {
    authed();
    fetchLotteOnIdentity.mockResolvedValue(IDENTITY);
    runLotteOnRead
      .mockResolvedValueOnce({ ok: true, result: { data: [{ spdNo: "S1" }] } })
      .mockResolvedValueOnce({ ok: true, result: { data: [{ [key]: [{ pdArtlCd: "0001" }] }] } });
    const { GET } = await import("../notice-article-probe/route");
    const json = await (await GET()).json();
    expect(json.articlesKey).toBe(key);
    expect(json.articleCount).toBe(1);
  });

  it("어느 키도 없으면 «없다» 고 말한다 — 빈 배열과 구분한다", async () => {
    authed();
    fetchLotteOnIdentity.mockResolvedValue(IDENTITY);
    runLotteOnRead
      .mockResolvedValueOnce({ ok: true, result: { data: [{ spdNo: "S1" }] } })
      .mockResolvedValueOnce({ ok: true, result: { data: [{ pdItmsCd: "23" }] } });
    const { GET } = await import("../notice-article-probe/route");
    const json = await (await GET()).json();
    expect(json.conclusion).toBe("ARTICLES_KEY_ABSENT");
  });
});
