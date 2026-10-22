import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractCodeLikeSlugSegment, extractUrlSlug } from "@commerce/shared";

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * 🔴🔴🔴 WU-169 — **URL 안에 «이미 있는» 품번을 안전하게 회수할 수 있는가** (측정)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * CPO 지시(2026-10-23) — 「`MODEL_CODE` 비교 규칙이나 SAME threshold 를 **변경하지
 * 않고**, URL 안에 이미 존재하는 품번을 `extractUrlSlug` 가 놓치는 경우를 **안전하게
 * 회수할 수 있는지만** 검증한다」 · 「**정상 회수 / 오회수 / 미회수** 를 분리한다」.
 *
 * 🔴 `compareModelCode` **0** · SAME 규칙 **0** · `SAME_MIN_AXES` **0** · title **0** ·
 *    synonym/romanization **0** · fuzzy **0** · brand 규칙 **0** · 새 축 **0** ·
 *    threshold **0** · 운영 코드 **0** · 배포 **0**.
 * 🔴 게이트 `WU_169_PROBE=1` 없으면 SKIP.
 *
 * ── 🟢🟢 ① 기존 추출 구조(코드 실측 · 그대로 기준으로 쓴다) ──────────────────
 * ```
 * `extractUrlSlug(url)`                   → **마지막 경로 세그먼트** 하나(product-facts.ts:726)
 * `extractCodeLikeSlugSegment(slug)`      → 🔴 그 slug 의 **`split("-")[0]`**(첫 조각)만 보고
 *                                            길이·영숫자·글자+숫자 **둘 다** 요구(WU-095 가드)
 * `slugCarriesCode(facts, code)`(cross-seller.ts:679)
 *     → `slug` = `facts.urlSlug ?? extractUrlSlug(sourceUrl)`  ← 🔴 **마지막 세그먼트**
 *     → `slug.replace(/[^a-z0-9]/g,"").includes(code 정규화)`   · `code.length < 4` 면 false
 *     🟢 **양방향** 으로 부른다(대칭)
 * ⟹ 🔴 **건초더미가 「마지막 세그먼트」 하나** 라는 것이 WU-168 이 찾은 병목이다
 * ```
 *
 * ── 반사실 ─────────────────────────────────────────────────────────────────
 * ```
 * CF-0  현재 — 건초더미 = `extractUrlSlug(url)`(마지막 세그먼트)
 * CF-1  반사실 — 건초더미 = **URL pathname 전체**
 * 🔴 **비교 규칙은 한 글자도 바꾸지 않는다** — `includes` 와 `length<4` 가드 그대로다
 * ```
 */
const LIVE = process.env.WU_169_PROBE === "1";

/** 🔴 `slugCarriesCode` 의 정규화를 **그대로** 옮겼다(비교 규칙 변경 0). */
const norm = (s: string) => s.toLowerCase().normalize("NFKC").replace(/[^a-z0-9]/g, "");
/** 🔴 `code.length < 4` 가드도 그대로. */
const carries = (haystack: string, code: string) => (code.length < 4 ? false : norm(haystack).includes(norm(code)));

interface Row {
  src: string;
  origin: string;
  domain: string;
  url: string;
  human: string;
  last: string;
  cf0: boolean;
  cf1: boolean;
  /** 🟢 CF-1 에서 품번을 품은 **세그먼트** — 사람이 위치를 눈으로 확인하게 한다 */
  hitSeg: string | null;
  /** 🔴 품번이 **더 긴 영숫자 덩어리의 일부** 인가(다른 상품 코드 오인 위험) */
  substringOfLonger: boolean;
  /** 🔴 중간 세그먼트에 있는 **다른** code-like 토큰(WU-071 kids21 위험) */
  otherCodes: string[];
}

const CODE_LIKE = /\b(?=[a-z0-9]*[a-z])(?=[a-z0-9]*[0-9])[a-z0-9]{6,20}\b/g;

describe("WU-169 — URL 전체 경로 품번 회수 가능성", () => {
  it.runIf(LIVE)("정상 회수 / 오회수 / 미회수 를 분리해 센다", async () => {
    /* eslint-disable no-console */
    const dir = path.join(__dirname, "fixtures");
    const read = (f: string) => JSON.parse(readFileSync(path.join(dir, f), "utf8")) as Record<string, unknown>;
    const rows: Row[] = [];

    const push = (src: string, origin: string, domain: string, url: string, human: string) => {
      if (!origin || !url) return;
      let segs: string[] = [];
      let pathname = "";
      try {
        const u = new URL(url);
        pathname = decodeURIComponent(u.pathname);
        segs = pathname.split("/").filter(Boolean);
      } catch {
        return;
      }
      const last = extractUrlSlug(url) ?? "";
      const cf0 = carries(last, origin);
      /**
       * 🔴🔴 **1차에 `carries(pathname, origin)` 로 썼고 그것이 틀렸다.**
       *    `norm` 이 `/` 까지 지우므로 **세그먼트가 이어붙는다** —
       *    `…-b226ac009` + `/8891/` → `b226ac0098891` 이 되어 「더 긴 코드」로 오탐했다.
       * 🔴🔴 그리고 그것은 **실제 위험** 이다 — 이어붙이면 `/b226/ac009/` 같은 URL 이
       *    **세그먼트 경계를 넘어 거짓 일치** 를 만든다. 🟢 그래서 **세그먼트별** 로 본다.
       *    🔴 이 사실은 나중에 구현할 때의 **설계 조건** 이다(pathname 통째 금지).
       */
      const cf1 = segs.some((s) => carries(s, origin));
      const hitSeg = segs.find((s) => carries(s, origin)) ?? null;
      /** 🔴 **걸린 세그먼트 «안» 에서만** 본다 — 품번 뒤에 영숫자가 더 붙었는가. */
      const substringOfLonger = (() => {
        if (!hitSeg) return false;
        const n = norm(hitSeg);
        const c = norm(origin);
        const at = n.indexOf(c);
        return at >= 0 && /[a-z0-9]/.test(n[at + c.length] ?? "");
      })();
      const middle = segs.slice(0, -1).join(" ").toLowerCase();
      const otherCodes = [...new Set(middle.match(CODE_LIKE) ?? [])].filter((t) => norm(t) !== norm(origin));
      rows.push({ src, origin, domain, url, human, last, cf0, cf1, hitSeg, substringOfLonger, otherCodes });
    };

    const g112 = read("wu-112-human-gt.json") as { candidates: { originCode: string; domain: string; url: string; verdict: string }[] };
    for (const c of g112.candidates) push("wu-112", c.originCode, c.domain, c.url, c.verdict);
    const g111 = read("wu-111-human-gt.json") as { candidates: { originCode: string; domain: string; url: string; humanVerdict: string }[] };
    for (const c of g111.candidates) push("wu-111", c.originCode, c.domain, c.url, c.humanVerdict);
    const g116 = read("wu-116-human-gt.json") as { candidates: { originCode: string; domain: string; url: string; humanVerdict: string }[] };
    for (const c of g116.candidates) push("wu-116", c.originCode, c.domain, c.url, c.humanVerdict);
    const g125 = read("wu-125-human-gt.json") as { candidates: { origin: string; host: string; url: string; human: string }[] };
    for (const c of g125.candidates) push("wu-125", c.origin, c.host, c.url, c.human);

    console.log("\n══════ 🔴 ② 전체 path 반사실 ══════");
    console.log(`  분모 **${rows.length}** (wu-112/111/116/125 의 URL+human 전수)`);
    const recovered = rows.filter((r) => !r.cf0 && r.cf1);
    const kept = rows.filter((r) => r.cf0 && r.cf1);
    const none = rows.filter((r) => !r.cf0 && !r.cf1);
    const lost = rows.filter((r) => r.cf0 && !r.cf1);
    const tally = (xs: Row[]) => `SAME ${xs.filter((x) => x.human === "SAME").length} · DIFFERENT ${xs.filter((x) => x.human === "DIFFERENT").length} · 그외 ${xs.filter((x) => x.human !== "SAME" && x.human !== "DIFFERENT").length}`;
    console.log(`  🟢 **새로 회수** ${recovered.length} (${tally(recovered)})`);
    console.log(`  🟢 기존 유지     ${kept.length} (${tally(kept)})`);
    console.log(`  🔴 미회수       ${none.length} (${tally(none)})`);
    console.log(`  🔴 **잃은 것**   ${lost.length}${lost.length ? " ← 있으면 반사실이 잘못됐다" : ""}`);

    console.log("\n  ── 새로 회수된 것 전수(위치를 같이 적는다) ──");
    for (const r of recovered) {
      console.log(
        `    ${r.human.padEnd(10)} ${r.domain.padEnd(22)} 품번=${r.origin.padEnd(11)}` +
          ` 마지막="${r.last.slice(0, 18)}" → 걸린 세그먼트 "${String(r.hitSeg).slice(0, 44)}"` +
          `${r.substringOfLonger ? "  🔴 **더 긴 코드의 일부**" : ""}`,
      );
    }

    console.log("\n══════ 🔴🔴 ③ 통제군 ══════");
    for (const key of ["biskuit", "trenbe", "luxboy"]) {
      const hits = rows.filter((r) => r.domain.includes(key));
      for (const r of hits) {
        const want = key === "luxboy" ? "NO" : "YES";
        const got = r.cf1 ? "YES" : "NO";
        console.log(
          `  ${key.padEnd(10)} human ${r.human.padEnd(10)} CF-0 ${r.cf0 ? "YES" : "NO "} → CF-1 **${got}**` +
            `  기대 ${want}  ${got === want ? "🟢" : "🔴 **기대 불일치**"}`,
        );
      }
      if (hits.length === 0) console.log(`  ${key.padEnd(10)} 🔴 분모에 없다`);
    }

    console.log("\n══════ 🔴🔴 ④⑤ 오회수 · SKU 오인 위험 ══════");
    const falseId = recovered.filter((r) => r.human === "DIFFERENT");
    console.log(`  🔴 **DIFFERENT 가 새로 identifier 를 얻은 것 = ${falseId.length}**`);
    for (const r of falseId) console.log(`    🔴 ${r.domain} ${r.url.slice(0, 96)}`);
    /**
     * 🔴🔴 **1차 판정식이 과도했다** — 「더 긴 코드의 일부」를 전체에서 세어
     *    `trenbe`(CF-0 에서 **이미** 일치하던 human SAME)까지 위험으로 찍고 「GO 아님」을
     *    냈다. 🔴 이 WU 가 묻는 것은 **「CF-1 이 «새로» 만드는 위험」** 이다.
     * 🟢 그래서 **신규 회수분에서만** 세고, 기존분은 **따로** 적는다.
     */
    const longerNew = recovered.filter((r) => r.substringOfLonger);
    const longerPre = rows.filter((r) => r.cf0 && r.substringOfLonger);
    console.log(`  🔴 **신규 회수 중** 품번이 더 긴 코드의 일부 = ${longerNew.length}`);
    for (const r of longerNew) console.log(`    🔴 ${r.domain} ${r.hitSeg}`);
    console.log(`  🟡 (참고) **기존에도 그랬던 것** = ${longerPre.length} — CF-1 이 만든 위험이 아니다`);
    for (const r of longerPre) console.log(`    🟡 ${r.human} ${r.domain} ${String(r.hitSeg).slice(0, 70)}`);
    const longer = longerNew;
    const withOther = rows.filter((r) => r.otherCodes.length > 0);
    console.log(`  🟡 중간 세그먼트에 **다른 code-like 토큰** 이 있는 URL = ${withOther.length}`);
    for (const r of withOther.slice(0, 8)) console.log(`    ${r.domain.padEnd(22)} ${JSON.stringify(r.otherCodes.slice(0, 4))}`);
    console.log("  🟢 단 `slugCarriesCode` 는 **원상품 품번을 substring 으로 찾는다** —");
    console.log("     다른 토큰이 있어도 **그것을 품번으로 승격하지 않는다**(비교 규칙 불변)");

    /** 🔴 숫자-only 가드가 **그대로 사는지** 확인한다(WU-095 계약). */
    console.log("\n══════ 🟢 숫자-only 가드 유지 확인 ══════");
    for (const s of ["1", "8891", "70", "display", "b226ac009"]) {
      console.log(`  extractCodeLikeSlugSegment("${s}") = ${JSON.stringify(extractCodeLikeSlugSegment(s))}`);
    }

    console.log("\n══════ 🔴🔴 ⑥ 판정 ══════");
    const bisk = rows.find((r) => r.domain.includes("biskuit"));
    const tren = rows.find((r) => r.domain.includes("trenbe"));
    const lux = rows.find((r) => r.domain.includes("luxboy"));
    const ok =
      Boolean(bisk?.cf1) && Boolean(tren?.cf1) && !lux?.cf1 && falseId.length === 0 && longer.length === 0 && lost.length === 0;
    console.log(
      `  통제군 — 비스킷 ${bisk?.cf1 ? "🟢" : "🔴"} · 트렌비 ${tren?.cf1 ? "🟢" : "🔴"} · 럭스보이 ${lux?.cf1 ? "🔴 열렸다" : "🟢 안 열림"}`,
    );
    console.log(`  오회수 ${falseId.length} · 더긴코드 ${longer.length} · 잃은것 ${lost.length}`);
    console.log(
      `  ⟹ ${ok ? "🟡 **GO 조건 충족** — 🔴 단 분모/표본 한계를 같이 본다(아래)" : "🔴 **GO 아님**"}`,
    );
    console.log(`  🔴 분모 ${rows.length} · 원상품 소수`);
    console.log("  🔴 그리고 이 측정은 **「후보 URL 이 원상품 품번을 품는가」 한 방향** 이다 —");
    console.log("     slugCarriesCode 는 양방향이지만 반대 방향은 **후보 품번** 이 필요하고");
    console.log("     그것이 전건 null 이라(WU-168 실측) **측정 불가** 다");

    /** 🔴 측정이다 — 숫자를 단언해 고정하지 않는다. */
    expect(rows.length).toBeGreaterThan(0);
  }, 300_000);
});
