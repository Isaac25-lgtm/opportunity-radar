-- Worldwide coverage: the product is international, so the automated sources stop filtering to East Africa.
-- Data only (no schema change). Source ids and slugs are unchanged so existing listings keep their source.

UPDATE sources SET
  name = 'World Bank procurement notices (worldwide)',
  config = '{"worldwide":true,"rows":100}',
  geography = '["Worldwide"]',
  updated_at = '2026-11-22T00:00:00.000Z'
WHERE id = 'src_worldbank_ea';

UPDATE sources SET
  name = 'Grants.gov (international opportunities)',
  config = '{"keywords":["international","developing countries","Africa","Asia","Latin America"],"rows":25}',
  geography = '["International"]',
  updated_at = '2026-11-22T00:00:00.000Z'
WHERE id = 'src_grantsgov_africa';

UPDATE sources SET
  name = 'Remotive remote jobs (worldwide)',
  config = '{"limit":100,"locations":[]}',
  geography = '["Remote","Worldwide"]',
  updated_at = '2026-11-22T00:00:00.000Z'
WHERE id = 'src_remotive';
