-- P1-1(Brand Resolver) 검증 요구사항 — 관리자 화면과 DB에서 각 등록 시도의
-- Raw/Cleaned/Rule Applied/Confidence/Brand API 매칭 결과를 확인할 수 있게 한다.
-- compliance_report와 같은 패턴: jsonb 통째로 저장(스키마가 아직 유동적이라
-- 컬럼을 미리 다 쪼개지 않는다), 정제가 안 일어난 경우도 "원본 그대로 썼다"는
-- 사실 자체를 남긴다(raw=cleaned인 행도 유의미하다).
alter table registration_attempts add column if not exists brand_resolution jsonb;
