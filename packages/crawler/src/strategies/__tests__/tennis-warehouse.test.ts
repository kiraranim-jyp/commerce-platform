import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildTennisWarehouseGallery,
  isTennisWarehouseUrl,
  readGalleryPaths,
  readMaxResizerWidth,
  tennisWarehouseStrategy,
} from "../tennis-warehouse.strategy";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * P2-1 C — 「실제 페이지 5장 → 수집 5장」 (CPO 지시, 2026-10-04)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 fixture 는 **실제 응답에서 떠 온 조각** 이다(HTTP 200 · 197,858 bytes 중 대표
 * 이미지 srcset 조각 + 갤러리 `<ul>` 블록). 손으로 만든 HTML 로 재면 실제 스킨이
 * 아니라 내가 상상한 스킨을 재게 된다([[fixtures-must-be-dirty]]).
 *
 * 🔴 **개수만 세지 않는다.** 금지된 것을 하지 «않았는지» 가 더 중요하다:
 *     워터마크 경로 유지 · nw 상수 박기 금지 · 파일명 번호 증가 금지 ·
 *     43px 썸네일을 상품 이미지로 올리지 않음.
 */
const FIXTURE = readFileSync(join(__dirname, "fixtures/tennis-warehouse-product.html"), "utf8");
const PAGE_URL =
  "https://www.tennis-warehouse.com/Sergio_Tacchini_Mens_Trattino_Polo/descpageMASGT-STMFTP.html?color=BL";

describe("① 🔴 실제 페이지 5장 → 후보 5장", () => {
  const candidates = buildTennisWarehouseGallery(FIXTURE, PAGE_URL);

  it("5장이다 — 실측 개수와 같다", () => {
    expect(candidates).toHaveLength(5);
  });

  it("🔴 순서를 유지한다 — 1번이 대표다", () => {
    const paths = candidates.map((c) => /path=([^&]+)/.exec(c.url)![1]);
    expect(paths).toEqual([
      "STMFTP-BL-1.jpg",
      "STMFTP-BL-2.jpg",
      "STMFTP-BL-3.jpg",
      "STMFTP-BL-4.jpg",
      "STMFTP-BL-5.jpg",
    ]);
  });

  it("중복이 없다", () => {
    expect(new Set(candidates.map((c) => c.url)).size).toBe(candidates.length);
  });

  it("source 가 전용 전략으로 표시된다", () => {
    for (const c of candidates) expect(c.source).toBe("tennis-warehouse");
  });
});

describe("② 🔴 금지된 것을 하지 «않았다»", () => {
  const candidates = buildTennisWarehouseGallery(FIXTURE, PAGE_URL);

  it("🔴 워터마크 경로를 그대로 쓴다 — 우회하지 않았다", () => {
    for (const c of candidates) expect(c.url).toContain("/watermark/");
  });

  it("🔴 43px 썸네일을 상품 이미지로 올리지 «않는다»", () => {
    /* 갤러리 마크업의 원래 폭은 43 이다. 그대로 쓰면 채널 규격에 걸리고,
       셀러는 「5장 들어왔다」고 믿는다 — 1장만 받는 것보다 나쁘다. */
    for (const c of candidates) expect(c.url).not.toMatch(/nw=43$/);
  });

  it("🔴 폭을 상수로 박지 않았다 — 페이지가 쓰는 최대 폭을 «읽는다»", () => {
    expect(readMaxResizerWidth(FIXTURE)).toBe(1486);
    /* 같은 구조에 다른 폭을 넣으면 결과가 «따라 바뀐다» — 상수라면 안 바뀐다.
       🔴 1486 «하나만» 바꾸면 남아 있던 1426 이 새 최대가 된다(처음에 이렇게 쓰고
       틀렸다). 그 자체가 「읽고 있다」는 증거지만, 단정은 의도대로 적는다 —
       폭을 «전부» 내린 뒤 한 자리에만 큰 값을 넣어, 그 값이 따라오는지 본다
       (`\d{4}` 만 바꿨을 때 944 가 남아 또 틀렸다 — 두 번 걸렸다). */
    const shrunk = FIXTURE.replace(/nw=\d+/g, "nw=300").replace("nw=300", "nw=777");
    expect(readMaxResizerWidth(shrunk)).toBe(777);
    for (const c of buildTennisWarehouseGallery(shrunk, PAGE_URL)) expect(c.url).toContain("nw=777");
  });

  it("🔴 폭을 못 읽으면 «아무것도» 돌려주지 않는다", () => {
    const noWidth = FIXTURE.replace(/&(amp;)?nw=\d+/g, "");
    expect(buildTennisWarehouseGallery(noWidth, PAGE_URL)).toEqual([]);
  });

  it("🔴 엔드포인트도 읽는다 — 호스트를 상수로 박지 않았다", () => {
    const moved = FIXTURE.replace(/img\.tennis-warehouse\.com/g, "cdn2.tennis-warehouse.com");
    const rebuilt = buildTennisWarehouseGallery(moved, PAGE_URL);
    expect(rebuilt.length).toBe(5);
    for (const c of rebuilt) expect(c.url).toContain("cdn2.tennis-warehouse.com");
  });

  it("🔴 경로는 마크업에서 «읽는다» — 번호를 증가시켜 만들지 않는다", () => {
    /* 갤러리 항목 하나를 지우면 결과가 4장이어야 한다. 번호를 세어 만들었다면
       5장이 그대로 나온다(그것이 「URL 패턴 발명」의 증상이다). */
    const without3 = FIXTURE.replace(/path=STMFTP-BL-3\.jpg/g, "path=STMFTP-BL-1.jpg");
    const paths = buildTennisWarehouseGallery(without3, PAGE_URL).map(
      (c) => /path=([^&]+)/.exec(c.url)![1],
    );
    expect(paths).not.toContain("STMFTP-BL-3.jpg");
    expect(paths.length).toBeLessThan(5);
  });
});

describe("③ 🔴 다른 사이트에서는 돌지 «않는다»", () => {
  it("호스트가 다르면 canHandle 이 false 다", () => {
    expect(
      tennisWarehouseStrategy.canHandle({
        url: "https://www.example.com/p/1",
        html: FIXTURE,
        page: null as never,
      }),
    ).toBe(false);
  });

  it("🔴 호스트가 맞아도 갤러리 마커가 없으면 돌지 않는다 — 목록·검색 페이지", () => {
    expect(
      tennisWarehouseStrategy.canHandle({
        url: PAGE_URL,
        html: "<html><body>no gallery here</body></html>",
        page: null as never,
      }),
    ).toBe(false);
  });

  it("상품 페이지에서는 돈다", () => {
    expect(tennisWarehouseStrategy.canHandle({ url: PAGE_URL, html: FIXTURE, page: null as never })).toBe(true);
  });

  it("호스트 판별 — 서브도메인을 느슨하게 받지 않는다", () => {
    expect(isTennisWarehouseUrl(PAGE_URL)).toBe(true);
    expect(isTennisWarehouseUrl("https://tennis-warehouse.com/x")).toBe(true);
    expect(isTennisWarehouseUrl("https://evil-tennis-warehouse.com/x")).toBe(false);
    expect(isTennisWarehouseUrl("not a url")).toBe(false);
  });
});

describe("④ 갤러리 경로 읽기 — 단위", () => {
  it("문서 순서를 유지하고 중복을 지운다", () => {
    const html =
      '<span class="prod_view-multiview-image" data-imgsrc="https://i/rs.php?path=B.jpg&amp;nw=43"></span>' +
      '<span class="prod_view-multiview-image" data-imgsrc="https://i/rs.php?path=A.jpg&amp;nw=43"></span>' +
      '<span class="prod_view-multiview-image" data-imgsrc="https://i/rs.php?path=B.jpg&amp;nw=43"></span>';
    expect(readGalleryPaths(html)).toEqual(["B.jpg", "A.jpg"]);
  });

  it("갤러리가 없으면 빈 배열이다 — 「없다」고 말할 뿐 만들지 않는다", () => {
    expect(readGalleryPaths("<html></html>")).toEqual([]);
    expect(buildTennisWarehouseGallery("<html></html>", PAGE_URL)).toEqual([]);
  });
});
