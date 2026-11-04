import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  compareCrossSellerProducts,
  compareModelCode,
  confirmBrandCodeInEvidence,
  deriveMatchTruth,
  isColorUnverified,
} from "@commerce/crawler";
import { backfillCanonicalProduct, buildProductIdentityDna, productFactsFromIdentityDna } from "@commerce/shared";
import { priceTierFromLink } from "../../../domestic-price-sources/_lib/domestic-product-link";

/**
 * ════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 STAGE 4-G-R2 — **정책 A 의 사업 효과 · 계약 의미**(분석 전용)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 운영 코드 변경 **0** · A 구현 **0** · B 구현 **0** · 테스트 기대값 수정 **0** ·
 *    계약 수정 **0** · Legacy GT **0** · 가격/Search/UI/DB **0** · 네트워크 **0**.
 * 🔴 **`cross-seller.ts` 를 임시로도 고치지 않았다** — A 는 **이 파일 안에서만** 모사한다.
 *
 * ── 🟢 A 의 «정확한» 모사 규칙(전체 복제가 아니다) ─────────────────────────
 * ```
 * A = PRESUMED_SAME 에 hasIdentifyingEvidence 를 요구한다
 *   운영 분기:  totalPoints >= 3 && <조건>  → PRESUMED_SAME
 *               totalPoints >= 1           → SIMILAR
 *   ⟹ A 아래에서 바뀔 수 있는 것은 **PRESUMED_SAME 한 칸** 이고,
 *      그 경우 totalPoints 는 이미 3 이상이므로 **반드시 SIMILAR 로 내려간다**
 *   ⟹ 그래서 매핑이 **한 줄** 이다 — 다른 verdict 는 손대지 않는다
 * ```
 * 🟢 그 등가성은 R1 의 `stage4g-identity-policy-01` **replicationGate**(mismatch 0)가
 *    이미 검증했다. 이 파일은 그 결론을 **좁은 매핑으로만** 쓴다.
 */

const OUT = path.join(process.env.TEMP ?? ".", "mi-p0-02");
const FIX = path.join(__dirname, "fixtures");
const pad = (s: unknown, n: number) =>
  String(s ?? "-").slice(0, n) + " ".repeat(Math.max(0, n - String(s ?? "-").length));

/** 🟢 wu-066 과 **같은 캐시 키** 를 쓴다(새로 수집하지 않는다). */
const cacheKey = (u: string) => createHash("sha1").update(u).digest("hex").slice(0, 16);
const IDS: Record<string, string> = {
  S1: "c0725ecc-29f6-4570-83d2-311c4f2a0b8e",
  S2: "cd93efd9-6c34-42a3-b733-d1178e968113",
  S3: "c5395889-7651-4272-aff5-dbeddd8d6199",
  S4: "c27d4727-2248-4fe0-9084-8c239737a889",
  S5: "32f7b651-29b9-4217-b8ce-46596f538306",
  S6: "278d4c38-0a55-4724-bcd6-4a2630b1a278",
};
/** 🟢 wu-066 의 CF-2 색상 복구값 — **그 파일에서 그대로 가져왔다**(새 값 0). */
const RECOVERED: Record<string, string> = {
  C07: "라이트 블루",
  C47: "블루",
  C23: "Graystone",
  C24: "Graystone",
  C08: "블루",
};

const READY =
  existsSync(path.join(OUT, "wu-036-3way.json")) &&
  existsSync(path.join(OUT, "wu-032-cache")) &&
  existsSync(path.join(OUT, "mi-017-e2e-cases.json"));

/* ══════════════════════ 조사 B — wu-066 CF-3 의 의미 ══════════════════════ */

interface Row {
  id: string;
  searchId: string;
  candidateUrl: string;
  domain: string;
  humanGt: string;
  humanReason?: string;
}

describe("STAGE4-G-R2 · 조사 B — CF-3 의 16 → 12 가 무엇인가", () => {
  (READY ? it : it.skip)("CF-3 False SAME 의 구성과 A 아래에서 빠지는 건을 «건별» 로 적는다", () => {
    /* eslint-disable no-console */
    const rows = JSON.parse(readFileSync(path.join(OUT, "wu-036-3way.json"), "utf8")).rows as Row[];
    const cases = JSON.parse(readFileSync(path.join(OUT, "mi-017-e2e-cases.json"), "utf8")) as {
      id: string;
      canonical_product: unknown;
    }[];
    const origins: Record<string, ReturnType<typeof productFactsFromIdentityDna>> = {};
    for (const [sid, id] of Object.entries(IDS)) {
      const c = cases.find((x) => x.id === id);
      if (!c) continue;
      origins[sid] = productFactsFromIdentityDna(
        buildProductIdentityDna(backfillCanonicalProduct(c.canonical_product as never)),
      );
    }

    /**
     * 🟢 wu-066 의 `evalPair` 와 **같은 owner · 같은 순서** 다. 더한 것은 `applyA` 하나다.
     * 🔴 CF-3 은 `PRESUMED_SAME → SAME` **승격** 이다(wu-066:88 원문) ⟹
     *    A 가 PRESUMED_SAME 을 없애면 **승격시킬 것이 사라진다**. 그 성질이 이 측정의 과녁이다.
     */
    function evalPair(
      originId: string,
      r: Row,
      opts: { color?: boolean; dropTitle?: boolean; dropReserve?: boolean; applyA?: boolean },
    ) {
      const o = origins[originId];
      if (!o) return null;
      const f = path.join(OUT, "wu-032-cache", `${cacheKey(r.candidateUrl)}.facts.json`);
      if (!existsSync(f)) return null;
      const cached = JSON.parse(readFileSync(f, "utf8")) as {
        candidate?: { facts?: Record<string, unknown>; title?: string };
      };
      const b0 = cached.candidate?.facts;
      if (!b0) return null;
      const cand = opts.color && RECOVERED[r.id] ? { ...b0, colorText: RECOVERED[r.id] } : b0;
      const cross = compareCrossSellerProducts(o, cand as never) as unknown as {
        verdict: string;
        axes: { axis: string; points: number }[];
        blockers: { blocker: string }[];
        conflicts: { conflict: string }[];
      };

      /** 🟢 A 모사 — 한 줄. PRESUMED_SAME 이고 식별 축이 없으면 SIMILAR 다. */
      const hasIdentity = (cross.axes ?? []).some((a) => a.axis === "TITLE" || a.axis === "MODEL_CODE");
      const baseVerdict = String(cross.verdict);
      const afterA = opts.applyA && baseVerdict === "PRESUMED_SAME" && !hasIdentity ? "SIMILAR" : baseVerdict;

      let blockers = (cross.blockers ?? []) as { blocker: string }[];
      if (opts.dropTitle) blockers = blockers.filter((b) => b.blocker !== "NO_TITLE_OVERLAP");
      const verdict = opts.dropReserve && afterA === "PRESUMED_SAME" ? "SAME" : afterA;
      const dCode =
        (cand.brandModelCode as string | null) ??
        confirmBrandCodeInEvidence(o.brandModelCode ?? null, {
          title: cached.candidate?.title ?? "",
          url: r.candidateUrl,
        });
      const mc = compareModelCode(o.brandModelCode ?? null, dCode ?? null);
      const cu = isColorUnverified(o.colorText ?? null, (cand.colorText as string | null) ?? null);
      const truth = deriveMatchTruth(
        "very_high",
        mc as never,
        verdict as never,
        blockers as never,
        (cross.conflicts ?? []) as never,
        cu,
      );
      return {
        tier: String(priceTierFromLink({ matchTruth: truth, verified: false } as never)),
        baseVerdict,
        afterA,
        hasIdentity,
      };
    }

    /* ── 표본 구성 — wu-066 과 동일(실측 51 + 파생 135 = 186) ── */
    type P = { pid: string; originId: string; r: Row; label: string; derived: boolean };
    const pairs: P[] = [];
    for (const r of rows) {
      pairs.push({
        pid: `${r.searchId}/${r.id}`,
        originId: r.searchId,
        r,
        label: r.humanGt === "SAME" ? "SAME" : r.humanGt === "DIFFERENT" ? "DIFFERENT" : "OTHER",
        derived: false,
      });
    }
    for (const r of rows.filter((x) => x.humanGt === "SAME")) {
      for (const sid of Object.keys(IDS)) {
        if (sid !== r.searchId) pairs.push({ pid: `${sid}/${r.id}`, originId: sid, r, label: "DIFFERENT", derived: true });
      }
    }

    const CF3 = { dropTitle: true, color: true, dropReserve: true } as const;
    const data = pairs
      .map((p) => ({
        ...p,
        cf3: evalPair(p.originId, p.r, CF3),
        cf3A: evalPair(p.originId, p.r, { ...CF3, applyA: true }),
      }))
      .filter((x) => x.cf3 && x.cf3A);

    const fsBase = data.filter((x) => x.label === "DIFFERENT" && x.cf3!.tier === "EXACT");
    const fsA = data.filter((x) => x.label === "DIFFERENT" && x.cf3A!.tier === "EXACT");
    const dropped = fsBase.filter((x) => !fsA.some((y) => y.pid === x.pid));
    const sameBase = data.filter((x) => x.label === "SAME" && x.cf3!.tier === "EXACT");
    const sameA = data.filter((x) => x.label === "SAME" && x.cf3A!.tier === "EXACT");

    console.log(`\n═══ 조사 B — CF-3(crossSellerReserved 우회) 분모 ${data.length}쌍 ═══`);
    console.log(`  CF-3 False SAME   BASE **${fsBase.length}**  →  A **${fsA.length}**   (빠지는 건 ${dropped.length})`);
    console.log(`  CF-3 true  SAME   BASE **${sameBase.length}**  →  A **${sameA.length}**`);
    const precB = sameBase.length + fsBase.length ? (sameBase.length / (sameBase.length + fsBase.length)) * 100 : 0;
    const precA = sameA.length + fsA.length ? (sameA.length / (sameA.length + fsA.length)) * 100 : 0;
    console.log(`  CF-3 precision    BASE **${precB.toFixed(1)}%** → A **${precA.toFixed(1)}%**`);

    console.log(`\n  🔴 A 아래에서 CF-3 False SAME 에서 «빠지는» ${dropped.length}건 — 파생/실측 구분`);
    console.log(`  ${pad("pid", 14)} ${pad("파생?", 7)} ${pad("판매처", 24)} ${pad("base verdict", 14)} 사람 사유`);
    for (const x of dropped) {
      console.log(
        `  ${pad(x.pid, 14)} ${pad(x.derived ? "파생" : "🔴실측", 7)} ${pad(x.r.domain, 24)} ` +
          `${pad(x.cf3!.baseVerdict, 14)} ${x.derived ? "(파생쌍 — 사람 사유 없음)" : (x.r.humanReason ?? "(사유 미저장)")}`,
      );
    }
    const droppedReal = dropped.filter((x) => !x.derived);
    console.log(
      `\n  🔴🔴 **그중 «실측(사람이 직접 라벨한)» 쌍은 ${droppedReal.length}건** 이다 — 나머지 ${dropped.length - droppedReal.length}건은 파생쌍`,
    );

    /** 🟢 분모 성립만 단언한다(측정이다 · 숫자를 계약으로 박지 않는다). */
    expect(data.length, "🔴 CF-3 분모가 비었다 — 측정불가").toBeGreaterThan(100);
    expect(fsBase.length, "🔴 CF-3 baseline False SAME 이 0 이면 이 조사가 성립하지 않는다").toBeGreaterThan(0);
  });
});

/* ════════════════ 조사 C — 운영 TP 「맨몸 행」 6건의 원인 ════════════════ */

describe("STAGE4-G-R2 · 조사 C — 운영 TP 측정불가의 원인", () => {
  it("판정보유 21 · TP 7 의 칸을 전수로 적고 복구 가능성을 가른다", () => {
    /* eslint-disable no-console */
    const ops = JSON.parse(readFileSync(path.join(FIX, "sprint5-brand-gt.json"), "utf8")) as Record<string, unknown> & {
      rows: Record<string, unknown>[];
    };
    const meta = Object.fromEntries(Object.entries(ops).filter(([k]) => k !== "rows"));
    console.log(`\n═══ 조사 C — fixture 메타(출처) ═══`);
    console.log(`  ${JSON.stringify(meta).slice(0, 600)}`);

    const POSITIVE = new Set(["SAME", "PRESUMED_SAME"]);
    const rows = ops.rows;
    const scored = rows.filter((r) => r.systemVerdict);
    const tp = scored.filter((r) => r.humanVerdict === "SAME" && POSITIVE.has(String(r.systemVerdict)));

    const KEYS = [
      "candidateDomain",
      "candidateTitle",
      "candidateUrl",
      "matchReasons",
      "blockers",
      "candidateBrandInReason",
      "originBrandInReason",
      "market",
      "systemVerdict",
      "humanVerdict",
    ];
    console.log(`\n  🔴 TP ${tp.length}건의 칸 전수 — 무엇이 «없는가»`);
    console.log(`  ${pad("id", 7)} ${pad("판매처", 24)} ${pad("verdict", 14)} ${KEYS.slice(2).map((k) => pad(k, 13)).join(" ")}`);
    const bare: Record<string, unknown>[] = [];
    for (const r of tp) {
      const has = (k: string) => {
        const v = r[k];
        if (v == null) return "·없음";
        if (Array.isArray(v)) return v.length ? `있음(${v.length})` : "·빈배열";
        return String(v).trim() ? "있음" : "·빈값";
      };
      const reasons = (r.matchReasons as string[] | null) ?? [];
      if (reasons.length === 0) bare.push(r);
      console.log(
        `  ${pad(r.id, 7)} ${pad(r.candidateDomain, 24)} ${pad(r.systemVerdict, 14)} ` +
          KEYS.slice(2).map((k) => pad(has(k), 13)).join(" "),
      );
    }
    console.log(`\n  🔴🔴 **근거 문장이 없는 TP = ${bare.length}/${tp.length}** (ids: ${bare.map((r) => r.id).join(", ")})`);

    /** 🔴 복구 가능성 — URL 이 있으면 «재수집» 으로 복구 가능하지만 그것은 네트워크다(금지). */
    const bareWithUrl = bare.filter((r) => r.candidateUrl != null && String(r.candidateUrl).trim());
    const bareWithTitle = bare.filter((r) => r.candidateTitle != null && String(r.candidateTitle).trim());
    const bareWithBlockers = bare.filter((r) => Array.isArray(r.blockers) && (r.blockers as unknown[]).length > 0);
    console.log(`\n  ═══ 복구 가능성(네트워크 0 · DB 0 전제) ═══`);
    console.log(`    URL 보유            ${bareWithUrl.length}/${bare.length}`);
    console.log(`    제목 보유           ${bareWithTitle.length}/${bare.length}`);
    console.log(`    blockers 보유       ${bareWithBlockers.length}/${bare.length}`);
    console.log(`    🔴 facts(축 원자료) 보유  0/${bare.length}  ← fixture 에 그 칸이 **애초에 없다**`);
    console.log(`    ⟹ 🔴 **재수집 없이는 복구 불가** · 🔴 재수집은 네트워크/과금이라 이번 범위 금지`);

    expect(scored.length, "🔴 운영 분모가 비었다").toBeGreaterThan(0);
    expect(tp.length, "🔴 TP 분모가 비었다").toBe(7);
  });

  /**
   * ══════════════════════════════════════════════════════════════════════════
   * 🟢🟢🟢 **「측정불가 6건」을 «1건» 으로 줄인다** — 재수집 없이.
   * ══════════════════════════════════════════════════════════════════════════
   *
   * 🔴 R1 은 「근거 문장이 없으니 A 의 운영 TP 비용은 측정불가」로 닫았다.
   *    🟢 그런데 **저장된 `blockers` 가 그 답을 갖고 있다.** 운영 owner 의 구조 때문이다:
   * ```
   * titleOverlap >= 0.5  → axes TITLE 2점
   * titleOverlap >  0    → axes TITLE 1점
   * titleOverlap == 0    → blockers **NO_TITLE_OVERLAP**        (cross-seller.ts)
   * ```
   *    ⟹ 🟢 **`NO_TITLE_OVERLAP` 이 «없다» ⟺ TITLE 축이 «있다»** (셋이 상호배타·전수다)
   *    ⟹ 🟢 TITLE 축이 있으면 `hasIdentifyingEvidence` 가 참 ⟹ **A 가 건드리지 못한다**
   *
   * 🔴 그리고 A 는 **`PRESUMED_SAME` 한 칸만** 바꾼다 ⟹ `systemVerdict === "SAME"` 인 행은
   *    **구조적으로 영향 0** 이다(판정 경로가 다르다).
   *
   * 🔴 남는 미지는 하나뿐이다 — `NO_TITLE_OVERLAP` 이 있고 `MODEL_CODE` 축 유무를
   *    알 수 없는 행. 그 행만 **측정불가** 로 남긴다.
   */
  it("🟢🟢 blockers 로 A 의 운영 TP 영향을 가른다 — 미지는 **1건** 뿐이다", () => {
    /* eslint-disable no-console */
    const ops = JSON.parse(readFileSync(path.join(FIX, "sprint5-brand-gt.json"), "utf8")) as {
      rows: { id: string; candidateDomain: string | null; systemVerdict: string | null; humanVerdict: string; blockers: string[]; matchReasons: string[] | null }[];
    };
    const POSITIVE = new Set(["SAME", "PRESUMED_SAME"]);
    const tp = ops.rows.filter((r) => r.systemVerdict && POSITIVE.has(r.systemVerdict) && r.humanVerdict === "SAME");

    const IDENTIFYING_REASON = /핵심 상품명|브랜드 품번|모델명 유사도|모델코드|카테고리 일치|브랜드 일치/;
    type Verdict = "영향 0 (SAME 경로)" | "영향 0 (TITLE 축 보유)" | "영향 0 (근거에 식별 축)" | "🔴 측정불가";

    console.log(`\n═══ 조사 C-2 — A 의 운영 TP 영향(저장 blockers 기반 · 네트워크 0) ═══`);
    console.log(`  ${pad("id", 7)} ${pad("판매처", 24)} ${pad("verdict", 14)} ${pad("NO_TITLE_OVERLAP", 18)} 판정`);
    const unknown: string[] = [];
    for (const r of tp) {
      const noTitle = (r.blockers ?? []).includes("NO_TITLE_OVERLAP");
      const reasons = (r.matchReasons ?? []).filter((l) => l.startsWith("근거:") || IDENTIFYING_REASON.test(l));
      let v: Verdict;
      if (r.systemVerdict === "SAME") v = "영향 0 (SAME 경로)";
      else if (!noTitle) v = "영향 0 (TITLE 축 보유)";
      else if (reasons.some((l) => IDENTIFYING_REASON.test(l))) v = "영향 0 (근거에 식별 축)";
      else {
        v = "🔴 측정불가";
        unknown.push(`${r.id}/${r.candidateDomain}`);
      }
      console.log(
        `  ${pad(r.id, 7)} ${pad(r.candidateDomain, 24)} ${pad(r.systemVerdict, 14)} ${pad(noTitle ? "🔴 있음" : "없음", 18)} ${v}`,
      );
    }
    console.log(`\n  🟢🟢 **A 영향 0 으로 «확정» 된 TP = ${tp.length - unknown.length}/${tp.length}**`);
    console.log(`  🔴 남은 측정불가 = ${unknown.length}건 — ${unknown.join(", ") || "없음"}`);
    console.log(`     사유: NO_TITLE_OVERLAP 이 있어 TITLE 축이 없고, **MODEL_CODE 축 유무를**`);
    console.log(`           **저장 자료로 알 수 없다**(matchReasons 가 비어 있다) ⟹ 재수집 없이는 불가`);

    /** 🔴 R1 의 「측정불가 6건」을 정정한다 — 구조적으로 1건이다. */
    expect(unknown.length, "🔴 측정불가 건수가 바뀌었다 — 보고 숫자를 갱신한다").toBe(1);
    expect(unknown[0]).toContain("TP-16");
  });

  /**
   * ══════════════════════════════════════════════════════════════════════════
   * 🔴🔴🔴 **그 마지막 1건은 «GT 모순» 이다** — 같은 쌍에 사람 라벨이 둘 있다.
   * ══════════════════════════════════════════════════════════════════════════
   *
   * 실측(`sprint5-brand-gt.json` · 운영 `candidate_reviews` 캡처):
   * ```
   * FP-20  2026-10-21 09:05  human **DIFFERENT**
   * TP-16  2026-10-21 16:29  human **SAME**
   *   originCode B226AC009 · candidateUrl 동일 · blockers 4개 동일 ·
   *   systemVerdict PRESUMED_SAME · priceTier COMPARISON · GBP 21.2 — **모든 칸이 같다**
   * ```
   * 🟢 그래서 A 의 그 쌍 차단은 **TP −1 «그리고» FP −1** ⟹ **순 0** 이다
   *    ⟹ 🟢🟢 「A 의 운영 TP 비용 측정불가」가 **완전히 닫힌다**(순 0 으로 확정).
   * 🔴 그리고 **더 큰 문제를 드러낸다** — 나중 라벨이 이전 라벨을 덮지 않고 **둘 다 남는다**.
   *    `candidate_reviews` 에 **모순 감지/해소 경로가 없다** ⟹ GT 누적 구조 문제다.
   * 🔴 **CTO 는 둘 중 어느 라벨이 맞는지 고르지 않았다**(사람 판단 영역).
   */
  it("🔴🔴 운영 GT 에 **모순쌍** 이 있다 — 같은 (원상품, 후보) 에 반대 라벨 둘", () => {
    /* eslint-disable no-console */
    const ops = JSON.parse(readFileSync(path.join(FIX, "sprint5-brand-gt.json"), "utf8")) as {
      rows: { id: string; at: string; originCode: string | null; candidateUrl: string | null; humanVerdict: string }[];
    };
    const byPair = new Map<string, typeof ops.rows>();
    for (const r of ops.rows) {
      if (!r.candidateUrl) continue;
      const k = `${r.originCode ?? "-"}::${r.candidateUrl}`;
      byPair.set(k, [...(byPair.get(k) ?? []), r]);
    }
    const conflicting = [...byPair.entries()].filter(
      ([, rs]) => new Set(rs.map((r) => r.humanVerdict)).size > 1,
    );

    console.log(`\n═══ 조사 C-3 — 운영 GT 모순쌍 ═══`);
    console.log(`  (원상품코드, 후보URL) 고유 쌍 ${byPair.size} · 🔴 **라벨이 갈리는 쌍 ${conflicting.length}**`);
    for (const [k, rs] of conflicting) {
      console.log(`  🔴 ${k}`);
      for (const r of rs.sort((a, b) => a.at.localeCompare(b.at))) {
        console.log(`       ${pad(r.id, 7)} ${pad(r.at, 32)} human **${r.humanVerdict}**`);
      }
    }
    console.log(`  🟢 ⟹ A 가 이 쌍을 차단하면 TP −1 «그리고» FP −1 ⟹ **순 0**`);
    console.log(`  🔴 ⟹ 그리고 **모순을 해소하는 경로가 없다**(나중 라벨이 이전 것을 덮지 않는다)`);

    expect(conflicting.length, "🔴 모순쌍 수가 바뀌었다 — GT 구조 결론을 갱신한다").toBe(1);
    expect(conflicting[0]![1].map((r) => r.id).sort()).toEqual(["FP-20", "TP-16"]);
  });
});
