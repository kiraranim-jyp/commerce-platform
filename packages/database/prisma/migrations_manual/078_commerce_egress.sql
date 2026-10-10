-- ════════════════════════════════════════════════════════════════════════════
-- 078 — Commerce Egress 관리 (CPO 확정 2026-10-10)
-- ════════════════════════════════════════════════════════════════════════════
--
-- 셀러가 프록시 장애 때 CTO 없이 OCI ↔ FIXIE 를 직접 전환할 수 있게 한다.
-- 이 마이그레이션은 그 기능의 ①단계 — **저장 자리만** 만든다. 코드는 아직
-- 이 칸을 읽지 않으므로, 적용해도 현재 동작이 한 글자도 바뀌지 않는다.
--
-- ── 🔴 왜 env 가 아니라 DB 인가 (2026-10-10 실측) ──────────────────────────
--
-- 전환을 `OUTBOUND_PROXY` env 로 하면 **재배포가 필요하다.** env 는 배포 시점에
-- 함수에 박히기 때문이다. 실측으로 확인했다:
--
--     vercel env rm/add OUTBOUND_PROXY production   → 값은 바뀐다
--     그런데 돌고 있는 배포본은 «옛 값» 을 계속 쓴다
--     빈 커밋 push 로 재배포해야 반영된다 (2분)
--
-- 셀러가 버튼을 누르고 2분을 기다리는 UX 는 성립하지 않고, 앱이 스스로 배포를
-- 트리거하려면 Vercel 배포 토큰을 앱 env 에 심어야 한다 — 앱이 자기 인프라를
-- 재배포할 권한을 갖는 구조이고 받아들일 수 없다.
--
-- 🔴 그래서 **비밀값(URL)은 env 에 남기고 «선택값» 만 DB 로** 옮긴다.
--    `OCI_PROXY_URL` · `FIXIE_URL` 은 그대로 둔다(건드리지 않는다).
--    🔴 env 이름은 `FIXIE_URL` 이다 — 작업지시서의 `FIXIE_PROXY_URL` 은 오기이고
--       실제 Production env(75일 전 등록)와 코드가 쓰는 이름은 `FIXIE_URL` 이다.
--       이름을 바꾸면 Production secret 을 다시 등록해야 한다.
--
-- ── 🔴 NULL 이 「모름」이 아니라 «폴백» 이다 ───────────────────────────────
--
-- 077 이 남긴 교훈의 반대 방향이다. 077 에서는 NULL 이 두 가지를 뜻해서 문제가
-- 됐지만, 여기서는 NULL 의 뜻이 **하나** 다:
--
--     NULL   → 기존 env(`OUTBOUND_PROXY`) 를 그대로 쓴다   ← 현재 상태
--     'OCI'  → OCI 로 나간다
--     'FIXIE'→ FIXIE 로 나간다
--
-- 즉 이 칸을 추가해도 **아무 행도 동작이 바뀌지 않는다**(전부 NULL 로 시작).
-- 셀러가 한 번 전환하면 그때부터 DB 값이 env 를 이긴다. 되돌리기는 NULL 로
-- 되돌리는 것이고, 그러면 env 기반 동작으로 «완전히» 복귀한다.
--
-- 🔴 CHECK 로 어휘를 못박는다 — 'oci' 같은 소문자나 'TINYPROXY' 같은 값이
--    들어오면 거절한다. Tinyproxy 는 OCI 의 내부 구성요소이고 provider 가
--    아니다(CPO 명시). provider 는 둘뿐이다.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE seller_settings
  ADD COLUMN IF NOT EXISTS egress_provider text NULL;

-- 🔴 제약을 «따로» 건다 — ADD COLUMN 과 묶으면 재실행(idempotent)이 어려워진다.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'seller_settings_egress_provider_check'
  ) THEN
    ALTER TABLE seller_settings
      ADD CONSTRAINT seller_settings_egress_provider_check
      CHECK (egress_provider IS NULL OR egress_provider IN ('OCI', 'FIXIE'));
  END IF;
END $$;

COMMENT ON COLUMN seller_settings.egress_provider IS
  'Commerce outbound proxy 선택값. NULL = env(OUTBOUND_PROXY) 폴백 · OCI · FIXIE. 비밀값(URL)은 여기 저장하지 않는다.';

-- ════════════════════════════════════════════════════════════════════════════
-- commerce_egress_log — 장애·전환 이력
-- ════════════════════════════════════════════════════════════════════════════
--
-- 🔴 이 표가 있어야 **「2일 주기」가 가설에서 사실로 바뀔 수 있다.**
--    2026-10-10 장애에서 확보한 사실은 「8888 TCP 는 살아 있는데 CONNECT 가
--    hang 한다」까지였고, 주기성·발생 지점은 아무 근거가 없었다. 그래서
--    「또 죽었네」밖에 할 수 없었다. 이 표는 그 공백을 메운다:
--
--      어느 provider 가 · 몇 시에 · 어느 «단계» 에서 · 얼마나 걸려 실패했는가
--
-- 🔴 단계를 둘로 «갈라» 적는 것이 핵심이다. 2026-10-10 에 두 양상이 완전히
--    달랐고, 그 차이가 원인을 가렸다:
--
--      FIXIE  407 · 488ms      → 프록시가 «거절» (상한/자격증명)
--      OCI    무응답 · 25s      → 프록시가 «응답 안 함» (데몬 hang)
--
--    둘을 「연결 실패」로 뭉치면 이 구별이 사라진다.
--
-- 🔴 비밀값 금지 — proxy URL · 자격증명 · Authorization 헤더를 넣지 않는다.
--    `detail` 에는 `describeErrorCauseChain()` 이 만드는 문구만 넣는다(그 함수는
--    host/port/에러코드만 남기고 URL 을 포함하지 않는다). 개인정보도 넣지 않는다.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS commerce_egress_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),

  /* 이 시도가 «어느» provider 로 나갔는가. */
  provider text NOT NULL CHECK (provider IN ('OCI', 'FIXIE')),

  /* ── 🔴 단계별 결과. NULL 은 「그 단계까지 가지 못했다」는 뜻이다 ──────
     CONNECT 가 실패하면 outbound 는 실행되지 않으므로 NULL 이고, 그것은
     「outbound 가 성공했다/실패했다」와 «다른 사실» 이다. */
  connect_result text NULL CHECK (connect_result IS NULL OR connect_result IN ('OK', 'REFUSED', 'TIMEOUT', 'ERROR')),
  outbound_result text NULL CHECK (outbound_result IS NULL OR outbound_result IN ('OK', 'HTTP_ERROR', 'TIMEOUT', 'ERROR')),

  /* 🔴 소요시간이 원인을 가른다 — 수백 ms 즉시 실패 = 거절 · 20~25s = hang. */
  elapsed_ms integer NULL CHECK (elapsed_ms IS NULL OR elapsed_ms >= 0),

  /* 전환 시도였을 때만 채운다. NULL = 전환이 아니라 health check 였다. */
  switched_from text NULL CHECK (switched_from IS NULL OR switched_from IN ('OCI', 'FIXIE')),

  /* 전환이 «확정됐는가». 실패하면 기존 provider 를 유지하므로 false 다. */
  switch_committed boolean NULL,

  /* 어디서 호출됐는가 — 'HEALTH_CHECK' | 'SWITCH' | 'CHANNEL_REQUEST'.
     🔴 어휘를 열어 두지 않는다. 자유 문자열이면 집계가 불가능해진다. */
  source text NOT NULL CHECK (source IN ('HEALTH_CHECK', 'SWITCH', 'CHANNEL_REQUEST')),

  /* 진단 문구. 🔴 비밀값·개인정보 금지(위 주석 참고). */
  detail text NULL
);

/* 🔴 「어느 provider 가 언제 죽었나」가 이 표의 유일한 질의 패턴이다 —
   그 질의를 위한 인덱스만 만든다(추측으로 인덱스를 늘리지 않는다). */
CREATE INDEX IF NOT EXISTS commerce_egress_log_provider_time_idx
  ON commerce_egress_log (provider, created_at DESC);

COMMENT ON TABLE commerce_egress_log IS
  'Commerce outbound egress 이력. CONNECT 와 외부요청을 «갈라» 기록해 거절(즉시)과 hang(무응답)을 구별한다. secret·개인정보 저장 금지.';
