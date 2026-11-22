import {
  BadgeCheck,
  Bell,
  CircleCheck,
  LayoutTemplate,
  ListChecks,
  Scale,
  Sparkles,
  Upload,
  type LucideIcon,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { CV_TEMPLATE_LABELS, CV_TEMPLATES } from '../../../shared/constants';
import { CvThumb } from '../../components/CvThumb';
import { PlanCards, usePlans } from '../../components/PlanCards';
import { Faq, HeroSlideshow, SectionHeading, type HeroSlide } from '../../components/marketing';
import { ScoreRing, VerificationBadge } from '../../components/opportunity';
import { ButtonLink, useLoad } from '../../components/ui';
import { SAMPLE_CV } from '../../cv/sample';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';

type SourcesResponse = {
  sources: Array<{ enabled: boolean; automation: string; owner: string }>;
  totals: Array<{ category: string; n: number }>;
};

const HERO_SLIDES: HeroSlide[] = [
  { src: '/photos/hero-career.webp', caption: 'Build a CV that gets read' },
  { src: '/photos/hero-academic.webp', caption: 'Find funded study places' },
  { src: '/photos/hero-business.webp', caption: 'Bid for the right contracts' },
];

const PROFILES = [
  {
    id: 'career',
    title: 'Career',
    photo: '/photos/card-career-bg.webp',
    img: '/product/card-career.jpg',
    text: 'Jobs, internships, graduate programmes, fellowships and individual consultancies, matched to your skills, experience and preferred locations.',
  },
  {
    id: 'academic',
    title: 'Academic',
    photo: '/photos/card-academic-bg.webp',
    img: '/product/card-academic.jpg',
    text: "Fully and partially funded scholarships, Master's and PhD places, research grants and fellowships, checked against published eligibility.",
  },
  {
    id: 'business',
    title: 'Business',
    photo: '/photos/card-business-bg.webp',
    img: '/product/card-business.jpg',
    text: 'Tenders, RFPs, RFQs, EOIs and business grants, with registration, turnover and certification requirements flagged clearly.',
  },
];

const FEATURES: Array<[LucideIcon, string, string]> = [
  [
    LayoutTemplate,
    'ATS-friendly templates',
    'Clean layouts that applicant-tracking systems read correctly, in PDF and Word.',
  ],
  [
    Upload,
    'Import your current CV',
    'Upload a PDF or Word CV. We extract it for you to review. Nothing is added that you did not write.',
  ],
  [
    Sparkles,
    'Tailor for each role',
    'See which of your skills an opportunity asks for, and create a focused copy in one click.',
  ],
  [
    Scale,
    'Explainable matching',
    'Every match shows the facts used, what is missing and any requirement you do not meet.',
  ],
  [
    BadgeCheck,
    'Honest verification labels',
    'Official, ATS, aggregator or unverified: you always know where a listing came from.',
  ],
  [
    ListChecks,
    'Track applications & bids',
    'Statuses, notes, follow-ups and deadline reminders for jobs, scholarships and tenders.',
  ],
];

const MATCHING_STEPS: Array<[string, string]> = [
  ['Discover', 'Every six hours we check official portals and permitted feeds, and remove duplicates.'],
  [
    'Check eligibility',
    'Hard requirements such as deadline, nationality, degree, registration and turnover are checked first.',
  ],
  [
    'Score relevance',
    'Skills, field, sector and location are scored separately for career, academic and business profiles.',
  ],
  ['Explain & alert', 'You see why it fits and what is missing, and you are alerted once, not every cycle.'],
];

const LABELS = [
  'verified_official',
  'verified_ats',
  'admin_verified',
  'aggregator_only',
  'unverified',
  'stale',
  'expired',
] as const;

const FAQS: Array<[string, string]> = [
  [
    'Is Opportunity Radar free?',
    'Yes. Browsing is free, and the Free plan gives you one career profile, one CV, PDF export and weekly job matches. Paid plans are $10 a month for jobs, $15 for jobs and scholarships, and $25 to add tenders and contracts for your company.',
  ],
  [
    'Where do the opportunities come from?',
    'From official sources such as the World Bank procurement portal and Grants.gov, recognised job platforms, and listings our administrators verify against official pages. Each listing shows its source and verification label.',
  ],
  [
    'Will the CV builder make things up?',
    'No. It improves layout and structure, but it never invents employers, dates, degrees, skills or achievements. Where a stronger statement needs a fact, it asks you for it.',
  ],
  [
    'Does a high match mean I am eligible?',
    'Not necessarily. Relevance and eligibility are shown separately. A strong match that fails a stated requirement is marked “Not eligible”, and missing information is shown as “Insufficient information”.',
  ],
  [
    'Do you apply on my behalf?',
    'No. We never submit applications, bids or scholarship forms for you. You review everything and apply on the official site.',
  ],
  [
    'How is my data protected?',
    'Your documents are stored privately and only you can download them. You can export or delete your data at any time. See our privacy policy for details.',
  ],
];

export default function Home() {
  const { me } = useAuth();
  const stats = useLoad(() => api.get<SourcesResponse>('/public/sources'), []);
  const open = stats.data?.totals.reduce((a, t) => a + t.n, 0) ?? null;
  const active = stats.data?.sources.filter((s) => s.enabled).length ?? null;
  const owners = [
    ...new Set(
      (stats.data?.sources ?? []).filter((s) => s.enabled && s.automation !== 'curated').map((s) => s.owner),
    ),
  ].slice(0, 5);
  const hasCurated = (stats.data?.sources ?? []).some((s) => s.enabled && s.automation === 'curated');
  const start = me.user ? '/app' : '/signup';

  return (
    <>
      {/* HERO */}
      <section className="relative isolate overflow-hidden bg-night text-white">
        <HeroSlideshow slides={HERO_SLIDES} />
        <div className="container-page relative grid items-center gap-12 pb-14 pt-20 sm:gap-14 sm:pb-20 sm:pt-28 lg:grid-cols-[1.08fr_1fr] lg:pb-24">
          <div className="min-w-0">
            <h1 className="text-balance text-[40px] font-semibold leading-[1.05] tracking-display text-white sm:text-[54px]">
              The professional CV builder that also{' '}
              <span className="text-white/55">finds your next opportunity</span>
            </h1>
            <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-white/75 sm:mt-6 sm:text-[17px] sm:text-white/70">
              Create one profile. Opportunity Radar turns it into an ATS-ready CV, checks official sources
              every six hours for jobs, scholarships, grants and tenders, and tells you honestly how well each
              one fits, before the deadline.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:mt-9 sm:flex-row">
              <Link to={start} className="btn btn-lg bg-white text-ink hover:bg-ink-100">
                Create my CV, free
              </Link>
              <Link
                to="/opportunities"
                className="btn btn-lg border border-white/20 text-white hover:border-white/50 hover:bg-white/5"
              >
                Browse opportunities
              </Link>
            </div>
            <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-2.5 text-[14.5px] text-white/80 sm:mt-9 sm:gap-x-7 sm:gap-y-3 sm:text-[15px]">
              {['Free to start', 'Official & verified sources', 'No invented facts, ever'].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <CircleCheck className="h-[18px] w-[18px] text-white/55" aria-hidden /> {t}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative mx-auto w-full max-w-[340px] pb-14 sm:max-w-[520px] sm:pb-12" aria-hidden>
            {/* Two templates of the same CV, stacked straight (no tilt) so edges stay crisp. */}
            <div className="absolute right-0 top-10 hidden w-[66%] overflow-hidden rounded-lg bg-white shadow-paper ring-1 ring-black/10 brightness-[0.9] sm:block">
              <CvThumb data={SAMPLE_CV} template="ats" />
            </div>
            {/* On phones the sheet is centred and cropped with a fade so the hero stays short. */}
            <div className="relative mx-auto max-h-[300px] w-[88%] overflow-hidden rounded-lg bg-white shadow-paper ring-1 ring-black/10 [mask-image:linear-gradient(to_bottom,black_65%,transparent)] sm:mx-0 sm:max-h-none sm:w-[80%] sm:[mask-image:none]">
              <CvThumb data={SAMPLE_CV} template="modern" />
            </div>
            <div className="absolute bottom-0 left-0 right-0 rounded-2xl border border-line bg-white p-4 text-ink shadow-card sm:left-auto sm:right-0 sm:w-[310px]">
              <div className="flex items-center gap-3">
                <ScoreRing score={87} size={48} />
                <div className="min-w-0">
                  <p className="truncate text-[14.5px] font-semibold">Chief Operating Officer</p>
                  <p className="text-[12.5px] text-ink-500">Eligible based on available profile</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <VerificationBadge state="verified_official" />
                <span className="chip bg-warn-50 text-warn-700">Closes in 6 days</span>
              </div>
            </div>
            <div className="absolute -left-4 bottom-28 hidden items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-ink shadow-card md:flex">
              <Bell className="h-4 w-4 text-ink-500" />
              <span className="text-[12.5px] font-medium">3 new matches today</span>
            </div>
          </div>
        </div>

        {/* LIVE SOURCE STRIP */}
        <div className="relative border-t border-white/10 bg-black/30 backdrop-blur-sm">
          <div className="container-page flex flex-col items-center gap-4 py-6 text-center lg:flex-row lg:justify-between lg:gap-10 lg:text-left">
            <p className="text-[14.5px] text-white/60 lg:flex-none">
              {open !== null && active !== null ? (
                <>
                  <span className="block sm:inline">
                    Monitoring <span className="font-medium text-white">{active} sources</span>
                  </span>
                  <span className="hidden sm:inline"> · </span>
                  <span className="block sm:inline">
                    <span className="font-medium text-white">{open.toLocaleString()} open opportunities</span>{' '}
                    right now
                  </span>
                </>
              ) : (
                'Opportunities from official portals, recognised job platforms and administrator-verified listings'
              )}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 lg:flex-nowrap lg:justify-end">
              {owners.map((owner) => (
                <span
                  key={owner}
                  className="rounded-full border border-white/15 px-3 py-1 text-[12.5px] text-white/75"
                >
                  {owner}
                </span>
              ))}
              {hasCurated && (
                <span className="rounded-full border border-white/15 px-3 py-1 text-[12.5px] text-white/75">
                  Admin-verified listings
                </span>
              )}
              <Link
                to="/sources"
                className="whitespace-nowrap rounded-full px-3 py-1 text-[12.5px] font-medium text-white hover:underline"
              >
                See all sources →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* THREE PROFILES */}
      <section className="bg-ink-50 py-24">
        <div className="container-page">
          <SectionHeading
            center
            title="Three profiles. One radar."
            sub="Keep a career, academic and business profile in one account. Each is matched against the opportunities that suit it, and nothing else."
          />
          <div className="mt-14 grid gap-5 md:grid-cols-3">
            {PROFILES.map((c) => (
              <Link
                key={c.id}
                to={`/how-it-works#${c.id}`}
                className="card group flex flex-col overflow-hidden !shadow-card transition-transform duration-300 hover:-translate-y-1"
              >
                {/* Photo of the audience, with a real listing from the product floating on top. */}
                <div className="relative h-56 overflow-hidden">
                  <img
                    src={c.photo}
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/5 to-transparent" />
                  <span className="absolute left-4 top-4 rounded-full bg-white px-2.5 py-1 text-[12.5px] font-medium text-ink shadow-soft">
                    {c.title}
                  </span>
                  <div className="absolute -bottom-3 left-1/2 w-[84%] -translate-x-1/2 overflow-hidden rounded-xl border border-white/60 bg-white shadow-paper transition-transform duration-500 group-hover:-translate-y-1">
                    <div
                      className="flex items-center gap-1 border-b border-line bg-ink-50 px-2.5 py-1.5"
                      aria-hidden
                    >
                      {[0, 1, 2].map((d) => (
                        <span key={d} className="h-1.5 w-1.5 rounded-full bg-ink-300" />
                      ))}
                    </div>
                    <img src={c.img} alt="" loading="lazy" className="block w-full" />
                  </div>
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <h3 className="text-[19px] font-semibold">{c.title} profile</h3>
                  <p className="mt-2 flex-1 text-[15px] leading-relaxed text-ink-500">{c.text}</p>
                  <span className="mt-5 text-[14.5px] font-medium text-ink group-hover:underline">
                    How it works →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="py-24">
        <div className="container-page grid gap-14 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
          <div>
            <SectionHeading
              title="Use Opportunity Radar as your guide"
              sub="Everything you need to go from “I should apply” to a submitted application, without guesswork."
            />
            <ButtonLink to={start} size="lg" className="mt-8">
              Get started now
            </ButtonLink>
          </div>
          <div className="grid gap-x-10 gap-y-9 sm:grid-cols-2">
            {FEATURES.map(([Icon, t, d]) => (
              <div key={t} className="flex gap-4">
                <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl border border-line bg-white text-ink shadow-soft">
                  <Icon className="h-[18px] w-[18px]" aria-hidden />
                </span>
                <div>
                  <h3 className="text-[16px] font-semibold">{t}</h3>
                  <p className="mt-1 text-[14.5px] leading-relaxed text-ink-500">{d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TEMPLATES */}
      <section className="border-y border-line bg-ink-50 py-24">
        <div className="container-page">
          <div className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-end">
            <SectionHeading
              title="Beautiful, ready-to-use CV templates"
              sub="Switch templates at any time. Your content stays exactly the same."
            />
            <ButtonLink to="/templates" variant="outline">
              See all templates
            </ButtonLink>
          </div>
          {/* Phones: a swipeable row (the next template peeks in); larger screens: a grid. */}
          <div className="-mx-5 mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-4 sm:mx-0 sm:mt-12 sm:grid sm:snap-none sm:grid-cols-2 sm:gap-8 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3">
            {CV_TEMPLATES.map((t) => (
              <Link key={t} to={start} className="group w-[78%] flex-none snap-start sm:w-auto">
                <div className="overflow-hidden rounded-xl border border-line bg-white shadow-panel transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-card">
                  <CvThumb data={SAMPLE_CV} template={t} />
                </div>
                <h3 className="mt-4 text-[17px] font-semibold">{CV_TEMPLATE_LABELS[t].name}</h3>
                <p className="text-[14.5px] text-ink-500">{CV_TEMPLATE_LABELS[t].blurb}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* HOW MATCHING WORKS */}
      <section className="bg-night py-24 text-white">
        <div className="container-page">
          <SectionHeading light title="Matching you can check, not a black box" />
          <ol className="mt-12 grid border-t border-white/10 sm:grid-cols-2 md:grid-cols-4">
            {MATCHING_STEPS.map(([t, d], i) => (
              <li
                key={t}
                className="border-b border-white/10 py-7 pr-6 md:border-b-0 md:border-r md:px-6 md:first:pl-0 md:last:border-r-0"
              >
                <p className="text-[13px] text-white/45">{String(i + 1).padStart(2, '0')}</p>
                <h3 className="mt-3 text-[17px] font-medium text-white">{t}</h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-white/60">{d}</p>
              </li>
            ))}
          </ol>
          <div className="mt-12 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <p className="text-[13px] font-medium text-white/50">Every listing carries a label</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {LABELS.map((s) => (
                <VerificationBadge key={s} state={s} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <HomePricing />

      {/* FAQ */}
      <section className="py-24">
        <div className="container-page max-w-3xl">
          <h2 className="text-center text-[30px] font-medium sm:text-[37px]">Frequently asked questions</h2>
          <div className="mt-10">
            <Faq items={FAQS} defaultOpen={0} />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="pb-24">
        <div className="container-page">
          <div className="relative isolate flex flex-col items-center gap-6 overflow-hidden rounded-[20px] bg-night px-6 py-20 text-center text-white">
            <img
              src="/photos/hero-business.webp"
              alt=""
              loading="lazy"
              className="absolute inset-0 -z-10 h-full w-full object-cover opacity-35"
            />
            <div className="absolute inset-0 -z-10 bg-gradient-to-b from-night/60 to-night/90" aria-hidden />
            <h2 className="max-w-2xl text-[30px] font-medium leading-tight text-white sm:text-[37px]">
              Your next opportunity is already out there
            </h2>
            <p className="max-w-xl text-[16.5px] text-white/65">
              Build your profile in minutes. We will keep watching while you get on with your day.
            </p>
            <Link to={start} className="btn btn-lg bg-white text-ink hover:bg-ink-100">
              Create my free profile
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

/** The same plan cards as the Pricing page, so the two always agree. */
function HomePricing() {
  const { data } = usePlans();
  if (!data?.plans.length) return null;
  return (
    <section className="border-b border-line bg-ink-50 py-24">
      <div className="container-page">
        <SectionHeading
          center
          title="Simple monthly plans"
          sub="Browsing every listing is free. Pick the plan that matches what you are looking for: jobs, scholarships, or contracts for your company."
        />
        <div className="mt-14">
          <PlanCards plans={data.plans} />
        </div>
        <p className="mt-8 text-center text-[14.5px] text-ink-500">
          Prices in US dollars, billed monthly. Plans do not renew automatically.{' '}
          <Link to="/pricing" className="font-medium text-ink underline-offset-4 hover:underline">
            Compare every feature →
          </Link>
        </p>
      </div>
    </section>
  );
}
