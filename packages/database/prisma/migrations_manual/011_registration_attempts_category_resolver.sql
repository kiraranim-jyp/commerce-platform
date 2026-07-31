-- Sprint A-2.5(Category Resolver 2.0) — 등록마다 Resolver Accuracy KPI를
-- 저장한다(Predict Result/Selected Result/Final Registered/Manual Override
-- 여부/판단 근거). brand_resolution/price_breakdown과 같은 패턴.
alter table registration_attempts add column if not exists category_resolver_kpi jsonb;
