import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { CrossSellerMatch } from "@commerce/crawler/src/comparison-search/cross-seller";
import type { ProductFacts } from "@commerce/shared";
import {
  SAME03_EXTRA_CANDIDATES,
  SAME03_ORIGIN_CODES,
  SAME03_ORIGIN_URL,
  buildSame03Candidates,
  classifySame03Kr,
  loadSame03GtRows,
  originJoinIsProven,
  proveOriginJoin,
  same03UrlKey,
} from "./core-same03-inventory";
import { buildSame03Evidence, describeSame03SupplyGaps } from "./core-same03-evidence";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 CORE-PRICE-SAME-03 — **인벤토리 · 8축 읽기 계약**(네트워크 0 · CI 상주)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 운영 변경 **0**. 이 파일은 **검토 화면의 전제** 를 잠근다.
 *
 * ── 🔴🔴 왜 라이브 빌더와 «갈라» 두는가 ─────────────────────────────────────
 * ```
 * START-HERE §14 가 기록한 사실 — `core-2m-visual-review-build` 는 외부 사이트에
 * 의존해 **병렬에서 간헐 FAIL** 한다. 그 파일에 매핑 계약을 같이 넣으면
 * 「매핑이 틀렸는가」와 「외부 사이트가 느렸는가」를 **가를 수 없다.**
 * 🟢 그래서 매핑·축 읽기는 **여기(네트워크 0)** 에 있고 화면 생성은 저쪽에 있다.
 * ```
 */

/* ── 🟢 축 분류를 네트워크 없이 재려면 손으로 만든 입력이 필요하다 ────────── */
const facts = (over: Partial<ProductFacts> = {}): ProductFacts => ({
  sourceUrl: "https://example.com/products/x",
  urlSlug: "x",
  brand: "Bobo Choses",
  brandModelCode: "B226AC009",
  sellerSku: null,
  title: "Hug Hairy Monster T-Shirt",
  coreTitleTokens: ["hug", "hairy", "monster"],
  categoryText: "T-shirt",
  colorText: "Light Blue",
  materialText: "cotton",
  fitText: null,
  ageRangeText: "2-3Y",
  sizeLabels: [],
  audienceSignals: ["kids"],
  imageUrls: [],
  ...over,
});

const cross = (over: Partial<CrossSellerMatch> = {}): CrossSellerMatch => ({
  verdict: "PRESUMED_SAME",
  axes: [],
  conflicts: [],
  blockers: [],
  identifierConfirmed: false,
  reasons: [],
  ...over,
});

describe("CORE-PRICE-SAME-03 ① 원상품 매핑은 «증명» 된다 (추측 금지)", () => {
  const proof = proveOriginJoin();

  it("wu-059 ↔ wu-067 의 원상품 제목이 전건 일치한다 — 이것이 searchId 조인의 근거다", () => {
    const disagreeing = proof.titleAgreement.filter((t) => !t.agrees);
    expect(proof.titleAgreement.length).toBeGreaterThan(0);
    expect(disagreeing, `🔴 제목이 어긋나면 그 sid 의 원상품을 신뢰할 수 없다`).toEqual([]);
  });

  it("같은 후보 id 가 wu-067 · wu-068 · wu-074 에서 같은 URL 을 가리킨다", () => {
    const disagreeing = proof.idAgreement.filter((i) => !i.agrees);
    expect(proof.idAgreement.length).toBeGreaterThan(0);
    expect(disagreeing, "🔴 같은 id 가 다른 URL 이면 세 파일이 같은 체계가 아니다").toEqual([]);
    /** 🔴 세 파일이 **모두** 그 id 를 적었는지도 센다(한 파일만 봐도 agrees 는 참이다). */
    expect(proof.idAgreement.every((i) => i.urls.length === 3)).toBe(true);
  });

  it("searchId → 원상품 품번 매핑이 실제 값이다", () => {
    expect(originJoinIsProven(proof)).toBe(true);
    expect(proof.sidToCode.S1).toBe("B226AC010");
    expect(proof.sidToCode.S2).toBe("B226AC009");
    /** 🔴 S6 은 원상품에 품번이 **없다** — null 이고 그래서 이 화면에 들어오지 않는다. */
    expect(proof.sidToCode.S6).toBeNull();
  });

  /**
   * 🔴🔴 **증명이 깨지면 조인을 쓰지 않는다** 를 단언한다.
   *
   * 🟢 `originJoinIsProven` 에 **조작된 증명** 을 넣어 확인한다 — fixture 를 건드리지
   *    않고도 「전건 일치가 아니면 false」라는 성질을 잠근다.
   */
  it("증명이 하나라도 어긋나면 조인은 사용 불가로 판정된다", () => {
    expect(
      originJoinIsProven({
        ...proof,
        titleAgreement: [...proof.titleAgreement.slice(1), { sid: "S9", wu059Title: "a", wu067Title: "b", agrees: false }],
      }),
    ).toBe(false);
    expect(
      originJoinIsProven({
        ...proof,
        idAgreement: [...proof.idAgreement.slice(1), { id: "S9-1", urls: ["a", "b"], agrees: false }],
      }),
    ).toBe(false);
    /** 🔴 빈 증명을 「문제 없음」으로 읽지 않는다. */
    expect(originJoinIsProven({ ...proof, titleAgreement: [], idAgreement: [] })).toBe(false);
  });
});

describe("CORE-PRICE-SAME-03 ② 분모를 «둘» 로 적는다 (도메인 수 ≠ 매핑 확정 후보 수)", () => {
  const rows = loadSame03GtRows();
  const ac009 = buildSame03Candidates("B226AC009", rows);
  const ac010 = buildSame03Candidates("B226AC010", rows);

  it("원상품이 확정되지 않은 GT 행이 실재하고, 그 행은 버려진다", () => {
    const unknown = rows.filter((r) => r.originBasis === "UNKNOWN");
    expect(unknown.length, "🔴 원상품 미상 행이 0 이면 이 계약이 아무것도 지키지 않는다").toBeGreaterThan(0);
    const keptUrls = new Set([...ac009, ...ac010].map((c) => c.urlKey));
    for (const row of unknown) {
      /** 🔴 미상 행의 URL 이 다른 근거로 들어왔다면 그건 **다른 행** 이 데려온 것이다. */
      const alsoMapped = rows.some((r) => r.urlKey === row.urlKey && r.originBasis !== "UNKNOWN");
      if (!alsoMapped) expect(keptUrls.has(row.urlKey), `🔴 ${row.domain} 은 원상품 미상인데 들어왔다`).toBe(false);
    }
  });

  /**
   * 🔴🔴 **이 단언은 변이가 «뚫은» 자리를 메운 것이다.**
   *
   * 1차 변이 M1(「`originBasis === "UNKNOWN"` 이면 버린다」를 삭제)이 **통과했다.**
   * 원인 — 현재 fixture 에서는 `originBasis === "UNKNOWN"` 과 `originCode === null` 이
   * **항상 같이** 나타나고, 앞의 `originCode !== originCode` 비교가 **먼저** 걸러 버린다
   * ⟹ 그 가드는 **발화한 적이 없다.** 🔴 발화하지 않는 가드는 검증된 가드가 아니다.
   *
   * 🟢 그래서 **합성 행** 으로 직접 찌른다 — 「품번은 적혀 있는데 근거가 UNKNOWN」인
   *    모양이다. 그 모양이 통과하면 **추측으로 붙인 원상품** 이 비교표에 들어간다.
   * 🔴 fixture 를 고치지 않았다(그쪽을 고치면 다른 측정이 흔들린다).
   */
  it("품번이 적혀 있어도 근거가 UNKNOWN 이면 후보로 쓰지 않는다", () => {
    const synthetic = {
      src: "합성",
      url: "https://example.co.kr/product/detail.html?product_no=1",
      urlKey: same03UrlKey("https://example.co.kr/product/detail.html?product_no=1"),
      domain: "example.co.kr",
      originCode: "B226AC009",
      originBasis: "UNKNOWN" as const,
      verdict: "SAME",
      reason: null,
      ceoBasis: null,
      uiLabel: null,
    };
    const withSynthetic = buildSame03Candidates("B226AC009", [...rows, synthetic]);
    expect(
      withSynthetic.some((c) => c.domain === "example.co.kr"),
      "🔴 원상품 근거가 UNKNOWN 인 행이 들어오면 비교 대상이 거짓이 된다",
    ).toBe(false);
    /** 🟢 같은 행의 근거만 바꾸면 **들어온다** — 가드가 근거를 보고 있다는 증거다. */
    const mapped = buildSame03Candidates("B226AC009", [
      ...rows,
      { ...synthetic, originBasis: "ROW_LEVEL" as const },
    ]);
    expect(mapped.some((c) => c.domain === "example.co.kr")).toBe(true);
  });

  it("두 원상품의 후보가 서로 섞이지 않는다", () => {
    expect(ac009.length).toBeGreaterThan(0);
    expect(ac010.length).toBeGreaterThan(0);
    for (const c of ac009) expect(c.originCode).toBe("B226AC009");
    for (const c of ac010) expect(c.originCode).toBe("B226AC010");
    const a = new Set(ac009.map((c) => c.urlKey));
    const overlap = ac010.filter((c) => a.has(c.urlKey));
    expect(overlap.map((c) => c.domain), "🔴 같은 URL 이 두 원상품 섹션에 들어가면 비교가 거짓이다").toEqual([]);
  });

  it("국내가 아닌 후보는 들어오지 않는다", () => {
    for (const c of [...ac009, ...ac010]) expect(c.krBasis).not.toBe("NOT_KR");
  });

  /**
   * 🔴🔴 **지시서의 「국내 11개 도메인」을 그대로 쓰지 않는다** — 그 숫자는
   *    가치 라벨 fixture(`wu-099/100` · 원상품 B226AC112)와 다른 원상품(S6)을 포함한다.
   */
  it("가치 라벨 fixture 의 도메인은 동일상품 GT 로 들어오지 않는다", () => {
    const gtDomains = new Set(rows.filter((r) => r.verdict).map((r) => r.domain));
    for (const d of ["m.web.mustit.co.kr", "littleluna.co.kr", "www.wconcept.co.kr"]) {
      expect(gtDomains.has(d), `🔴 ${d} 는 동일상품 GT 라벨을 가진 적이 없다`).toBe(false);
    }
    /** 🔴 모듈이 그 파일을 **읽지도** 않는다. */
    const src = readFileSync(path.join(__dirname, "core-same03-inventory.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/\/\/.*$/gm, " ");
    expect(src).not.toContain("wu-099");
    expect(src).not.toContain("wu-100");
  });

  it("GT 라벨 없이 올린 후보는 「운영 근거」로 표시되고 라벨 없음으로 남는다", () => {
    expect(SAME03_EXTRA_CANDIDATES.length).toBeGreaterThan(0);
    for (const extra of SAME03_EXTRA_CANDIDATES) {
      const target = extra.originCode === "B226AC009" ? ac009 : ac010;
      const hit = target.find((c) => c.urlKey === same03UrlKey(extra.url));
      expect(hit, `🔴 ${extra.url} 이 화면에서 빠지면 「가격은 있는데 동일상품 0곳」의 실체가 사라진다`).toBeTruthy();
      expect(hit!.unlabeled, "🔴 라벨이 없다는 사실을 숨기지 않는다").toBe(true);
      expect(hit!.priorVerdicts).toEqual([]);
      expect(hit!.addedBecause).toBeTruthy();
    }
    /** 🟢 그 후보가 지금 국내 참고가격의 출처다 — 도메인을 글자로 잠근다. */
    expect(ac009.some((c) => c.domain === "miniboutique.co.kr")).toBe(true);
  });

  it("과거 판정이 서로 달랐던 후보를 «충돌» 로 표시한다", () => {
    const all = [...ac009, ...ac010];
    const conflicted = all.filter((c) => c.verdictConflict).map((c) => c.domain);
    /** 🔴 두 건은 fixture 에 **실재** 하는 충돌이다 — 하나라도 사라지면 계약이 죽는다. */
    expect(conflicted).toContain("global.trenbe.com");
    expect(conflicted).toContain("m.luxboy.com");
    for (const c of all.filter((x) => x.verdictConflict)) {
      expect(c.priorVerdicts.length, "🔴 충돌은 라벨이 둘 이상이어야 성립한다").toBeGreaterThan(1);
    }
    /** 🟢 합의된 건은 충돌이 아니다. */
    const biskuit = ac009.find((c) => c.domain === "biskuit.kr");
    expect(biskuit?.verdictConflict).toBe(false);
    expect(biskuit?.priorVerdicts).toEqual(["SAME"]);
  });

  it("국내 분류 근거가 라벨로 남는다", () => {
    expect(classifySame03Kr("biskuit.kr")).toBe("KR_TLD");
    expect(classifySame03Kr("www.beaumonde.co.kr")).toBe("KR_TLD");
    expect(classifySame03Kr("global.trenbe.com")).toBe("KNOWN_KR_MALL");
    expect(classifySame03Kr("m.luxboy.com")).toBe("KNOWN_KR_MALL");
    expect(classifySame03Kr("donokids.com")).toBe("KNOWN_KR_MALL");
    expect(classifySame03Kr("bobochoses.com")).toBe("NOT_KR");
    expect(classifySame03Kr("cissywears.com")).toBe("NOT_KR");
  });

  it("원상품 URL 은 fixture / 기존 하니스가 쓰는 값이다", () => {
    const c2m = JSON.parse(
      readFileSync(path.join(__dirname, "fixtures", "core-2m-ceo-visual-gt.json"), "utf8"),
    ) as { originUrl: string; originCode: string };
    expect(SAME03_ORIGIN_URL.B226AC009).toBe(c2m.originUrl);
    expect(c2m.originCode).toBe("B226AC009");
    expect(SAME03_ORIGIN_URL.B226AC010).toContain("b226ac010");
    expect(SAME03_ORIGIN_CODES).toEqual(["B226AC009", "B226AC010"]);
  });

  it("[분모 기록] 도메인 수와 매핑 확정 후보 수를 같은 자리에서 센다", () => {
    const domains = new Set([...ac009, ...ac010].map((c) => c.domain));
    console.log(`    AC009 후보 ${ac009.length} · AC010 후보 ${ac010.length} · 국내 도메인 ${domains.size}`);
    console.log(`    도메인: ${[...domains].sort().join(" · ")}`);
    for (const c of [...ac009, ...ac010]) {
      console.log(
        `      ${c.originCode}  ${c.domain.padEnd(22)} ${(c.priorVerdicts.join("|") || "라벨없음").padEnd(18)}` +
          `${c.verdictConflict ? " 🔴충돌" : ""} [${c.sources.join(",")}]`,
      );
    }
    /** 🔴 두 수는 **다르다** — 보고에서 하나로 합치지 않는다. */
    expect(domains.size).not.toBe(ac009.length + ac010.length);
  });
});

describe("CORE-PRICE-SAME-03 ③ 8축 읽기 — 「보지 않았다」를 「몰랐다」로 적지 않는다", () => {
  it("반증으로 조기 종료되면 나머지 축은 NOT_AVAILABLE 이고 그 사실을 적는다", () => {
    const ev = buildSame03Evidence(
      cross({ verdict: "CONFLICT", conflicts: [{ conflict: "MODEL_CODE", detail: "품번 B226AC009 ↔ B226AB040" }] }),
      facts(),
      facts({ brandModelCode: "B226AB040" }),
    );
    expect(ev.earlyReturn, "🔴 conflict + axes 0 이 조기 종료의 정의다").toBe(true);
    const modelCode = ev.rows.find((r) => r.label === "MODEL_CODE")!;
    expect(modelCode.state).toBe("CONFLICT");
    expect(modelCode.from).toBe("CONFLICT");
    const title = ev.rows.find((r) => r.label === "TITLE")!;
    expect(title.state, "🔴 TITLE 은 계산조차 되지 않았다 — UNKNOWN 이 아니다").toBe("NOT_AVAILABLE");
    expect(title.from).toBe("NOT_COMPUTED");
    expect(title.detail).toContain("계산되지 않았습니다");
  });

  it("축이 실제로 계산되면 PASS 와 점수를 그대로 보여준다", () => {
    const ev = buildSame03Evidence(
      cross({
        verdict: "SAME",
        axes: [
          { axis: "TITLE", points: 3, detail: "핵심 상품명 hug/hairy/monster" },
          { axis: "MODEL_CODE", points: 5, detail: "품번 일치" },
        ],
      }),
      facts(),
      facts(),
    );
    const title = ev.rows.find((r) => r.label === "TITLE")!;
    expect(title.state).toBe("PASS");
    expect(title.from).toBe("AXIS");
    expect(title.points).toBe(3);
    expect(title.detail).toBe("핵심 상품명 hug/hairy/monster");
    expect(ev.earlyReturn).toBe(false);
  });

  /**
   * 🔴🔴 `cross-seller.ts` 의 `OBSERVED_DIFFERENCE_BLOCKERS` 가 그은 선을
   *    화면에서도 **유지** 한다 — 「읽었는데 달랐다」 ≠ 「읽지 못했다」.
   */
  it("BRAND_UNCONFIRMED 는 UNKNOWN 이고 BRAND_MISMATCH 는 FAIL 이다", () => {
    const unconfirmed = buildSame03Evidence(
      cross({ blockers: [{ blocker: "BRAND_UNCONFIRMED", detail: "양쪽 브랜드를 확인하지 못했다" }] }),
      facts(),
      facts({ brand: null }),
    ).rows.find((r) => r.label === "BRAND")!;
    expect(unconfirmed.state, "🔴 모름을 FAIL 로 적으면 그 구분이 사라진다").toBe("UNKNOWN");

    const mismatch = buildSame03Evidence(
      cross({ blockers: [{ blocker: "BRAND_MISMATCH", detail: "브랜드 Bobo Choses ↔ 비스킷" }] }),
      facts(),
      facts({ brand: "비스킷" }),
    ).rows.find((r) => r.label === "BRAND")!;
    expect(mismatch.state).toBe("FAIL");
    expect(mismatch.detail).toContain("비스킷");
  });

  it("한쪽에 값이 없으면 UNKNOWN 이 아니라 NOT_AVAILABLE 이다", () => {
    const ev = buildSame03Evidence(cross(), facts(), facts({ materialText: null }));
    const material = ev.rows.find((r) => r.label === "MATERIAL")!;
    expect(material.state).toBe("NOT_AVAILABLE");
    expect(material.detail).toContain("한쪽에 값이 없습니다");
    expect(material.originValue).toBe("cotton");
    expect(material.candidateValue).toBeNull();
  });

  it("지시서의 8축이 전부 있고 IMAGE 는 «계산될 때만» 생긴다", () => {
    const base = buildSame03Evidence(cross(), facts(), facts());
    expect(base.rows.map((r) => r.label)).toEqual([
      "BRAND",
      "TITLE",
      "MODEL_CODE",
      "COLOR",
      "MATERIAL",
      "FIT",
      "GARMENT_FORM",
      "AUDIENCE_LINE",
    ]);
    const withImage = buildSame03Evidence(
      cross({ axes: [{ axis: "IMAGE", points: 2, detail: "이미지 거리 12" }] }),
      facts({ imageUrls: ["https://a/1.jpg"] }),
      facts({ imageUrls: ["https://b/1.jpg"] }),
    );
    expect(withImage.rows.at(-1)!.label).toBe("IMAGE");
    expect(withImage.rows).toHaveLength(9);
  });

  it("공급 문제는 «사실일 때만» 적는다", () => {
    const conflicted = buildSame03Evidence(
      cross({ verdict: "CONFLICT", conflicts: [{ conflict: "MODEL_CODE", detail: "품번 충돌" }] }),
      facts(),
      facts({ brandModelCode: "B226AB040" }),
    );
    const gaps = describeSame03SupplyGaps(conflicted, facts({ imageUrls: [] }), true);
    const labels = gaps.map((g) => g.label);
    /** 🔴 상세설명은 **구조적 부재** 라 항상 적는다. */
    expect(labels).toContain("상세설명");
    expect(labels).toContain("이미지");
    expect(labels).toContain("품번");
    /** 🟢 이미지가 실제로 있으면 그 줄은 나오지 않는다 — 없는 문제를 적지 않는다. */
    const healthy = describeSame03SupplyGaps(
      buildSame03Evidence(cross({ axes: [{ axis: "TITLE", points: 3, detail: "ok" }] }), facts(), facts()),
      facts({ imageUrls: ["https://a/1.jpg"] }),
      false,
    );
    expect(healthy.map((g) => g.label)).not.toContain("이미지");
    expect(healthy.map((g) => g.label)).not.toContain("품번");
  });
});
