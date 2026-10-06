import { describe, expect, it } from "vitest";
import type { CanonicalProductImage } from "@commerce/shared";
import { ensureRepresentativeImage } from "../canonical-product";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * A-1 — **이미지가 있는데 대표가 없는 상태를 허용하지 않는다.** (CPO 확정 2026-10-06)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * CEO 화면: 원본 이미지 5장이 있는데 「대표 이미지 선택 안됨」.
 *
 * ── 🔴 회귀가 «아니다» — git 으로 확인했다 ────────────────────────────────
 * `isRepresentative` 는 최초 도입(`6a13015`)부터 thumbnail selector 에 전적으로
 * 의존했고, `images[0]` 폴백이 있던 이력이 **한 번도 없다**. 그래서 AI 분류가
 * PRODUCT 를 하나도 못 내면(→ 전부 UNKNOWN → 후보 0 → `thumbnail=""`) 대표가
 * 사라진다. 고장난 것이 아니라 **방어선이 하나뿐이었다.**
 *
 * ── 🔴 이 파일이 지키는 불변식 ────────────────────────────────────────────
 *     images.length === 0  → 대표 없음이 정상
 *     images.length >= 1   → isRepresentative 가 «정확히 1개»
 *     이미 1개면            → 손대지 않는다 (셀러 선택 보호)
 *
 * 🔴 「원소스 대표 계승」은 1순위로 넣지 «않았다». §2-3 이 「image[0] 이라는
 * 이유만으로 대표로 간주하지 않는다」고 못박았고, og:image/JSON-LD 가 «어느
 * 장이 대표인지» 를 규정한다는 근거를 조사에서 찾지 못했다. 확인되지 않은 의미를
 * 1순위로 올리면 그것이 §14 가 금지한 「임의 선택」이 된다.
 */
const img = (id: string, isRepresentative = false): CanonicalProductImage =>
  ({
    id,
    originalUrl: `https://cdn.example.com/${id}.jpg`,
    selectedVariant: "ORIGINAL",
    isRepresentative,
    useInProductGallery: true,
    useInDescription: true,
    classification: "PRODUCT",
  }) as CanonicalProductImage;

/** 🔴 「정확히 1개」를 세는 헬퍼. 불변식을 손으로 다시 적지 않는다. */
const marked = (images: CanonicalProductImage[]) => images.filter((i) => i.isRepresentative).map((i) => i.id);

describe("Case A — 이미 대표가 지정돼 있으면 그것을 쓴다", () => {
  it("thumbnail selector 가 고른 대표를 덮지 않는다", () => {
    const input = [img("a"), img("b", true), img("c")];
    expect(marked(ensureRepresentativeImage(input))).toEqual(["b"]);
  });

  it("🔴 배열을 «그대로» 돌려준다 — 참조까지 동일하다(불필요한 재렌더 방지)", () => {
    const input = [img("a", true), img("b")];
    expect(ensureRepresentativeImage(input)).toBe(input);
  });
});

describe("Case B — 대표가 하나도 없으면 첫 장이 대표가 된다", () => {
  const input = [img("a"), img("b"), img("c")];

  it("🔴 공허 방지 — 입력에 대표가 «정말» 없다", () => {
    expect(marked(input)).toEqual([]);
  });

  it("첫 장만 대표가 된다", () => {
    expect(marked(ensureRepresentativeImage(input))).toEqual(["a"]);
  });

  it("🔴 나머지는 false 로 남는다 — 둘이 되지 않는다", () => {
    const out = ensureRepresentativeImage(input);
    expect(out.map((i) => i.isRepresentative)).toEqual([true, false, false]);
  });

  it("순서를 바꾸지 않는다", () => {
    expect(ensureRepresentativeImage(input).map((i) => i.id)).toEqual(["a", "b", "c"]);
  });

  it("🔴 원본 배열을 변형하지 않는다", () => {
    ensureRepresentativeImage(input);
    expect(marked(input)).toEqual([]);
  });
});

describe("Case C — 이미지가 1장이면 그것이 대표다", () => {
  it("한 장뿐이면 대표가 된다", () => {
    expect(marked(ensureRepresentativeImage([img("only")]))).toEqual(["only"]);
  });
});

describe("Case D — 이미지가 0장이면 대표 없음이 정상이다", () => {
  it("빈 배열은 빈 배열이다 — 가짜 대표를 만들지 않는다", () => {
    expect(ensureRepresentativeImage([])).toEqual([]);
  });
});

describe("Case E — 🔴 셀러가 고른 대표를 자동 판정이 덮지 않는다", () => {
  it("첫 장이 아닌 것을 골라 뒀으면 그대로 유지된다", () => {
    /* 자동 폴백이 「첫 장」이라고 해서 셀러의 선택(c)을 a 로 되돌리면 안 된다. */
    const chosen = [img("a"), img("b"), img("c", true)];
    expect(marked(ensureRepresentativeImage(chosen))).toEqual(["c"]);
  });
});

describe("Case F — 🔴 재분석/재적용에 멱등이다", () => {
  it("두 번 적용해도 결과가 같다", () => {
    const once = ensureRepresentativeImage([img("a"), img("b")]);
    const twice = ensureRepresentativeImage(once);
    expect(marked(twice)).toEqual(marked(once));
    /* 두 번째는 이미 1개이므로 손대지 않는다 — 참조까지 같다. */
    expect(twice).toBe(once);
  });

  it("셀러 선택이 있는 상태에 다시 적용해도 그 선택이 남는다", () => {
    const chosen = [img("a"), img("b", true)];
    expect(marked(ensureRepresentativeImage(ensureRepresentativeImage(chosen)))).toEqual(["b"]);
  });
});

describe("🔴 불변식 — 이미지가 있으면 대표는 «정확히 1개» 다", () => {
  it("대표가 둘이면 첫 표시만 남는다", () => {
    const two = [img("a"), img("b", true), img("c", true)];
    expect(marked(ensureRepresentativeImage(two))).toEqual(["b"]);
  });

  it("전부 대표로 표시돼 있어도 하나로 줄인다", () => {
    const all = [img("a", true), img("b", true), img("c", true)];
    expect(marked(ensureRepresentativeImage(all))).toEqual(["a"]);
  });

  it("🔴 id 가 중복돼도 흔들리지 않는다 — 위치로 고른다", () => {
    /* id 로 고르면 같은 id 둘이 모두 대표로 남는다. */
    const dup = [img("x"), img("dup", true), img("dup", true)];
    expect(marked(ensureRepresentativeImage(dup))).toEqual(["dup"]);
    expect(ensureRepresentativeImage(dup).filter((i) => i.isRepresentative)).toHaveLength(1);
  });

  it("어떤 입력이든 결과의 대표 수는 0(빈 배열) 또는 1이다", () => {
    const inputs: CanonicalProductImage[][] = [
      [],
      [img("a")],
      [img("a"), img("b")],
      [img("a", true), img("b", true)],
      [img("a"), img("b", true), img("c")],
    ];
    for (const input of inputs) {
      const count = marked(ensureRepresentativeImage(input)).length;
      expect(count, `입력 ${input.length}장에서 대표가 ${count}개`).toBe(input.length === 0 ? 0 : 1);
    }
  });
});
