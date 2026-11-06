import type { ProfileType } from './constants';

type Check = [label: string, ok: (d: any) => boolean, weight: number];
const filled = (v: unknown) =>
  Array.isArray(v) ? v.length > 0 : v !== null && v !== undefined && String(v).trim() !== '';

const CHECKS: Record<ProfileType, Check[]> = {
  career: [
    ['Headline', (d) => filled(d.headline), 8],
    ['Summary', (d) => filled(d.summary), 8],
    ['Location', (d) => filled(d.location) || filled(d.country), 6],
    ['Nationality', (d) => filled(d.nationality), 6],
    ['Target roles', (d) => filled(d.target_titles), 12],
    ['Skills (5+)', (d) => (d.skills ?? []).length >= 5, 16],
    ['Work experience', (d) => filled(d.experience), 16],
    ['Education', (d) => filled(d.education) || filled(d.highest_education), 12],
    ['Languages', (d) => filled(d.languages), 4],
    ['Work-mode / type preferences', (d) => filled(d.work_modes) || filled(d.employment_types), 6],
    ['Preferred countries', (d) => filled(d.preferred_countries), 6],
  ],
  academic: [
    ['Current level', (d) => filled(d.current_level), 12],
    ['Field of study', (d) => filled(d.field_of_study), 12],
    ['Qualifications', (d) => filled(d.qualifications), 14],
    ['Grades / GPA', (d) => (d.qualifications ?? []).some((q: any) => q.gpa || q.classification), 8],
    ['Target levels', (d) => filled(d.target_levels), 12],
    ['Research interests', (d) => filled(d.research_interests), 10],
    ['Nationality', (d) => filled(d.nationality), 12],
    ['Preferred countries', (d) => filled(d.preferred_countries), 6],
    ['Language qualifications', (d) => filled(d.languages), 8],
    ['Funding need', (d) => filled(d.funding_need), 6],
  ],
  business: [
    ['Registered name', (d) => filled(d.registered_name), 10],
    ['Registration status', (d) => d.is_registered !== null && d.is_registered !== undefined, 8],
    ['Registration country', (d) => filled(d.registration_country), 8],
    ['Description', (d) => filled(d.description), 6],
    ['Service lines / products', (d) => filled(d.service_lines) || filled(d.products_services), 18],
    ['Procurement categories', (d) => filled(d.procurement_categories), 10],
    ['Operating locations', (d) => filled(d.operating_locations), 8],
    ['Year established', (d) => filled(d.year_established), 6],
    ['Past contracts', (d) => filled(d.past_contracts), 10],
    ['Certifications / licences', (d) => filled(d.certifications) || filled(d.licenses), 8],
    ['Turnover band', (d) => filled(d.turnover_band), 4],
    ['Tax compliance status', (d) => d.tax_compliance && d.tax_compliance !== 'unknown', 4],
  ],
};

export function profileCompleteness(type: ProfileType, data: unknown): { score: number; missing: string[] } {
  const d = (data ?? {}) as Record<string, unknown>;
  let got = 0;
  let total = 0;
  const missing: string[] = [];
  for (const [label, ok, w] of CHECKS[type]) {
    total += w;
    if (ok(d)) got += w;
    else missing.push(label);
  }
  return { score: Math.round((got / total) * 100), missing };
}
