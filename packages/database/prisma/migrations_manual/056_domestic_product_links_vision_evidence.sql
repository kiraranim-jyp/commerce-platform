-- P0-A.29-B(CEO 승인 ㉮, 2026-09-19) — Vision 을 «판정기» 가 아니라 «관측 데이터
-- 수집기» 로 붙인다. 가격 판정은 한 칸도 바뀌지 않는다.
--
-- ── 왜 지금 «효과 0» 인 배선을 하는가 ───────────────────────────────────────
-- 실측(P0-A.20~29): 등급 프롬프트 Vision 은 브랜드 2개 259쌍에서 FP 0 · FN 0 을
-- 냈다. 그런데 그것을 가격 판정에 연결하는 길은 셋뿐이고 전부 문제가 있었다:
--   · 기존 image 칸에 연결   → decision.ts:108-122 가 「승격시키지 않는다」고
--                              설계돼 있어 «가격이 한 건도 안 바뀐다»
--   · deriveMatchTruth 입력  → EXACT 의 뜻이 「식별자 근거」에서 흔들린다
--   · 새 상태 신설           → 가격 경로·화면·집계까지 번진다
-- 그래서 «지금은» 점수만 모은다. 경계(HIGH/REVIEW/LOW)는 실데이터가 쌓인 뒤
-- 별도 시뮬레이션으로 긋는다 — 055(cross_seller_verdict)와 같은 순서다.
--
-- ── 왜 컬럼 7개인가(JSON blob 이 아니라) ────────────────────────────────────
-- 🔴 점수만 남기면 «왜 그 점수인지» 가 사라진다. score 는 프롬프트와 모델과
--    해상도에 «종속» 이라, 그 셋이 없으면 나중에 임계값을 다시 그을 수 없다.
--    image_refs 가 없으면 상품이 사진을 바꾼 뒤 재현이 불가능해진다.
--    이 표의 나머지 칸이 전부 평면이라 여기만 JSON 으로 두면 조회가 갈라진다.
--
-- ── 하지 않는 것 ────────────────────────────────────────────────────────────
-- 🔴 backfill 없음. DEFAULT 없음. 기존 71행은 NULL 로 남는다 — 새 판정부터 쌓인다.
-- 🔴 bucket(HIGH/REVIEW/LOW)을 저장하지 않는다. 0~100 «원점수» 만 남기고 구간은
--    런타임 판정값으로 취급한다. 경계가 바뀌면 과거 행의 뜻이 바뀌면 안 된다.
-- 🔴 어떤 판정/가격 경로도 이 칸을 읽지 않는다(priceTierFromLink 는 여전히
--    match_truth·verified 만 본다).

alter table domestic_product_links
  add column if not exists vision_model text,
  add column if not exists vision_prompt_version text,
  add column if not exists vision_media_resolution text,
  add column if not exists vision_score integer,
  add column if not exists vision_reason text,
  add column if not exists vision_image_refs text[],
  add column if not exists vision_checked_at timestamptz;

-- 0~100 밖의 값이 조용히 섞이면 이 칸으로 임계값을 다시 긋는 다음 판단이 틀어진다.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'domestic_product_links_vision_score_check') then
    alter table domestic_product_links
      add constraint domestic_product_links_vision_score_check
      check (vision_score is null or (vision_score >= 0 and vision_score <= 100));
  end if;
end $$;

comment on column domestic_product_links.vision_score is
  'Vision 등급 0~100 «원점수». P0-A.29-B(2026-09-19) 관측 전용 — 어떤 판정/가격 계산에도 입력으로 쓰이지 않는다. HIGH/REVIEW/LOW 로 접어서 저장하지 않는다(경계는 아직 정해지지 않았고, 정해진 뒤에도 과거 행의 뜻이 바뀌면 안 된다). null = 이 쌍을 Vision 으로 본 적이 없다. backfill 없음.';
comment on column domestic_product_links.vision_image_refs is
  '비교에 실제로 쓴 이미지 URL 2개(해외, 국내 순). 재현과 «캐시 무효화» 에 쓴다 — 상품이 사진을 바꾸면 점수를 다시 받아야 한다.';
