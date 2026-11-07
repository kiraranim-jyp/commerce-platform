/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 DESC-COMPARE — **원상품 ↔ 후보 상세설명을 나란히 비교하고**
 *                        **최초 판단 대비 변화를 측정한다**(CPO 공식 작업지시서)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 운영 코드 · 추출기 · matcher · Identity · alias · GT · DB · schema · UI **변경 0**
 *    **DB 쓰기 0** · **운영 함수 호출 0** · **외부 URL 재방문 0**(기존 확보 원문만 읽는다).
 *
 * 🔴🔴 **shadow 다 — 운영 판정 변경이 아니다.** 그래서 어휘를 **분리** 한다:
 * ```
 * 운영 verdict   SAME · PRESUMED_SAME · SIMILAR · UNKNOWN · CONFLICT   ← 건드리지 않는다
 * 이 파일 산출   SHADOW_STRONG_SAME · SHADOW_LIKELY_SAME · SHADOW_LIKELY_SIMILAR ·
 *                SHADOW_LIKELY_DIFFERENT · SHADOW_NEEDS_REVIEW · SHADOW_UNDECIDABLE
 * ```
 * 🔴 메모 `guard-blocking-my-name-means-the-name-collides` — 같은 이름이 두 개를 가리키면
 *    다음 사람이 「여기서 판정이 일어난다」고 읽는다. 그래서 `SHADOW_` 접두를 **뗀 적이 없다**.
 *
 * 🔴🔴 **분모를 섞지 않는다**(CPO 명시):
 * ```
 * 행 190 ≠ 고유 후보 URL 95 ≠ 고유 원상품 URL 27 ≠ 고유 (원상품,후보) 쌍 109
 *        ≠ 설명문 둘 다 확보 82 ≠ GT 보유 쌍 33 ≠ BRAND 누락 62 ≠ GT 확대 대상 21
 * ```
 *
 * 🔴 **「이미 알고 있던 정보」와 「새로 발견한 정보」를 가른다** — 중복 계산 금지(CPO 검토 ①).
 *    기준은 조사 당시 저장한 baseline facts 칸이다(`brandBefore` · `codeBefore` · `nameBefore`).
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const DIR = path.join(os.tmpdir(), "mi-url-evidence");
const s2 = JSON.parse(readFileSync(path.join(DIR, "step2-evidence.json"), "utf8")).rows;
const pr = (o) => JSON.stringify(o, null, 1);
const p = new PrismaClient();
const lit = (s) => `'${String(s).replace(/'/g, "''")}'`;

/* ═══════ 공통 전처리 — 기존 운영 전처리와 같은 축만 쓴다 ═══════════════════ */
const NFKC = (s) => String(s ?? "").normalize("NFKC");
const low = (s) => NFKC(s).toLowerCase();
/** 🔴 `{value,source,confidence}` 래퍼 — canonicalProduct 의 **모든** 칸이 이 모양이다. */
const V = (x) => (x && typeof x === "object" && !Array.isArray(x) && "value" in x ? x.value : x) ?? "";
const txt = (x) => String(V(x) ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const hasHangul = (s) => /[가-힣]/.test(String(s));
const hasLatinWord = (s) => /[a-z]{3,}/i.test(String(s));
const excerpt = (hay, re, pad = 50) => {
  const m = re.exec(NFKC(hay));
  if (!m) return null;
  const i = Math.max(0, m.index - pad);
  return NFKC(hay).slice(i, m.index + m[0].length + pad).replace(/\s+/g, " ").trim();
};

/** 🔴 축 상태 어휘는 CPO 지시서 그대로 **넷** 이다. 늘리지 않는다. */
const MATCH = "MATCH", MISMATCH = "MISMATCH", UNKNOWN = "UNKNOWN", NA = "NOT_APPLICABLE";

/* ═══════ 사전 — 🔴 전부 **관측된 어휘** 다. 새 분류 체계를 만들지 않는다 ════ */
const FORM_FAMILIES = [
  ["TSHIRT", /t[-\s]?shirts?\b|티셔츠|\btee\b|반팔티|긴팔티/i],
  ["SWEATSHIRT", /sweat[-\s]?shirts?\b|스웨트셔츠|맨투맨|트레이닝\s?셔츠/i],
  ["HOODIE", /hoodie|후드/i],
  ["CARDIGAN", /cardigan|가디건/i],
  ["JACKET", /jackets?\b|anorak|아노락|자켓|재킷|점퍼|windbreaker|바람막이/i],
  ["PANTS", /pants|trousers|팬츠|바지|leggings?|레깅스|denim/i],
  ["SHORTS", /shorts\b|반바지/i],
  ["DRESS", /dress(?:es)?\b|원피스|tuniques?\b|tunics?\b|튜닉/i],
  ["CAP", /\bcaps?\b|\bhats?\b|모자|비니|beanie/i],
  ["SOCKS", /socks\b|양말/i],
  ["SHOES", /shoes\b|sneakers?\b|신발|슈즈|부츠|boots\b/i],
  ["BAG", /\bbags?\b|가방|백팩|backpack/i],
  ["BIB", /\bbibs?\b|턱받이/i],
  ["BODYSUIT", /bodysuit|우주복|romper|바디수트/i],
  ["SCARF", /scarf|머플러|스카프|bandana|반다나/i],
];
const SLEEVE = [["LONG", /long[-\s]?sleeve|긴팔|긴소매/i], ["SHORT", /short[-\s]?sleeve|반팔|반소매/i]];
const COLOR_FAMILIES = [
  ["BLACK", /\bblack\b|블랙|검정|검은/i],
  ["WHITE", /\bwhite\b|화이트|흰/i],
  ["CREAM", /\becru\b|\bcream\b|off[-\s]?white|오프화이트|에크루|크림|아이보리|ivory/i],
  ["GREY", /\bgrey\b|\bgray\b|그레이|회색|melange|멜란지/i],
  ["NAVY", /\bnavy\b|네이비|감색/i],
  ["BLUE", /\bblue\b|블루|파랑|파란/i],
  ["GREEN", /\bgreen\b|그린|초록|카키|khaki/i],
  ["RED", /\bred\b|레드|빨강|burgundy|버건디|와인/i],
  ["PINK", /\bpink\b|핑크|분홍|lavender|라벤더/i],
  ["YELLOW", /\byellow\b|옐로|노랑|mustard|머스타드/i],
  ["BROWN", /\bbrown\b|브라운|갈색|\btan\b|베이지|beige|camel/i],
  ["PURPLE", /\bpurple\b|퍼플|보라/i],
  ["ORANGE", /\borange\b|오렌지|주황/i],
];
const FIBERS = [
  ["COTTON", /cotton|코튼|면\b/i], ["POLYESTER", /polyester|폴리에스터|폴리에스테르/i],
  ["WOOL", /\bwool\b|울\b|모\b|merino/i], ["ELASTANE", /elastane|spandex|엘라스탄|스판/i],
  ["NYLON", /nylon|나일론|polyamide|폴리아미드/i], ["LINEN", /linen|리넨|린넨/i],
  ["VISCOSE", /viscose|비스코스|rayon|레이온/i], ["CASHMERE", /cashmere|캐시미어/i],
  ["ACRYLIC", /acrylic|아크릴/i], ["LEATHER", /leather|가죽/i],
];
/** 🔴 소재 **표기 수식어** — 이것이 다르다는 이유로 MISMATCH 를 내지 않는다. */
const FIBER_MODIFIER = /organic|recycled|오가닉|유기농|리사이클|재생/i;
const AUDIENCE = [["BABY", /\bbaby\b|베이비|유아|신생아|newborn/i], ["KIDS", /\bkids?\b|children|키즈|아동|주니어|junior/i], ["ADULT", /\badult\b|성인|men'?s|women'?s/i]];
const SET_RE = /\bsets?\b|세트|구성품|\d\s?pcs\b|\d종\s?구성/i;
/** 🔴 상품명 비교에서 **식별력이 없는** 토큰 — 이것만 겹쳐도 MATCH 로 쓰지 않는다. */
const GENERIC = new Set(["the", "and", "for", "with", "in", "of", "by", "a", "an", "kids", "kid", "baby", "child",
  "children", "junior", "new", "fw26", "ss26", "fw25", "ss25", "26fw", "25fw", "aw26", "organic", "cotton", "recycled",
  "t", "tshirt", "shirt", "tee", "sweatshirt", "jacket", "pants", "dress", "cap", "hat", "socks", "shorts", "set",
  "unisex", "boy", "girl", "boys", "girls", "collection", "color", "colour", "size", "made", "shop", "official"]);

const families = (dict, s) => dict.filter(([, re]) => re.test(NFKC(s))).map(([k]) => k);
const tokens = (s) => low(s).split(/[^a-z0-9가-힣]+/).filter((t) => t.length >= 2 && !GENERIC.has(t));
const CODE_RE = /\b[A-Z]{1,3}\d{2,3}[A-Z]{1,3}\d{2,4}\b/gi;      // B226AC009 · WK21A165 · LM26KSJAC…
const normCode = (c) => low(c).replace(/[^a-z0-9]/g, "");
/**
 * 🔴🔴 **코드 «가족» 서명** — 판매처 자체 코드를 제조사 품번 불일치로 적지 않기 위해 쓴다.
 * ```
 * B226AC009        → L1D3L2D3
 * BB26KSSSTC142311 → L2D2L6D6   ← 🔴 같은 가족이 아니다 ⟹ 「불일치」로 세지 않는다
 * ```
 * 🔴 메모 `candidate-code-path-ignores-the-title` — 승격하면 판매처 SKU 가 품번이 된다.
 */
const codeShape = (c) => (normCode(c).match(/[a-z]+|[0-9]+/g) ?? [])
  .map((s) => (/[a-z]/.test(s) ? "L" : "D") + s.length).join("");
/**
 * 🟢 **원상품 코드를 기준으로 후보 원문을 찾는다** — 운영 `confirmBrandCodeInEvidence` 의 성질이다
 *    (건초더미 = title + url + sku). 🔴 그리고 **접두 1자 생략형** 을 같이 본다:
 *    실측 — 후보 제목이 「… sweatshirt **#226AC036**」 로 `B` 를 빼고 적는다.
 */
function originCodeInText(originCode, hay) {
  const o = normCode(originCode);
  if (o.length < 6) return null;
  const sep = "[^a-z0-9]{0,2}";
  const build = (s) => new RegExp(s.split("").join(sep), "i");
  const h = NFKC(hay);
  if (build(o).test(h)) return { via: "품번 전체 일치", form: originCode };
  const tail = o.slice(1);                       // 🔴 접두 1자 생략형만 허용한다(2자 이상은 위험)
  if (/^[a-z]/.test(o) && build(tail).test(h)) return { via: "접두 1자 생략형 일치(예 B226AC036 ↔ 226AC036)", form: tail };
  return null;
}
/** 🔴 축 ↔ 운영 blocker 어휘 대응 — 「최초 판단에서 무엇이 막혀 있었나」의 **운영 근거** 다. */
const AXIS_BLOCKERS = {
  BRAND: ["BRAND_MISMATCH", "BRAND_UNCONFIRMED"],
  MODEL_CODE: ["MODEL_CODE", "MODEL_CODE_AGE_LINE"],
  PRODUCT_NAME: ["NO_TITLE_OVERLAP"],
  FORM_DESIGN: ["GARMENT_FORM"],
  COLOR: ["COLOR", "COLOR_VARIANT"],
  MATERIAL: ["MATERIAL"],
  AUDIENCE_AGE: ["AUDIENCE_LINE"],
  SIZE_FIT: ["FIT"],
  SET_OPTION: [],
  IMAGE: [],
};

/** 🟢 브랜드 귀속 — STEP 3A-R 의 술어를 **그대로** 쓴다(새 규칙 0). */
const WORDISH = /[A-Za-z0-9가-힣]/;
const PARTICLES = ["으로", "에서", "부터", "까지", "에게", "한테", "은", "는", "이", "가", "을", "를", "의", "에", "와", "과", "도", "만", "로"];
function brandHits(hay, brand) {
  if (!brand) return [];
  const raw = NFKC(hay), text = raw.toLowerCase();
  const parts = low(brand).split(/[^a-z0-9가-힣]+/).filter(Boolean);
  if (!text || !parts.length) return [];
  const re = new RegExp(parts.map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("[\\s\\-_.]*"), "g");
  const out = [];
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const end = m.index + m[0].length;
    if (m.index > 0 && WORDISH.test(text[m.index - 1])) continue;
    const after = text[end] ?? "";
    if (after && WORDISH.test(after)) {
      const okParticle = [...PARTICLES].sort((a, b) => b.length - a.length).some((pt) => {
        if (!text.startsWith(pt, end)) return false;
        const nx = text[end + pt.length] ?? "";
        return !nx || !WORDISH.test(nx);
      });
      if (!okParticle) continue;
    }
    out.push({ index: m.index, matched: raw.slice(m.index, end) });
  }
  return out;
}
const LABEL_RE = /(brand|브랜드)\s*[:：]\s*$/i;
const ATTRIB_LEAD = /\b(by|from|collection)\s*$/i;
const roleOf = (text, i) => {
  const before = low(text).slice(Math.max(0, i - 20), i);
  if (LABEL_RE.test(before)) return "라벨(Brand:)";
  if (ATTRIB_LEAD.test(before)) return "귀속문구(by/from/collection)";
  return null;
};

/* ═══════ 데이터 로드 ══════════════════════════════════════════════════════ */
const originUrls = [...new Set(s2.map((r) => r.originUrl).filter(Boolean))];
const snapRows = await p.$queryRawUnsafe(`
  select source_url, title, workspace->'canonicalProduct' cp, created_at
    from product_snapshots
   where source_url in (${originUrls.map(lit).join(",")}) and workspace ? 'canonicalProduct'
   order by created_at desc`);
/** 🔴 같은 원상품 URL 의 스냅샷이 여럿이면 **최신 하나** 를 쓴다(반복 스냅샷 중복 제거). */
const originByUrl = new Map();
for (const r of snapRows) if (!originByUrl.has(r.source_url)) originByUrl.set(r.source_url, r);

/** 🔴 쌍 단위 — 같은 (원상품URL, 후보URL) 의 반복 행은 **하나** 로 접는다. */
const pairs = new Map();
for (const r of s2) {
  const k = `${r.originUrl ?? "?"} >> ${r.candidateUrl}`;
  const cur = pairs.get(k);
  /** 설명문이 있는 행 · GT 가 있는 행을 우선 보존한다. */
  const score = (x) => (x?.descriptionRaw ? 2 : 0) + (x?.ceoGt ? 1 : 0);
  if (!cur || score(r) > score(cur)) pairs.set(k, { ...r, _dupes: (cur?._dupes ?? 0) + 1 });
  else pairs.set(k, { ...cur, _dupes: (cur._dupes ?? 0) + 1 });
}
const PAIRS = [...pairs.values()];

/* ═══════ 축 비교기 ═══════════════════════════════════════════════════════ */
function compare(pair) {
  const snap = originByUrl.get(pair.originUrl);
  const cp = snap?.cp ?? null;
  const oTitle = txt(cp?.title) || String(snap?.title ?? "");
  const oDesc = [txt(cp?.description), txt(cp?.descriptionKo)].filter(Boolean).join(" ‖ ");
  const oText = `${oTitle} ${oDesc}`;
  const cTitle = String(pair.liveTitle ?? pair.baselineTitle ?? "");
  const cDesc = String(pair.descriptionRaw ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const cText = `${cTitle} ${cDesc}`;
  const axes = {};
  const put = (k, status, reason, extra = {}) => { axes[k] = { status, reason, ...extra }; };

  /* ── BRAND ── 🔴 판매처명은 브랜드 증거가 아니다(원칙 ⒞). */
  const oBrand = txt(cp?.brand) || String(pair.originBrand ?? "");
  if (!oBrand) put("BRAND", UNKNOWN, "원상품 브랜드가 비어 있다 — 비교 자체가 성립하지 않는다");
  else if (!cText.trim()) put("BRAND", UNKNOWN, "후보 원문이 없다");
  else {
    const hits = brandHits(cText, oBrand);
    const withRole = hits.map((h) => ({ h, role: roleOf(cText, h.index) })).find((x) => x.role);
    const inTitle = brandHits(cTitle, oBrand).length > 0;
    const where = inTitle ? "TITLE" : hits.length ? "DESCRIPTION" : null;
    if (withRole) put("BRAND", MATCH, `브랜드 자리에서 확인 — ${withRole.role}`, {
      where, originEvidence: oBrand, candidateExcerpt: excerpt(cText, new RegExp(low(oBrand).split(/\s+/)[0], "i")),
    });
    else if (hits.length) put("BRAND", MATCH, "브랜드 문자열 확인(귀속 문구 없음 — 약한 근거)", {
      where, weak: true, originEvidence: oBrand, candidateExcerpt: excerpt(cText, new RegExp(low(oBrand).split(/\s+/)[0], "i")),
    });
    else put("BRAND", UNKNOWN, "후보 원문에 원상품 브랜드 문자열이 없다 — 🔴 «불일치» 로 적지 않는다", { originEvidence: oBrand });
  }

  /* ── MODEL_CODE ── 🔴 핵심 식별 축. 보조 차이로 덮지 않는다(CPO 규칙).
   * 🔴🔴 `codeBefore`/`codeAfter` 를 **쓰지 않는다** — 그 칸은 **상태 문자열** 이다
   *    (`MATCH`/`MISMATCH`/`UNKNOWN`/`NOT_AVAILABLE`). 1차 구현이 그것을 후보 품번으로
   *    넣어 「서로 다른 품번(B226AC009 ↔ UNKNOWN)」이라는 **거짓 불일치 50건** 을 만들었다. */
  const oCodes = [...new Set([pair.originCode, ...(pair.originCodes ?? []), txt(cp?.sku)]
    .filter(Boolean).map(String))].filter((c) => normCode(c).length >= 6 && /\d/.test(c) && /[a-z]/i.test(c));
  /** 🟢 후보 품번 후보값 — **값인 칸만** 쓴다(운영 추출기 산출 + 원문 매치). */
  const cHay = `${cTitle} ${cDesc} ${pair.candidateUrl ?? ""}`;
  const cCodeFields = [pair.liveModelCode, ...(pair.evidenceCodeValues ?? [])].filter(Boolean).map(String);
  const cTextCodes = [...new Set((cHay.match(CODE_RE) ?? []).map(String))];
  const cCodes = [...new Set([...cCodeFields, ...cTextCodes])].filter((c) => normCode(c).length >= 6);
  if (!oCodes.length) put("MODEL_CODE", UNKNOWN, "원상품 품번이 없다 — 🔴 `canonicalProduct.sku` 는 27 URL 중 **5** 만 채워져 있다");
  else {
    const o0 = oCodes[0];
    const exact = oCodes.find((o) => cCodes.some((c) => normCode(o) === normCode(c)));
    const inHay = exact ? null : oCodes.map((o) => ({ o, hit: originCodeInText(o, cHay) })).find((x) => x.hit);
    if (exact) {
      const inTitle = Boolean(originCodeInText(exact, cTitle));
      const inUrl = Boolean(originCodeInText(exact, String(pair.candidateUrl ?? "")));
      put("MODEL_CODE", MATCH, "제조사 품번이 정확히 일치한다", {
        where: inTitle ? "TITLE" : inUrl ? "URL" : "STRUCTURED_DATA",
        originEvidence: exact, candidateEvidence: exact, candidateExcerpt: excerpt(cHay, new RegExp(normCode(exact).split("").join("[^a-z0-9]{0,2}"), "i")),
      });
    } else if (inHay) {
      put("MODEL_CODE", MATCH, `원상품 품번이 후보 원문에서 확인된다 — ${inHay.hit.via}`, {
        where: originCodeInText(inHay.o, cTitle) ? "TITLE" : originCodeInText(inHay.o, String(pair.candidateUrl ?? "")) ? "URL" : "DESCRIPTION",
        originEvidence: inHay.o, candidateEvidence: inHay.hit.form,
        candidateExcerpt: excerpt(cHay, new RegExp(inHay.hit.form.split("").join("[^a-z0-9]{0,2}"), "i")),
      });
    } else if (!cCodes.length) {
      put("MODEL_CODE", UNKNOWN, "후보 원문·운영 추출값 어디에도 품번 모양이 없다", { originEvidence: o0 });
    } else {
      /** 🔴🔴 **같은 «가족» 일 때만 불일치로 적는다.** 모양이 다르면 판매처 자체 코드다. */
      const sameFamily = cCodes.filter((c) => codeShape(c) === codeShape(o0));
      if (!sameFamily.length) {
        put("MODEL_CODE", UNKNOWN, `후보 코드가 **다른 코드 체계** 다(${codeShape(o0)} ↔ ${cCodes.map(codeShape).join("/")}) — 🔴 판매처 자체 코드일 수 있어 «제조사 품번 불일치» 로 적지 않는다`,
          { originEvidence: o0, candidateEvidence: cCodes.slice(0, 3), sellerOwnCodeSuspected: true });
      } else {
        const near = sameFamily.find((c) => normCode(c).slice(0, 4) === normCode(o0).slice(0, 4));
        put("MODEL_CODE", MISMATCH, near
          ? `같은 품번 체계에서 공통 접두 4자 뒤 분기 — 품번 충돌(${o0} ↔ ${near})`
          : `같은 품번 체계인데 값이 다르다(${o0} ↔ ${sameFamily[0]})`,
          { where: "TITLE", originEvidence: o0, candidateEvidence: near ?? sameFamily[0], conflict: Boolean(near) });
      }
    }
  }

  /* ── PRODUCT_NAME ── 🔴 번역/표기 차이를 불일치로 적지 않는다. */
  const bt = new Set(tokens(oBrand));
  const oT = new Set(tokens(oTitle).filter((t) => !bt.has(t)));
  const cT = new Set(tokens(cTitle).filter((t) => !bt.has(t)));
  const shared = [...oT].filter((t) => cT.has(t));
  const scriptDiffers = (hasHangul(oTitle) !== hasHangul(cTitle)) || (hasLatinWord(oTitle) !== hasLatinWord(cTitle));
  if (!oT.size || !cT.size) put("PRODUCT_NAME", UNKNOWN, "한쪽 상품명에 식별력 있는 토큰이 없다");
  else if (shared.length >= 2) put("PRODUCT_NAME", MATCH, `식별력 있는 토큰 ${shared.length}개 공유 — ${shared.join("/")}`, { where: "TITLE", shared });
  else if (shared.length === 1) put("PRODUCT_NAME", UNKNOWN, `공유 토큰 1개뿐(${shared[0]}) — 근거로 쓰기에 약하다`, { shared });
  else if (scriptDiffers) put("PRODUCT_NAME", UNKNOWN, "문자체계가 달라 토큰이 겹치지 않는다 — 🔴 번역 차이이고 «불일치가 아니다»");
  else put("PRODUCT_NAME", MISMATCH, "같은 문자체계인데 식별력 있는 토큰이 하나도 겹치지 않는다", { originTokens: [...oT].slice(0, 8), candidateTokens: [...cT].slice(0, 8) });

  /* ── FORM / DESIGN ── 소매 길이 충돌을 같이 본다(CEO 가 실제로 가른 축). */
  const oF = families(FORM_FAMILIES, oText), cF = families(FORM_FAMILIES, cText);
  const oS = families(SLEEVE, oText), cS = families(SLEEVE, cText);
  const sleeveConflict = oS.length === 1 && cS.length === 1 && oS[0] !== cS[0];
  if (!oF.length || !cF.length) put("FORM_DESIGN", UNKNOWN, `형태 어휘를 한쪽에서 찾지 못했다(원 ${oF.join("/") || "없음"} ↔ 후보 ${cF.join("/") || "없음"})`);
  else if (sleeveConflict) put("FORM_DESIGN", MISMATCH, `소매 길이가 충돌한다 — ${oS[0]} ↔ ${cS[0]}`, { where: "DESCRIPTION", originEvidence: oS[0], candidateEvidence: cS[0], sleeveConflict: true });
  else if (oF.some((f) => cF.includes(f))) put("FORM_DESIGN", MATCH, `형태 계열 일치 — ${oF.filter((f) => cF.includes(f)).join("/")}`, { where: "TITLE" });
  else put("FORM_DESIGN", MISMATCH, `형태 계열이 다르다 — ${oF.join("/")} ↔ ${cF.join("/")}`, { originEvidence: oF.join("/"), candidateEvidence: cF.join("/") });

  /* ── COLOR ── 🔴 **같은 제품의 색상 옵션** 을 불일치로 적지 않는다. */
  const oC = [...new Set([...families(COLOR_FAMILIES, txt(cp?.color)), ...families(COLOR_FAMILIES, oTitle)])];
  const cC = [...new Set([...families(COLOR_FAMILIES, String(pair.liveColor ?? "")), ...families(COLOR_FAMILIES, cTitle)])];
  const cCAll = families(COLOR_FAMILIES, cText);
  if (!oC.length || !cC.length) put("COLOR", UNKNOWN, `색상을 한쪽에서 확정하지 못했다(원 ${oC.join("/") || "없음"} ↔ 후보 ${cC.join("/") || "없음"})`);
  else if (oC.some((c) => cC.includes(c))) put("COLOR", MATCH, `색상 계열 일치 — ${oC.filter((c) => cC.includes(c)).join("/")}`, { originEvidence: txt(cp?.color) || oC.join("/") });
  else if (cCAll.length >= 3 || oC.some((c) => cCAll.includes(c)))
    put("COLOR", UNKNOWN, `후보 원문이 색상을 여러 개 싣는다(${cCAll.join("/")}) — 🔴 색상 «옵션» 일 수 있어 불일치로 적지 않는다`, { optionVariant: true });
  else put("COLOR", MISMATCH, `색상 계열이 다르다 — ${oC.join("/")} ↔ ${cC.join("/")}`, { originEvidence: txt(cp?.color) || oC.join("/"), candidateEvidence: cC.join("/") });

  /* ── MATERIAL ── 🔴 「organic cotton ↔ cotton」은 **표기차** 다. */
  const oM = txt(cp?.material), cM = [String(pair.liveMaterial ?? ""), cDesc].join(" ");
  const oFib = families(FIBERS, oM), cFib = families(FIBERS, cM);
  const pct = (s) => (String(s).match(/(\d{1,3})\s*%/g) ?? []).map((x) => parseInt(x, 10));
  if (!oFib.length || !cFib.length) put("MATERIAL", UNKNOWN, `소재를 한쪽에서 확정하지 못했다(원 ${oFib.join("/") || "없음"} ↔ 후보 ${cFib.join("/") || "없음"})`);
  else if (oFib.every((f) => cFib.includes(f)) && cFib.every((f) => oFib.includes(f))) {
    const modDiff = FIBER_MODIFIER.test(oM) !== FIBER_MODIFIER.test(cM);
    put("MATERIAL", MATCH, modDiff ? `섬유 구성 일치 — 🟢 수식어(organic/recycled) 표기만 다르다` : `섬유 구성 일치 — ${oFib.join("/")}`,
      { where: "DESCRIPTION", originEvidence: oM, notationOnly: modDiff });
  } else if (!oFib.some((f) => cFib.includes(f)))
    put("MATERIAL", MISMATCH, `섬유 구성이 전혀 겹치지 않는다 — ${oFib.join("/")} ↔ ${cFib.join("/")}`, { originEvidence: oM, candidateEvidence: cFib.join("/") });
  else put("MATERIAL", UNKNOWN, `섬유 구성이 부분만 겹친다 — ${oFib.join("/")} ↔ ${cFib.join("/")} (원문 상세도 차이 가능)`, { originPercents: pct(oM), candidatePercents: pct(cM).slice(0, 4) });

  /* ── AUDIENCE / AGE ── */
  const oA = families(AUDIENCE, `${oText} ${txt(cp?.recommendedAge)}`), cA = families(AUDIENCE, cText);
  if (!oA.length || !cA.length) put("AUDIENCE_AGE", UNKNOWN, `대상 어휘를 한쪽에서 찾지 못했다(원 ${oA.join("/") || "없음"} ↔ 후보 ${cA.join("/") || "없음"})`);
  else if (oA.some((x) => cA.includes(x))) put("AUDIENCE_AGE", MATCH, `대상 일치 — ${oA.filter((x) => cA.includes(x)).join("/")}`);
  else put("AUDIENCE_AGE", MISMATCH, `대상이 다르다 — ${oA.join("/")} ↔ ${cA.join("/")}`, { originEvidence: oA.join("/"), candidateEvidence: cA.join("/") });

  /* ── SIZE / FIT ── 🔴 사이즈 체계 차이는 **단독으로 동일성을 부정하지 않는다**(WU-045 계약). */
  const sizeSys = (s) => {
    const o = [];
    if (/\b\d{1,2}\s*-\s*\d{1,2}\s*(y|yr|yrs|years?|세|살)\b/i.test(s) || /\b\d{1,2}\s*(y|yrs|years?|세|살)\b/i.test(s) || /\b\d{1,2}\s*개월/.test(s)) o.push("AGE");
    if (/\b(xs|s|m|l|xl|xxl)\b/i.test(s)) o.push("ALPHA");
    if (/\b(cm|호)\b/i.test(s)) o.push("METRIC");
    return o;
  };
  const oZ = sizeSys(oText), cZ = sizeSys(cText);
  if (!oZ.length || !cZ.length) put("SIZE_FIT", UNKNOWN, `사이즈 체계를 한쪽에서 찾지 못했다(원 ${oZ.join("/") || "없음"} ↔ 후보 ${cZ.join("/") || "없음"})`);
  else if (oZ.some((x) => cZ.includes(x))) put("SIZE_FIT", MATCH, `사이즈 체계 일치 — ${oZ.filter((x) => cZ.includes(x)).join("/")}`);
  else put("SIZE_FIT", UNKNOWN, `사이즈 체계가 다르다(${oZ.join("/")} ↔ ${cZ.join("/")}) — 🔴 WU-045 계약: 단독으로 동일성을 막지 않는다`, { sizeSystemDiffers: true });

  /* ── SET / OPTION ── */
  const oSet = SET_RE.test(oText), cSet = SET_RE.test(cText);
  if (oSet === cSet) put("SET_OPTION", oSet ? MATCH : NA, oSet ? "양쪽 모두 세트/구성 어휘가 있다" : "양쪽 모두 세트 상품이 아니다");
  else put("SET_OPTION", MISMATCH, `세트 구성 표기가 한쪽에만 있다(원 ${oSet} ↔ 후보 ${cSet})`, { where: "DESCRIPTION" });

  /* ── IMAGE ── 🔴 **PROBE 다.** 내용 비교를 하지 않았다(표준 §1.2). */
  const oImg = Array.isArray(V(cp?.images)) ? V(cp.images).length : 0;
  const cImg = pair.imageUrl ? 1 : 0;
  if (!oImg && !cImg) put("IMAGE", NA, "양쪽 모두 이미지가 없다");
  else put("IMAGE", UNKNOWN, `이미지 보유(원 ${oImg}장 · 후보 ${cImg}장) — 🔴 **내용 비교는 하지 않았다**(사람 판독 필요)`, { probe: true, originImages: oImg, candidateImages: cImg });

  /* ── 🔴🔴 «이미 알고 있던 정보» ↔ «새로 발견한 정보» 를 가른다(CPO 검토 ①) ──
   * 🔴 판단 기준은 내 1차 구현의 `brandBefore` 가 **아니다** — 그 칸은 값이 아니라 **상태** 다.
   * 🟢 운영 신호 둘을 쓴다:
   *   ⒜ `baselineBlockers`  = 최초 판정이 그 축을 **막았다**(운영이 확인하지 못했다)
   *   ⒝ `evidence*Sources`  = **운영 추출기** 가 그 축 증거를 이미 뽑았다(그러면 신규가 아니다)
   */
  const blockers = (pair.baselineBlockers ?? []).map(String);
  const opHad = {
    BRAND: (pair.evidenceBrandSources ?? []).length > 0,
    MODEL_CODE: (pair.evidenceCodeSources ?? []).length > 0,
  };
  for (const [k, v] of Object.entries(axes)) {
    const mapped = AXIS_BLOCKERS[k] ?? [];
    v.baselineBlocked = mapped.filter((b) => blockers.includes(b));
    /**
     * 🔴🔴 **운영 추출기가 그 축을 갖고 있었는지 아는 축은 «둘» 뿐이다** — `evidenceBrandSources` ·
     * `evidenceCodeSources`. 나머지 축에는 그 신호가 **없다** ⟹ `null`(미확인)로 둔다.
     * 🔴 1차 구현이 `opHad[k] !== true` 로 썼고 그래서 **소재 17건이 「신규 발견」으로 찍혔다** —
     *    운영이 이미 갖고 있었는지 **모르는데** 신규로 센 것이다. 그 숫자를 쓰지 않는다.
     */
    v.operationalExtractorHadAxis = k in opHad ? opHad[k] : null;
    v.newFromRawText = typeof v.operationalExtractorHadAxis === "boolean"
      ? v.status === MATCH && (v.where === "DESCRIPTION" || v.where === "URL") && v.operationalExtractorHadAxis === false
      : null;   // 🔴 **미확인** — 「신규 0」으로도 「신규 N」으로도 적지 않는다
    /** 🔴 최초가 막아 둔 축을 원문이 **뒤집는가** — 이것이 개선/오판의 직접 근거다. */
    v.contradictsBaselineBlocker = v.status === MATCH && v.baselineBlocked.length > 0;
  }
  return { axes, oTitle, oDesc, cTitle, cDesc, blockers, hasOriginDesc: Boolean(oDesc), hasCandidateDesc: Boolean(cDesc) };
}

/* ═══════ shadow 판단 — 🔴 CPO 사업 규칙을 그대로 코드로 옮긴다 ════════════
 * 「동일 브랜드 + 동일 품번 → 우선 동일상품」
 * 「컬러·형태·소재 차이는 동일상품 확정 대신 **유사상품** 으로 안내」
 * 「핵심 식별정보는 보조 차이로 덮지 않는다」
 */
const SUPPORTING = ["COLOR", "MATERIAL", "SET_OPTION", "SIZE_FIT"];
/**
 * 🔴🔴 **1차 구현의 두 결함을 고쳤다 — 둘 다 적는다**:
 * ```
 * ⒜ `BRAND UNKNOWN` 을 **차단 조건으로 썼다** ⟹ 품번이 **정확히 일치하는** 쌍이
 *    `SHADOW_UNDECIDABLE` 로 떨어졌다(human GT **SAME** 인 건이 거기 있었다).
 *    🔴 그것은 **원칙 ⒝「UNKNOWN 은 MISMATCH 가 아니다」위반** 이다.
 *    🟢 이제 차단은 `BRAND === MISMATCH` 일 때만 한다.
 * ⒝ 품번 충돌을 **무조건** `LIKELY_DIFFERENT` 로 적었다 ⟹ human GT **SIMILAR** 인
 *    건(B226AC110 ↔ B226AC111)과 어긋났다. 🔴 CPO 지시서에 품번 «충돌» 의 안내 등급이
 *    명시돼 있지 않다 ⟹ **CTO 가 고르지 않고 반사실 두 안으로 갈라 잰다**(아래 `ruleset`).
 * ```
 * 🔴 `N=1` 로 축을 만들지 않는다 — 그래서 ⒝ 는 **규칙 선택을 CPO 에게 올린다**.
 */
function shadow(axes, ruleset = "A") {
  const st = (k) => axes[k]?.status;
  const brandOk = st("BRAND") === MATCH, brandBad = st("BRAND") === MISMATCH;
  const codeOk = st("MODEL_CODE") === MATCH, codeBad = st("MODEL_CODE") === MISMATCH;
  const supportDiff = SUPPORTING.filter((k) => st(k) === MISMATCH);
  const formBad = st("FORM_DESIGN") === MISMATCH, formOk = st("FORM_DESIGN") === MATCH;
  const audBad = st("AUDIENCE_AGE") === MISMATCH;
  if (codeBad) {
    /** 안 B — 같은 브랜드·형태인데 품번만 다르면 **유사상품** 으로 안내한다. */
    if (ruleset === "B" && brandOk && formOk && !brandBad) {
      return { label: "SHADOW_LIKELY_SIMILAR", why: `품번은 다르지만 브랜드·형태가 같다 — 유사상품 (${axes.MODEL_CODE.reason})` };
    }
    return { label: "SHADOW_LIKELY_DIFFERENT", why: `핵심 식별 축 충돌 — ${axes.MODEL_CODE.reason}` };
  }
  /** 🟢 **품번 일치가 핵심 식별이다** — 브랜드가 `UNKNOWN` 인 것은 그것을 덮지 않는다. */
  if (codeOk && !brandBad) {
    if (formBad) return { label: "SHADOW_LIKELY_DIFFERENT", why: `품번은 같은데 형태가 다르다 — ${axes.FORM_DESIGN.reason}(🔴 사람 확인 필요)` };
    if (supportDiff.length) return { label: "SHADOW_LIKELY_SIMILAR", why: `핵심 식별(품번) 일치 · 보조 차이 ${supportDiff.join("/")} — CPO 규칙대로 유사상품` };
    return {
      label: "SHADOW_STRONG_SAME",
      why: brandOk ? "브랜드 + 제조사 품번이 모두 일치하고 충돌 축이 없다"
        : "제조사 품번이 일치하고 충돌 축이 없다(🔴 브랜드는 UNKNOWN — 그것은 불일치가 아니다)",
    };
  }
  if (formBad || audBad) return { label: "SHADOW_LIKELY_DIFFERENT", why: `핵심 식별이 미확정인데 ${formBad ? "형태" : "대상"}이 다르다` };
  if (brandBad) return { label: "SHADOW_LIKELY_DIFFERENT", why: `브랜드가 불일치한다 — ${axes.BRAND.reason}` };
  if (brandOk && st("PRODUCT_NAME") === MATCH) {
    if (supportDiff.length) return { label: "SHADOW_LIKELY_SIMILAR", why: `브랜드+상품명 일치 · 보조 차이 ${supportDiff.join("/")}` };
    return { label: "SHADOW_LIKELY_SAME", why: "브랜드와 상품명이 일치한다(품번 미확정 — 확정 근거는 아니다)" };
  }
  if (brandOk) return { label: "SHADOW_NEEDS_REVIEW", why: "브랜드만 확인됐다 — 품번·상품명 근거가 부족하다" };
  if (st("PRODUCT_NAME") === MISMATCH) return { label: "SHADOW_UNDECIDABLE", why: "브랜드·품번 미확정 · 상품명도 겹치지 않는다 — 🔴 **동일 근거가 없다**(「다르다」로 단정하지 않는다)" };
  return { label: "SHADOW_UNDECIDABLE", why: "브랜드·품번을 확정하지 못했다 — 원문 근거 부족" };
}

/** 🔴 최초 판단 ↔ shadow 의 **변화 분류**(CPO 지시서 §3-D 넷 + 측정불가). */
const STRONG_SAME_SET = new Set(["SHADOW_STRONG_SAME"]);
const DIFF_SET = new Set(["SHADOW_LIKELY_DIFFERENT"]);
function classify(baseline, sh, axes) {
  if (!baseline || baseline === "BASELINE_NOT_REPRODUCED") return { change: "UNDECIDABLE", why: "최초 판정을 재현하지 못했다 — 대조 자체가 성립하지 않는다" };
  if (sh.label === "SHADOW_UNDECIDABLE") return { change: "UNDECIDABLE", why: "원문 근거가 부족하다" };
  const assertive = baseline === "SAME";
  if (assertive && DIFF_SET.has(sh.label)) return { change: "FIRST_JUDGMENT_ERROR", why: `최초 SAME 인데 상세설명이 충돌을 보인다 — ${sh.why}` };
  if (baseline === "CONFLICT" && STRONG_SAME_SET.has(sh.label)) return { change: "FIRST_JUDGMENT_ERROR", why: "최초 CONFLICT 인데 브랜드+품번이 일치한다" };
  if (!assertive && STRONG_SAME_SET.has(sh.label)) return { change: "IMPROVABLE", why: `최초 ${baseline} → 상세설명으로 강한 동일 근거 확보` };
  if (!assertive && sh.label === "SHADOW_LIKELY_DIFFERENT") return { change: "IMPROVABLE", why: `최초 ${baseline} → 상세설명으로 차이 근거 확보(불확실성 감소)` };
  if (sh.label === "SHADOW_LIKELY_SIMILAR") return { change: "IMPROVABLE", why: "핵심 일치 + 보조 차이 ⟹ 유사상품으로 안내 가능(확정 대신)" };
  return { change: "MAINTAINED", why: `최초 ${baseline} 이 상세설명과 모순되지 않는다` };
}

/* ═══════ 실행 ═══════════════════════════════════════════════════════════ */
const out = PAIRS.map((pair) => {
  const c = compare(pair);
  /**
   * 🔴🔴 **설명문이 한쪽이라도 없으면 판단을 «적지 않는다».**
   * 1차 산출이 그 쌍에도 `STRONG_SAME` 을 적어 표가 「축은 ∅ 인데 결론은 있다」로 모순됐다.
   * 🟢 계산값은 `_incomplete` 로 보존하되 **제시하지 않는다**(원문 미확보를 확인 완료로 쓰지 않는다 · §4).
   */
  const complete = c.hasOriginDesc && c.hasCandidateDesc;
  const shRaw = shadow(c.axes, "A"), shBRaw = shadow(c.axes, "B");
  const sh = complete ? shRaw : { label: "NOT_COMPARABLE", why: `설명문 미확보 — 원상품 ${c.hasOriginDesc ? "O" : "X"} · 후보 ${c.hasCandidateDesc ? "O" : "X"}` };
  const shB = complete ? shBRaw : { label: "NOT_COMPARABLE" };
  const cl = complete ? classify(pair.baselineSystemVerdict, sh, c.axes)
    : { change: "NOT_COMPARABLE", why: "설명문 미확보 — 최초 판단과 대조할 수 없다" };
  /** 🔴 신규 발견 = 원문에서 확인됐고 **운영 추출기가 그 축을 갖고 있지 않았던** 것만. */
  const newlyFound = Object.entries(c.axes).filter(([, v]) => v.newFromRawText === true).map(([k]) => k);
  /** 🔴 **신규 여부를 알 수 없는 축** — 「신규 0」으로 적지 않기 위해 따로 센다. */
  const newnessUnknown = Object.entries(c.axes)
    .filter(([, v]) => v.newFromRawText === null && v.status === MATCH && v.where).map(([k]) => k);
  const contradicts = Object.entries(c.axes).filter(([, v]) => v.contradictsBaselineBlocker).map(([k]) => k);
  return {
    originCode: pair.originCode ?? null, originBrand: pair.originBrand ?? null, originUrl: pair.originUrl,
    candidateDomain: pair.candidateDomain, candidateUrl: pair.candidateUrl,
    repeatedSnapshots: pair._dupes ?? 1, visitStatus: pair.visitStatus,
    hasOriginDescription: c.hasOriginDesc, hasCandidateDescription: c.hasCandidateDesc,
    originTitle: c.oTitle, candidateTitle: c.cTitle,
    originDescriptionExcerpt: c.oDesc.slice(0, 400), candidateDescriptionExcerpt: c.cDesc.slice(0, 400),
    baselineSystemVerdict: pair.baselineSystemVerdict ?? null, baselineBlockers: c.blockers,
    baselineReproduced: pair.baselineSystemVerdict !== "BASELINE_NOT_REPRODUCED",
    humanGt: pair.ceoGt ?? null,
    axes: c.axes, newlyFoundAxes: newlyFound, newnessUnknownAxes: newnessUnknown,
    contradictsBaselineBlockerAxes: contradicts,
    operationalExtractorHadAxes: Object.entries(c.axes).filter(([, v]) => v.operationalExtractorHadAxis === true).map(([k]) => k),
    shadowLabel: sh.label, shadowWhy: sh.why, shadowLabelRulesetB: shB.label,
    change: cl.change, changeWhy: cl.why,
    /** 🔴 비교 불가 쌍에서 «계산은 됐지만 제시하지 않는» 값 — 추적용으로만 남긴다. */
    _incompleteShadow: complete ? null : shRaw.label,
    remainingRisk: [
      c.axes.IMAGE?.probe ? "이미지 내용 비교 미실시(사람 판독 필요)" : null,
      c.axes.MODEL_CODE?.status === UNKNOWN ? "품번 미확정 — 핵심 식별 축 공백" : null,
      c.axes.SIZE_FIT?.sizeSystemDiffers ? "사이즈 체계 차이(단독 근거 아님)" : null,
      c.axes.COLOR?.optionVariant ? "색상 옵션 다수 — 변형 여부 미확정" : null,
    ].filter(Boolean),
  };
});

/* ═══════ 집계 출력 ═══════════════════════════════════════════════════════ */
const tally = (xs, f) => xs.reduce((a, x) => { const k = f(x); a[k] = (a[k] ?? 0) + 1; return a; }, {});
const comparable = out.filter((r) => r.hasOriginDescription && r.hasCandidateDescription);
console.log("═".repeat(80));
console.log("  원상품 ↔ 후보 상세설명 비교 (운영 변경 0 · DB 쓰기 0 · 재방문 0)");
console.log("═".repeat(80));
console.log(`\n§1 분모 — 🔴 섞지 않는다`);
console.log(`   행 ${s2.length} · 고유 후보 URL ${new Set(s2.map((r) => r.candidateUrl)).size} · 고유 원상품 URL ${originUrls.length}`);
console.log(`   🟢 고유 (원상품,후보) 쌍 **${out.length}** · 설명문 둘 다 확보 **${comparable.length}**`);
console.log(`   원상품 스냅샷 없음 ${out.filter((r) => !r.hasOriginDescription).length} · 후보 설명문 없음 ${out.filter((r) => !r.hasCandidateDescription).length}`);
console.log(`   GT 보유 쌍 ${out.filter((r) => r.humanGt).length} · 방문 ${pr(tally(out, (r) => r.visitStatus))}`);
console.log(`\n§2 최초 시스템 판정(비교가능 ${comparable.length})`);
console.log("  ", pr(tally(comparable, (r) => r.baselineSystemVerdict ?? "(없음)")));
console.log(`\n§3 증거 축별 분포(비교가능 ${comparable.length})`);
for (const k of ["BRAND", "MODEL_CODE", "PRODUCT_NAME", "FORM_DESIGN", "COLOR", "MATERIAL", "AUDIENCE_AGE", "SIZE_FIT", "SET_OPTION", "IMAGE"]) {
  const t = tally(comparable, (r) => r.axes[k]?.status ?? "(없음)");
  console.log(`   ${k.padEnd(13)} MATCH ${String(t.MATCH ?? 0).padStart(3)} · MISMATCH ${String(t.MISMATCH ?? 0).padStart(3)} · UNKNOWN ${String(t.UNKNOWN ?? 0).padStart(3)} · N/A ${String(t.NOT_APPLICABLE ?? 0).padStart(3)}`);
}
console.log(`\n§4 shadow 판단 (🔴 운영 판정 변경이 아니다)`);
console.log("  ", pr(tally(comparable, (r) => r.shadowLabel)));
/** 🔴 `SHADOW_UNDECIDABLE` 을 한 덩어리로 두면 「아무것도 못 했다」로 읽힌다 — 갈라 센다. */
const und = comparable.filter((r) => r.shadowLabel === "SHADOW_UNDECIDABLE");
console.log(`   🔴 UNDECIDABLE ${und.length} 의 내역 — 상품명 축으로 가른다:`);
console.log("      상품명 MISMATCH(= 동일 근거가 **없다**):", und.filter((r) => r.axes.PRODUCT_NAME.status === MISMATCH).length);
console.log("      상품명 MATCH(= 이름은 겹치는데 브랜드·품번이 공백):", und.filter((r) => r.axes.PRODUCT_NAME.status === MATCH).length);
console.log("      상품명 UNKNOWN(= 근거 자체가 얇다):", und.filter((r) => r.axes.PRODUCT_NAME.status === UNKNOWN).length);
console.log(`\n§5 최초 판단 대비 변화 (분모 ${comparable.length})`);
console.log("  ", pr(tally(comparable, (r) => r.change)));
console.log(`\n§6 신규 발견 vs 이미 알고 있던 정보 (🔴 중복 계산 금지)`);
const newAx = {}; for (const r of comparable) for (const k of r.newlyFoundAxes) newAx[k] = (newAx[k] ?? 0) + 1;
const oldAx = {}; for (const r of comparable) for (const k of r.operationalExtractorHadAxes) oldAx[k] = (oldAx[k] ?? 0) + 1;
const conAx = {}; for (const r of comparable) for (const k of r.contradictsBaselineBlockerAxes) conAx[k] = (conAx[k] ?? 0) + 1;
const unkAx = {}; for (const r of comparable) for (const k of r.newnessUnknownAxes) unkAx[k] = (unkAx[k] ?? 0) + 1;
console.log("   🟢 원문에서 **신규** 확인(운영 추출기가 그 축을 안 갖고 있었다):", pr(newAx));
console.log("   🔴 **운영 추출기가 이미** 그 축 증거를 갖고 있었다:", pr(oldAx));
console.log("   🔴 **신규 여부 미확인**(운영 보유 신호가 없는 축 — 「신규」로도 「기존」으로도 세지 않는다):", pr(unkAx));
console.log("   🟢🟢 최초가 **막아 둔 축** 을 원문이 뒤집는다(개선/오판의 직접 근거):", pr(conAx));
const blk = {}; for (const r of comparable) for (const k of r.baselineBlockers) blk[k] = (blk[k] ?? 0) + 1;
console.log("   최초 판정의 blocker 분포:", pr(blk));
console.log(`\n§7 GT 대조 — 🔴 **최초 판정이 재현된 쌍만** 쓴다`);
const g = comparable.filter((r) => r.humanGt && r.baselineReproduced);
console.log(`   GT 보유 ${comparable.filter((r) => r.humanGt).length} 중 baseline 재현 **${g.length}** · 미재현 ${comparable.filter((r) => r.humanGt && !r.baselineReproduced).length} 는 **측정불가**`);
for (const v of ["SAME", "SIMILAR", "DIFFERENT", "UNCERTAIN"]) {
  const sub = g.filter((r) => String(r.humanGt).toUpperCase() === v);
  if (sub.length) console.log(`   human ${v.padEnd(10)} ${String(sub.length).padStart(2)} → shadow ${pr(tally(sub, (r) => r.shadowLabel)).replace(/\s+/g, " ")}`);
}
/** 🔴 **반사실** — 품번 충돌 안내 등급 A/B 를 GT 로 대조한다. CTO 가 고르지 않는다. */
/** 🔴 **보류를 「불일치」로 세지 않는다** — 세면 오차가 과대 표시된다. 셋으로 가른다. */
const HOLD = ["SHADOW_UNDECIDABLE", "SHADOW_NEEDS_REVIEW"];
const SAME_SIDE = ["SHADOW_STRONG_SAME", "SHADOW_LIKELY_SAME"];
const agree = (r, lab) => {
  const h = String(r.humanGt).toUpperCase();
  if (HOLD.includes(lab)) return "HOLD";
  if (h === "SAME") return SAME_SIDE.includes(lab) ? "AGREE" : "DISAGREE";
  if (h === "SIMILAR") return lab === "SHADOW_LIKELY_SIMILAR" ? "AGREE" : "DISAGREE";
  if (h === "DIFFERENT") return lab === "SHADOW_LIKELY_DIFFERENT" ? "AGREE" : "DISAGREE";
  return null;
};
const scoreOf = (key) => {
  const sub = g.filter((r) => agree(r, r[key]) !== null);
  return {
    분모: sub.length,
    일치: sub.filter((r) => agree(r, r[key]) === "AGREE").length,
    역방향오류: sub.filter((r) => agree(r, r[key]) === "DISAGREE").length,
    보류: sub.filter((r) => agree(r, r[key]) === "HOLD").length,
    /** 🔴🔴 **오포함** — human DIFFERENT 를 동일 쪽으로 올린 건. 안전의 핵심 숫자다. */
    오포함_falseSame: sub.filter((r) => String(r.humanGt).toUpperCase() === "DIFFERENT" && SAME_SIDE.includes(r[key])).length,
    /** 🔴 **누락** — human SAME 을 동일 쪽으로 못 올린 건. */
    누락_missedSame: sub.filter((r) => String(r.humanGt).toUpperCase() === "SAME" && !SAME_SIDE.includes(r[key])).length,
  };
};
console.log(`\n§7-B 반사실 — 품번 충돌 안내 등급(🔴 CPO 선택 사안 · CTO 가 고르지 않았다)`);
console.log("   안 A(품번 충돌 → 다른 상품):", pr(scoreOf("shadowLabel")).replace(/\s+/g, " "));
console.log("   안 B(품번 충돌 + 브랜드·형태 일치 → 유사상품):", pr(scoreOf("shadowLabelRulesetB")).replace(/\s+/g, " "));
console.log("   🔴 차이가 나는 쌍:", g.filter((r) => r.shadowLabel !== r.shadowLabelRulesetB).length, "· 전체 비교가능에서",
  comparable.filter((r) => r.shadowLabel !== r.shadowLabelRulesetB).length);

writeFileSync(path.join(DIR, "desc-compare.json"), pr({
  denominators: {
    rows: s2.length, uniqueCandidateUrls: new Set(s2.map((r) => r.candidateUrl)).size,
    uniqueOriginUrls: originUrls.length, pairs: out.length, comparablePairs: comparable.length,
    pairsWithGt: out.filter((r) => r.humanGt).length,
  },
  baselineVerdicts: tally(comparable, (r) => r.baselineSystemVerdict ?? "(없음)"),
  axisDistribution: Object.fromEntries(["BRAND", "MODEL_CODE", "PRODUCT_NAME", "FORM_DESIGN", "COLOR", "MATERIAL", "AUDIENCE_AGE", "SIZE_FIT", "SET_OPTION", "IMAGE"]
    .map((k) => [k, tally(comparable, (r) => r.axes[k]?.status ?? "(없음)")])),
  shadowDistribution: tally(comparable, (r) => r.shadowLabel),
  changeDistribution: tally(comparable, (r) => r.change),
  newlyFoundAxisCounts: newAx, operationalAlreadyHadAxisCounts: oldAx, newnessUnknownAxisCounts: unkAx,
  contradictsBaselineBlockerCounts: conAx, baselineBlockerCounts: blk,
  gtCrossTab: {
    withGt: comparable.filter((r) => r.humanGt).length, baselineReproduced: g.length,
    rulesetA: scoreOf("shadowLabel"), rulesetB: scoreOf("shadowLabelRulesetB"),
    byHuman: Object.fromEntries(["SAME", "SIMILAR", "DIFFERENT"].map((v) => [v,
      tally(g.filter((r) => String(r.humanGt).toUpperCase() === v), (r) => r.shadowLabel)])),
  },
  pairs: out,
}), "utf8");
const cols = ["originCode", "originBrand", "candidateDomain", "baselineSystemVerdict", "humanGt",
  "shadowLabel", "change", "newlyFoundAxes", "originTitle", "candidateTitle", "candidateUrl"];
const axCols = ["BRAND", "MODEL_CODE", "PRODUCT_NAME", "FORM_DESIGN", "COLOR", "MATERIAL", "AUDIENCE_AGE", "SIZE_FIT", "SET_OPTION", "IMAGE"];
writeFileSync(path.join(DIR, "desc-compare.csv"),
  [[...cols, ...axCols, "shadowWhy", "changeWhy"].join(",")].concat(out.map((r) => [
    ...cols.map((c) => `"${String(Array.isArray(r[c]) ? r[c].join("/") : (r[c] ?? "")).replace(/"/g, '""')}"`),
    ...axCols.map((k) => `"${r.axes[k]?.status ?? ""}"`),
    `"${String(r.shadowWhy).replace(/"/g, '""')}"`, `"${String(r.changeWhy).replace(/"/g, '""')}"`,
  ].join(","))).join("\n"), "utf8");
console.log("\n🟢 산출 desc-compare.json / desc-compare.csv");
await p.$disconnect();
