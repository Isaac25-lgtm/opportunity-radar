import { z } from 'zod';

/** -1 means unlimited for numeric limits. */
export const entitlementsSchema = z.object({
  max_profiles: z.number().int(),
  max_cvs: z.number().int(),
  cv_exports_per_month: z.number().int(),
  docx_export: z.boolean(),
  cv_tailoring: z.boolean(),
  cover_letters: z.boolean(),
  max_tracked: z.number().int(),
  business_matching: z.boolean(),
  alert_frequencies: z.array(z.enum(['instant', 'daily', 'weekly'])),
  max_documents: z.number().int(),
  ai_requests_per_month: z.number().int(),
});
export type Entitlements = z.infer<typeof entitlementsSchema>;

export const FREE_ENTITLEMENTS: Entitlements = {
  max_profiles: 1,
  max_cvs: 1,
  cv_exports_per_month: 5,
  docx_export: false,
  cv_tailoring: false,
  cover_letters: false,
  max_tracked: 10,
  business_matching: false,
  alert_frequencies: ['weekly'],
  max_documents: 3,
  ai_requests_per_month: 0,
};

export const ENTITLEMENT_LABELS: Record<keyof Entitlements, string> = {
  max_profiles: 'Active profiles (career, academic, business)',
  max_cvs: 'CVs',
  cv_exports_per_month: 'CV exports per month',
  docx_export: 'Word (DOCX) export',
  cv_tailoring: 'Job-specific CV tailoring',
  cover_letters: 'Cover-letter drafts',
  max_tracked: 'Tracked applications and bids',
  business_matching: 'Business tender matching',
  alert_frequencies: 'Alert frequency',
  max_documents: 'Stored documents',
  ai_requests_per_month: 'AI assistance requests per month (when enabled)',
};

export function withinLimit(limit: number, used: number): boolean {
  return limit < 0 || used < limit;
}

export function formatLimit(v: number): string {
  return v < 0 ? 'Unlimited' : String(v);
}
