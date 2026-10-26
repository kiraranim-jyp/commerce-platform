/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 CORE-PRICE-SAME-03 — **국내 SAME 검토 화면의 «후보 인벤토리»**(순수 · 네트워크 0)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 운영 코드가 **아니다.** `__tests__` 안의 순수 모듈이고 vitest `include` 는
 *    `*.test.ts` 만 수집하므로 이 파일은 **테스트로 실행되지 않는다**(import 전용).
 * 🔴 MI · threshold · priceTier · domesticReference · 가격 pipeline · 셀러 UI
 *    **전부 변경 0** — 이 파일은 **fixture 를 읽어 매핑만** 한다.
 *
 * ── 🔴🔴 왜 이 파일이 따로 있는가 ──────────────────────────────────────────────
 * ```
 * 화면 빌더는 **라이브 네트워크** 를 쓴다(후보 페이지를 실제로 받아야 사진이 뜬다).
 * 그런데 「후보 → 원상품」 매핑이 틀리면 **비교 자체가 거짓** 이 된다 —
 * 원상품이 다른 후보를 한 표에 넣는 것이 그 실패 모양이다.
 * 🟢 그래서 매핑을 **순수 함수로 갈라** 내고 네트워크 0 계약으로 잠근다.
 *    라이브 빌더가 간헐 실패해도 **매핑 계약은 CI 에 상주한다.**
 * ```
 *
 * ── 🔴🔴🔴 START-HERE §9 「구현 제약 ②」를 **실측으로 정정한다** ─────────────
 * ```
 * 지시서: 「wu-059 / wu-067 / wu-074 는 originCode 가 없다 ⟹ 원상품을 알 수 없다」
 * 실측  : 🟢 **네 파일 전부 원상품이 «증명 가능하게» 매핑된다.**
 *   wu-059-gt-facts.json  `origins` 맵이 **searchId → canonicalProduct.sku.value** 다
 *                         (S1=B226AC010 · S2=B226AC009 · S3=B126AI018 · S4=AW26MS185 …)
 *   wu-067 / wu-068 / wu-074  같은 **S<N>** / **S<N>-<M>** 식별자를 쓴다
 * 🔴 그러나 「같은 식별자 체계일 것이다」를 **가정하지 않는다** — 두 축으로 **증명** 한다:
 *   ⒜ wu-059 `origins[sid].title` **==** wu-067 그 sid 의 origin `title`  (6/6 일치)
 *   ⒝ 같은 `id` 가 wu-067 · wu-068 · wu-074 에서 **같은 URL** 을 가리킨다 (19/19 일치)
 * 🔴 그 증명이 깨지면 `proveOriginJoin()` 이 **그 사실을 돌려주고** 계약이 FAIL 한다.
 *    ⟹ 「조용히 틀린 원상품에 붙는 일」이 구조적으로 불가능하다.
 * ```
 *
 * ── 🔴🔴 그리고 「국내 도메인 11개」의 분모를 **둘로 가른다** ─────────────────
 * ```
 * 🔴 지시서의 11 은 **도메인 수** 이고 그 안에 성질이 다른 셋이 섞여 있다:
 *   ⒜ 원상품이 AC009/AC010 이고 **CEO 동일상품 라벨이 있다**      ← 🟢 이 화면의 대상
 *   ⒝ 원상품이 **다른 상품** 이다 (wconcept.co.kr → S6 트랙수트 자켓)
 *   ⒞ **동일상품 라벨이 아예 아니다** — `wu-099/100` 은 USEFUL/NOISE/UNSURE 라는
 *      **가치 라벨** 이고 원상품도 B226AC112 다(CLAUDE.md §12 · WU-102 가 그 분모
 *      오류를 정정했다). miniboutique · mustit · littleluna 가 **거기서만** 나온다
 * 🔴🔴 그래서 이 모듈은 `wu-099/100` 을 **읽지 않는다.** 읽으면 가치 라벨이
 *    동일상품 GT 로 조용히 승격된다 — 이 트랙이 이미 한 번 밟은 분모 오류다.
 * ```
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const FIXTURES = path.join(__dirname, "fixtures");
const readJson = (file: string): unknown =>
  JSON.parse(readFileSync(path.join(FIXTURES, file), "utf8")) as unknown;

/** 🔴 이 화면이 다루는 원상품은 **둘** 이다. 다른 원상품 후보를 섞지 않는다. */
export const SAME03_ORIGIN_CODES = ["B226AC009", "B226AC010"] as const;
export type Same03OriginCode = (typeof SAME03_ORIGIN_CODES)[number];

/**
 * 원상품 URL.
 *
 * 🔴 **지어낸 URL 이 아니다** — 리포의 기존 하니스가 쓰는 그 URL 이다.
 *    AC009 는 `core-2m-ceo-visual-gt.json` 의 `originUrl` 이고(파일이 직접 적어 뒀다),
 *    AC010 은 기존 테스트 전수에서 **28회** 등장하는 공식몰 URL 이다.
 */
export const SAME03_ORIGIN_URL: Record<Same03OriginCode, string> = {
  B226AC009: "https://bobochoses.com/products/b226ac009-hug-hairy-monster-t-shirt",
  B226AC010: "https://bobochoses.com/products/b226ac010-booty-ghosts-t-shirt",
};

/* ══════════════════════════════════════════════════════════════════════════════
   ① 원상품 매핑의 «증명»
   ══════════════════════════════════════════════════════════════════════════════ */

export interface OriginJoinProof {
  /** searchId → 원상품 품번(없으면 null — 그 트랙은 품번이 없는 원상품이다). */
  sidToCode: Record<string, string | null>;
  /** ⒜ wu-059 ↔ wu-067 의 원상품 **제목 일치** 여부(가정이 아니라 증명). */
  titleAgreement: { sid: string; wu059Title: string | null; wu067Title: string | null; agrees: boolean }[];
  /** ⒝ 같은 후보 `id` 가 세 파일에서 **같은 URL** 인가. */
  idAgreement: { id: string; urls: string[]; agrees: boolean }[];
}

/** URL 을 비교 가능한 키로 만든다. 🔴 식별 쿼리는 **보존** 한다(고도몰 `goodsNo` 등). */
export function same03UrlKey(url: string): string {
  try {
    const u = new URL(url);
    return `${u.host.replace(/^www\./, "")}${u.pathname.replace(/\/$/, "")}${u.search}`;
  } catch {
    return url;
  }
}

export function same03Domain(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return "(알 수 없음)";
  }
}

/**
 * 🔴🔴 `searchId` 체계가 **파일 사이에서 같다는 것** 을 증명한다.
 *
 * 🔴 이 함수가 「증명됐다」를 돌려주지 않으면 `loadSame03GtRows()` 는
 *    searchId 매핑 행을 **버린다**(원상품 미상으로 남긴다) — 추측해서 붙이지 않는다.
 */
export function proveOriginJoin(): OriginJoinProof {
  const f59 = readJson("wu-059-gt-facts.json") as {
    origins: Record<string, { canonicalProduct?: { sku?: { value?: string }; title?: { value?: string } } }>;
  };
  const f67 = readJson("wu-067-blind-review-set.json") as Record<
    string,
    { sid: string; title: string; items: { id: string; url: string }[] }
  >;
  const f68 = readJson("wu-068-new-gt.json") as Record<string, { id: string; url: string }>;
  const f74 = readJson("wu-074-probe.json") as Record<string, { url: string }>;

  const sidToCode: Record<string, string | null> = {};
  for (const [sid, origin] of Object.entries(f59.origins)) {
    sidToCode[sid] = origin.canonicalProduct?.sku?.value || null;
  }

  const titleAgreement = Object.values(f67).map((group) => {
    const wu059Title = f59.origins[group.sid]?.canonicalProduct?.title?.value ?? null;
    const wu067Title = group.title ?? null;
    return { sid: group.sid, wu059Title, wu067Title, agrees: Boolean(wu059Title) && wu059Title === wu067Title };
  });

  const byId = new Map<string, string[]>();
  const add = (id: string, url: string) => {
    if (!byId.has(id)) byId.set(id, []);
    byId.get(id)!.push(same03UrlKey(url));
  };
  for (const group of Object.values(f67)) for (const item of group.items) add(item.id, item.url);
  for (const row of Object.values(f68)) add(row.id, row.url);
  for (const [id, probe] of Object.entries(f74)) add(id, probe.url);

  const idAgreement = [...byId].map(([id, urls]) => ({
    id,
    urls,
    agrees: new Set(urls).size === 1,
  }));

  return { sidToCode, titleAgreement, idAgreement };
}

/** 🟢 위 두 축이 **전건** 일치할 때만 searchId 매핑을 신뢰한다. */
export function originJoinIsProven(proof: OriginJoinProof = proveOriginJoin()): boolean {
  return (
    proof.titleAgreement.length > 0 &&
    proof.titleAgreement.every((t) => t.agrees) &&
    proof.idAgreement.length > 0 &&
    proof.idAgreement.every((i) => i.agrees)
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   ② GT 행 적재 — 🔴 원상품 근거를 «행마다» 적는다
   ══════════════════════════════════════════════════════════════════════════════ */

/** 원상품을 무엇으로 알아냈는가. 🔴 화면과 보고에 **그대로** 적는다. */
export type Same03OriginBasis =
  /** 파일 상단이 `originCode` 를 직접 적어 뒀다(`core-2m`). */
  | "FILE_LEVEL"
  /** 행이 `originCode` 를 직접 들고 있다(`wu-112` · `wu-116` · `wu-111`). */
  | "ROW_LEVEL"
  /** `searchId` → `wu-059.origins` 조인(🔴 `originJoinIsProven()` 일 때만 쓴다). */
  | "SEARCH_ID_JOIN"
  /** 🔴 알 수 없다 — 원상품 섹션에 **넣지 않는다**. */
  | "UNKNOWN";

export interface Same03GtRow {
  src: string;
  url: string;
  urlKey: string;
  domain: string;
  originCode: string | null;
  originBasis: Same03OriginBasis;
  /** CEO 동일상품 라벨(SAME · DIFFERENT · UNCERTAIN). 🔴 없으면 null 이다. */
  verdict: string | null;
  /** CEO 가 적은 사유. 🔴 없으면 null — 지어내지 않는다. */
  reason: string | null;
  /** `core-2m` 이 보존한 「무엇을 보고 판단했는가」. */
  ceoBasis: string | null;
  /** CEO UI 가 실제로 제시한 낱말(동일 · 유사 · 판단불가). */
  uiLabel: string | null;
}

/**
 * 동일상품 GT 를 들고 있는 fixture **전수** 를 읽는다.
 *
 * 🔴 `wu-099/100`(가치 라벨)은 **읽지 않는다** — 위 머리 주석 ⒞ 참고.
 * 🔴 `wu-074-probe.json` 은 HTTP probe 결과뿐이고 **라벨이 없다** ⟹ GT 가 아니다
 *    (origin 조인의 **증명 재료** 로만 쓴다).
 */
export function loadSame03GtRows(): Same03GtRow[] {
  const proof = proveOriginJoin();
  const joinUsable = originJoinIsProven(proof);
  const rows: Same03GtRow[] = [];

  const push = (
    src: string,
    url: string,
    originCode: string | null,
    originBasis: Same03OriginBasis,
    extra: Partial<Pick<Same03GtRow, "verdict" | "reason" | "ceoBasis" | "uiLabel">> = {},
  ) => {
    rows.push({
      src,
      url,
      urlKey: same03UrlKey(url),
      domain: same03Domain(url),
      originCode,
      originBasis,
      verdict: extra.verdict ?? null,
      reason: extra.reason ?? null,
      ceoBasis: extra.ceoBasis ?? null,
      uiLabel: extra.uiLabel ?? null,
    });
  };

  /* ── core-2m — 🟢 1순위 소스다(`ceoBasis` 까지 들고 있는 유일한 fixture) ── */
  const c2m = readJson("core-2m-ceo-visual-gt.json") as {
    originCode: string;
    candidates: { url: string; calibrationLabel: string; ceoUiLabel: string; ceoBasis: string }[];
  };
  for (const c of c2m.candidates) {
    push("core-2m", c.url, c2m.originCode, "FILE_LEVEL", {
      verdict: c.calibrationLabel,
      ceoBasis: c.ceoBasis,
      uiLabel: c.ceoUiLabel,
    });
  }

  /* ── wu-112 — 행 단위 originCode ─────────────────────────────────────────── */
  const f112 = readJson("wu-112-human-gt.json") as {
    candidates: { originCode: string; url: string; verdict: string; reason: string | null }[];
  };
  for (const c of f112.candidates) {
    push("wu-112", c.url, c.originCode, "ROW_LEVEL", { verdict: c.verdict, reason: c.reason });
  }

  /* ── wu-116 — 🔴 이 행의 원상품은 **B226AC010** 이다(지시서의 「AC009」는 틀렸다) ── */
  const f116 = readJson("wu-116-human-gt.json") as {
    candidates: { originCode: string; url: string; humanVerdict: string }[];
  };
  for (const c of f116.candidates) {
    push("wu-116", c.url, c.originCode, "ROW_LEVEL", { verdict: c.humanVerdict });
  }

  /* ── wu-111 — 행 단위 originCode ─────────────────────────────────────────── */
  const f111 = readJson("wu-111-human-gt.json") as {
    candidates: { originCode: string; url: string; humanVerdict?: string; verdict?: string }[];
  };
  for (const c of f111.candidates) {
    push("wu-111", c.url, c.originCode, "ROW_LEVEL", { verdict: c.humanVerdict ?? c.verdict ?? null });
  }

  /* ── wu-059 · wu-068 — searchId 조인(🔴 증명됐을 때만) ──────────────────── */
  const f59 = readJson("wu-059-gt-facts.json") as {
    candidates: Record<string, { searchId: string; url: string; humanGt: string; humanReason: string | null }>;
  };
  for (const c of Object.values(f59.candidates)) {
    const code = joinUsable ? (proof.sidToCode[c.searchId] ?? null) : null;
    push("wu-059", c.url, code, code ? "SEARCH_ID_JOIN" : "UNKNOWN", {
      verdict: c.humanGt,
      reason: c.humanReason,
    });
  }
  const f68 = readJson("wu-068-new-gt.json") as Record<
    string,
    { searchId: string; url: string; gt: string; why: string | null }
  >;
  for (const c of Object.values(f68)) {
    const code = joinUsable ? (proof.sidToCode[c.searchId] ?? null) : null;
    push("wu-068", c.url, code, code ? "SEARCH_ID_JOIN" : "UNKNOWN", { verdict: c.gt, reason: c.why });
  }

  return rows;
}

/* ══════════════════════════════════════════════════════════════════════════════
   ③ 「국내」 분류 — 🔴 근거를 **라벨로** 남긴다
   ══════════════════════════════════════════════════════════════════════════════ */

/**
 * 🔴 운영 `classifyCandidateMarket` 과 **다른 목적** 이다 — 그 함수는 **가격 귀속**
 *    판정이고 통화를 요구한다. 여기서 필요한 것은 「이 후보를 국내 검토 화면에
 *    **올릴 것인가**」라는 **화면 선별** 이다.
 * 🔴 그래서 운영 함수를 **고치거나 흉내내지 않고** 선별 근거를 따로 적는다.
 *    화면에는 운영 판정값을 **같이** 보여준다(그쪽이 가격 자격의 주인이다).
 */
export type Same03KrBasis = "KR_TLD" | "KNOWN_KR_MALL" | "NOT_KR";

/**
 * 🔴 `.kr` 이 아닌데 한국 쇼핑몰인 호스트는 **수기 지정** 이다. 그 사실을 숨기지 않는다 —
 *    화면에 「한국 쇼핑몰(수기 지정)」으로 적는다.
 * 🟢 셋 다 이 트랙의 기존 측정에서 **한국 판매처로 다뤄진 호스트** 다
 *    (`global.trenbe.com` 리세일 · `m.luxboy.com` · `www.donokids.com` 고도몰).
 */
const KNOWN_KR_MALLS: ReadonlySet<string> = new Set(["global.trenbe.com", "m.luxboy.com", "donokids.com"]);

export function classifySame03Kr(domain: string): Same03KrBasis {
  const d = domain.trim().toLowerCase().replace(/\.$/, "");
  if (d === "kr" || d.endsWith(".kr")) return "KR_TLD";
  if (KNOWN_KR_MALLS.has(d.replace(/^www\./, ""))) return "KNOWN_KR_MALL";
  return "NOT_KR";
}

/* ══════════════════════════════════════════════════════════════════════════════
   ④ 후보 통합 — 🔴 **라벨 충돌을 합치지 않는다**
   ══════════════════════════════════════════════════════════════════════════════ */

export interface Same03Candidate {
  urlKey: string;
  url: string;
  domain: string;
  originCode: Same03OriginCode;
  krBasis: Same03KrBasis;
  /** 이 후보를 적은 fixture 들. */
  sources: string[];
  originBases: Same03OriginBasis[];
  /** 과거 CEO 라벨 **전부**(중복 제거). 🔴 둘 이상이면 충돌이다. */
  priorVerdicts: string[];
  priorReasons: string[];
  ceoBasis: string | null;
  uiLabels: string[];
  /** 🔴🔴 과거 판정이 서로 달랐다 — CEO 가 **꼭 다시 봐야 하는 건** 이다. */
  verdictConflict: boolean;
  /** GT 라벨이 하나도 없다(화면에 「이전 판정 없음」으로 적는다). */
  unlabeled: boolean;
  /** 🔴 GT 가 아니라 **운영 근거** 로 넣은 후보인가(아래 `SAME03_EXTRA_CANDIDATES`). */
  addedBecause: string | null;
}

/**
 * 🔴🔴 **GT 라벨이 없는데도 화면에 반드시 올려야 하는 후보** (START-HERE §9).
 *
 * `miniboutique.co.kr` 은 **지금 화면의 「🇰🇷 국내 참고가격 KRW 88,000」 출처** 다.
 * 🔴 그런데 동일상품 GT 가 **없다** — 즉 「가격은 있는데 동일상품 0곳」이라는 상태의
 *    실체가 이 후보다. 그래서 CEO 가 **꼭** 봐야 한다.
 * 🔴 직전 빌드에서 `UNREACHABLE` 이었다 ⟹ 🟢 **빼지 말고** 「페이지를 읽지 못했습니다
 *    (측정불가)」로 **표시** 한다. 「후보가 없다」와 「읽지 못했다」는 다른 문장이다.
 * 🔴 URL 은 지어내지 않았다 — `core-2m-visual-review-build.test.ts:50` 의 그 상수다.
 */
export const SAME03_EXTRA_CANDIDATES: {
  url: string;
  originCode: Same03OriginCode;
  addedBecause: string;
}[] = [
  {
    url: "https://miniboutique.co.kr/product/detail.html?product_no=4117&cate_no=1&display_group=1",
    originCode: "B226AC009",
    addedBecause: "현재 🇰🇷 국내 참고가격(KRW 88,000)의 출처인데 동일상품 GT 라벨이 없다",
  },
];

/**
 * 원상품 하나에 대한 **국내 후보 목록** 을 만든다.
 *
 * 🔴 `originCode` 가 확정되지 않은 행은 **버린다** — 원상품이 다른 후보를 한 비교표에
 *    넣으면 그 비교는 거짓이다(START-HERE §9 제약 ②가 지목한 그 실패).
 */
export function buildSame03Candidates(
  originCode: Same03OriginCode,
  rows: Same03GtRow[] = loadSame03GtRows(),
): Same03Candidate[] {
  const byUrl = new Map<string, Same03Candidate>();

  const ensure = (url: string, addedBecause: string | null): Same03Candidate => {
    const urlKey = same03UrlKey(url);
    let hit = byUrl.get(urlKey);
    if (!hit) {
      const domain = same03Domain(url);
      hit = {
        urlKey,
        url,
        domain,
        originCode,
        krBasis: classifySame03Kr(domain),
        sources: [],
        originBases: [],
        priorVerdicts: [],
        priorReasons: [],
        ceoBasis: null,
        uiLabels: [],
        verdictConflict: false,
        unlabeled: true,
        addedBecause,
      };
      byUrl.set(urlKey, hit);
    }
    return hit;
  };

  for (const row of rows) {
    if (row.originCode !== originCode) continue;
    if (row.originBasis === "UNKNOWN") continue;
    if (classifySame03Kr(row.domain) === "NOT_KR") continue;
    const c = ensure(row.url, null);
    if (!c.sources.includes(row.src)) c.sources.push(row.src);
    if (!c.originBases.includes(row.originBasis)) c.originBases.push(row.originBasis);
    if (row.verdict && !c.priorVerdicts.includes(row.verdict)) c.priorVerdicts.push(row.verdict);
    if (row.reason && !c.priorReasons.includes(row.reason)) c.priorReasons.push(row.reason);
    if (row.uiLabel && !c.uiLabels.includes(row.uiLabel)) c.uiLabels.push(row.uiLabel);
    /** 🟢 `ceoBasis` 는 `core-2m` 만 들고 있다 — 먼저 적힌 것을 덮지 않는다. */
    if (row.ceoBasis && !c.ceoBasis) c.ceoBasis = row.ceoBasis;
  }

  for (const extra of SAME03_EXTRA_CANDIDATES) {
    if (extra.originCode !== originCode) continue;
    const c = ensure(extra.url, extra.addedBecause);
    if (!c.sources.includes("운영 근거")) c.sources.push("운영 근거");
    if (!c.originBases.includes("FILE_LEVEL")) c.originBases.push("FILE_LEVEL");
    c.addedBecause = extra.addedBecause;
  }

  for (const c of byUrl.values()) {
    c.verdictConflict = c.priorVerdicts.length > 1;
    c.unlabeled = c.priorVerdicts.length === 0;
  }

  return [...byUrl.values()].sort((a, b) => a.domain.localeCompare(b.domain) || a.urlKey.localeCompare(b.urlKey));
}
