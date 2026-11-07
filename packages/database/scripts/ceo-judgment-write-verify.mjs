/**
 * 🔵🔵🔵 CEO 판단 쓰기 경로 — **운영 DB 실측 검증**(CPO 승인 조건 6항 준수).
 *
 * 🔴🔴 **안전 조건**(CPO 명시):
 * ```
 * ① 검증 데이터는 **전용 키로만** 생성한다               → review_key = '__CTO_VERIFY__'
 * ② 삭제는 **그 전용 키로 생성한 행에만** 한정한다         → delete where review_key = 그 값
 * ③ 기존 `candidate_reviews` 38건·GT 는 **접근·변경 0**   → 이 스크립트가 그 표를 **읽지도 않는다**
 * ④ 축 데이터도 **전용 판단 id 로만** 정리한다            → 축은 애초에 **쓰지 않는다**(범위 ⒞)
 * ⑤ 정리 후 **두 표 모두 검증 데이터 0건** 확인
 * ⑥ 실패하면 원인을 보고하고 **정리 여부를 확인하기 전까지 완료로 보고하지 않는다**
 * ```
 * 🔴 `saveCeoJudgment` 는 TS 라 여기서 import 할 수 없다 ⟹ **그 함수와 «같은 순서» 로**
 *    SQL 을 직접 쓴다(버전 계산 → insert). 🔴 그래서 이것은 **DB 동작 검증** 이고
 *    「운영 함수 재현」이 아니다 — 그 구분을 보고에 적는다.
 */
import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();
const KEY = "__CTO_VERIFY__";
const q = (sql, ...a) => p.$queryRawUnsafe(sql, ...a);
const ok = [];
const bad = [];
const mark = (pass, label, detail = "") => {
  (pass ? ok : bad).push(label);
  console.log(`  ${pass ? "🟢 PASS" : "🔴 FAIL"}  ${label}${detail ? "  — " + detail : ""}`);
};

const countVerify = async () =>
  (await q(`select count(*)::int as n from ceo_judgments where review_key = $1`, KEY))[0].n;
const countAxesForVerify = async () =>
  (
    await q(
      `select count(*)::int as n from ceo_judgment_axes a
        join ceo_judgments j on j.id = a.judgment_id where j.review_key = $1`,
      KEY,
    )
  )[0].n;

/** 🟢 `saveCeoJudgment` 와 같은 순서 — max(version) 조회 → version+1 · supersedes_id 로 insert. */
async function insertVersion(pairId, verdict, note) {
  const prev = (
    await q(
      `select id, version from ceo_judgments where review_key = $1 and pair_id = $2
        order by version desc limit 1`,
      KEY,
      pairId,
    )
  )[0];
  const rows = await q(
    `insert into ceo_judgments
       (review_key, pair_id, origin_url, candidate_url, review_url_key, human_verdict,
        reviewer, reviewed_at, raw_note, decision_context, version, supersedes_id, snapshot_id)
     values ($1,$2,'https://x.test/o','https://x.test/c','https://x.test/c',$3,
             'cto-verify', now(), $4, null, $5::int, $6::uuid, null)
     returning id, version, supersedes_id, raw_note`,
    KEY,
    pairId,
    verdict,
    note,
    (prev?.version ?? 0) + 1,
    prev?.id ?? null,
  );
  return rows[0];
}

try {
  console.log(`전(前) 전용 키 행: ${await countVerify()}   (0 이어야 한다)\n`);

  /* ① version 1 → 2 보존 */
  console.log("── ① 같은 (review_key, pair_id) 에 version 2 저장 ──");
  const v1 = await insertVersion("VERIFY-A", "SAME", "첫 판단");
  const v2 = await insertVersion("VERIFY-A", "DIFFERENT", "뒤집은 판단");
  const both = await q(
    `select version, human_verdict, supersedes_id, raw_note from ceo_judgments
      where review_key = $1 and pair_id = 'VERIFY-A' order by version`,
    KEY,
  );
  mark(
    both.length === 2 && Number(both[0].version) === 1 && Number(both[1].version) === 2,
    "version 1·2 가 **둘 다 보존** 된다",
    both.map((r) => `v${r.version}=${r.human_verdict}`).join(" · "),
  );
  mark(both[0].human_verdict === "SAME" && both[1].human_verdict === "DIFFERENT", "뒤집힌 판단이 «덮지 않고» 쌓인다");
  mark(both[1].supersedes_id === v1.id, "`supersedes_id` 가 직전 판단을 가리킨다");

  /* ② 동일 내용 재제출 → 새 버전 */
  console.log("\n── ② 동일 내용 재제출(CPO 결정 Ⓘ) ──");
  const same1 = await insertVersion("VERIFY-B", "SAME", "같은 메모");
  const same2 = await insertVersion("VERIFY-B", "SAME", "같은 메모");
  mark(
    Number(same2.version) === Number(same1.version) + 1 && same1.id !== same2.id,
    "같은 내용도 **새 버전** 이 된다(내용 비교 0)",
    `v${same1.version} → v${same2.version}`,
  );

  /* ③ 축 0개로 판단 저장 */
  console.log("\n── ③ 축 0개 판단 저장 ──");
  mark((await countAxesForVerify()) === 0, "축 **0행** 인데 판단이 저장돼 있다(= 정상적인 축 미입력)");

  /* ④ UNIQUE 충돌(23505) — 같은 version 을 일부러 두 번 */
  console.log("\n── ④ 중복 방지 · 23505 ──");
  let code = null;
  try {
    await q(
      `insert into ceo_judgments
         (review_key, pair_id, origin_url, candidate_url, review_url_key, human_verdict,
          reviewer, reviewed_at, version)
       values ($1,'VERIFY-A','https://x.test/o','https://x.test/c','https://x.test/c',
               'SAME','cto-verify', now(), 1)`,
      KEY,
    );
  } catch (e) {
    code = String(e.message).match(/23505/) ? "23505" : String(e.message).slice(0, 80);
  }
  mark(code === "23505", "같은 version 재삽입이 **23505 로 거부** 된다", String(code));

  /* ⑤ verdict CHECK — 임의 문자열 거부 */
  console.log("\n── ⑤ verdict CHECK ──");
  let vcode = null;
  try {
    await insertVersion("VERIFY-C", "MAYBE_SAME", null);
  } catch (e) {
    vcode = String(e.message).match(/23514/) ? "23514" : String(e.message).slice(0, 80);
  }
  mark(vcode === "23514", "`human_verdict` 임의 문자열이 **CHECK 로 거부** 된다", String(vcode));

  /* ⑥ raw_note 를 지어내지 않는다 */
  console.log("\n── ⑥ raw_note 자동 생성 0 ──");
  const noNote = await insertVersion("VERIFY-D", "UNDECIDED", null);
  mark(noNote.raw_note === null, "메모를 안 주면 **null 이다**(시스템이 만들지 않는다)");

  /* ─────────── 정리(CPO 조건 ②④⑤) ─────────── */
  console.log("\n── 🔴 정리 — 전용 키 행만 삭제한다 ──");
  const before = await countVerify();
  const delAxes = await p.$executeRawUnsafe(
    `delete from ceo_judgment_axes where judgment_id in (select id from ceo_judgments where review_key = $1)`,
    KEY,
  );
  /** 🔴 자기참조 FK 가 `on delete set null` 이라 순서 상관없이 지워진다(083 설계). */
  const delJ = await p.$executeRawUnsafe(`delete from ceo_judgments where review_key = $1`, KEY);
  console.log(`  삭제 — 판단 ${delJ}행 · 축 ${delAxes}행 (삭제 전 판단 ${before}행)`);
  const leftJ = await countVerify();
  const leftA = await countAxesForVerify();
  mark(leftJ === 0 && leftA === 0, "정리 후 **검증 데이터 0건**(두 표 모두)", `판단 ${leftJ} · 축 ${leftA}`);

  /** 🔴 기존 데이터가 그대로인지 — 전용 키 밖의 행 수. */
  const others = (await q(`select count(*)::int as n from ceo_judgments where review_key <> $1`, KEY))[0].n;
  mark(others === 0, "전용 키 **밖** 의 `ceo_judgments` 행은 여전히 0(GT_IMPORT 적재 0)", `${others}행`);

  console.log(`\n${bad.length === 0 ? `🟢🟢 **전부 PASS (${ok.length}항)**` : `🔴 FAIL ${bad.length}항: ${bad.join(" / ")}`}`);
} catch (e) {
  console.log(`\n🔴🔴 검증 중 예외 — ${String(e.message).slice(0, 300)}`);
  console.log("🔴 정리를 시도한다(CPO 조건 ⑥ — 정리 여부를 확인하기 전까지 완료로 보고하지 않는다)");
  try {
    await p.$executeRawUnsafe(
      `delete from ceo_judgment_axes where judgment_id in (select id from ceo_judgments where review_key = $1)`,
      KEY,
    );
    await p.$executeRawUnsafe(`delete from ceo_judgments where review_key = $1`, KEY);
    console.log(`  정리 후 전용 키 행: ${await countVerify()}`);
  } catch (e2) {
    console.log(`  🔴🔴 정리 실패 — ${String(e2.message).slice(0, 200)}`);
  }
  process.exitCode = 1;
}

await p.$disconnect();
