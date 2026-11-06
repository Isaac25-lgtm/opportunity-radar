import { Briefcase, Building2, GraduationCap } from 'lucide-react';
import { CATEGORIES_BY_PROFILE, CATEGORY_LABELS, ELIGIBILITY_LABELS } from '../../../shared/constants';
import { EligibilityBadge, STATE_HELP, VerificationBadge } from '../../components/opportunity';
import { ButtonLink } from '../../components/ui';

const PROFILES = [
  {
    id: 'career',
    icon: Briefcase,
    title: 'Career profile',
    checks: [
      'Deadline and status',
      'Nationality, when the notice restricts it',
      'Minimum education level',
      'Minimum years of experience',
      'Registered-firm notices are excluded',
    ],
    scores: [
      'Skills (35%)',
      'Role/title fit (25%)',
      'Experience (15%)',
      'Education (10%)',
      'Location (10%)',
      'Employment type (5%)',
    ],
  },
  {
    id: 'academic',
    icon: GraduationCap,
    title: 'Academic profile',
    checks: [
      'Deadline and status',
      'Eligible nationalities — a required fact',
      'Prerequisite qualification for the level',
      'Minimum GPA/grade, when stated',
      'Language requirements',
    ],
    scores: [
      'Field fit (35%)',
      'Level offered (25%)',
      'Destination preference (15%)',
      'Language (10%)',
      'Academic standing (10%)',
      'Funding (5%)',
    ],
  },
  {
    id: 'business',
    icon: Building2,
    title: 'Business profile',
    checks: [
      'Deadline and status',
      'Individual-consultant notices are excluded',
      'Business registration',
      'Eligible bidder countries',
      'Minimum turnover and years in operation',
      'Certifications, licences and tax clearance — never assumed',
    ],
    scores: [
      'Scope / services (40%)',
      'Geography (20%)',
      'Sector (15%)',
      'Contract size (15%)',
      'Track record (10%)',
    ],
  },
] as const;

export default function HowItWorks() {
  return (
    <>
      <section className="bg-ink-100 py-16">
        <div className="container-page max-w-3xl text-center">
          <h1 className="text-[36px] font-extrabold sm:text-[46px]">How Opportunity Radar works</h1>
          <p className="mt-4 text-lg text-ink-600">
            We separate two questions: <strong>Can you apply?</strong> (eligibility) and{' '}
            <strong>Is it a good fit?</strong> (relevance). A great fit never hides a failed requirement.
          </p>
        </div>
      </section>
      <section className="py-16">
        <div className="container-page space-y-10">
          {PROFILES.map((p) => (
            <article key={p.id} id={p.id} className="card scroll-mt-24 p-6 sm:p-8">
              <div className="flex items-center gap-3">
                <p.icon className="h-7 w-7 text-brand-500" />
                <h2 className="text-2xl font-bold">{p.title}</h2>
              </div>
              <p className="mt-3 text-sm text-ink-500">
                Matched against: {CATEGORIES_BY_PROFILE[p.id].map((c) => CATEGORY_LABELS[c]).join(', ')}.
              </p>
              <div className="mt-6 grid gap-6 md:grid-cols-2">
                <div>
                  <h3 className="font-bold">1. Eligibility checks</h3>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-[15px] text-ink-700">
                    {p.checks.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="font-bold">2. Relevance score (default weights)</h3>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-[15px] text-ink-700">
                    {p.scores.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-ink-500">
                    Only components we can evaluate count. If too little is known, the score is left blank
                    rather than guessed.
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="bg-ink-50 py-16">
        <div className="container-page grid gap-10 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold">Eligibility statuses</h2>
            <ul className="mt-4 space-y-3">
              {(Object.keys(ELIGIBILITY_LABELS) as Array<keyof typeof ELIGIBILITY_LABELS>).map((k) => (
                <li key={k} className="flex flex-col gap-1">
                  <EligibilityBadge value={k} long />
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="text-2xl font-bold">Verification labels</h2>
            <ul className="mt-4 space-y-3">
              {(
                [
                  'verified_official',
                  'verified_ats',
                  'admin_verified',
                  'aggregator_only',
                  'unverified',
                  'stale',
                  'status_uncertain',
                ] as const
              ).map((s) => (
                <li key={s}>
                  <VerificationBadge state={s} />
                  <p className="mt-1 text-sm text-ink-600">{STATE_HELP[s]}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
      <section className="py-16 text-center">
        <h2 className="text-2xl font-bold">What we cannot promise</h2>
        <p className="mx-auto mt-3 max-w-2xl text-ink-600">
          We cannot guarantee that an opportunity is still open, that you will be selected, or that a source
          has not changed its terms. Always read the official notice before applying, and never pay anyone to
          apply on your behalf.
        </p>
        <ButtonLink to="/signup" size="lg" className="mt-8">
          Create my profile
        </ButtonLink>
      </section>
    </>
  );
}
