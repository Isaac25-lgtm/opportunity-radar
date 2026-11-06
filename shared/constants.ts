export const PROFILE_TYPES = ['career', 'academic', 'business'] as const;
export type ProfileType = (typeof PROFILE_TYPES)[number];

export const OPPORTUNITY_CATEGORIES = [
  'job',
  'internship',
  'graduate_programme',
  'consultancy',
  'scholarship',
  'fellowship',
  'research_grant',
  'business_grant',
  'tender',
  'rfp',
  'rfq',
  'eoi',
  'supplier_registration',
  'framework_agreement',
  'training',
  'other',
] as const;
export type OpportunityCategory = (typeof OPPORTUNITY_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<OpportunityCategory, string> = {
  job: 'Job',
  internship: 'Internship',
  graduate_programme: 'Graduate programme',
  consultancy: 'Individual consultancy',
  scholarship: 'Scholarship',
  fellowship: 'Fellowship',
  research_grant: 'Research grant',
  business_grant: 'Business grant',
  tender: 'Tender',
  rfp: 'Request for proposals',
  rfq: 'Request for quotations',
  eoi: 'Expression of interest',
  supplier_registration: 'Supplier registration',
  framework_agreement: 'Framework agreement',
  training: 'Training',
  other: 'Other',
};

/** Which opportunity categories each profile type is matched against. */
export const CATEGORIES_BY_PROFILE: Record<ProfileType, OpportunityCategory[]> = {
  career: ['job', 'internship', 'graduate_programme', 'consultancy', 'fellowship', 'training'],
  academic: ['scholarship', 'fellowship', 'research_grant', 'training'],
  business: ['tender', 'rfp', 'rfq', 'eoi', 'supplier_registration', 'framework_agreement', 'business_grant'],
};

export const VERIFICATION_STATES = [
  'verified_official',
  'verified_ats',
  'aggregator_only',
  'admin_verified',
  'unverified',
] as const;
export type VerificationState = (typeof VERIFICATION_STATES)[number];

export const OPPORTUNITY_STATUSES = ['open', 'closed', 'expired', 'cancelled', 'status_uncertain'] as const;
export type OpportunityStatus = (typeof OPPORTUNITY_STATUSES)[number];

/** Display state combines verification, lifecycle status and freshness. */
export type DisplayState =
  | VerificationState
  | 'stale'
  | 'closed'
  | 'expired'
  | 'cancelled'
  | 'status_uncertain';

export const DISPLAY_STATE_LABELS: Record<DisplayState, string> = {
  verified_official: 'Verified official',
  verified_ats: 'Verified ATS',
  aggregator_only: 'Aggregator only',
  admin_verified: 'Admin verified',
  unverified: 'Unverified',
  stale: 'Stale — status uncertain',
  status_uncertain: 'Status uncertain',
  closed: 'Closed',
  expired: 'Expired',
  cancelled: 'Cancelled',
};

export const ELIGIBILITY = ['eligible', 'potential', 'not_eligible', 'insufficient'] as const;
export type Eligibility = (typeof ELIGIBILITY)[number];

export const ELIGIBILITY_LABELS: Record<Eligibility, string> = {
  eligible: 'Eligible based on available profile',
  potential: 'Potential match — confirm these requirements',
  not_eligible: 'Not eligible based on a stated requirement',
  insufficient: 'Insufficient information',
};

export const EDUCATION_LEVELS = [
  'none',
  'secondary',
  'certificate',
  'diploma',
  'bachelor',
  'master',
  'phd',
] as const;
export type EducationLevel = (typeof EDUCATION_LEVELS)[number];
export const EDUCATION_LABELS: Record<EducationLevel, string> = {
  none: 'None',
  secondary: 'Secondary (UCE/UACE)',
  certificate: 'Certificate',
  diploma: 'Diploma',
  bachelor: "Bachelor's degree",
  master: "Master's degree",
  phd: 'PhD / Doctorate',
};
export function educationRank(level: EducationLevel | undefined | null): number {
  if (!level) return -1;
  return EDUCATION_LEVELS.indexOf(level);
}

export const APPLICATION_STATUSES = [
  'interested',
  'preparing',
  'applied',
  'shortlisted',
  'awarded',
  'rejected',
  'withdrawn',
  'closed',
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];
export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  interested: 'Interested',
  preparing: 'Preparing',
  applied: 'Applied / submitted',
  shortlisted: 'Interview / shortlisted',
  awarded: 'Awarded / contract won',
  rejected: 'Rejected / unsuccessful',
  withdrawn: 'Withdrawn',
  closed: 'Closed / no longer pursuing',
};

export const EAST_AFRICA = [
  'Uganda',
  'Kenya',
  'Tanzania',
  'Rwanda',
  'Burundi',
  'South Sudan',
  'Democratic Republic of the Congo',
  'Ethiopia',
  'Somalia',
];

export const CV_TEMPLATES = ['modern', 'ats', 'academic'] as const;
export type CvTemplate = (typeof CV_TEMPLATES)[number];
export const CV_TEMPLATE_LABELS: Record<CvTemplate, { name: string; blurb: string }> = {
  modern: { name: 'Executive', blurb: 'Modern two-column layout with a coloured sidebar.' },
  ats: { name: 'Clarity', blurb: 'Single-column, ATS-friendly layout that parses cleanly.' },
  academic: { name: 'Scholar', blurb: 'Academic CV with publications, research and awards first.' },
};

export const DOCUMENT_KINDS = [
  'cv',
  'company_profile',
  'transcript',
  'certificate',
  'cover_letter',
  'other',
] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
