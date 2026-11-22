import { Briefcase, Building2, GraduationCap, type LucideIcon } from 'lucide-react';
import { EligibilityBadge, STATE_HELP, VerificationBadge } from '../../components/opportunity';
import { ButtonLink } from '../../components/ui';

type Guide = {
  id: 'career' | 'academic' | 'business';
  icon: LucideIcon;
  title: string;
  forWho: string;
  find: string[];
  start: string[];
  checks: string[];
  fit: string[];
  example: string;
  plans: string;
};

/** Written for people new to the product: no internal terms, short sentences, concrete examples. */
const GUIDES: Guide[] = [
  {
    id: 'career',
    icon: Briefcase,
    title: 'Looking for a job',
    forWho:
      'For anyone looking for work: first jobs, career moves, internships, graduate programmes and consultancy work.',
    find: [
      'Jobs',
      'Internships and graduate programmes',
      'Consultancy and short-term contracts',
      'Fellowships and training',
    ],
    start: [
      'Create a free account.',
      'Fill in your career profile: the jobs you want, your skills, your work history and where you want to work. As you type, we suggest job titles and skills you can add with one click.',
      'Open “Opportunities”. Jobs are listed with the best fits first, and each one tells you why.',
    ],
    checks: [
      'Is it still open? We hide jobs whose deadline has passed.',
      'Can people from your country apply? Some jobs are only for citizens of one country.',
      'Do you have the education it asks for, such as a degree?',
      'Do you have enough years of work experience?',
    ],
    fit: [
      'Your skills compared with what the job asks for. This matters most.',
      'How close the job title is to the jobs you want or have done.',
      'Your experience and education.',
      'Where the job is, and whether it is remote, compared with where you want to work.',
    ],
    example:
      'Grace is a procurement officer in Kampala. A “Procurement Officer” job in Kampala that asks for three years of experience shows a high score and “You qualify”. A similar job open only to Kenyan citizens shows “Not eligible”, so she does not waste time on it.',
    plans: 'Included in the Free and Jobs plans.',
  },
  {
    id: 'academic',
    icon: GraduationCap,
    title: 'Looking for a scholarship or funded study',
    forWho:
      "For students and researchers looking for funded places: Bachelor's, Master's, PhD, postdoc, short courses and research grants.",
    find: ['Scholarships', 'Fellowships', 'Research grants', 'Training and short courses'],
    start: [
      'Create an account on the Jobs & Scholarships plan.',
      'Fill in your academic profile: your qualifications and grades, your field of study, the level you want to study next, and where you would like to study. We suggest fields and research topics as you go.',
      'Open “Opportunities” and choose “Academic”. Each scholarship shows whether you can apply and how well it fits.',
    ],
    checks: [
      'Is it still open?',
      'Is it open to people of your nationality? Many scholarships are only for certain countries.',
      "Do you already hold the qualification needed for that level, for example a Bachelor's before a Master's?",
      'Does it ask for a minimum grade or a language test, such as IELTS?',
    ],
    fit: [
      'Your field of study compared with the fields it supports. This matters most.',
      'Whether it offers the level you want, such as a Master’s or a PhD.',
      'Whether it is in a country or region you chose.',
      'Funding: full or partial, compared with what you need.',
    ],
    example:
      'Fatima studied economics in Nigeria and wants a fully funded Master’s in the United Kingdom. A Master’s in Public Policy open to Commonwealth citizens shows “You qualify” with a high score. A scholarship only for Kenyan citizens shows “Not eligible”.',
    plans: 'Included in the Jobs & Scholarships and Complete plans.',
  },
  {
    id: 'business',
    icon: Building2,
    title: 'Looking for contracts for your company',
    forWho: 'For companies and organisations that bid for work: suppliers, contractors and consulting firms.',
    find: [
      'Tenders and invitations to bid',
      'Requests for proposals and quotations',
      'Expressions of interest',
      'Business grants and supplier registration',
    ],
    start: [
      'Create an account on the Complete plan.',
      'Fill in your business profile: what your company supplies, where you work, your size and track record, and your registrations and certificates. Write a short description and we suggest services and sectors that match it.',
      'Open “Opportunities” and choose “Business”. Each tender shows whether your company can bid and how well it fits.',
    ],
    checks: [
      'Is it still open for bids?',
      'Is it for companies, not individual consultants?',
      'Must your company be registered, or from certain countries?',
      'Does it ask for a minimum yearly turnover, years in business, certificates, licences or a tax clearance? We never assume you have these.',
    ],
    fit: [
      'What your company supplies compared with what the buyer needs. This matters most.',
      'Where the work is, compared with where you work or want to work.',
      'Your sector, the size of the contract, and similar contracts you have done before.',
    ],
    example:
      'A small printing company sees a tender to print national exam papers. It fits their work perfectly, but the tender asks for a turnover their company does not have, so it shows “Not eligible” and explains why.',
    plans: 'Included in the Complete plan.',
  },
];

const STEPS: Array<[string, string]> = [
  [
    'Tell us about yourself',
    'Fill in a short profile. We suggest answers as you type, so most of it is a few clicks.',
  ],
  [
    'We look for you',
    'Every six hours we check official sources around the world for new jobs, scholarships and contracts.',
  ],
  [
    'See what fits, and why',
    'Each opportunity says whether you can apply and how well it fits you, in plain words.',
  ],
];

const SCORE_BANDS: Array<[string, string]> = [
  ['70 and above', 'A strong fit. Worth applying.'],
  ['40 to 69', 'A partial fit. Read it and decide.'],
  ['Below 40', 'Probably not for you.'],
];

const ELIGIBILITY_HELP: Array<['eligible' | 'potential' | 'not_eligible' | 'insufficient', string]> = [
  ['eligible', 'Based on what you told us, you meet every requirement the notice states.'],
  [
    'potential',
    'You meet everything we can check, but there is something to confirm, such as your nationality or a certificate. The listing tells you what.',
  ],
  [
    'not_eligible',
    'The notice asks for something your profile says you do not have. We still show it, with the reason, so nothing is hidden.',
  ],
  [
    'insufficient',
    'We need a few more details in your profile before we can tell. Adding them takes a minute.',
  ],
];

export default function HowItWorks() {
  return (
    <>
      <section className="bg-ink-50 py-16">
        <div className="container-page max-w-4xl text-center">
          <h1 className="text-[36px] font-semibold sm:text-[46px]">How Opportunity Radar works</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-ink-600">
            We answer two simple questions for every opportunity: <strong>can you apply?</strong> and{' '}
            <strong>is it a good fit for you?</strong> A good fit never hides a requirement you do not meet.
          </p>
          <ol className="mt-10 grid gap-4 text-left sm:grid-cols-3">
            {STEPS.map(([t, d], i) => (
              <li key={t} className="card p-5">
                <p className="text-[13px] font-medium text-ink-500">Step {i + 1}</p>
                <h2 className="mt-1 text-[18px] font-semibold">{t}</h2>
                <p className="mt-1.5 text-[14.5px] leading-relaxed text-ink-600">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="py-16">
        <div className="container-page max-w-5xl space-y-10">
          {GUIDES.map((g) => (
            <article key={g.id} id={g.id} className="card scroll-mt-24 p-6 sm:p-8">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl border border-line bg-ink-50">
                  <g.icon className="h-5 w-5 text-ink-700" aria-hidden />
                </span>
                <h2 className="text-[24px] font-semibold">{g.title}</h2>
              </div>
              <p className="mt-3 text-[16px] text-ink-600">{g.forWho}</p>
              <p className="mt-2 text-[14.5px] text-ink-500">
                <span className="font-medium text-ink-700">You will find:</span> {g.find.join(' · ')}
              </p>

              <h3 className="mt-7 text-[17px] font-semibold">How to get started</h3>
              <ol className="mt-3 space-y-3">
                {g.start.map((s, i) => (
                  <li key={s} className="flex gap-3 text-[15px] leading-relaxed text-ink-700">
                    <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-ink text-[12.5px] font-semibold text-white">
                      {i + 1}
                    </span>
                    {s}
                  </li>
                ))}
              </ol>

              <div className="mt-7 grid gap-6 md:grid-cols-2">
                <div>
                  <h3 className="text-[17px] font-semibold">What we check before we say “you qualify”</h3>
                  <ul className="mt-3 list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-ink-700">
                    {g.checks.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="text-[17px] font-semibold">How we decide what fits you best</h3>
                  <ul className="mt-3 list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-ink-700">
                    {g.fit.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                  <p className="mt-2 text-[13.5px] text-ink-500">
                    If we do not know enough yet, we say so instead of guessing.
                  </p>
                </div>
              </div>

              <div className="mt-7 rounded-xl border border-line bg-ink-50 p-4">
                <p className="text-[13px] font-medium text-ink-500">Example</p>
                <p className="mt-1 text-[15px] leading-relaxed text-ink-700">{g.example}</p>
              </div>
              <p className="mt-4 text-[14px] text-ink-500">{g.plans}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-line bg-ink-50 py-16">
        <div className="container-page grid max-w-5xl gap-12 md:grid-cols-2">
          <div>
            <h2 className="text-[24px] font-semibold">What the labels mean</h2>
            <p className="mt-2 text-[15px] text-ink-600">Every opportunity shows one of these.</p>
            <ul className="mt-5 space-y-4">
              {ELIGIBILITY_HELP.map(([k, help]) => (
                <li key={k}>
                  <EligibilityBadge value={k} long />
                  <p className="mt-1.5 text-[14.5px] leading-relaxed text-ink-600">{help}</p>
                </li>
              ))}
            </ul>
            <h3 className="mt-10 text-[18px] font-semibold">The number in the circle</h3>
            <p className="mt-2 text-[15px] text-ink-600">
              It shows how well an opportunity fits you, from 0 to 100. It is a guide, not a promise.
            </p>
            <ul className="mt-3 space-y-2">
              {SCORE_BANDS.map(([band, meaning]) => (
                <li key={band} className="flex gap-3 text-[15px]">
                  <span className="w-28 flex-none font-medium text-ink">{band}</span>
                  <span className="text-ink-600">{meaning}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="text-[24px] font-semibold">Where each listing comes from</h2>
            <p className="mt-2 text-[15px] text-ink-600">
              Every listing says where we found it, so you know how much to trust it.
            </p>
            <ul className="mt-5 space-y-4">
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
                  <p className="mt-1.5 text-[14.5px] leading-relaxed text-ink-600">{STATE_HELP[s]}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="py-16 text-center">
        <div className="container-page max-w-2xl">
          <h2 className="text-[24px] font-semibold">What we cannot promise</h2>
          <p className="mt-3 text-[16px] text-ink-600">
            We cannot promise that an opportunity is still open, that you will be selected, or that a source
            has not changed its terms. Always read the official notice before you apply, and never pay anyone
            to apply for you.
          </p>
          <ButtonLink to="/signup" size="lg" className="mt-8">
            Create my profile
          </ButtonLink>
        </div>
      </section>
    </>
  );
}
