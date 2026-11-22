import { readFileSync, writeFileSync } from "node:fs";

import { dirname, join as pjoin } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = pjoin(
  HERE,
  "..",
  "apps/admin/src/app/api/price-history/_lib/__tests__/fixtures/mcrw01-workspace.json",
);
/**
 * 🔵 MI-CEO-REVIEW-WORKSPACE-01 — CEO 판정 워크스페이스 생성기(WU-093 선례).
 * 🔴 산출물은 **자립형** 이다 — 외부 호스트 참조 0(Artifact CSP) · 이미지는 `data:` URI.
 * 🔴 판정을 **채우지 않는다** · 원문을 **변형하지 않는다** · 값을 **지어내지 않는다**.
 * 사용: node scripts/mcrw01-build-workspace.mjs [출력경로]
 */
const OUT = process.argv[2] ?? "mcrw01-workspace.html";

const d = JSON.parse(readFileSync(SRC, "utf8"));
const esc = (s) =>
  String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const all = d.rows.flatMap((r) => r.candidates);
const T = {
  origins: d.rows.length,
  candidates: all.length,
  img: all.filter((c) => c.image.dataUri).length,
  desc: all.filter((c) => c.descriptionChars > 0).length,
  codeMatch: all.filter((c) => c.codeVerdict === "일치").length,
  codeConflict: all.filter((c) => c.codeVerdict === "불일치").length,
  codeNA: all.filter((c) => c.codeVerdict === "비교 불가").length,
  fail: all.filter((c) => c.fetchStatus !== "OK").length,
};

const V = { "일치": "ok", "불일치": "bad", "비교 불가": "na" };
const pill = (txt, cls) => `<span class="pill ${cls}">${esc(txt)}</span>`;
const dash = (v) => (v == null || String(v).trim() === "" ? null : String(v));

/** 🔴 원상품 ↔ 후보 한 쌍을 같은 줄에 — 다르면 표시한다. 🔴 값을 만들지 않는다. */
const diffRow = (label, a, b) => {
  const av = dash(a);
  const bv = dash(b);
  const state = av == null || bv == null ? "na" : av.toLowerCase() === bv.toLowerCase() ? "ok" : "bad";
  const mark = state === "ok" ? "같음" : state === "bad" ? "다름" : "확인 불가";
  return `
            <tr class="${state}">
              <th>${esc(label)}</th>
              <td>${av ? esc(av) : '<em>미확보</em>'}</td>
              <td>${bv ? esc(bv) : '<em>미확보</em>'}</td>
              <td class="verdict">${pill(mark, state)}</td>
            </tr>`;
};

const imgBox = (im, alt) =>
  im.dataUri
    ? `<img src="${im.dataUri}" alt="${esc(alt)}" loading="lazy">`
    : `<div class="noimg"><b>이미지 미확보</b><span>${esc(im.note)}</span></div>`;

const excerpt = (label, v) =>
  v
    ? `<div class="ex"><span class="exl">${esc(label)}</span><blockquote>${esc(v)}</blockquote></div>`
    : `<div class="ex"><span class="exl">${esc(label)}</span><p class="none">발췌 없음</p></div>`;


/**
 * 🔵🔵 CPO 완료기준 ② — **품번 충돌과 판매처 자체 번호는 «전혀 다른 상황»** 이다.
 *    🔴 그런데 `nickis` 는 구조화 품번이 `null` 이라 「판매처 자체 번호」로도 잡히지
 *       않았다 — 그 번호는 **URL 에** 있다(`…-mehrfarbig-7400851022`).
 * 🟢 그래서 **URL 꼬리의 숫자만인 세그먼트** 를 «표시 전용» 으로 읽는다 —
 *    🔴 모델 품번으로 쓰지 않는다(화면이 그 문장을 같이 적는다) · 새 판정 규칙 0.
 */
const sellerNumberFromUrl = (url) => {
  try {
    const last = new URL(url).pathname.split("/").filter(Boolean).pop() ?? "";
    const tail = last.split("-").pop() ?? "";
    return /^[0-9]{6,}$/.test(tail) ? tail : null;
  } catch {
    return null;
  }
};

const candidate = (c, gi, ci) => {
  const id = `c${gi}-${ci}`;
  const codeCls = V[c.codeVerdict];
  return `
        <article class="cand" id="${id}" data-verdict-row="${id}">
          <header class="ch">
            <div>
              <h4>${esc(c.domain ?? "(도메인 없음)")}</h4>
              <p class="ct">${esc(c.title ?? "(제목 없음)")}</p>
            </div>
            <div class="chips">
              ${pill(c.market, "mkt")}
              ${pill("품번 " + c.codeVerdict, codeCls)}
              <span class="chip">자동판정 ${esc(c.systemVerdict ?? "없음")}</span>
              <span class="chip${c.fetchStatus === "OK" ? "" : " warn"}">${esc(c.fetchStatus)}</span>
            </div>
          </header>

          <div class="cbody">
            <div class="pics">
              <figure><figcaption>원상품</figcaption>${
                ORIGIN_IMG[gi].dataUri
                  ? `<div class="oref" style="background-image:var(--oimg-${gi})" role="img" aria-label="원상품 이미지"></div>`
                  : imgBox(ORIGIN_IMG[gi], "원상품")
              }</figure>
              <figure><figcaption>후보</figcaption>${imgBox(c.image, c.domain ?? "후보")}</figure>
            </div>

            <div class="cmp">
              <table class="three">
                <thead><tr><th></th><th>원상품</th><th>후보</th><th>결과</th></tr></thead>
                <tbody>
                  <tr class="${c.brandState}">
                    <th>브랜드</th>
                    <td>${esc(ORIGIN_META[gi].brand ?? "미확보")}</td>
                    <td>${c.brand ? esc(c.brand) : "<em>구조화 없음</em>"}</td>
                    <td class="verdict">${pill(c.brandMark, c.brandState)}</td>
                  </tr>
                  <tr class="${codeCls}">
                    <th>품번</th>
                    <td>${esc(ORIGIN_META[gi].opCode ?? "없음")}<br><span class="src">${esc(ORIGIN_META[gi].opCodeSource)}</span></td>
                    <td>${c.modelCode.value ? esc(c.modelCode.value) : "<em>모델 품번 없음</em>"}<br><span class="src">${esc(c.modelCode.source)}</span>${
                      c.sellerSku
                        ? `<br><span class="sku">판매처 자체 번호 ${esc(c.sellerSku)} — 모델 품번으로 쓰지 않습니다</span>`
                        : ""
                    }${
                      !c.sellerSku && !c.modelCode.value && sellerNumberFromUrl(c.url)
                        ? `<br><span class="sku">URL 의 판매처 자체 번호 ${esc(sellerNumberFromUrl(c.url))} — 숫자만이라 모델 품번으로 쓰지 않습니다</span>`
                        : ""
                    }</td>
                    <td class="verdict">${pill(c.codeVerdict, codeCls)}</td>
                  </tr>
                  <tr class="${c.nameState}">
                    <th>상품명</th>
                    <td>${esc(ORIGIN_META[gi].title)}</td>
                    <td>${esc(c.title ?? "미확보")}</td>
                    <td class="verdict">${pill(c.nameMark, c.nameState)}</td>
                  </tr>
                </tbody>
              </table>

              <table class="three diffs">
                <thead><tr><th></th><th>원상품</th><th>후보</th><th>결과</th></tr></thead>
                <tbody>
${diffRow("상품군", ORIGIN_META[gi].categoryText, c.categoryText)}
${diffRow("색상", ORIGIN_META[gi].colorText, c.colorText)}
${diffRow("소재", ORIGIN_META[gi].materialText, c.materialText)}
${diffRow("제품 형태", ORIGIN_META[gi].fitText, c.fitText)}
${diffRow("사이즈", (ORIGIN_META[gi].sizeLabels ?? []).join(", "), (c.sizeLabels ?? []).join(", "))}
${diffRow("대상", (ORIGIN_META[gi].audienceSignals ?? []).join(", "), (c.audienceSignals ?? []).join(", "))}
                </tbody>
              </table>
            </div>
          </div>

          <div class="ev">
            <h5>상세설명 근거 ${c.descriptionChars > 0 ? `<span class="src">${c.descriptionChars}자 · 수집 ${esc(String(c.collectedAt).slice(0, 16).replace("T", " "))}</span>` : ""}</h5>
            ${
              c.descriptionChars > 0
                ? excerpt("브랜드", c.excerpts.brand) + excerpt("품번", c.excerpts.code) + excerpt("상품명", c.excerpts.name) +
                  `<details><summary>상세설명 원문 전체 (${c.descriptionChars}자 · 번역·보정 없음)</summary><pre>${esc(c.descriptionRaw)}</pre></details>`
                : `<p class="unk"><b>확인 불가</b> — 상세설명 원문을 받지 못했습니다(${esc(c.fetchStatus)}). 「없음」이 아닙니다.</p>`
            }
            <details class="mi">
              <summary>기존 MI 자동 판정 근거 (${(c.blockers ?? []).length} blocker · ${(c.matchReasons ?? []).length} reason)</summary>
              <dl class="meta">
                <dt>판정 / truth / tier</dt><dd>${esc(c.systemVerdict ?? "-")} / ${esc(c.matchTruth ?? "-")} / ${esc(c.priceTier ?? "-")}</dd>
                <dt>blocker</dt><dd>${(c.blockers ?? []).length ? esc(c.blockers.join(" · ")) : "없음"}</dd>
                <dt>match reasons</dt><dd>${(c.matchReasons ?? []).length ? esc(c.matchReasons.join(" · ")) : "없음"}</dd>
                <dt>수집 경로</dt><dd>${esc(c.fetchPath ?? "-")}</dd>
                <dt>후보 URL</dt><dd><a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.url)}</a></dd>
              </dl>
            </details>
          </div>

          <fieldset class="verdictbox" data-id="${id}" data-domain="${esc(c.domain ?? "-")}" data-url="${esc(c.url)}">
            <legend>대표님 판정</legend>
            <div class="opts">
              <label><input type="radio" name="v-${id}" value="SAME"><span>동일상품</span></label>
              <label><input type="radio" name="v-${id}" value="DIFFERENT"><span>다른 상품</span></label>
              <label><input type="radio" name="v-${id}" value="HOLD"><span>판단 보류</span></label>
            </div>
            <textarea rows="2" placeholder="판정 메모 — 무엇을 보고 그렇게 판단하셨는지"></textarea>
          </fieldset>
        </article>`;
};

/* ── 원상품 메타를 미리 펼쳐 둔다(카드가 매번 참조한다) ── */
const ORIGIN_META = d.rows.map((r) => r);
const ORIGIN_IMG = d.rows.map((r) => r.image);

/* ── 후보에 브랜드/상품명 판정을 붙인다(화면 전용 · 판정 아님) ── */
const GENERIC = new Set(
  ("dress jacket pants trousers jeans shirt sweatshirt coat anorak cap backpack blouse tunique outer top set suit puffer " +
    "denim woven knit knitted reversible print printed gingham tartan cotton organic polyester nylon wool linen fur faux mixed media " +
    "long short sleeve sleeves sleeved blue black white red pink green brown grey gray beige cream ecru navy burgundy lilac coral lemon " +
    "natural mix melange mehrfarbig kids baby boys girls girl boy child junior aw26 ss26 exclusive preorder copy new the and with for by in of").split(" "),
);
const norm = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9가-힣]/g, "");
const idTokens = (t) => [
  ...new Set(
    String(t ?? "").toLowerCase().replace(/[^a-z0-9가-힣\s]/g, " ").split(/\s+/).filter((x) => x.length >= 3 && !GENERIC.has(x)),
  ),
];
d.rows.forEach((r) => {
  const ob = norm(r.brand);
  const ot = idTokens(r.title);
  r.candidates.forEach((c) => {
    const cb = norm(c.brand);
    const cn = norm(c.title);
    const brandOk = ob && ((cb && ob === cb) || cn.includes(ob));
    c.brandState = ob && (cb || cn) ? (brandOk ? "ok" : "bad") : "na";
    c.brandMark = c.brandState === "ok" ? "일치" : c.brandState === "bad" ? "불일치" : "확인 불가";
    const m = ot.filter((t) => cn.includes(norm(t)));
    const need = ot.length <= 1 ? 1 : 2;
    c.nameState = ot.length === 0 ? "na" : m.length >= need ? "ok" : "bad";
    c.nameMark = c.nameState === "ok" ? `식별어 ${m.length}개 연결` : c.nameState === "bad" ? "일반 단어만" : "확인 불가";
  });
});

const group = (r, gi) => `
      <section class="grp" data-group="${esc(r.group)}"${
        r.image.dataUri ? ` style="--oimg-${gi}:url('${r.image.dataUri}')"` : ""
      }>
        <aside class="origin">
          <div class="oin">
            <p class="eye">${esc(r.group)} · 원상품 ${gi + 1}/${d.rows.length}</p>
            <div class="oimg">${imgBox(r.image, "원상품")}</div>
            <h2>${esc(r.title)}</h2>
            <dl class="meta">
              <dt>브랜드</dt><dd>${esc(r.brand ?? "미확보")}</dd>
              <dt>운영 품번</dt><dd><b>${esc(r.opCode ?? "없음")}</b> <span class="src">${esc(r.opCodeSource)}</span></dd>
              <dt>DB SKU</dt><dd>${esc(r.dbSku ?? "없음")} <span class="src">운영 품번과 다른 칸입니다</span></dd>
              <dt>상품군</dt><dd>${esc(r.categoryText ?? "미확보")}</dd>
              <dt>색상</dt><dd>${esc(r.colorText ?? "미확보")}</dd>
              <dt>소재</dt><dd>${esc(r.materialText ?? "미확보")}</dd>
              <dt>제품 형태</dt><dd>${esc(r.fitText ?? "미확보")}</dd>
              <dt>사이즈</dt><dd>${esc((r.sizeLabels ?? []).join(", ") || "미확보")}</dd>
              <dt>대상</dt><dd>${esc((r.audienceSignals ?? []).join(", ") || "미확보")}</dd>
            </dl>
            <details><summary>원상품 상세설명 (${r.descriptionChars}자)</summary><pre>${esc(r.descriptionRaw)}</pre></details>
            <a class="ourl" href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.url)}</a>
            <p class="ocount">후보 <b>${r.candidates.length}</b>건 · <span data-grpdone="${gi}">0</span> 판정</p>
          </div>
        </aside>
        <div class="cands">
${r.candidates.map((c, ci) => candidate(c, gi, ci)).join("\n")}
        </div>
      </section>`;

const html = `<title>CEO 상품 동일성 판정 워크스페이스</title>
<style>
  :root{--paper:#FBFAF8;--ink:#1A1A20;--mid:#6B6B78;--rule:#E2DFD8;--deep:#2E3A5C;--soft:#EEF0F6;
    --ok:#1F6F4A;--okbg:#E6F0EA;--bad:#9B2C2C;--badbg:#F6E8E8;--na:#8A6D1F;--nabg:#F7F1DF;
    --sans:"Pretendard","Apple SD Gothic Neo","Malgun Gothic","Segoe UI",system-ui,sans-serif;
    --serif:"Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua",Georgia,serif;
    --mono:ui-monospace,"Cascadia Mono",Consolas,"D2Coding","Courier New",monospace;}
  *{box-sizing:border-box}
  body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--sans);font-size:15px;line-height:1.6;-webkit-font-smoothing:antialiased}
  .wrap{max-width:1320px;margin:0 auto;padding:0 20px 110px}

  .top{border-bottom:2px solid var(--deep);padding:36px 0 20px}
  .top h1{font-family:var(--serif);font-size:29px;margin:0 0 6px;font-weight:600;text-wrap:balance}
  .top p{color:var(--mid);margin:0 0 20px;max-width:64ch}
  .tally{display:flex;flex-wrap:wrap;border:1px solid var(--rule);background:#fff}
  .tally div{padding:10px 17px;border-right:1px solid var(--rule)}
  .tally div:last-child{border-right:0}
  .tally b{display:block;font-size:21px;font-variant-numeric:tabular-nums}
  .tally span{font-size:11px;color:var(--mid);text-transform:uppercase;letter-spacing:.07em}
  .howto{margin-top:18px;padding:13px 17px;background:var(--soft);border-left:3px solid var(--deep);font-size:13.5px}
  .howto p{margin:0 0 5px}.howto p:last-child{margin:0}.howto b{color:var(--deep)}
  .filters{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:16px;font-size:13px}
  .filters button{font-family:var(--sans);font-size:13px;padding:6px 13px;border:1px solid var(--rule);background:#fff;cursor:pointer}
  .filters button[aria-pressed="true"]{border-color:var(--deep);box-shadow:inset 0 0 0 1px var(--deep);font-weight:650}
  .filters button:focus-visible{outline:2px solid var(--deep);outline-offset:2px}

  .grp{display:grid;grid-template-columns:320px 1fr;gap:26px;align-items:start;padding:34px 0;border-bottom:1px solid var(--rule)}
  .origin{position:sticky;top:14px}
  .oin{background:#fff;border:1px solid var(--rule);border-top:3px solid var(--deep);padding:16px}
  .eye{margin:0 0 10px;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--deep);font-weight:600}
  .oimg{margin-bottom:12px}
  .oimg img{width:100%;height:auto;display:block;border:1px solid var(--rule);background:#fff}
  .origin h2{font-family:var(--serif);font-size:18px;line-height:1.3;margin:0 0 10px;font-weight:600;text-wrap:balance}
  .ourl{display:block;margin-top:10px;font-family:var(--mono);font-size:10.5px;color:var(--mid);word-break:break-all;text-decoration:none;border-bottom:1px solid var(--rule)}
  .ocount{margin:11px 0 0;padding-top:9px;border-top:1px dashed var(--rule);font-size:12px;color:var(--mid)}

  .cands{display:flex;flex-direction:column;gap:18px;min-width:0}
  .cand{background:#fff;border:1px solid var(--rule)}
  .cand.hide{display:none}
  .ch{display:flex;flex-wrap:wrap;gap:9px 16px;justify-content:space-between;align-items:flex-start;padding:13px 16px;border-bottom:1px solid var(--rule)}
  .ch h4{margin:0 0 2px;font-size:15.5px;font-weight:650}
  .ct{margin:0;font-size:13px;color:var(--mid)}
  .chips{display:flex;flex-wrap:wrap;gap:6px}
  .chip{font-size:11.5px;padding:3px 9px;border:1px solid var(--rule);color:var(--mid);background:#FCFCFB;white-space:nowrap}
  .chip.warn{border-color:var(--na);color:var(--na);background:var(--nabg)}
  .pill{font-size:11.5px;padding:2px 9px;border-radius:2px;font-weight:600;white-space:nowrap}
  .pill.ok{background:var(--okbg);color:var(--ok)}
  .pill.bad{background:var(--badbg);color:var(--bad)}
  .pill.na{background:var(--nabg);color:var(--na)}
  .pill.mkt{background:transparent;border:1px solid var(--deep);color:var(--deep);font-weight:500}

  .cbody{display:grid;grid-template-columns:230px 1fr;gap:16px;padding:15px 16px;border-bottom:1px solid var(--rule)}
  .pics{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  .pics figure{margin:0}
  .pics figcaption{font-size:10.5px;color:var(--mid);text-transform:uppercase;letter-spacing:.07em;margin-bottom:4px}
  .pics img{width:100%;height:auto;display:block;border:1px solid var(--rule);background:#fff}
  .oref{width:100%;aspect-ratio:1/1;border:1px solid var(--rule);background-color:#fff;background-size:contain;background-position:center;background-repeat:no-repeat}
  .noimg{border:1px dashed var(--rule);background:#FCFCFB;padding:14px 8px;text-align:center;font-size:11px;color:var(--mid);min-height:92px;display:flex;flex-direction:column;justify-content:center;gap:3px}
  .noimg b{color:var(--na);font-size:11.5px}

  .cmp{min-width:0;display:flex;flex-direction:column;gap:12px}
  table.three{width:100%;border-collapse:collapse;font-size:13px;table-layout:fixed}
  table.three thead th{font-size:10.5px;color:var(--mid);text-transform:uppercase;letter-spacing:.07em;text-align:left;padding:0 8px 5px;font-weight:600}
  table.three thead th:first-child{width:84px}
  table.three thead th:last-child{width:104px}
  table.three th[scope],table.three tbody th{text-align:left;font-weight:650;color:var(--deep);font-size:12px;padding:7px 8px;vertical-align:top;white-space:nowrap}
  table.three td{padding:7px 8px;vertical-align:top;word-break:break-word;border-top:1px solid var(--rule)}
  table.three tbody th{border-top:1px solid var(--rule)}
  table.three tr.bad td,table.three tr.bad th{background:#FDF6F6}
  table.three tr.na td,table.three tr.na th{background:#FDFBF4}
  table.three .verdict{text-align:right}
  table.three em{color:var(--mid);font-size:12px}
  .src{font-size:10.5px;color:var(--mid)}
  .sku{display:inline-block;margin-top:3px;font-size:10.5px;color:var(--na);background:var(--nabg);padding:1px 6px}
  .diffs thead th{padding-top:4px}

  .ev{padding:14px 16px;background:#FCFCFB;border-bottom:1px solid var(--rule)}
  .ev h5{margin:0 0 9px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--deep)}
  .ex{display:grid;grid-template-columns:62px 1fr;gap:9px;margin-bottom:7px;align-items:start}
  .exl{font-size:11.5px;color:var(--mid);padding-top:3px}
  .ex blockquote{margin:0;padding:7px 10px;background:#fff;border-left:2px solid var(--deep);font-family:var(--mono);font-size:11.5px;line-height:1.55;word-break:break-word}
  .ex .none{margin:3px 0;font-size:12px;color:var(--mid);font-style:italic}
  .unk{margin:0;padding:9px 11px;background:var(--nabg);font-size:12.5px}
  .unk b{color:var(--na)}
  details{margin-top:9px}
  details summary{cursor:pointer;font-size:12px;color:var(--deep)}
  details pre{margin:8px 0 0;padding:10px;background:#fff;border:1px solid var(--rule);font-family:var(--mono);font-size:11.5px;line-height:1.6;white-space:pre-wrap;word-break:break-word;max-height:300px;overflow-y:auto}
  dl.meta{display:grid;grid-template-columns:140px 1fr;gap:3px 12px;margin:8px 0 0;font-size:12.5px}
  dl.meta dt{color:var(--mid)}
  dl.meta dd{margin:0;word-break:break-word}
  .origin dl.meta{grid-template-columns:72px 1fr;font-size:12.5px}

  .verdictbox{margin:0;padding:12px 16px;border:0;border-top:2px solid var(--deep);background:var(--soft)}
  .verdictbox legend{padding:0;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--deep)}
  .opts{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0 9px}
  .opts label{display:inline-flex;align-items:center;gap:6px;padding:6px 13px;background:#fff;border:1px solid var(--rule);cursor:pointer;font-size:13.5px}
  .opts label:has(input:checked){border-color:var(--deep);box-shadow:inset 0 0 0 1px var(--deep);font-weight:650}
  .opts input{accent-color:var(--deep);margin:0}
  .opts label:focus-within{outline:2px solid var(--deep);outline-offset:2px}
  .verdictbox textarea{width:100%;font-family:var(--sans);font-size:13px;padding:8px 10px;border:1px solid var(--rule);background:#fff;resize:vertical}
  .verdictbox textarea:focus-visible{outline:2px solid var(--deep);outline-offset:1px}

  .bar{position:fixed;bottom:0;left:0;right:0;background:var(--ink);color:#fff;padding:10px 20px;display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:center;font-size:13px;z-index:30}
  .bar b{font-variant-numeric:tabular-nums}
  .bar button{font-family:var(--sans);font-size:13px;font-weight:600;padding:7px 15px;background:#fff;color:var(--ink);border:0;cursor:pointer}
  .bar button:focus-visible{outline:2px solid #fff;outline-offset:2px}
  .bar .note{color:#C9C6BE;font-size:11.5px}
  #out{display:none;max-width:1320px;margin:0 auto 96px}
  #out textarea{width:100%;min-height:240px;font-family:var(--mono);font-size:12px;padding:12px;border:1px solid var(--rule)}

  @media (max-width:1040px){
    .grp{grid-template-columns:1fr}.origin{position:static}
    .cbody{grid-template-columns:1fr}
    .pics{grid-template-columns:1fr 1fr;max-width:330px}
  }
  @media (max-width:620px){
    table.three{font-size:12px}table.three thead th:first-child{width:66px}
    dl.meta,.origin dl.meta{grid-template-columns:1fr}
    dl.meta dt{margin-top:5px}
  }
  @media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
</style>

<div class="wrap">
  <header class="top">
    <h1>상품 동일성 판정 워크스페이스</h1>
    <p>원상품 ${T.origins}개와 후보 ${T.candidates}개를 한 화면에서 비교합니다. 후보 페이지를 열지 않고도 이미지 · 브랜드 · 품번 · 상품명 · 색상 · 소재 · 형태 · 상세설명 원문을 나란히 보고 판정하실 수 있습니다.</p>
    <div class="tally">
      <div><b>${T.origins}</b><span>원상품</span></div>
      <div><b>${T.candidates}</b><span>후보</span></div>
      <div><b>${T.img}</b><span>후보 이미지</span></div>
      <div><b>${T.desc}</b><span>상세설명 확보</span></div>
      <div><b>${T.codeMatch}</b><span>품번 일치</span></div>
      <div><b>${T.codeConflict}</b><span>품번 불일치</span></div>
      <div><b>${T.codeNA}</b><span>품번 비교 불가</span></div>
      <div><b>${T.fail}</b><span>수집 실패</span></div>
    </div>
    <div class="howto">
      <p><b>원상품은 왼쪽에 고정</b>됩니다 — 스크롤해도 비교 기준이 사라지지 않습니다.</p>
      <p><b>품번은 두 가지를 구분</b>합니다 — <b>제조사 모델 품번</b>만 일치·불일치를 따지고, 판매처가 자기 창고용으로 붙인 번호(숫자만)는 「모델 품번으로 쓰지 않습니다」라고 적습니다.</p>
      <p><b>「없음」과 「확인 불가」는 다릅니다</b> — 원문을 읽었는데 그 정보가 없는 것과, 원문을 받지 못해 판단할 수 없는 것을 갈라 적었습니다.</p>
      <p><b>이미지는 보조 근거</b>입니다 — 모양이 비슷하다는 것만으로 동일상품이 되지는 않습니다.</p>
    </div>
    <div class="filters">
      <span>보기</span>
      <button type="button" data-f="all" aria-pressed="true">전체 ${T.candidates}</button>
      <button type="button" data-f="todo" aria-pressed="false">미판정만</button>
      <button type="button" data-f="conflict" aria-pressed="false">품번 불일치 ${T.codeConflict}</button>
      <button type="button" data-f="unverifiable" aria-pressed="false">확인 불가 ${T.fail}</button>
    </div>
  </header>

${d.rows.map((r, gi) => group(r, gi)).join("\n")}

  <div id="out">
    <h3>판정 결과 — 아래 내용을 복사해서 보내 주십시오</h3>
    <textarea readonly></textarea>
  </div>
</div>

<div class="bar">
  <span><b id="done">0</b> / ${T.candidates} 판정</span>
  <span class="note">동일 <b id="n-same">0</b> · 다름 <b id="n-diff">0</b> · 보류 <b id="n-hold">0</b></span>
  <button id="prev" type="button">← 미판정 이전</button>
  <button id="next" type="button">미판정 다음 →</button>
  <button id="exp" type="button">판정 결과 복사하기</button>
  <span class="note">입력은 이 브라우저에만 남습니다 — 시스템에 저장되지 않습니다.</span>
</div>

<script>
(function(){
  var KEY="mcrw01-ceo-verdicts";
  var store={};
  try{store=JSON.parse(localStorage.getItem(KEY)||"{}")}catch(e){store={}}
  var boxes=[].slice.call(document.querySelectorAll(".verdictbox"));

  function counts(){
    var n={SAME:0,DIFFERENT:0,HOLD:0},done=0;
    boxes.forEach(function(b){var s=store[b.dataset.id];if(s&&s.v){done++;n[s.v]=(n[s.v]||0)+1}});
    document.getElementById("done").textContent=done;
    document.getElementById("n-same").textContent=n.SAME;
    document.getElementById("n-diff").textContent=n.DIFFERENT;
    document.getElementById("n-hold").textContent=n.HOLD;
    document.querySelectorAll("[data-grpdone]").forEach(function(el){
      var gi=el.dataset.grpdone,c=0;
      boxes.forEach(function(b){if(b.dataset.id.indexOf("c"+gi+"-")===0&&store[b.dataset.id]&&store[b.dataset.id].v)c++});
      el.textContent=c;
    });
  }
  function save(){try{localStorage.setItem(KEY,JSON.stringify(store))}catch(e){}counts();applyFilter()}

  boxes.forEach(function(b){
    var id=b.dataset.id,s=store[id]||{},ta=b.querySelector("textarea");
    if(s.v){var r=b.querySelector('input[value="'+s.v+'"]');if(r)r.checked=true}
    if(s.n)ta.value=s.n;
    b.querySelectorAll("input[type=radio]").forEach(function(i){
      i.addEventListener("change",function(){store[id]={v:i.value,n:ta.value};save()});
    });
    ta.addEventListener("input",function(){store[id]={v:(store[id]||{}).v||"",n:ta.value};save()});
  });

  var filter="all";
  function matches(card){
    var id=card.dataset.verdictRow,s=store[id]||{};
    if(filter==="all")return true;
    if(filter==="todo")return !s.v;
    if(filter==="conflict")return !!card.querySelector(".pill.bad");
    if(filter==="unverifiable")return !!card.querySelector(".chip.warn");
    return true;
  }
  function applyFilter(){
    document.querySelectorAll(".cand").forEach(function(c){
      if(matches(c))c.classList.remove("hide");else c.classList.add("hide");
    });
  }
  document.querySelectorAll(".filters button").forEach(function(btn){
    btn.addEventListener("click",function(){
      filter=btn.dataset.f;
      document.querySelectorAll(".filters button").forEach(function(b){b.setAttribute("aria-pressed",String(b===btn))});
      applyFilter();
    });
  });

  function todo(){return boxes.filter(function(b){return !(store[b.dataset.id]||{}).v})}
  function go(dir){
    var list=todo();if(!list.length)return;
    var y=window.scrollY,pick=null;
    if(dir>0){for(var i=0;i<list.length;i++){var t=list[i].closest(".cand").offsetTop;if(t>y+60){pick=list[i];break}}if(!pick)pick=list[0]}
    else{for(var j=list.length-1;j>=0;j--){var t2=list[j].closest(".cand").offsetTop;if(t2<y-60){pick=list[j];break}}if(!pick)pick=list[list.length-1]}
    pick.closest(".cand").scrollIntoView({behavior:"smooth",block:"start"});
  }
  document.getElementById("next").addEventListener("click",function(){go(1)});
  document.getElementById("prev").addEventListener("click",function(){go(-1)});

  document.getElementById("exp").addEventListener("click",function(){
    var lines=[];
    document.querySelectorAll(".grp").forEach(function(g){
      lines.push("## ["+g.querySelector(".eye").textContent+"] "+g.querySelector(".origin h2").textContent);
      g.querySelectorAll(".verdictbox").forEach(function(b){
        var s=store[b.dataset.id]||{};
        lines.push("- "+b.dataset.domain+" | "+(s.v||"미판정")+(s.n?" | "+s.n:"")+"\\n  "+b.dataset.url);
      });
      lines.push("");
    });
    var box=document.getElementById("out"),ta=box.querySelector("textarea");
    ta.value=lines.join("\\n");box.style.display="block";ta.focus();ta.select();
    try{document.execCommand("copy")}catch(e){}
    box.scrollIntoView({behavior:"smooth",block:"start"});
  });

  counts();applyFilter();
})();
</script>
`;

writeFileSync(OUT, html, "utf8");
console.log("wrote", (html.length / 1048576).toFixed(1) + "MB", JSON.stringify(T));
