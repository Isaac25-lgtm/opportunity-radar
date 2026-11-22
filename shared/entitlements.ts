import { z } from 'zod';
import { PROFILE_TYPES, type ProfileType } from './constants';

/**
 * What a plan includes. -1 means unlimited for numeric limits.
 * `profile_types` is the plan's segment: which kinds of opportunity it matches —
 * career (jobs), academic (scholarships and research funding) and business (tenders and contracts).
 */
export const entitlementsSchema = z.object({
  profile_types: z.array(z.enum(PROFILE_TYPES)).min(1),
  max_profiles: z.number().int(),
  max_cvs: z.number().int(),
  cv_exports_per_month: z.number().int(),
  docx_export: z.boolean(),
  cv_tailoring: z.boolean(),
  cover_letters: z.boolean(),
  max_tracked: z.number().int(),
  alert_frequencies: z.array(z.enum(['instant', 'daily', 'weekly'])),
  max_documents: z.number().int(),
  ai_requests_per_month: z.number().int(),
});
export type Entitlements = z.infer<typeof entitlementsSchema>;

export const FREE_ENTITLEMENTS: Entitlements = {
  profile_types: ['career'],
  max_profiles: 1,
  max_cvs: 1,
  cv_exports_per_month: 5,
  docx_export: false,
  cv_tailoring: false,
  cover_letters: false,
  max_tracked: 10,
  alert_frequencies: ['weekly'],
  max_documents: 3,
  ai_requests_per_month: 0,
};

export const ENTITLEMENT_LABELS: Record<keyof Entitlements, string> = {
  profile_types: 'Opportunities matched',
  max_profiles: 'Active profiles',
  max_cvs: 'CVs',
  cv_exports_per_month: 'CV exports per month',
  docx_export: 'Word (DOCX) export',
  cv_tailoring: 'Job-specific CV tailoring',
  cover_letters: 'Cover-letter drafts',
  max_tracked: 'Tracked applications and bids',
  alert_frequencies: 'Alert frequency',
  max_documents: 'Stored documents',
  ai_requests_per_month: 'AI assistance requests per month (when enabled)',
};

/** Plain-language name of each segment, used on pricing, billing and upgrade prompts. */
export const SEGMENT_LABELS: Record<ProfileType, string> = {
  career: 'Jobs and consultancies',
  academic: 'Scholarships and research funding',
  business: 'Tenders and contracts for your company',
};

export function allowsProfileType(e: Entitlements, type: ProfileType): boolean {
  return e.profile_types.includes(type);
}

export function allowsMatchCategory(planCode: string, category: string): boolean {
  return planCode !== 'free' || ['job', 'internship', 'graduate_programme'].includes(category);
}

export function withinLimit(limit: number, used: number): boolean {
  return limit < 0 || used < limit;
}

export function formatLimit(v: number): string {
  return v < 0 ? 'Unlimited' : String(v);
}
