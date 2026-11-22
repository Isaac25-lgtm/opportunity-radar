-- Plans become segments priced in US dollars.
--   free  Free                       $0   jobs only, limited
--   basic Jobs                       $10  jobs and consultancies
--   pro   Jobs & Scholarships        $15  + scholarships and research funding (most chosen)
--   elite Complete                   $25  + tenders and contracts for your company
-- Prices are stored in the currency's minor unit (US cents). Existing payments keep their own
-- amount and currency, so historical UGX payments remain correct.

-- Additive so the previous Worker version keeps working until the new one is promoted.
-- price_ugx is no longer read and can be dropped in a later migration.
ALTER TABLE plans ADD COLUMN price_minor INTEGER NOT NULL DEFAULT 0;
ALTER TABLE plans ADD COLUMN currency TEXT NOT NULL DEFAULT 'USD';

UPDATE plans SET name = 'Free', currency = 'USD', price_minor = 0,
  description = 'Browse every listing and get weekly job matches for one career profile.',
  entitlements = '{"profile_types":["career"],"max_profiles":1,"max_cvs":1,"cv_exports_per_month":5,"docx_export":false,"cv_tailoring":false,"cover_letters":false,"max_tracked":10,"alert_frequencies":["weekly"],"max_documents":3,"ai_requests_per_month":0}',
  updated_at = '2026-11-22T00:00:00.000Z'
WHERE code = 'free';

UPDATE plans SET name = 'Jobs', currency = 'USD', price_minor = 1000,
  description = 'For job seekers: matched jobs and consultancies, tailored CVs and cover letters.',
  entitlements = '{"profile_types":["career"],"max_profiles":1,"max_cvs":5,"cv_exports_per_month":30,"docx_export":true,"cv_tailoring":true,"cover_letters":true,"max_tracked":50,"alert_frequencies":["daily","weekly"],"max_documents":10,"ai_requests_per_month":20}',
  updated_at = '2026-11-22T00:00:00.000Z'
WHERE code = 'basic';

UPDATE plans SET name = 'Jobs & Scholarships', currency = 'USD', price_minor = 1500,
  description = 'Everything in Jobs, plus scholarships, fellowships and research funding.',
  entitlements = '{"profile_types":["career","academic"],"max_profiles":2,"max_cvs":10,"cv_exports_per_month":-1,"docx_export":true,"cv_tailoring":true,"cover_letters":true,"max_tracked":-1,"alert_frequencies":["instant","daily","weekly"],"max_documents":30,"ai_requests_per_month":100}',
  updated_at = '2026-11-22T00:00:00.000Z'
WHERE code = 'pro';

UPDATE plans SET name = 'Complete', currency = 'USD', price_minor = 2500,
  description = 'Everything in Jobs & Scholarships, plus tenders and contracts for your company.',
  entitlements = '{"profile_types":["career","academic","business"],"max_profiles":3,"max_cvs":-1,"cv_exports_per_month":-1,"docx_export":true,"cv_tailoring":true,"cover_letters":true,"max_tracked":-1,"alert_frequencies":["instant","daily","weekly"],"max_documents":100,"ai_requests_per_month":300}',
  updated_at = '2026-11-22T00:00:00.000Z'
WHERE code = 'elite';
