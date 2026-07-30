-- Sprint B(Product Compliance Engine) — "등록됐다"와 별개로 "얼마나 실제
-- 판매/승인 가능한 수준으로 등록됐는가"를 등록 이력에서 바로 볼 수 있게 한다.
-- compliance_score는 목록에서 정렬/필터하기 쉽게 정수 컬럼으로 따로 빼고,
-- compliance_report(userInputNeeded 목록 등 전체)는 jsonb로 통째로 저장한다.
alter table registration_attempts add column if not exists compliance_score integer;
alter table registration_attempts add column if not exists compliance_report jsonb;
