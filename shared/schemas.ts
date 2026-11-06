import { z } from 'zod';
import {
  APPLICATION_STATUSES,
  CV_TEMPLATES,
  DOCUMENT_KINDS,
  EDUCATION_LEVELS,
  OPPORTUNITY_CATEGORIES,
  OPPORTUNITY_STATUSES,
  VERIFICATION_STATES,
} from './constants';

const str = (max = 300) => z.string().trim().max(max);
const optStr = (max = 300) => str(max).optional().default('');
const list = (max = 300, n = 60) => z.array(str(max)).max(n).default([]);
const yearMonth = z
  .string()
  .trim()
  .regex(/^$|^\d{4}(-\d{2})?$/, 'Use YYYY or YYYY-MM')
  .optional()
  .default('');
const optNum = z.number().finite().nonnegative().nullable().optional().default(null);
const edu = z.enum(EDUCATION_LEVELS).nullable().optional().default(null);

export const languageSchema = z.object({
  name: str(60),
  level: optStr(60),
  test: optStr(60),
  score: optStr(30),
});

/* ---------------- Career profile ---------------- */
export const experienceItem = z.object({
  title: str(150),
  employer: str(150),
  location: optStr(150),
  start: yearMonth,
  end: yearMonth,
  current: z.boolean().optional().default(false),
  description: optStr(4000),
});
export const educationItem = z.object({
  qualification: str(200),
  level: edu,
  field: optStr(150),
  institution: optStr(200),
  country: optStr(80),
  start: yearMonth,
  end: yearMonth,
  grade: optStr(80),
});

export const careerProfileSchema = z.object({
  headline: optStr(160),
  summary: optStr(3000),
  location: optStr(120),
  country: optStr(80),
  nationality: optStr(80),
  highest_education: edu,
  years_experience: optNum,
  target_titles: list(120, 20),
  industries: list(120, 20),
  seniority: z.enum(['entry', 'mid', 'senior', 'executive']).nullable().optional().default(null),
  employment_types: z
    .array(z.enum(['full_time', 'part_time', 'contract', 'internship', 'consultancy', 'volunteer']))
    .max(6)
    .default([]),
  work_modes: z
    .array(z.enum(['onsite', 'remote', 'hybrid']))
    .max(3)
    .default([]),
  preferred_countries: list(80, 30),
  excluded_locations: list(80, 30),
  salary_expectation: optStr(80),
  skills: list(80, 80),
  languages: z.array(languageSchema).max(15).default([]),
  experience: z.array(experienceItem).max(30).default([]),
  education: z.array(educationItem).max(15).default([]),
  certifications: z
    .array(z.object({ name: str(200), issuer: optStr(150), year: optStr(10) }))
    .max(30)
    .default([]),
  projects: z
    .array(z.object({ name: str(200), description: optStr(1500), link: optStr(300) }))
    .max(20)
    .default([]),
  memberships: z
    .array(z.object({ name: str(200), role: optStr(120) }))
    .max(20)
    .default([]),
});
export type CareerProfile = z.infer<typeof careerProfileSchema>;

/* ---------------- Academic profile ---------------- */
export const academicProfileSchema = z.object({
  current_level: edu,
  field_of_study: optStr(150),
  qualifications: z
    .array(
      z.object({
        qualification: str(200),
        level: edu,
        field: optStr(150),
        institution: optStr(200),
        country: optStr(80),
        year: optStr(10),
        classification: optStr(80),
        gpa: optNum,
        gpa_scale: optNum,
      }),
    )
    .max(15)
    .default([]),
  research_interests: list(150, 30),
  proposed_research: optStr(3000),
  target_levels: z
    .array(z.enum(['master', 'phd', 'postdoc', 'short_course', 'exchange', 'bachelor']))
    .max(6)
    .default([]),
  target_fields: list(150, 20),
  target_programmes: list(200, 20),
  preferred_countries: list(80, 30),
  preferred_institutions: list(200, 30),
  nationality: optStr(80),
  residence_country: optStr(80),
  languages: z.array(languageSchema).max(15).default([]),
  funding_need: z.enum(['full', 'partial', 'any']).nullable().optional().default(null),
  accepts_partial: z.boolean().nullable().optional().default(null),
  publications: z
    .array(z.object({ title: str(300), venue: optStr(200), year: optStr(10) }))
    .max(50)
    .default([]),
  research_experience: optStr(3000),
  awards: z
    .array(z.object({ title: str(200), year: optStr(10) }))
    .max(30)
    .default([]),
  work_experience_years: optNum,
});
export type AcademicProfile = z.infer<typeof academicProfileSchema>;

/* ---------------- Business profile ---------------- */
export const TURNOVER_BANDS = {
  lt_50m: { label: 'Under UGX 50M', min: 0, max: 50_000_000 },
  '50m_200m': { label: 'UGX 50M – 200M', min: 50_000_000, max: 200_000_000 },
  '200m_1b': { label: 'UGX 200M – 1B', min: 200_000_000, max: 1_000_000_000 },
  '1b_5b': { label: 'UGX 1B – 5B', min: 1_000_000_000, max: 5_000_000_000 },
  gt_5b: { label: 'Over UGX 5B', min: 5_000_000_000, max: Number.MAX_SAFE_INTEGER },
} as const;
export type TurnoverBand = keyof typeof TURNOVER_BANDS;

export const businessProfileSchema = z.object({
  registered_name: optStr(200),
  trading_name: optStr(200),
  is_registered: z.boolean().nullable().optional().default(null),
  registration_country: optStr(80),
  registration_number: optStr(80),
  operating_locations: list(120, 30),
  description: optStr(3000),
  service_lines: list(150, 40),
  industries: list(120, 20),
  procurement_categories: z
    .array(z.enum(['works', 'goods', 'services', 'consultancy']))
    .max(4)
    .default([]),
  products_services: list(150, 60),
  year_established: z.number().int().min(1900).max(2100).nullable().optional().default(null),
  past_contracts: z
    .array(
      z.object({
        title: str(200),
        client: optStr(200),
        year: optStr(10),
        value_band: optStr(60),
        description: optStr(1500),
      }),
    )
    .max(40)
    .default([]),
  turnover_band: z
    .enum(Object.keys(TURNOVER_BANDS) as [TurnoverBand, ...TurnoverBand[]])
    .nullable()
    .optional()
    .default(null),
  staff_count: optNum,
  certifications: list(150, 40),
  licenses: list(150, 40),
  tax_compliance: z.enum(['valid', 'expired', 'unknown']).optional().default('unknown'),
  ppda_registered: z.boolean().nullable().optional().default(null),
  supplier_classifications: list(120, 10),
  preferred_contract_min_ugx: optNum,
  preferred_contract_max_ugx: optNum,
  preferred_geographies: list(120, 30),
  preferred_buyers: list(150, 30),
  consortium_willing: z.boolean().nullable().optional().default(null),
});
export type BusinessProfile = z.infer<typeof businessProfileSchema>;

export const profileSchemas = {
  career: careerProfileSchema,
  academic: academicProfileSchema,
  business: businessProfileSchema,
} as const;

/* ---------------- Opportunity requirements ---------------- */
export const requirementsSchema = z.object({
  applicant_type: z.enum(['individual', 'business', 'either', 'unknown']).optional().default('unknown'),
  eligible_countries: list(80, 80),
  places: list(120, 40),
  min_experience_years: optNum,
  education_level: edu,
  degree_levels: z
    .array(z.enum(['bachelor', 'master', 'phd', 'postdoc', 'short_course', 'exchange']))
    .max(6)
    .default([]),
  fields: list(150, 40),
  skills: list(80, 60),
  languages: list(60, 10),
  min_gpa: optNum,
  gpa_scale: optNum,
  employment_type: optStr(40),
  seniority: optStr(40),
  certifications: list(150, 30),
  licenses: list(150, 30),
  registration_required: z.boolean().nullable().optional().default(null),
  tax_clearance_required: z.boolean().nullable().optional().default(null),
  min_turnover_ugx: optNum,
  min_years_in_operation: optNum,
  min_past_contracts: optNum,
  procurement_categories: z
    .array(z.enum(['works', 'goods', 'services', 'consultancy']))
    .max(4)
    .default([]),
  funding: z.enum(['full', 'partial', 'unknown']).optional().default('unknown'),
  required_documents: list(200, 30),
  notes: list(400, 20),
});
export type Requirements = z.infer<typeof requirementsSchema>;

/* ---------------- Opportunity (admin create/edit) ---------------- */
const httpsUrl = z
  .string()
  .trim()
  .max(1000)
  .url()
  .refine((u) => /^https?:\/\//i.test(u), 'Must be an http(s) URL');

export const opportunityInputSchema = z.object({
  category: z.enum(OPPORTUNITY_CATEGORIES),
  title: str(300).min(3),
  organization: str(200).min(2),
  description: optStr(20000),
  summary: optStr(600),
  country: optStr(80),
  countries: list(80, 40),
  location: optStr(200),
  remote: z.enum(['onsite', 'remote', 'hybrid', 'unknown']).optional().default('unknown'),
  source_id: z.string().max(60),
  source_url: httpsUrl,
  application_url: httpsUrl.optional().or(z.literal('')).default(''),
  official_url: httpsUrl.optional().or(z.literal('')).default(''),
  reference_no: optStr(120),
  published_at: z.string().max(40).optional().default(''),
  deadline_at: z.string().max(40).optional().default(''),
  deadline_tz: optStr(60),
  status: z.enum(OPPORTUNITY_STATUSES).optional().default('open'),
  verification: z.enum(VERIFICATION_STATES).optional().default('admin_verified'),
  meta: z.record(z.string(), z.unknown()).optional().default({}),
  requirements: requirementsSchema.prefault({}),
});
export type OpportunityInput = z.infer<typeof opportunityInputSchema>;

/* ---------------- Applications ---------------- */
export const applicationInputSchema = z.object({
  kind: z.enum(['application', 'bid']),
  title: str(300).min(1),
  organization: optStr(200),
  status: z.enum(APPLICATION_STATUSES).default('interested'),
  opportunity_id: z.string().max(60).nullable().optional().default(null),
  profile_id: z.string().max(60).nullable().optional().default(null),
  applied_at: z.string().max(40).nullable().optional().default(null),
  follow_up_at: z.string().max(40).nullable().optional().default(null),
  deadline_at: z.string().max(40).nullable().optional().default(null),
  notes: optStr(5000),
  cv_id: z.string().max(60).nullable().optional().default(null),
  document_ids: z.array(z.string().max(60)).max(20).default([]),
});

/* ---------------- Notification preferences ---------------- */
export const notificationPrefsSchema = z.object({
  email_enabled: z.boolean(),
  in_app_enabled: z.boolean(),
  frequency: z.enum(['instant', 'daily', 'weekly', 'off']),
  categories: z.array(z.enum(['new_match', 'deadline', 'follow_up', 'status_change'])).max(4),
  min_score: z.number().int().min(0).max(100),
  quiet_start: z.number().int().min(0).max(23).nullable(),
  quiet_end: z.number().int().min(0).max(23).nullable(),
});

/* ---------------- Auth ---------------- */
export const passwordSchema = z
  .string()
  .min(10, 'Use at least 10 characters')
  .max(200)
  .refine((p) => /[A-Za-z]/.test(p) && /[0-9]/.test(p), 'Include at least one letter and one number');

export const signupSchema = z.object({
  name: str(120).min(2, 'Enter your name'),
  email: z.string().trim().toLowerCase().email().max(200),
  password: passwordSchema,
  accept_terms: z.literal(true, { error: 'You must accept the terms' }),
});
export const signinSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(1).max(200),
});

export const documentKindSchema = z.enum(DOCUMENT_KINDS);
export const cvTemplateSchema = z.enum(CV_TEMPLATES);
