import { Fragment, type CSSProperties, type ReactNode } from 'react';
import { CV_SECTION_LABELS, dateRange, type CvData, type CvSectionKey } from '../../shared/cv';
import type { CvTemplate } from '../../shared/constants';

export const ACCENTS = [
  '#1e3a5f',
  '#1a91f0',
  '#0f766e',
  '#2f7d32',
  '#8b1e3f',
  '#5b3fa6',
  '#b45309',
  '#1e2532',
];

/** Splits free text into bullet items (lines starting with -, •, *) and paragraphs. */
function RichText({ text, style }: { text: string; style?: CSSProperties }) {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return null;
  const blocks: Array<{ type: 'ul' | 'p'; items: string[] }> = [];
  for (const l of lines) {
    const bullet = /^[-•*▪●]\s*/.test(l);
    const content = l.replace(/^[-•*▪●]\s*/, '');
    const last = blocks[blocks.length - 1];
    if (bullet) {
      if (last?.type === 'ul') last.items.push(content);
      else blocks.push({ type: 'ul', items: [content] });
    } else blocks.push({ type: 'p', items: [content] });
  }
  return (
    <div style={style}>
      {blocks.map((b, i) =>
        b.type === 'ul' ? (
          <ul key={i} style={{ margin: '4px 0', paddingLeft: 16, listStyle: 'disc' }}>
            {b.items.map((it, j) => (
              <li key={j} style={{ marginBottom: 2 }}>
                {it}
              </li>
            ))}
          </ul>
        ) : (
          <p key={i} style={{ margin: '3px 0' }}>
            {b.items[0]}
          </p>
        ),
      )}
    </div>
  );
}

const visible = (d: CvData) => d.order.filter((k) => !d.hidden.includes(k));
const hasContent = (d: CvData, k: CvSectionKey): boolean => {
  switch (k) {
    case 'summary':
      return !!d.summary.trim();
    case 'references':
      return !!d.references.trim();
    default:
      return (d[k] as unknown[]).length > 0;
  }
};

/* ============================== Shared section renderers ============================== */
type Tone = { accent: string; muted: string; title: (label: string) => ReactNode; font: string };

function Body({ d, k, t }: { d: CvData; k: CvSectionKey; t: Tone }) {
  const sm: CSSProperties = { fontSize: 11.5, lineHeight: 1.5, color: '#303848' };
  const meta: CSSProperties = { fontSize: 10.5, color: t.muted };
  switch (k) {
    case 'summary':
      return <RichText text={d.summary} style={sm} />;
    case 'experience':
      return (
        <>
          {d.experience.map((e) => (
            <div key={e.id} className="cv-avoid-break" style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: '#1e2532' }}>
                  {[e.title, e.employer].filter(Boolean).join(', ')}
                  {e.location && <span style={{ fontWeight: 400, color: t.muted }}>, {e.location}</span>}
                </div>
              </div>
              <div style={{ ...meta, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 1 }}>
                {dateRange(e.start, e.end, e.current)}
              </div>
              {e.description && <RichText text={e.description} style={{ ...sm, marginTop: 3 }} />}
            </div>
          ))}
        </>
      );
    case 'education':
      return (
        <>
          {d.education.map((e) => (
            <div key={e.id} className="cv-avoid-break" style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#1e2532' }}>
                {[e.degree, e.institution].filter(Boolean).join(', ')}
                {e.location && <span style={{ fontWeight: 400, color: t.muted }}>, {e.location}</span>}
              </div>
              <div style={{ ...meta, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 1 }}>
                {[dateRange(e.start, e.end), e.grade].filter(Boolean).join(' · ')}
              </div>
              {e.details && <RichText text={e.details} style={{ ...sm, marginTop: 3 }} />}
            </div>
          ))}
        </>
      );
    case 'skills':
      return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 18px', ...sm }}>
          {d.skills.map((s) => (
            <span key={s.id}>
              {s.name}
              {s.level && <span style={{ color: t.muted }}> — {s.level}</span>}
            </span>
          ))}
        </div>
      );
    case 'languages':
      return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 18px', ...sm }}>
          {d.languages.map((s) => (
            <span key={s.id}>
              {s.name}
              {s.level && <span style={{ color: t.muted }}> — {s.level}</span>}
            </span>
          ))}
        </div>
      );
    case 'projects':
      return (
        <>
          {d.projects.map((p) => (
            <div key={p.id} className="cv-avoid-break" style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700 }}>
                {p.name}
                {p.role && <span style={{ fontWeight: 400, color: t.muted }}> — {p.role}</span>}
              </div>
              {p.link && <div style={{ ...meta }}>{p.link}</div>}
              {p.description && <RichText text={p.description} style={sm} />}
            </div>
          ))}
        </>
      );
    case 'certifications':
      return (
        <ul style={{ margin: 0, paddingLeft: 16, listStyle: 'disc', ...sm }}>
          {d.certifications.map((c) => (
            <li key={c.id}>
              <strong>{c.name}</strong>
              {[c.issuer, c.date].filter(Boolean).length > 0 && (
                <span style={{ color: t.muted }}> — {[c.issuer, c.date].filter(Boolean).join(', ')}</span>
              )}
            </li>
          ))}
        </ul>
      );
    case 'publications':
      return (
        <ol style={{ margin: 0, paddingLeft: 18, ...sm }}>
          {d.publications.map((p) => (
            <li key={p.id} style={{ marginBottom: 3 }}>
              {p.title}
              {p.venue && <em>. {p.venue}</em>}
              {p.year && <span> ({p.year})</span>}
              {p.link && <span style={{ color: t.muted }}>. {p.link}</span>}
            </li>
          ))}
        </ol>
      );
    case 'awards':
      return (
        <ul style={{ margin: 0, paddingLeft: 16, listStyle: 'disc', ...sm }}>
          {d.awards.map((a) => (
            <li key={a.id}>
              <strong>{a.title}</strong>
              {[a.issuer, a.year].filter(Boolean).length > 0 && (
                <span style={{ color: t.muted }}> — {[a.issuer, a.year].filter(Boolean).join(', ')}</span>
              )}
            </li>
          ))}
        </ul>
      );
    case 'memberships':
      return (
        <ul style={{ margin: 0, paddingLeft: 16, listStyle: 'disc', ...sm }}>
          {d.memberships.map((m) => (
            <li key={m.id}>
              {m.name}
              {m.role && <span style={{ color: t.muted }}> — {m.role}</span>}
            </li>
          ))}
        </ul>
      );
    case 'references':
      return <RichText text={d.references} style={sm} />;
  }
}

function contactItems(d: CvData) {
  const p = d.personal;
  return [p.email, p.phone, p.location, p.linkedin, p.website].filter(Boolean);
}

/* ============================== Modern ("Executive") ============================== */
function Modern({ d }: { d: CvData }) {
  const accent = d.accent;
  const side: CvSectionKey[] = ['skills', 'languages', 'certifications'];
  const sideKeys = visible(d).filter((k) => side.includes(k) && hasContent(d, k));
  const mainKeys = visible(d).filter((k) => !side.includes(k) && hasContent(d, k));
  const t: Tone = {
    accent,
    muted: '#656e83',
    font: 'Figtree, Arial, sans-serif',
    title: (l) => (
      <h2
        style={{
          fontSize: 14,
          fontWeight: 800,
          color: '#1e2532',
          margin: '0 0 8px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span
          style={{ width: 18, height: 3, background: accent, display: 'inline-block', borderRadius: 2 }}
        />{' '}
        {l}
      </h2>
    ),
  };
  return (
    <div
      className="cv-paper"
      style={{ display: 'grid', gridTemplateColumns: '250px 1fr', fontFamily: t.font, minHeight: 1123 }}
    >
      <aside
        style={{
          background: accent,
          color: '#fff',
          padding: '44px 26px',
          WebkitPrintColorAdjust: 'exact',
          printColorAdjust: 'exact',
        }}
      >
        <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.15, wordBreak: 'break-word' }}>
          {d.personal.fullName || 'Your Name'}
        </div>
        {d.personal.headline && (
          <div
            style={{
              fontSize: 12.5,
              marginTop: 6,
              opacity: 0.85,
              textTransform: 'uppercase',
              letterSpacing: 1,
            }}
          >
            {d.personal.headline}
          </div>
        )}
        <div style={{ marginTop: 26 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: 1.2,
              textTransform: 'uppercase',
              opacity: 0.7,
              marginBottom: 6,
            }}
          >
            Details
          </div>
          {contactItems(d).map((c) => (
            <div key={c} style={{ fontSize: 11.5, marginBottom: 4, wordBreak: 'break-word', opacity: 0.95 }}>
              {c}
            </div>
          ))}
        </div>
        {sideKeys.map((k) => (
          <div key={k} style={{ marginTop: 22 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: 1.2,
                textTransform: 'uppercase',
                opacity: 0.7,
                marginBottom: 8,
              }}
            >
              {CV_SECTION_LABELS[k]}
            </div>
            {k === 'skills' &&
              d.skills.map((s) => (
                <div key={s.id} style={{ fontSize: 11.5, marginBottom: 5 }}>
                  {s.name}
                  {s.level && (
                    <div
                      style={{
                        height: 3,
                        background: 'rgba(255,255,255,.25)',
                        borderRadius: 2,
                        marginTop: 3,
                      }}
                    >
                      <div
                        style={{ height: 3, background: '#fff', borderRadius: 2, width: levelWidth(s.level) }}
                      />
                    </div>
                  )}
                </div>
              ))}
            {k === 'languages' &&
              d.languages.map((s) => (
                <div key={s.id} style={{ fontSize: 11.5, marginBottom: 5 }}>
                  {s.name}
                  {s.level && <span style={{ opacity: 0.75 }}> — {s.level}</span>}
                </div>
              ))}
            {k === 'certifications' &&
              d.certifications.map((c) => (
                <div key={c.id} style={{ fontSize: 11.5, marginBottom: 6 }}>
                  <div style={{ fontWeight: 700 }}>{c.name}</div>
                  <div style={{ opacity: 0.75 }}>{[c.issuer, c.date].filter(Boolean).join(', ')}</div>
                </div>
              ))}
          </div>
        ))}
      </aside>
      <main style={{ padding: '44px 38px' }}>
        {mainKeys.map((k) => (
          <section key={k} style={{ marginBottom: 20 }}>
            {t.title(k === 'summary' ? 'Profile' : CV_SECTION_LABELS[k])}
            <Body d={d} k={k} t={t} />
          </section>
        ))}
      </main>
    </div>
  );
}

function levelWidth(level: string): string {
  const l = level.toLowerCase();
  if (/expert|advanced|native|fluent|5/.test(l)) return '100%';
  if (/proficient|experienced|good|4/.test(l)) return '80%';
  if (/intermediate|skilful|3/.test(l)) return '60%';
  if (/basic|beginner|novice|elementary|2|1/.test(l)) return '35%';
  return '70%';
}

/* ============================== ATS ("Clarity") ============================== */
function Ats({ d }: { d: CvData }) {
  const t: Tone = {
    accent: d.accent,
    muted: '#5c6475',
    font: 'Arial, Helvetica, sans-serif',
    title: (l) => (
      <h2
        style={{
          fontSize: 12.5,
          fontWeight: 700,
          color: d.accent,
          letterSpacing: 1.2,
          textTransform: 'uppercase',
          borderBottom: '1px solid #cfd5e2',
          paddingBottom: 3,
          margin: '0 0 8px',
        }}
      >
        {l}
      </h2>
    ),
  };
  return (
    <div className="cv-paper" style={{ padding: '48px 56px', fontFamily: t.font }}>
      <header style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 26, fontWeight: 700, color: '#1e2532' }}>
          {d.personal.fullName || 'Your Name'}
        </div>
        {d.personal.headline && (
          <div style={{ fontSize: 13.5, color: '#303848', marginTop: 2 }}>{d.personal.headline}</div>
        )}
        <div style={{ fontSize: 11, color: t.muted, marginTop: 6 }}>
          {contactItems(d).map((c, i) => (
            <Fragment key={c}>
              {i > 0 && ' | '}
              {c}
            </Fragment>
          ))}
        </div>
      </header>
      {visible(d)
        .filter((k) => hasContent(d, k))
        .map((k) => (
          <section key={k} style={{ marginBottom: 16 }}>
            {t.title(CV_SECTION_LABELS[k])}
            <Body d={d} k={k} t={t} />
          </section>
        ))}
    </div>
  );
}

/* ============================== Academic ("Scholar") ============================== */
function Academic({ d }: { d: CvData }) {
  const t: Tone = {
    accent: d.accent,
    muted: '#5c6475',
    font: '"Source Serif 4", Georgia, "Times New Roman", serif',
    title: (l) => (
      <h2
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: d.accent,
          fontVariant: 'small-caps',
          letterSpacing: 0.6,
          margin: '0 0 6px',
          borderBottom: `1.5px solid ${d.accent}`,
          paddingBottom: 2,
        }}
      >
        {l}
      </h2>
    ),
  };
  return (
    <div className="cv-paper" style={{ padding: '52px 60px', fontFamily: t.font }}>
      <header style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 27, fontWeight: 700, color: '#1e2532' }}>
          {d.personal.fullName || 'Your Name'}
        </div>
        {d.personal.headline && (
          <div style={{ fontSize: 13, color: '#303848', marginTop: 3, fontStyle: 'italic' }}>
            {d.personal.headline}
          </div>
        )}
        <div style={{ fontSize: 11, color: t.muted, marginTop: 6 }}>{contactItems(d).join('  ·  ')}</div>
      </header>
      {visible(d)
        .filter((k) => hasContent(d, k))
        .map((k) => (
          <section key={k} style={{ marginBottom: 15 }}>
            {t.title(k === 'summary' ? 'Research profile' : CV_SECTION_LABELS[k])}
            <Body d={d} k={k} t={t} />
          </section>
        ))}
    </div>
  );
}

export function CvDocument({ data, template }: { data: CvData; template: CvTemplate }) {
  if (template === 'ats') return <Ats d={data} />;
  if (template === 'academic') return <Academic d={data} />;
  return <Modern d={data} />;
}

export const ACADEMIC_ORDER: CvSectionKey[] = [
  'summary',
  'education',
  'publications',
  'experience',
  'awards',
  'projects',
  'skills',
  'languages',
  'certifications',
  'memberships',
  'references',
];
