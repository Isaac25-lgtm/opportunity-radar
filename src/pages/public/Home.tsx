import {
  BadgeCheck,
  Bell,
  Briefcase,
  Building2,
  CheckCircle2,
  ChevronDown,
  FileText,
  GraduationCap,
  LayoutTemplate,
  ListChecks,
  Scale,
  Sparkles,
  Upload,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CV_TEMPLATE_LABELS, CV_TEMPLATES } from '../../../shared/constants';
import { CvThumb } from '../../components/CvThumb';
import { ButtonLink, useLoad } from '../../components/ui';
import { VerificationBadge } from '../../components/opportunity';
import { api } from '../../lib/api';
import { SAMPLE_CV } from '../../cv/sample';
import { useAuth } from '../../lib/auth';

export default function Home() {
  const { me } = useAuth();
  const stats = useLoad(
    () => api.get<{ sources: any[]; totals: Array<{ category: string; n: number }> }>('/public/sources'),
    [],
  );
  const open = stats.data?.totals.reduce((a, t) => a + t.n, 0) ?? null;
  const active = stats.data?.sources.filter((s) => s.enabled).length ?? null;
  const start = me.user ? '/app' : '/signup';
  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-to-b from-ink-100 to-white">
        <div className="container-page grid items-center gap-12 py-14 lg:grid-cols-[1.05fr_1fr] lg:py-20">
          <div className="min-w-0">
            <h1 className="text-[40px] font-extrabold leading-[1.08] text-ink sm:text-[54px]">
              The professional CV builder that also{' '}
              <span className="text-brand-500">finds your next opportunity</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-600">
              Create one profile. Opportunity Radar turns it into an ATS-ready CV, checks official sources
              every six hours for jobs, scholarships, grants and tenders, and tells you honestly how well each
              one fits — before the deadline.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink to={start} size="lg">
                Create my CV — free
              </ButtonLink>
              <ButtonLink to="/opportunities" size="lg" variant="secondary">
                Browse opportunities
              </ButtonLink>
            </div>
            <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-ink-600">
              {['Free to start', 'Official & verified sources', 'No invented facts — ever'].map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-ok-500" /> {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="relative mx-auto w-full max-w-[520px]">
            <div className="absolute -right-6 top-6 hidden w-[62%] rotate-6 overflow-hidden rounded-lg opacity-90 shadow-paper sm:block">
              <CvThumb data={SAMPLE_CV} template="ats" />
            </div>
            <div className="relative w-[78%] overflow-hidden rounded-lg shadow-paper sm:-rotate-2">
              <CvThumb data={SAMPLE_CV} template="modern" />
            </div>
            <div className="absolute -bottom-4 left-4 right-4 rounded-xl bg-white p-4 shadow-paper sm:left-auto sm:right-0 sm:w-[300px]">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 flex-none items-center justify-center rounded-full border-[5px] border-ok-500 text-sm font-bold">
                  87
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">Chief Operating Officer</p>
                  <p className="text-xs text-ink-500">Eligible based on available profile</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <VerificationBadge state="verified_official" />
                <span className="chip bg-warn-50 text-warn-700">Closes in 6 days</span>
              </div>
            </div>
            <div className="absolute -left-3 bottom-20 hidden items-center gap-2 rounded-lg bg-white px-3 py-2 shadow-card md:flex">
              <Bell className="h-4 w-4 text-brand-500" />
              <span className="text-xs font-semibold">3 new matches today</span>
            </div>
          </div>
        </div>
      </section>

      {/* LIVE SOURCE STRIP */}
      <section className="border-y border-ink-100 bg-white">
        <div className="container-page flex flex-col items-center gap-4 py-6 text-center md:flex-row md:justify-between md:text-left">
          <p className="text-sm font-semibold text-ink-500">
            {open !== null && active !== null ? (
              <>
                Monitoring <span className="text-ink">{active} sources</span> ·{' '}
                <span className="text-ink">{open.toLocaleString()} open opportunities</span> right now
              </>
            ) : (
              'Opportunities from official portals, recognised job platforms and administrator-verified listings'
            )}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {[
              ...new Set(
                (stats.data?.sources ?? [])
                  .filter((s) => s.enabled && s.automation !== 'curated')
                  .map((s) => s.owner as string),
              ),
            ]
              .slice(0, 5)
              .map((owner) => (
                <span
                  key={owner}
                  className="rounded-full bg-ink-100 px-3 py-1 text-xs font-semibold text-ink-600"
                >
                  {owner}
                </span>
              ))}
            {(stats.data?.sources ?? []).some((s) => s.enabled && s.automation === 'curated') && (
              <span className="rounded-full bg-ink-100 px-3 py-1 text-xs font-semibold text-ink-600">
                Admin-verified listings
              </span>
            )}
            <Link
              to="/sources"
              className="rounded-full px-3 py-1 text-xs font-semibold text-brand-600 hover:underline"
            >
              See all sources →
            </Link>
          </div>
        </div>
      </section>

      {/* THREE PROFILES */}
      <section className="py-20">
        <div className="container-page">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-extrabold sm:text-[40px]">Three profiles. One radar.</h2>
            <p className="mt-4 text-lg text-ink-600">
              Keep a career, academic and business profile in one account. Each is matched against the
              opportunities that suit it — and nothing else.
            </p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              {
                icon: Briefcase,
                title: 'Career',
                color: 'bg-brand-50 text-brand-600',
                text: 'Jobs, internships, graduate programmes, fellowships and individual consultancies — matched to your skills, experience and preferred locations.',
                id: 'career',
              },
              {
                icon: GraduationCap,
                title: 'Academic',
                color: 'bg-ok-50 text-ok-700',
                text: "Fully and partially funded scholarships, Master's and PhD places, research grants and fellowships — checked against published eligibility.",
                id: 'academic',
              },
              {
                icon: Building2,
                title: 'Business',
                color: 'bg-warn-50 text-warn-700',
                text: 'Tenders, RFPs, RFQs, EOIs and business grants — with registration, turnover and certification requirements flagged clearly.',
                id: 'business',
              },
            ].map((c) => (
              <Link
                key={c.title}
                to={`/how-it-works#${c.id}`}
                className="card group p-7 transition-shadow hover:shadow-paper"
              >
                <span className={`flex h-12 w-12 items-center justify-center rounded-xl ${c.color}`}>
                  <c.icon className="h-6 w-6" />
                </span>
                <h3 className="mt-5 text-xl font-bold">{c.title} profile</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-600">{c.text}</p>
                <span className="mt-4 inline-block text-sm font-semibold text-brand-600 group-hover:underline">
                  How it works →
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="bg-ink-100 py-20">
        <div className="container-page grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <h2 className="text-3xl font-extrabold sm:text-[40px]">Use Opportunity Radar as your guide</h2>
            <p className="mt-4 text-lg text-ink-600">
              Everything you need to go from “I should apply” to a submitted application — without guesswork.
            </p>
            <ButtonLink to={start} size="lg" className="mt-8">
              Get started now
            </ButtonLink>
          </div>
          <div className="grid gap-x-8 gap-y-9 sm:grid-cols-2">
            {[
              [
                LayoutTemplate,
                'ATS-friendly templates',
                'Clean layouts that applicant-tracking systems read correctly, in PDF and Word.',
              ],
              [
                Upload,
                'Import your current CV',
                'Upload a PDF or Word CV. We extract it for you to review — nothing is added that you did not write.',
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
                'Official, ATS, aggregator or unverified — you always know where a listing came from.',
              ],
              [
                ListChecks,
                'Track applications & bids',
                'Statuses, notes, follow-ups and deadline reminders for jobs, scholarships and tenders.',
              ],
            ].map(([Icon, t, d]) => {
              const I = Icon as typeof FileText;
              return (
                <div key={t as string} className="flex gap-4">
                  <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-white text-brand-500 shadow-sm">
                    <I className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="font-bold">{t as string}</h3>
                    <p className="mt-1 text-[15px] leading-relaxed text-ink-600">{d as string}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* TEMPLATES */}
      <section className="py-20">
        <div className="container-page">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-extrabold sm:text-[40px]">Beautiful, ready-to-use CV templates</h2>
              <p className="mt-3 text-lg text-ink-600">
                Switch templates at any time — your content stays exactly the same.
              </p>
            </div>
            <ButtonLink to="/templates" variant="secondary">
              See all templates
            </ButtonLink>
          </div>
          <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {CV_TEMPLATES.map((t) => (
              <Link key={t} to={start} className="group">
                <div className="overflow-hidden rounded-lg shadow-card ring-1 ring-ink-100 transition-all group-hover:-translate-y-1 group-hover:shadow-paper">
                  <CvThumb data={SAMPLE_CV} template={t} />
                </div>
                <h3 className="mt-4 text-lg font-bold group-hover:text-brand-600">
                  {CV_TEMPLATE_LABELS[t].name}
                </h3>
                <p className="text-sm text-ink-500">{CV_TEMPLATE_LABELS[t].blurb}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* HOW MATCHING WORKS */}
      <section className="bg-ink py-20 text-white">
        <div className="container-page">
          <h2 className="max-w-2xl text-3xl font-extrabold sm:text-[40px]">
            Matching you can check, not a black box
          </h2>
          <div className="mt-12 grid gap-8 md:grid-cols-4">
            {[
              [
                '1',
                'Discover',
                'Every six hours we check official portals and permitted feeds, and remove duplicates.',
              ],
              [
                '2',
                'Check eligibility',
                'Hard requirements — deadline, nationality, degree, registration, turnover — are checked first.',
              ],
              [
                '3',
                'Score relevance',
                'Skills, field, sector and location are scored separately for career, academic and business profiles.',
              ],
              [
                '4',
                'Explain & alert',
                'You see why it fits and what is missing, and you are alerted once — not every cycle.',
              ],
            ].map(([n, t, d]) => (
              <div key={n}>
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-500 font-bold">
                  {n}
                </span>
                <h3 className="mt-4 text-lg font-bold">{t}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-300">{d}</p>
              </div>
            ))}
          </div>
          <div className="mt-12 rounded-xl bg-white/5 p-6 ring-1 ring-white/10">
            <p className="text-sm font-semibold uppercase tracking-wider text-ink-300">
              Every listing carries a label
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {(
                [
                  'verified_official',
                  'verified_ats',
                  'admin_verified',
                  'aggregator_only',
                  'unverified',
                  'stale',
                  'expired',
                ] as const
              ).map((s) => (
                <VerificationBadge key={s} state={s} />
              ))}
            </div>
          </div>
        </div>
      </section>

      <Faq />

      {/* CTA */}
      <section className="pb-20">
        <div className="container-page">
          <div className="flex flex-col items-center gap-6 rounded-2xl bg-brand-500 px-6 py-14 text-center text-white">
            <h2 className="max-w-2xl text-3xl font-extrabold sm:text-[40px]">
              Your next opportunity is already out there
            </h2>
            <p className="max-w-xl text-lg text-brand-50">
              Build your profile in minutes. We will keep watching while you get on with your day.
            </p>
            <ButtonLink to={start} size="lg" className="bg-white !text-brand-600 hover:bg-brand-50">
              Create my free profile
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}

const FAQS: Array<[string, string]> = [
  [
    'Is Opportunity Radar free?',
    'Yes. The Free plan includes one profile, one CV, PDF export and weekly alerts. Paid plans (from UGX 10,000/month) add more profiles, Word export, faster alerts, tailoring and cover letters.',
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

function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="py-20">
      <div className="container-page max-w-3xl">
        <h2 className="text-center text-3xl font-extrabold sm:text-[40px]">Frequently asked questions</h2>
        <div className="mt-10 divide-y divide-ink-200 border-y border-ink-200">
          {FAQS.map(([q, a], i) => (
            <div key={q}>
              <button
                className="flex w-full items-center justify-between gap-4 py-5 text-left text-lg font-semibold"
                onClick={() => setOpen(open === i ? null : i)}
                aria-expanded={open === i}
              >
                {q}
                <ChevronDown
                  className={`h-5 w-5 flex-none text-ink-400 transition-transform ${open === i ? 'rotate-180' : ''}`}
                />
              </button>
              {open === i && <p className="pb-5 text-[15px] leading-relaxed text-ink-600">{a}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
