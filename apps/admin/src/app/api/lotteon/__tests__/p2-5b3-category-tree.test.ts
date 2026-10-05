import { describe, expect, it } from "vitest";
import { buildLotteOnCategoryTree } from "../category-tree/route";
import { parseLotteOnStandardCategory, type LotteOnStandardCategory } from "../../../pipeline/commerce/lotteon-category";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P2-5b-③ — 롯데ON 평면 카테고리 → 중첩 트리 (CPO 승인, 2026-10-05)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 등급을 미리 적어 둔다: 이 파일이 증명하는 것은 **변환** 이다.
 * `parseLotteOnStandardCategory()` 는 Production 실제 응답을 받은 적이 없고
 * (lotteon-category.ts 가 스스로 적어 둔 사실), 이 라우트는 그 등급을 물려받는다.
 * 즉 `Code/Test PASS`이고 `Production 미검증` 이다.
 *
 * 아래 raw 객체의 필드명은 롯데ON 공개 가이드 원문(205 Response Sample)에서
 * 옮긴 것이고, 기존 파서가 읽는 바로 그 이름들이다 — 테스트용으로 지어낸 이름이
 * 아니다. 그래서 이 테스트는 파서와 변환을 «함께» 잰다.
 */
const raw = (
  id: string,
  name: string,
  parentId: string,
  opts: { leaf?: boolean; use?: boolean } = {},
) => ({
  std_cat_id: id,
  std_cat_nm: name,
  upr_std_cat_id: parentId,
  depth_no: parentId === "0" ? "1" : "2",
  leaf_yn: opts.leaf === false ? "N" : "Y",
  use_yn: opts.use === false ? "N" : "Y",
});

const parseAll = (rows: Record<string, unknown>[]): LotteOnStandardCategory[] =>
  rows.map(parseLotteOnStandardCategory).filter((c): c is LotteOnStandardCategory => c != null);

describe("① 🔴 평면 목록 → 중첩 트리", () => {
  const categories = parseAll([
    raw("C1", "패션의류", "0", { leaf: false }),
    raw("C1-1", "남성의류", "C1", { leaf: false }),
    raw("C1-1-1", "남성 티셔츠", "C1-1"),
    raw("C1-1-2", "남성 셔츠", "C1-1"),
    raw("C2", "가방/지갑", "0", { leaf: false }),
    raw("C2-1", "남성가방", "C2"),
  ]);
  const tree = buildLotteOnCategoryTree(categories);

  it("루트 아래에 최상위 둘이 선다", () => {
    expect(tree.children?.map((c) => c.name)).toEqual(["패션의류", "가방/지갑"]);
  });

  it("🔴 parent/child 관계가 보존된다 — 3단계까지", () => {
    const fashion = tree.children!.find((c) => c.name === "패션의류")!;
    const men = fashion.children!.find((c) => c.name === "남성의류")!;
    expect(men.children?.map((c) => c.name)).toEqual(["남성 티셔츠", "남성 셔츠"]);
  });

  it("리프는 children 이 undefined 다 — 공통 계약(자식 없으면 선택 가능)", () => {
    const bag = tree.children!.find((c) => c.name === "가방/지갑")!;
    expect(bag.children![0].children).toBeUndefined();
  });

  it("🔴 id 는 std_cat_id 그대로다 — 코드를 지어내지 않았다", () => {
    const bag = tree.children!.find((c) => c.name === "가방/지갑")!;
    expect(bag.children![0].id).toBe("C2-1");
  });
});

describe("② 🔴 usable=false 는 제외한다", () => {
  it("use_yn=N 인 리프가 트리에 없다", () => {
    const categories = parseAll([
      raw("P", "패션의류", "0", { leaf: false }),
      raw("A", "남성 티셔츠", "P"),
      raw("B", "단종 카테고리", "P", { use: false }),
    ]);
    const parent = buildLotteOnCategoryTree(categories).children![0];
    expect(parent.children?.map((c) => c.name)).toEqual(["남성 티셔츠"]);
  });

  it("🔴 부모가 사용중지면 자식을 «버리지 않고» 최상위에 둔다", () => {
    /* 205 상위 노드의 use_yn 을 실측으로 확인하지 못했다. 자식을 버리면 트리가
       통째로 빌 수 있어서, 깊이가 얕게 보이는 쪽을 골랐다 — 셀러가 고를 수 있는
       것을 숨기지 않는다. 이 판단을 테스트에 적어 둔다. */
    const categories = parseAll([
      raw("P", "사용중지 상위", "0", { leaf: false, use: false }),
      raw("A", "남성 티셔츠", "P"),
    ]);
    const tree = buildLotteOnCategoryTree(categories);
    expect(tree.children?.map((c) => c.name)).toEqual(["남성 티셔츠"]);
  });
});

describe("③ 🔴 조용히 잘못된 빈 트리를 만들지 않는다", () => {
  it("파싱된 카테고리가 0건이면 children 이 undefined 다 — 빈 배열로 포장하지 않는다", () => {
    const tree = buildLotteOnCategoryTree([]);
    expect(tree.children).toBeUndefined();
  });

  it("🔴 필수 필드가 없는 응답은 파서가 걸러낸다 — 트리에 서지 않는다", () => {
    /* std_cat_id / std_cat_nm 이 없으면 파서가 null 이다(기존 계약). */
    expect(parseLotteOnStandardCategory({ upr_std_cat_id: "0", leaf_yn: "Y" })).toBeNull();
    expect(parseAll([{ upr_std_cat_id: "0" }])).toEqual([]);
  });

  it("🔴 라우트가 0건을 OK 로 내려보내지 않는다 — PARSE_EMPTY 를 쓴다", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    /* 🔴 주석을 벗기고 본다 — 이 분기를 «설명하는» 주석이 같은 파일에 길게 있다. */
    const code = readFileSync(join(__dirname, "../category-tree/route.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^[ \t]*\/\/.*$/gm, "");
    expect(code).toContain("categories.length === 0");
    expect(code).toContain('status: "PARSE_EMPTY"');
    /* 첫 페이지 실패를 「카테고리 없음」으로 바꾸지 않는다. */
    expect(code).toContain("if (page === 0) return read.response;");
  });
});

describe("④ 🔴 순환 참조에서 터지지 않는다", () => {
  it("자기 자신을 부모로 가리키면 파서가 parentId 를 비운다 — 최상위가 된다", () => {
    const categories = parseAll([raw("X", "자기참조", "X")]);
    expect(categories[0].parentId).toBeNull();
    expect(buildLotteOnCategoryTree(categories).children?.map((c) => c.name)).toEqual(["자기참조"]);
  });

  it("긴 순환(A→B→A)에서도 끝난다 — 깊이 상한", () => {
    const categories = parseAll([raw("A", "에이", "B", { leaf: false }), raw("B", "비", "A", { leaf: false })]);
    /* 둘 다 서로를 부모로 가리키므로 최상위가 없다 — 무한 재귀 없이 끝나야 한다. */
    expect(() => buildLotteOnCategoryTree(categories)).not.toThrow();
  });
});

describe("⑤ 🔴 기존 쿠팡·네이버 어댑터를 건드리지 않았다 (회귀)", () => {
  it("어댑터 파일에 세 채널이 각자 함수로 있다", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const code = readFileSync(join(__dirname, "../../../pipeline/commerce/category-tree-adapters.ts"), "utf8");
    expect(code).toContain("export async function fetchCoupangCategoryTree()");
    expect(code).toContain("export async function fetchNaverCategoryTree()");
    expect(code).toContain("export async function fetchLotteOnCategoryTree()");
    /* 쿠팡 변환 로직이 그대로다. */
    expect(code).toContain('.filter((child) => child.status !== "DISABLED")');
    expect(code).toContain("String(node.displayItemCategoryCode)");
  });

  it("🔴 롯데ON 어댑터는 «통과만» 한다 — 클라이언트에서 페이징하지 않는다", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const code = readFileSync(join(__dirname, "../../../pipeline/commerce/category-tree-adapters.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^[ \t]*\/\/.*$/gm, "");
    const lotteBlock = code.slice(code.indexOf("fetchLotteOnCategoryTree"));
    expect(lotteBlock).not.toContain("skip");
    expect(lotteBlock).not.toContain("for (");
  });
});
