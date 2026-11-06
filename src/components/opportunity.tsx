import {
  AlertTriangle,
  BadgeCheck,
  Bookmark,
  BookmarkCheck,
  Building2,
  CalendarClock,
  CheckCircle2,
  CircleHelp,
  Clock,
  ExternalLink,
  EyeOff,
  Globe2,
  MapPin,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  CATEGORY_LABELS,
  DISPLAY_STATE_LABELS,
  ELIGIBILITY_LABELS,
  type DisplayState,
  type Eligibility,
  type OpportunityCategory,
} from '../../shared/constants';
import { deadlineLabel, relTime } from '../lib/format';
import { Button, Modal, cx } from './ui';

export type OppSummary = {
  id: string;
  category: OpportunityCategory;
  title: string;
  organization: string;
  summary: string;
  country: string | null;
  location: string | null;
  remote: string;
  source: {
    id: string;
    name: string;
    type: string | null;
    automation: string | null;
    terms_url: string | null;
  };
  source_url: string;
  application_url: string | null;
  official_url: string | null;
  reference_no: string | null;
  published_at: string | null;
  deadline_at: string | null;
  deadline_tz: string | null;
  deadline_note: string | null;
  status: string;
  verification: string;
  display_state: DisplayState;
  first_seen_at: string;
  last_checked_at: string;
  is_demo: boolean;
  attribution: string | null;
  match?: {
    score: number | null;
    eligibility: Eligibility;
    confidence?: string;
    top_reason?: string | null;
    missing_count?: number;
    profile_type?: string;
  } | null;
  user_state?: 'saved' | 'dismissed' | null;
};

const STATE_STYLE: Record<DisplayState, [string, typeof BadgeCheck]> = {
  verified_official: ['bg-ok-50 text-ok-700', BadgeCheck],
  admin_verified: ['bg-ok-50 text-ok-700', BadgeCheck],
  verified_ats: ['bg-brand-50 text-brand-700', BadgeCheck],
  aggregator_only: ['bg-warn-50 text-warn-700', Globe2],
  unverified: ['bg-bad-50 text-bad-700', ShieldAlert],
  stale: ['bg-ink-100 text-ink-600', Clock],
  status_uncertain: ['bg-ink-100 text-ink-600', CircleHelp],
  closed: ['bg-ink-100 text-ink-500', XCircle],
  expired: ['bg-ink-100 text-ink-500', XCircle],
  cancelled: ['bg-bad-50 text-bad-700', XCircle],
};

export const STATE_HELP: Record<DisplayState, string> = {
  verified_official: "Confirmed on the responsible organisation's official page or authorised portal.",
  verified_ats: 'Confirmed on a recognised applicant-tracking system (ATS) page operated for the employer.',
  aggregator_only:
    'Found through an aggregator. The original posting has not been confirmed on the employer’s own site.',
  admin_verified: 'Checked and approved by an Opportunity Radar administrator against the official source.',
  unverified: 'The source or application destination has not been sufficiently confirmed.',
  stale: 'The source has not been checked recently, so the status may have changed.',
  status_uncertain: 'The listing disappeared from its source. It may have closed — confirm before applying.',
  closed: 'The source shows this opportunity as closed.',
  expired: 'The published deadline has passed.',
  cancelled: 'The source published a cancellation.',
};

export function VerificationBadge({ state, className }: { state: DisplayState; className?: string }) {
  const [cls, Icon] = STATE_STYLE[state] ?? STATE_STYLE.unverified;
  return (
    <span className={cx('chip', cls, className)} title={STATE_HELP[state]}>
      <Icon className="h-3.5 w-3.5" aria-hidden /> {DISPLAY_STATE_LABELS[state]}
    </span>
  );
}

const ELIG_STYLE: Record<Eligibility, [string, typeof BadgeCheck]> = {
  eligible: ['text-ok-700 bg-ok-50', CheckCircle2],
  potential: ['text-brand-700 bg-brand-50', CircleHelp],
  not_eligible: ['text-bad-700 bg-bad-50', XCircle],
  insufficient: ['text-ink-600 bg-ink-100', AlertTriangle],
};
const ELIG_SHORT: Record<Eligibility, string> = {
  eligible: 'Eligible',
  potential: 'Potential match',
  not_eligible: 'Not eligible',
  insufficient: 'Insufficient information',
};

export function EligibilityBadge({ value, long }: { value: Eligibility; long?: boolean }) {
  const [cls, Icon] = ELIG_STYLE[value];
  return (
    <span className={cx('chip', cls)} title={ELIGIBILITY_LABELS[value]}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {long ? ELIGIBILITY_LABELS[value] : ELIG_SHORT[value]}
    </span>
  );
}

export function ScoreRing({ score, size = 52 }: { score: number | null; size?: number }) {
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  const v = score ?? 0;
  const color =
    score === null ? '#bec4d5' : v >= 75 ? '#21ad64' : v >= 55 ? '#1a91f0' : v >= 35 ? '#f5a623' : '#ef4b4b';
  return (
    <div
      className="relative flex-none"
      style={{ width: size, height: size }}
      aria-label={score === null ? 'Relevance not scored' : `Relevance ${score} out of 100`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#eff2f9" strokeWidth="5" fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth="5"
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={c - (c * v) / 100}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[13px] font-bold text-ink">
        {score === null ? '—' : `${score}`}
      </span>
    </div>
  );
}

export function CategoryChip({ category }: { category: OpportunityCategory }) {
  return <span className="chip bg-ink-100 text-ink-600">{CATEGORY_LABELS[category] ?? category}</span>;
}

export function OpportunityCard({
  o,
  onSave,
  onDismiss,
  linkBase = '/app/opportunities',
}: {
  o: OppSummary;
  onSave?: (o: OppSummary) => void;
  onDismiss?: (o: OppSummary) => void;
  linkBase?: string;
}) {
  const dl = deadlineLabel(o.deadline_at);
  const tone = { bad: 'text-bad-700', warn: 'text-warn-700', ok: 'text-ink-600', muted: 'text-ink-400' }[
    dl.tone
  ];
  return (
    <article className="card group relative flex gap-4 p-4 transition-shadow hover:shadow-paper sm:p-5">
      {o.match && (
        <div className="hidden sm:block">
          <ScoreRing score={o.match.score} />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
          <CategoryChip category={o.category} />
          <VerificationBadge state={o.display_state} />
          {o.match && <EligibilityBadge value={o.match.eligibility} />}
          {o.is_demo && <span className="chip bg-warn-500 text-white">DEMO DATA</span>}
        </div>
        <h3 className="text-[17px] font-bold leading-snug text-ink">
          <Link
            to={`${linkBase}/${o.id}`}
            className="break-words after:absolute after:inset-0 hover:text-brand-600"
          >
            {o.title}
          </Link>
        </h3>
        <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-500">
          <span className="flex min-w-0 items-center gap-1">
            <Building2 className="h-4 w-4 flex-none" aria-hidden />{' '}
            <span className="truncate">{o.organization}</span>
          </span>
          {(o.location || o.country) && (
            <span className="flex min-w-0 items-center gap-1">
              <MapPin className="h-4 w-4 flex-none" aria-hidden />{' '}
              <span className="truncate">{o.location || o.country}</span>
            </span>
          )}
          <span className={cx('flex items-center gap-1 font-medium', tone)}>
            <CalendarClock className="h-4 w-4 flex-none" aria-hidden /> {dl.text}
          </span>
        </p>
        {o.match?.top_reason && (
          <p className="mt-2 line-clamp-2 text-sm text-ink-600">{o.match.top_reason}</p>
        )}
        {!o.match?.top_reason && o.summary && (
          <p className="mt-2 line-clamp-2 text-sm text-ink-500">{o.summary}</p>
        )}
        <p className="mt-2 text-xs text-ink-400">
          Source: {o.source.name} · checked {relTime(o.last_checked_at)}
          {o.match?.score !== undefined && o.match && (
            <span className="sm:hidden"> · Relevance {o.match.score ?? '—'}/100</span>
          )}
        </p>
      </div>
      {(onSave || onDismiss) && (
        <div className="relative z-10 flex flex-col gap-1">
          {onSave && (
            <button
              onClick={() => onSave(o)}
              className="rounded p-2 text-ink-400 hover:bg-brand-50 hover:text-brand-600"
              aria-label={o.user_state === 'saved' ? 'Unsave' : 'Save'}
              title={o.user_state === 'saved' ? 'Saved' : 'Save'}
            >
              {o.user_state === 'saved' ? (
                <BookmarkCheck className="h-5 w-5 text-brand-600" />
              ) : (
                <Bookmark className="h-5 w-5" />
              )}
            </button>
          )}
          {onDismiss && (
            <button
              onClick={() => onDismiss(o)}
              className="rounded p-2 text-ink-400 hover:bg-ink-100 hover:text-ink"
              aria-label="Dismiss"
              title="Not interested"
            >
              <EyeOff className="h-5 w-5" />
            </button>
          )}
        </div>
      )}
    </article>
  );
}

export type MatchResult = {
  profile_type: string;
  eligibility: Eligibility;
  score: number | null;
  confidence: 'high' | 'medium' | 'low';
  reasons: Array<{ label: string; detail: string }>;
  missing: string[];
  disqualifiers: string[];
  facts_used: string[];
  requirements_used: string[];
  next_action: string;
  gated?: string;
};

export function MatchPanel({ m }: { m: MatchResult }) {
  const label =
    { career: 'Career profile', academic: 'Academic profile', business: 'Business profile' }[
      m.profile_type
    ] ?? 'Profile';
  if (m.gated)
    return (
      <div className="card p-5">
        <h3 className="font-bold">{label}</h3>
        <p className="mt-2 text-sm text-ink-600">
          Business tender matching is included from the Basic plan.{' '}
          <Link to="/pricing" className="link">
            Compare plans
          </Link>
        </p>
      </div>
    );
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">
            Your {label.toLowerCase()}
          </p>
          <div className="mt-2">
            <EligibilityBadge value={m.eligibility} long />
          </div>
        </div>
        <ScoreRing score={m.score} size={60} />
      </div>
      <p className="mt-3 text-xs text-ink-500">
        Relevance{' '}
        {m.score === null ? 'could not be scored — not enough profile information' : `${m.score}/100`} ·
        Confidence: {m.confidence}. Relevance measures fit; eligibility is checked separately against stated
        requirements.
      </p>
      <div className="mt-4 rounded-lg bg-ink-50 p-3 text-sm font-medium text-ink">{m.next_action}</div>
      {m.disqualifiers.length > 0 && (
        <Section title="Potential disqualifiers" tone="bad">
          {m.disqualifiers.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </Section>
      )}
      {m.reasons.length > 0 && (
        <Section title="Why it matches" tone="ok">
          {m.reasons.map((r, i) => (
            <li key={i}>
              <span className="font-semibold">{r.label}:</span> {r.detail}
            </li>
          ))}
        </Section>
      )}
      {m.missing.length > 0 && (
        <Section title="Missing or unconfirmed" tone="warn">
          {m.missing.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </Section>
      )}
      <details className="mt-4 text-sm">
        <summary className="cursor-pointer font-semibold text-ink-600">Evidence used</summary>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase text-ink-400">Your profile facts</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-ink-600">
              {m.facts_used.length ? m.facts_used.map((f) => <li key={f}>{f}</li>) : <li>None recorded</li>}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-ink-400">Opportunity requirements</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-ink-600">
              {m.requirements_used.length ? (
                m.requirements_used.map((f) => <li key={f}>{f}</li>)
              ) : (
                <li>No structured requirements extracted</li>
              )}
            </ul>
          </div>
        </div>
      </details>
    </div>
  );
}

function Section({
  title,
  tone,
  children,
}: {
  title: string;
  tone: 'ok' | 'warn' | 'bad';
  children: ReactNode;
}) {
  const color = { ok: 'text-ok-700', warn: 'text-warn-700', bad: 'text-bad-700' }[tone];
  return (
    <div className="mt-4">
      <h4 className={cx('text-sm font-bold', color)}>{title}</h4>
      <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-ink-700">{children}</ul>
    </div>
  );
}

/** External link that warns before leaving for a destination that is not verified. */
export function OutboundLink({
  href,
  verified,
  children,
  className,
}: {
  href: string;
  verified: boolean;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const host = (() => {
    try {
      return new URL(href).hostname;
    } catch {
      return href;
    }
  })();
  if (verified)
    return (
      <a href={href} target="_blank" rel="noopener noreferrer nofollow" className={className}>
        {children} <ExternalLink className="h-4 w-4" aria-hidden />
      </a>
    );
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {children} <ExternalLink className="h-4 w-4" aria-hidden />
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="You are leaving Opportunity Radar"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Stay here
            </Button>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="btn btn-md btn-primary"
              onClick={() => setOpen(false)}
            >
              Continue to {host}
            </a>
          </>
        }
      >
        <p className="text-[15px] text-ink-600">
          This destination (<strong>{host}</strong>) has <strong>not been verified</strong> as the employer's
          or funder's official page. Never pay a fee to apply, and do not share passwords or bank details.
          Confirm the opportunity on the organisation's own website if you can.
        </p>
      </Modal>
    </>
  );
}
