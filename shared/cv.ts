import { z } from 'zod';
import { CV_TEMPLATES } from './constants';
import type { CareerProfile } from './schemas';

const s = (max = 300) => z.string().max(max).default('');
const id = z.string().max(40);

export const CV_SECTION_KEYS = [
  'summary',
  'experience',
  'education',
  'skills',
  'projects',
  'certifications',
  'languages',
  'publications',
  'awards',
  'memberships',
  'references',
] as const;
export type CvSectionKey = (typeof CV_SECTION_KEYS)[number];

export const CV_SECTION_LABELS: Record<CvSectionKey, string> = {
  summary: 'Professional summary',
  experience: 'Employment history',
  education: 'Education',
  skills: 'Skills',
  projects: 'Projects',
  certifications: 'Certifications',
  languages: 'Languages',
  publications: 'Publications',
  awards: 'Awards',
  memberships: 'Professional memberships',
  references: 'References',
};

export const cvDataSchema = z.object({
  personal: z
    .object({
      fullName: s(120),
      headline: s(160),
      email: s(200),
      phone: s(60),
      location: s(150),
      website: s(300),
      linkedin: s(300),
    })
    .prefault({}),
  summary: s(3000),
  order: z
    .array(z.enum(CV_SECTION_KEYS))
    .max(CV_SECTION_KEYS.length)
    .default([...CV_SECTION_KEYS]),
  hidden: z.array(z.enum(CV_SECTION_KEYS)).max(CV_SECTION_KEYS.length).default([]),
  accent: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default('#1e3a5f'),
  experience: z
    .array(
      z.object({
        id,
        title: s(150),
        employer: s(150),
        location: s(150),
        start: s(10),
        end: s(10),
        current: z.boolean().default(false),
        description: s(4000),
      }),
    )
    .max(30)
    .default([]),
  education: z
    .array(
      z.object({
        id,
        degree: s(200),
        institution: s(200),
        location: s(150),
        start: s(10),
        end: s(10),
        grade: s(80),
        details: s(1500),
      }),
    )
    .max(15)
    .default([]),
  skills: z
    .array(z.object({ id, name: s(80), level: s(30) }))
    .max(80)
    .default([]),
  projects: z
    .array(z.object({ id, name: s(200), role: s(120), link: s(300), description: s(1500) }))
    .max(20)
    .default([]),
  certifications: z
    .array(z.object({ id, name: s(200), issuer: s(150), date: s(20) }))
    .max(30)
    .default([]),
  languages: z
    .array(z.object({ id, name: s(60), level: s(60) }))
    .max(15)
    .default([]),
  publications: z
    .array(z.object({ id, title: s(300), venue: s(200), year: s(10), link: s(300) }))
    .max(60)
    .default([]),
  awards: z
    .array(z.object({ id, title: s(200), issuer: s(150), year: s(10) }))
    .max(30)
    .default([]),
  memberships: z
    .array(z.object({ id, name: s(200), role: s(120) }))
    .max(20)
    .default([]),
  references: s(1500),
});
export type CvData = z.infer<typeof cvDataSchema>;

export const cvSaveSchema = z.object({
  title: z.string().trim().min(1).max(150),
  template: z.enum(CV_TEMPLATES),
  data: cvDataSchema,
});

export function rid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function emptyCv(fullName = '', email = ''): CvData {
  return cvDataSchema.parse({ personal: { fullName, email } });
}

export function cvFromCareerProfile(p: Partial<CareerProfile>, fullName: string, email: string): CvData {
  return cvDataSchema.parse({
    personal: {
      fullName,
      email,
      headline: p.headline ?? '',
      location: [p.location, p.country].filter(Boolean).join(', '),
    },
    summary: p.summary ?? '',
    experience: (p.experience ?? []).map((e) => ({
      id: rid(),
      title: e.title,
      employer: e.employer,
      location: e.location ?? '',
      start: e.start ?? '',
      end: e.end ?? '',
      current: !!e.current,
      description: e.description ?? '',
    })),
    education: (p.education ?? []).map((e) => ({
      id: rid(),
      degree: [e.qualification, e.field].filter(Boolean).join(', '),
      institution: e.institution ?? '',
      location: e.country ?? '',
      start: e.start ?? '',
      end: e.end ?? '',
      grade: e.grade ?? '',
      details: '',
    })),
    skills: (p.skills ?? []).map((name) => ({ id: rid(), name, level: '' })),
    certifications: (p.certifications ?? []).map((c) => ({
      id: rid(),
      name: c.name,
      issuer: c.issuer ?? '',
      date: c.year ?? '',
    })),
    languages: (p.languages ?? []).map((l) => ({ id: rid(), name: l.name, level: l.level ?? '' })),
    projects: (p.projects ?? []).map((x) => ({
      id: rid(),
      name: x.name,
      role: '',
      link: x.link ?? '',
      description: x.description ?? '',
    })),
    memberships: (p.memberships ?? []).map((m) => ({ id: rid(), name: m.name, role: m.role ?? '' })),
  });
}

/** Map CV content into career-profile fields. Only copies facts present in the CV. */
export function careerFieldsFromCv(cv: CvData): Partial<CareerProfile> {
  return {
    headline: cv.personal.headline,
    summary: cv.summary,
    location: cv.personal.location,
    skills: cv.skills.map((x) => x.name).filter(Boolean),
    experience: cv.experience
      .filter((e) => e.title || e.employer)
      .map((e) => ({
        title: e.title,
        employer: e.employer,
        location: e.location,
        start: normalizeYm(e.start),
        end: normalizeYm(e.end),
        current: e.current,
        description: e.description,
      })),
    education: cv.education
      .filter((e) => e.degree || e.institution)
      .map((e) => ({
        qualification: e.degree,
        level: guessEducationLevel(e.degree),
        field: '',
        institution: e.institution,
        country: e.location,
        start: normalizeYm(e.start),
        end: normalizeYm(e.end),
        grade: e.grade,
      })),
    certifications: cv.certifications.map((c) => ({
      name: c.name,
      issuer: c.issuer,
      year: c.date.slice(0, 10),
    })),
    languages: cv.languages.map((l) => ({ name: l.name, level: l.level, test: '', score: '' })),
    projects: cv.projects.map((p) => ({ name: p.name, description: p.description, link: p.link })),
    memberships: cv.memberships.map((m) => ({ name: m.name, role: m.role })),
  };
}

function normalizeYm(v: string): string {
  const m = v.match(/(\d{4})(?:[-/.](\d{1,2}))?/);
  if (!m) return '';
  return m[2] ? `${m[1]}-${m[2].padStart(2, '0')}` : m[1];
}

export function guessEducationLevel(text: string) {
  const t = text.toLowerCase();
  if (/\b(ph\.?\s?d|doctor(ate)?|dphil)\b/.test(t)) return 'phd' as const;
  if (/\b(master|msc|m\.sc|ma\b|mba|mph|m\.a\.|mphil|llm)\b/.test(t)) return 'master' as const;
  if (/\b(bachelor|bsc|b\.sc|ba\b|b\.a\.|bcom|llb|beng|b\.eng|bba|mbchb|degree)\b/.test(t))
    return 'bachelor' as const;
  if (/\bdiploma\b/.test(t)) return 'diploma' as const;
  if (/\bcertificate\b/.test(t)) return 'certificate' as const;
  if (/\b(uace|uce|a-level|o-level|secondary)\b/.test(t)) return 'secondary' as const;
  return null;
}

export type CvWarning = {
  section: CvSectionKey | 'personal';
  message: string;
  level: 'error' | 'warn' | 'tip';
};

/** Completeness score and warnings shown in the editor (resume.io-style progress bar). */
export function cvCompleteness(cv: CvData): { score: number; warnings: CvWarning[] } {
  const w: CvWarning[] = [];
  let score = 0;
  const p = cv.personal;
  if (p.fullName.trim()) score += 10;
  else w.push({ section: 'personal', message: 'Add your full name.', level: 'error' });
  if (p.email.trim()) score += 5;
  else
    w.push({
      section: 'personal',
      message: 'Add an email address so employers can contact you.',
      level: 'error',
    });
  if (p.phone.trim()) score += 5;
  else w.push({ section: 'personal', message: 'Add a phone number.', level: 'warn' });
  if (p.headline.trim()) score += 5;
  else w.push({ section: 'personal', message: 'Add a job title / headline.', level: 'tip' });
  if (p.location.trim()) score += 5;
  const sum = cv.summary.trim();
  if (sum.length >= 200) score += 15;
  else if (sum.length > 0) {
    score += 8;
    w.push({
      section: 'summary',
      message: 'A summary of 2–4 sentences (200+ characters) reads stronger.',
      level: 'tip',
    });
  } else w.push({ section: 'summary', message: 'Add a professional summary.', level: 'warn' });
  if (cv.experience.length > 0) {
    score += 20;
    cv.experience.forEach((e, i) => {
      const label = e.title || `Entry ${i + 1}`;
      if (!e.start)
        w.push({ section: 'experience', message: `“${label}”: add a start date.`, level: 'warn' });
      if (!e.end && !e.current)
        w.push({
          section: 'experience',
          message: `“${label}”: add an end date or mark as current.`,
          level: 'warn',
        });
      if (!e.employer)
        w.push({ section: 'experience', message: `“${label}”: add the employer.`, level: 'error' });
      if (e.description.trim().length < 40)
        w.push({
          section: 'experience',
          message: `“${label}”: describe responsibilities and results you achieved.`,
          level: 'tip',
        });
    });
  } else
    w.push({
      section: 'experience',
      message: 'Add your employment history (internships and volunteering count).',
      level: 'warn',
    });
  if (cv.education.length > 0) score += 15;
  else w.push({ section: 'education', message: 'Add your education.', level: 'warn' });
  if (cv.skills.length >= 5) score += 15;
  else if (cv.skills.length > 0) {
    score += 8;
    w.push({
      section: 'skills',
      message: 'List at least 5 skills relevant to your target roles.',
      level: 'tip',
    });
  } else w.push({ section: 'skills', message: 'Add skills.', level: 'warn' });
  if (cv.languages.length > 0) score += 5;
  return { score: Math.min(100, score), warnings: w };
}

export function formatYm(v: string): string {
  if (!v) return '';
  const m = v.match(/^(\d{4})-(\d{2})$/);
  if (!m) return v;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const idx = Number(m[2]) - 1;
  return idx >= 0 && idx < 12 ? `${months[idx]} ${m[1]}` : v;
}

export function dateRange(start: string, end: string, current?: boolean): string {
  const a = formatYm(start);
  const b = current ? 'Present' : formatYm(end);
  if (a && b) return `${a} — ${b}`;
  return a || b;
}
