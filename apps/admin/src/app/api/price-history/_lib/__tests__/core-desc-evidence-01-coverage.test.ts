import { describe, expect, it } from "vitest";
import { factsFromProductUrl } from "@commerce/crawler";
import {
  IDENTITY_EVIDENCE_AXES,
  PROBE_EVIDENCE_AXES,
  type EvidenceItem,
  type ProductEvidence,
  type ProductFacts,
} from "@commerce/shared";
import { SAME05_BASELINE, SAME05_PAIRS, same05Judge, same05Tally, fmtTally } from "./core-same05-gt";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔵🔵🔵 CORE-DESC-EVIDENCE-01 — **Evidence coverage 측정**(라이브 · 운영 경로 그대로)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴🔴 **왜 라이브여야 하는가 — 저장 GT 로는 구조적으로 못 잰다**(SPRINT-10 이 겪은 그 자리).
 * ```
 * 저장 facts 의 `description` = **0/33**(SPRINT-03 이전 스냅샷) ⟹ 그 분모로 재면
 * DESCRIPTION source 가 **언제나 0** 이고 그것은 제품 사실이 아니다.
 * 🟢 그래서 운영 `factsFromProductUrl` 로 **지금 다시** 수집한다.
 * ```
 *
 * 🟢🟢 **복제식이 아니다** — `attachProductEvidence` 가 **운영 경로에 배선돼 있으므로**
 *    이 하니스는 `facts.evidence` 를 **읽기만** 한다(증거를 여기서 다시 만들지 않는다).
 *    ⟹ 「하니스에서는 되는데 운영에서는 안 되는」 WU-110/134 의 함정을 구조적으로 피한다.
 *
 * 🔴 facts 를 못 얻은 쌍은 **분모에서 뺀다** — 「추출 0」으로 세지 않는다(측정불가).
 */

const LIVE = process.env.CORE_DESC_EVIDENCE_LIVE === "1";

const pad = (s: string, n: number) => s + " ".repeat(Math.max(0, n - [...s].length));
const frac = (n: number, d: number) => (d === 0 ? "측정불가(분모 0)" : `${n}/${d} (${((n / d) * 100).toFixed(1)}%)`);
const host = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "?";
  }
};
const items = (ev: ProductEvidence | null | undefined, axis: string): EvidenceItem[] =>
  (ev?.[axis as keyof ProductEvidence] as EvidenceItem[] | undefined) ?? [];
const hasFrom = (ev: ProductEvidence | null | undefined, axis: string, src: string): boolean =>
  items(ev, axis).some((i) => i.source === src);

describe.skipIf(!LIVE)("CORE-DESC-EVIDENCE-01 — Evidence coverage(라이브)", () => {
  it(
    "TITLE / DESCRIPTION 별 축 coverage 와 matcher 불변을 «같이» 잰다",
    async () => {
      const urls = [...new Set(SAME05_PAIRS.map((p) => p.url))];
      const live = new Map<string, { path: string; status: string; facts: ProductFacts | null }>();
      for (const url of urls) {
        try {
          const r = (await factsFromProductUrl(url)) as unknown as Record<string, unknown>;
          const cand = r.candidate as Record<string, unknown> | undefined;
          live.set(url, {
            path: String(r.fetchPath ?? "UNRESOLVED"),
            status: String(r.status ?? "?"),
            facts: (cand?.facts as ProductFacts | undefined) ?? null,
          });
        } catch (e) {
          live.set(url, { path: "UNRESOLVED", status: `THREW(${(e as Error).message.slice(0, 24)})`, facts: null });
        }
      }

      const usable = SAME05_PAIRS.filter((p) => live.get(p.url)?.facts);
      const skipped = SAME05_PAIRS.length - usable.length;
      const factsOf = (url: string) => live.get(url)!.facts as ProductFacts;
      const withDesc = usable.filter((p) => factsOf(p.url).description);

      console.log(`\n${"═".repeat(104)}`);
      console.log("  [1] 분모 — 🔴 못 얻은 것은 「0」이 아니라 «분모 밖» 이다");
      console.log(`${"═".repeat(104)}`);
      console.log(`  GT 쌍 ${SAME05_PAIRS.length} · 라이브 facts 확보 **${usable.length}** · 🔴 제외 ${skipped}`);
      console.log(`  description 존재              ${frac(withDesc.length, usable.length)}`);
      console.log(`  evidence 칸 존재              ${frac(usable.filter((p) => factsOf(p.url).evidence).length, usable.length)}`);

      console.log(`\n${"═".repeat(104)}`);
      console.log("  [2] Identity 축 coverage — 🔴 source 를 «갈라서» 센다");
      console.log(`${"═".repeat(104)}`);
      console.log(`  ${pad("축", 14)}${pad("전체", 18)}${pad("TITLE", 18)}${pad("DESCRIPTION", 18)}DESC(설명보유 분모)`);
      for (const axis of IDENTITY_EVIDENCE_AXES) {
        const any = usable.filter((p) => items(factsOf(p.url).evidence, axis).length > 0).length;
        const t = usable.filter((p) => hasFrom(factsOf(p.url).evidence, axis, "TITLE")).length;
        const d = usable.filter((p) => hasFrom(factsOf(p.url).evidence, axis, "DESCRIPTION")).length;
        const dOfDesc = withDesc.filter((p) => hasFrom(factsOf(p.url).evidence, axis, "DESCRIPTION")).length;
        console.log(
          `  ${pad(axis, 14)}${pad(frac(any, usable.length), 18)}${pad(frac(t, usable.length), 18)}${pad(frac(d, usable.length), 18)}${frac(dOfDesc, withDesc.length)}`,
        );
      }

      console.log(`\n${"═".repeat(104)}`);
      console.log("  [3] 🟡 관측 전용 축 — 추출 «가능성만» 잰다(matcher 축 승격 0)");
      console.log(`${"═".repeat(104)}`);
      for (const axis of PROBE_EVIDENCE_AXES) {
        const any = usable.filter((p) => items(factsOf(p.url).evidence, axis).length > 0).length;
        console.log(`  ${pad(axis, 14)}${frac(any, usable.length)}`);
      }

      console.log(`\n${"═".repeat(104)}`);
      console.log("  [4] 🔴 DESCRIPTION 에서만 나온 축 — TITLE 이 못 준 것을 설명문이 메운 건수");
      console.log(`${"═".repeat(104)}`);
      for (const axis of IDENTITY_EVIDENCE_AXES) {
        const only = usable.filter(
          (p) =>
            hasFrom(factsOf(p.url).evidence, axis, "DESCRIPTION") && !hasFrom(factsOf(p.url).evidence, axis, "TITLE"),
        );
        console.log(`  ${pad(axis, 14)}${pad(String(only.length), 6)}${only.map((p) => p.id).join(" ")}`);
      }

      console.log(`\n${"═".repeat(104)}`);
      console.log("  [5] 건별 — 🔴 CEO 반례를 «이름으로» 같이 본다");
      console.log(`${"═".repeat(104)}`);
      for (const p of usable) {
        const f = factsOf(p.url);
        const axes = [...IDENTITY_EVIDENCE_AXES, ...PROBE_EVIDENCE_AXES]
          .map((a) => {
            const src = new Set(items(f.evidence, a).map((i) => (i.source === "TITLE" ? "T" : "D")));
            return src.size ? `${a}:${[...src].sort().join("")}` : "";
          })
          .filter(Boolean)
          .join(" ");
        console.log(
          `  ${pad(p.id, 7)}${pad(p.human, 10)}${pad(host(p.url), 22)}${pad(live.get(p.url)!.path, 14)}${f.description ? "desc✓" : "desc·"}  ${axes}`,
        );
      }

      console.log(`\n${"═".repeat(104)}`);
      console.log("  [6] 🔴🔴 matcher 불변 — Evidence 가 늘어도 verdict 가 바뀌면 «실패» 다");
      console.log(`${"═".repeat(104)}`);
      /** 🔴 증거를 떼어낸 facts 와 붙인 facts 를 **같은 운영 judge** 에 넣어 비교한다. */
      let changed = 0;
      for (const p of usable) {
        const f = factsOf(p.url);
        const { evidence: _x, ...withoutEvidence } = f;
        const a = same05Judge(p.origin, withoutEvidence as ProductFacts);
        const b = same05Judge(p.origin, f);
        if (String(a.cross.verdict) !== String(b.cross.verdict) || a.tier !== b.tier) {
          changed += 1;
          console.log(`  🔴 ${p.id} ${String(a.cross.verdict)}→${String(b.cross.verdict)} · ${a.tier}→${b.tier}`);
        }
      }
      console.log(`  verdict/tier 변화 **${changed}** 건  (기대 0)`);

      const live33 = same05Tally(
        (p) => (live.get(p.url)?.facts ? String(same05Judge(p.origin, factsOf(p.url)).cross.verdict) : "UNKNOWN"),
        usable,
      );
      console.log(`  ${fmtTally("LIVE", live33)}`);
      console.log(`  🔴 저장 GT 기준선(분모 33) = ${JSON.stringify(SAME05_BASELINE)} — 분모가 달라 **직접 비교 금지**`);

      /* ══════════════════════════════════════════════════════════════════════
       * 🔵🔵🔵 [7] STAGE 6 보완 — **원본 ↔ 후보 «실제 값» 비교표**(CPO 보완 요구 1·2·4)
       * ══════════════════════════════════════════════════════════════════════
       * 🔴 1차 보고가 **coverage(존재율)** 만 냈다. CPO 가 요구한 것은 **쌍 단위** 로
       *    「원본 값 ↔ 후보 값 ↔ 일치/불일치/누락 ↔ 사람 라벨」이다.
       * 🔴 설명문 축은 **값** 을 적는다 — 「5건 있었다」가 아니라 그 값의 **문자열** 이다.
       * 🟢 새 하니스·새 fixture **0** — 위에서 이미 받은 라이브 facts 를 그대로 쓴다.
       */
      const norm = (v: unknown) =>
        v == null ? null : String(v).toLowerCase().replace(/[^a-z0-9가-힣]/g, "") || null;
      /** 🔴 세 상태를 가른다 — **누락을 불일치로 세지 않는다**(CPO §6). */
      const cmp3 = (a: unknown, b: unknown): "일치" | "불일치" | "누락" => {
        const x = norm(a);
        const y = norm(b);
        if (x == null || y == null) return "누락";
        if (x === y || x.includes(y) || y.includes(x)) return "일치";
        return "불일치";
      };
      /** 🟢 설명문에서 그 축으로 **실제로 읽은 값**(추정 0 · 원문 유래). */
      const descVal = (f: ProductFacts, axis: string): string | null =>
        items(f.evidence, axis).find((i) => i.source === "DESCRIPTION")?.value ?? null;

      const FIELD: [string, (f: ProductFacts) => unknown][] = [
        ["BRAND", (f) => f.brand],
        ["MODEL_CODE", (f) => f.brandModelCode],
        ["TITLE", (f) => (f.coreTitleTokens ?? []).join(" ")],
        ["CATEGORY", (f) => f.categoryText],
        ["COLOR", (f) => f.colorText],
        ["MATERIAL", (f) => f.materialText],
        ["FIT", (f) => f.fitText],
      ];

      console.log(`\n${"═".repeat(104)}`);
      console.log("  [7] 🔵 STAGE 6 보완 — 원본 ↔ 후보 «실제 값» (사람 라벨별)");
      console.log(`${"═".repeat(104)}`);
      const fnRows: {
        id: string;
        verdict: string;
        tier: string;
        core: number;
        axes: string[];
        blk: string[];
        cf: string[];
      }[] = [];
      for (const label of ["SAME", "DIFFERENT"] as const) {
        const group = usable.filter((p) => p.human === label);
        console.log(`\n──── 사람 ${label} ${group.length}건 ────`);
        for (const p of group) {
          const f = factsOf(p.url);
          const o = p.origin;
          const j = same05Judge(o, f);
          const v = String(j.cross.verdict);
          console.log(
            `  ${pad(p.id, 6)} ${pad(host(p.url), 22)} sys=${pad(v, 14)} ` +
              FIELD.map(([ax, get]) => `${ax}:${cmp3(get(o), get(f))}`).join(" "),
          );
          for (const [ax, get] of FIELD) {
            const r = cmp3(get(o), get(f));
            if (r === "일치") continue;
            const d = descVal(f, ax);
            console.log(
              `        ${pad(ax, 12)} ${pad(r, 4)} 원본「${String(get(o) ?? "-").slice(0, 32)}」` +
                ` 후보「${String(get(f) ?? "-").slice(0, 32)}」${d ? ` 설명문「${d.slice(0, 28)}」` : ""}`,
            );
          }
          /**
           * 🔵🔵 [보완 4] FN = 사람 SAME 인데 시스템이 SAME 을 **«확정» 하지 못한 전부**.
           * 🔴 1차 보고의 「FN 11」이 그 정의다(`SAME 6/17`) ⟹ 거기엔 **PRESUMED_SAME 도
           *    들어간다.** 🔴 그래서 11 을 한 덩어리로 적으면 거짓이다 — verdict·tier 가
           *    다르면 **화면 결과가 다르다**. 아래 [8] 에서 갈라 센다.
           * 🟢 SAME 게이트는 `!blocked && brandOk && corePoints >= 5` 이고
           *    `!brandKnown → BRAND_UNCONFIRMED` · `brandKnown && !brandOk → BRAND_MISMATCH`
           *    가 **둘 다 blocker** 다(cross-seller:844·795) ⟹ 🟢 **blockers 가 비면
           *    brandOk 는 참** 이다 ⟹ 막는 것은 **①blocker ②corePoints<5** 둘뿐이다.
           */
          if (label === "SAME" && v !== "SAME") {
            const axesArr = (j.cross.axes ?? []) as { axis: string; points: number }[];
            /** 🔴 운영과 **같은 필터** — IMAGE 와 TITLE 1점은 SAME 정원에서 뺀다(cross-seller:1281). */
            const core = axesArr
              .filter((a) => a.axis !== "IMAGE" && !(a.axis === "TITLE" && a.points === 1))
              .reduce((s, a) => s + a.points, 0);
            fnRows.push({
              id: `${p.id}/${host(p.url)}`,
              verdict: v,
              tier: String(j.tier),
              core,
              axes: axesArr.map((a) => `${a.axis}${a.points}`),
              blk: (j.cross.blockers ?? []).map((b) =>
                typeof b === "string" ? b : String((b as { blocker: string }).blocker),
              ),
              cf: (j.cross.conflicts ?? []).map((c) =>
                typeof c === "string" ? c : String((c as { conflict: string }).conflict),
              ),
            });
          }
        }
      }

      console.log(`\n${"═".repeat(104)}`);
      console.log("  [8] 🔵 보완 4 — FN 을 «막는 것» (verdict·tier·게이트까지 같이 적는다)");
      console.log(`${"═".repeat(104)}`);
      const freq = new Map<string, number>();
      const byVerdict = new Map<string, number>();
      for (const r of fnRows) {
        /** 🔴 게이트를 **추측하지 않는다** — 운영 조건식 그대로 둘 중 어느 쪽인지 적는다. */
        const gate =
          r.blk.length > 0
            ? `blocker(${r.blk.join("·")})`
            : r.core < 5
              ? `corePoints ${r.core}<5`
              : "🔴 설명 안 됨(재조사)";
        console.log(
          `  ${pad(r.id, 30)} ${pad(r.verdict, 14)} tier=${pad(r.tier, 11)} core=${pad(String(r.core), 2)} ` +
            `게이트=${gate}`,
        );
        console.log(`        축[${r.axes.join(" ") || "-"}] 충돌[${r.cf.join("·") || "-"}]`);
        byVerdict.set(r.verdict, (byVerdict.get(r.verdict) ?? 0) + 1);
        for (const k of [...r.blk, ...r.cf.map((c) => `충돌:${c}`)]) freq.set(k, (freq.get(k) ?? 0) + 1);
        if (r.blk.length === 0 && r.core < 5) freq.set(`corePoints<5(축 부족)`, (freq.get(`corePoints<5(축 부족)`) ?? 0) + 1);
      }
      console.log(`\n  🔴 FN ${fnRows.length}건은 «한 덩어리가 아니다» — verdict 별`);
      for (const [k, n] of [...byVerdict].sort((a, b) => b[1] - a[1])) {
        console.log(`    ${pad(k, 20)} ${n}/${fnRows.length}`);
      }
      console.log(`\n  🔴 막는 것의 빈도 — 공통 원인이 있는가`);
      for (const [k, n] of [...freq].sort((a, b) => b[1] - a[1])) {
        console.log(`    ${pad(k, 36)} ${n}/${fnRows.length}`);
      }

      /* ══════════════════════════════════════════════════════════════════════
       * 🔵🔵 [9] 사람 DIFFERENT 8건이 **금액 자격까지 가는가**
       * ══════════════════════════════════════════════════════════════════════
       * 🔴 1차 보고의 「FP 0」은 **verdict 축**(sys SAME)이다. 🔴 그런데 돈이 움직이는
       *    축은 **tier** 다 — `COMPARISON` 은 국내 버킷과 해외 금액에 **들어간다**
       *    (market-intelligence: 국내 `EXACT|COMPARISON` · 해외는 `EXCLUDED` 만 뺀다).
       * ⟹ 🔴 「FP 0」을 **「틀린 가격이 안 들어간다」로 읽으면 안 된다.** 그것을 여기서 센다.
       */
      console.log(`\n${"═".repeat(104)}`);
      console.log("  [9] 🔵 사람 DIFFERENT 8건 — verdict ↔ tier ↔ 금액 자격");
      console.log(`${"═".repeat(104)}`);
      let diffInMoney = 0;
      for (const p of usable.filter((x) => x.human === "DIFFERENT")) {
        const j = same05Judge(p.origin, factsOf(p.url));
        const tier = String(j.tier);
        /** 🔴 운영 규칙 그대로 — 국내는 EXACT|COMPARISON · 해외는 EXCLUDED 제외. */
        const money = tier === "EXACT" || tier === "COMPARISON";
        if (money) diffInMoney += 1;
        const blk = (j.cross.blockers ?? [])
          .map((b) => (typeof b === "string" ? b : String((b as { blocker: string }).blocker)))
          .join("·");
        console.log(
          `  ${pad(p.id, 6)} ${pad(host(p.url), 22)} ${pad(String(j.cross.verdict), 14)} ` +
            `truth=${pad(j.truth, 20)} tier=${pad(tier, 11)} 금액자격=${money ? "🔴 예" : "🟢 아니오"}` +
            `  보류[${blk || "-"}]`,
        );
      }
      console.log(
        `\n  🔴 사람 DIFFERENT 중 **금액 자격을 얻는 것** = ${diffInMoney}/` +
          `${usable.filter((x) => x.human === "DIFFERENT").length}`,
      );

      /* ══════════════════════════════════════════════════════════════════════
       * 🔵🔵🔵 [10] **같은 분모에서 두 축을 나란히** — verdict 축 ↔ 금액 자격 축
       * ══════════════════════════════════════════════════════════════════════
       * 🔴 1차 보고가 `SAME 6/17 · FP 0` 만 적었다. 그것은 **verdict 축** 이고
       *    셀러가 보는 가격은 **tier 축** 에서 결정된다 ⟹ 두 축을 **같이** 적는다.
       * 🔴 이 숫자는 **이 표본(라이브 확보 25건)** 의 값이고 시스템 전체 성능이 아니다.
       */
      const money = (t: string) => t === "EXACT" || t === "COMPARISON";
      const axis2 = { sSame: 0, sMoney: 0, dSame: 0, dMoney: 0, sN: 0, dN: 0 };
      for (const p of usable) {
        if (p.human !== "SAME" && p.human !== "DIFFERENT") continue;
        const j = same05Judge(p.origin, factsOf(p.url));
        const isSame = String(j.cross.verdict) === "SAME";
        const inMoney = money(String(j.tier));
        if (p.human === "SAME") {
          axis2.sN += 1;
          if (isSame) axis2.sSame += 1;
          if (inMoney) axis2.sMoney += 1;
        } else {
          axis2.dN += 1;
          if (isSame) axis2.dSame += 1;
          if (inMoney) axis2.dMoney += 1;
        }
      }
      console.log(`\n${"═".repeat(104)}`);
      console.log("  [10] 🔵 두 축 — verdict(SAME 확정) ↔ 금액 자격(EXACT|COMPARISON)");
      console.log(`${"═".repeat(104)}`);
      console.log(`  사람 SAME ${axis2.sN}      verdict SAME ${axis2.sSame}/${axis2.sN}      금액 진입 ${axis2.sMoney}/${axis2.sN}`);
      console.log(`  사람 DIFFERENT ${axis2.dN}  verdict SAME ${axis2.dSame}/${axis2.dN}      금액 진입 🔴 ${axis2.dMoney}/${axis2.dN}`);
      console.log(
        `  🔴 금액 축 정밀도 ${axis2.sMoney}/${axis2.sMoney + axis2.dMoney} · ` +
          `재현 ${axis2.sMoney}/${axis2.sN}  ⟸ 🔴 verdict 축의 「FP ${axis2.dSame}」과 **다른 숫자다**`,
      );

      /* ══════════════════════════════════════════════════════════════════════
       * 🔵🔵 [11] 의류 형태 / 소매 길이 — **상세설명 «원문» 에서 그 말을 찾는다**
       * ══════════════════════════════════════════════════════════════════════
       * 🔴 CPO ③ 의 전제(「원상품은 반팔인데 후보는 Long Sleeve」)를 **원문으로** 확인한다.
       * 🔴 추정하지 않는다 — 그 단어가 **어느 문장에 있는지** 를 그대로 찍는다.
       * 🔴 그 단어가 없으면 **「정보 없음」** 이다(「반팔이다」로 읽지 않는다).
       */
      const FORM_WORDS = [
        "long sleeve",
        "long-sleeve",
        "longsleeve",
        "short sleeve",
        "short-sleeve",
        "sleeveless",
        "긴팔",
        "반팔",
        "민소매",
      ];
      console.log(`\n${"═".repeat(104)}`);
      console.log("  [11] 🔵 소매 길이 — 상세설명 원문 발췌(추정 0)");
      console.log(`${"═".repeat(104)}`);
      for (const p of usable) {
        const d = factsOf(p.url).description;
        const lower = (d ?? "").toLowerCase();
        const hits = FORM_WORDS.filter((w) => lower.includes(w));
        const snip = hits.length
          ? (() => {
              const i = lower.indexOf(hits[0]);
              return (d as string).slice(Math.max(0, i - 40), i + 50).replace(/\s+/g, " ");
            })()
          : null;
        console.log(
          `  ${pad(p.id, 6)} ${pad(host(p.url), 22)} human=${pad(p.human, 10)} ` +
            (d ? (hits.length ? `발견[${hits.join("·")}] 원문「…${snip}…」` : "🔴 그 말 없음(정보 없음)") : "🔴 설명문 없음"),
        );
      }

      /* ══════════════════════════════════════════════════════════════════════
       * 🔵🔵🔵 [12] 상세설명 유래 MODEL_CODE — **그 신호가 «맞았는가»**
       * ══════════════════════════════════════════════════════════════════════
       * 🔴 1차 보고가 「설명문 품번 5건 → 사람 SAME 1 : DIFFERENT 4 ⟹ 승격 금지」로 적었다.
       *    🔴 그것은 **라벨 분포** 이고 **신호의 정답률이 아니다.** 여기서 갈라 센다 —
       *    「품번이 **같다고** 말했는가 / **다르다고** 말했는가」 × 「사람 판정」.
       * 🔴 n=5 다 ⟹ **유효성 미확정** 으로만 적는다(폐기도 승격도 하지 않는다).
       */
      console.log(`\n${"═".repeat(104)}`);
      console.log("  [12] 🔵 상세설명 유래 MODEL_CODE — 신호 방향 ↔ 사람 판정");
      console.log(`${"═".repeat(104)}`);
      for (const p of usable) {
        const f = factsOf(p.url);
        const mc = items(f.evidence, "MODEL_CODE");
        const src = mc.map((i) => `${i.source}:${i.value}`).join(" ");
        if (!mc.some((i) => i.source === "DESCRIPTION")) continue;
        const agree = cmp3(p.origin.brandModelCode, f.brandModelCode);
        console.log(
          `  ${pad(p.id, 6)} ${pad(host(p.url), 22)} human=${pad(p.human, 10)} ` +
            `원본「${String(p.origin.brandModelCode ?? "-")}」 후보「${String(f.brandModelCode ?? "-")}」 ` +
            `신호=${pad(agree, 4)} 증거[${src}]`,
        );
      }

      /** 🔴 이 측정의 **유일한 PASS 조건** — 증거는 늘어도 판정은 그대로다. */
      expect(changed).toBe(0);
      expect(usable.length).toBeGreaterThan(0);
    },
    20 * 60 * 1000,
  );
});
