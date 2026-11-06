/**
 * Deterministic CV text parser. It only ever copies text that exists in the source document:
 * it never invents employers, dates, degrees or skills. Output is a draft the user must review.
 */
import { cvDataSchema, rid, type CvData, type CvSectionKey } from './cv';

export type ParseResult = {
  data: CvData;
  found: string[];
  unassigned: string[];
  method: 'heuristic' | 'ai';
};

const HEADINGS: Array<[CvSectionKey | 'ignore', RegExp]> = [
  [
    'summary',
    /^(professional\s+)?(summary|profile|objective|career objective|about me|personal statement|career summary)$/,
  ],
  [
    'experience',
    /^(work|professional|employment|relevant|career)?\s*(experience|history|employment history|work history)$/,
  ],
  [
    'education',
    /^(education|academic (background|qualifications)|educational background|qualifications|education and training)$/,
  ],
  [
    'skills',
    /^(key\s+|core\s+|technical\s+|professional\s+)?(skills|competencies|competences|skills and abilities|expertise)$/,
  ],
  [
    'certifications',
    /^(certifications?|certificates|licenses( and certifications)?|training|courses|trainings attended)$/,
  ],
  ['languages', /^languages?( spoken)?$/],
  ['projects', /^(key\s+)?projects$/],
  ['publications', /^(publications|research( and publications)?|papers)$/],
  ['awards', /^(awards|honou?rs|awards and honou?rs|achievements)$/],
  ['memberships', /^(professional\s+)?(memberships|affiliations|associations)$/],
  ['references', /^(references|referees)$/],
  [
    'ignore',
    /^(personal (details|information)|contact( details| information)?|hobbies|interests|hobbies and interests)$/,
  ],
];

const MONTHS: Record<string, string> = {
  jan: '01',
  feb: '02',
  mar: '03',
  apr: '04',
  may: '05',
  jun: '06',
  jul: '07',
  aug: '08',
  sep: '09',
  sept: '09',
  oct: '10',
  nov: '11',
  dec: '12',
};

const DATE_TOKEN =
  '(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?\\s+\\d{4}|\\d{1,2}[/.-]\\d{4}|\\d{4})';
const RANGE_RE = new RegExp(
  `(${DATE_TOKEN})\\s*(?:-|–|—|to|until)\\s*(${DATE_TOKEN}|present|current|now|date|ongoing)`,
  'i',
);
const SINGLE_YEAR_RE = /\b(19[5-9]\d|20[0-4]\d)\b/;

export function toYm(token: string): string {
  const t = token.trim().toLowerCase();
  let m = t.match(/^([a-z]+)\.?\s+(\d{4})$/);
  if (m && MONTHS[m[1].slice(0, 4)]) return `${m[2]}-${MONTHS[m[1].slice(0, 4)]}`;
  if (m && MONTHS[m[1].slice(0, 3)]) return `${m[2]}-${MONTHS[m[1].slice(0, 3)]}`;
  m = t.match(/^(\d{1,2})[/.-](\d{4})$/);
  if (m && Number(m[1]) >= 1 && Number(m[1]) <= 12) return `${m[2]}-${m[1].padStart(2, '0')}`;
  m = t.match(/^(\d{4})$/);
  if (m) return m[1];
  return '';
}

function headingOf(line: string): CvSectionKey | 'ignore' | null {
  const clean = line
    .replace(/[:•*_#|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  if (!clean || clean.length > 45) return null;
  for (const [key, re] of HEADINGS) if (re.test(clean)) return key;
  return null;
}

const BULLET_RE = /^[\s•●▪◦‣\-*–·]+/;
const stripBullet = (l: string) => l.replace(BULLET_RE, '').trim();

export function parseCvText(input: string): ParseResult {
  const text = input
    .replace(/\r/g, '')
    .replace(/\u00a0/g, ' ')
    .slice(0, 60000);
  const lines = text
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.length > 0);
  const found = new Set<string>();
  const personal = {
    fullName: '',
    headline: '',
    email: '',
    phone: '',
    location: '',
    website: '',
    linkedin: '',
  };

  const email = text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  if (email) {
    personal.email = email[0];
    found.add('email');
  }
  const phone = text.match(/(?:\+\d{1,3}[\s-]?)?\(?\d{2,4}\)?[\s-]?\d{3}[\s-]?\d{3,4}/);
  if (phone && phone[0].replace(/\D/g, '').length >= 9) {
    personal.phone = phone[0].trim();
    found.add('phone');
  }
  const linkedin = text.match(/(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/[A-Za-z0-9/_-]+/i);
  if (linkedin) {
    personal.linkedin = linkedin[0];
    found.add('linkedin');
  }
  const web = text.match(/https?:\/\/(?!(?:[a-z]{2,3}\.)?linkedin\.com)[^\s,;]+/i);
  if (web) {
    personal.website = web[0];
    found.add('website');
  }

  // Split into sections
  const sections: Partial<Record<CvSectionKey | 'ignore' | 'header', string[]>> = { header: [] };
  let current: CvSectionKey | 'ignore' | 'header' = 'header';
  for (const line of lines) {
    const h = headingOf(line);
    if (h) {
      current = h;
      sections[current] = sections[current] ?? [];
      continue;
    }
    (sections[current] = sections[current] ?? []).push(line);
  }

  // Header: name + headline + location
  const isContact = (l: string) =>
    (personal.email && l.includes(personal.email)) ||
    (personal.phone && l.includes(personal.phone)) ||
    /linkedin\.com|https?:\/\//i.test(l);
  const header = (sections.header ?? []).filter((l) => !isContact(l));
  const nameLine = header.find(
    (l) => /^[A-Za-z][A-Za-z'.-]+(?:\s+[A-Za-z][A-Za-z'.-]+){1,4}$/.test(l) && l.length <= 60,
  );
  if (nameLine) {
    personal.fullName = nameLine;
    found.add('name');
    const idx = header.indexOf(nameLine);
    const next = header[idx + 1];
    if (next && next.length <= 80 && !/[@\d]{3,}/.test(next) && !SINGLE_YEAR_RE.test(next)) {
      personal.headline = next;
      found.add('headline');
    }
  }
  const locLine = (sections.header ?? []).find((l) =>
    /\b(kampala|entebbe|jinja|gulu|mbarara|mbale|wakiso|mukono|nairobi|kigali|dar es salaam|uganda|kenya|rwanda|tanzania)\b/i.test(
      l,
    ),
  );
  if (locLine) {
    const seg = locLine
      .split(/[|•,;]/)
      .map((x) => x.trim())
      .find((x) =>
        /\b(kampala|entebbe|jinja|gulu|mbarara|mbale|wakiso|mukono|nairobi|kigali|dar es salaam|uganda|kenya|rwanda|tanzania)\b/i.test(
          x,
        ),
      );
    if (seg && !seg.includes('@')) {
      personal.location = seg;
      found.add('location');
    }
  }

  const summary = (sections.summary ?? []).join(' ').trim();
  if (summary) found.add('summary');

  const experience = parseDated(sections.experience ?? []).map((e) => {
    const { title, org } = splitTitleOrg(e.header);
    return {
      id: rid(),
      title,
      employer: org,
      location: '',
      start: e.start,
      end: e.end,
      current: e.current,
      description: e.body.join('\n'),
    };
  });
  if (experience.length) found.add('experience');

  const education = parseDated(sections.education ?? []).map((e) => {
    const { title, org } = splitTitleOrg(e.header);
    return {
      id: rid(),
      degree: title,
      institution: org,
      location: '',
      start: e.start,
      end: e.end,
      grade: '',
      details: e.body.join('\n'),
    };
  });
  if (education.length) found.add('education');

  const skills = splitList(sections.skills ?? []).map((name) => ({ id: rid(), name, level: '' }));
  if (skills.length) found.add('skills');
  const languages = splitList(sections.languages ?? []).map((raw) => {
    const m = raw.match(/^([A-Za-z]+)\s*[(\-–:]\s*([^)]+)\)?$/);
    return { id: rid(), name: m ? m[1] : raw, level: m ? m[2].trim() : '' };
  });
  if (languages.length) found.add('languages');
  const certifications = (sections.certifications ?? [])
    .map(stripBullet)
    .filter(Boolean)
    .map((l) => {
      const y = l.match(SINGLE_YEAR_RE);
      return { id: rid(), name: l, issuer: '', date: y ? y[1] : '' };
    });
  if (certifications.length) found.add('certifications');
  const projects = (sections.projects ?? [])
    .map(stripBullet)
    .filter(Boolean)
    .map((l) => ({
      id: rid(),
      name: l.slice(0, 200),
      role: '',
      link: '',
      description: '',
    }));
  const publications = (sections.publications ?? [])
    .map(stripBullet)
    .filter(Boolean)
    .map((l) => {
      const y = l.match(SINGLE_YEAR_RE);
      return { id: rid(), title: l.slice(0, 300), venue: '', year: y ? y[1] : '', link: '' };
    });
  const awards = (sections.awards ?? [])
    .map(stripBullet)
    .filter(Boolean)
    .map((l) => {
      const y = l.match(SINGLE_YEAR_RE);
      return { id: rid(), title: l.slice(0, 200), issuer: '', year: y ? y[1] : '' };
    });
  const memberships = (sections.memberships ?? [])
    .map(stripBullet)
    .filter(Boolean)
    .map((l) => ({
      id: rid(),
      name: l.slice(0, 200),
      role: '',
    }));
  const references = (sections.references ?? []).join('\n');
  for (const [k, v] of Object.entries({ projects, publications, awards, memberships }))
    if (v.length) found.add(k);
  if (references) found.add('references');

  const assigned = new Set<string>([personal.fullName, personal.headline].filter(Boolean));
  const unassigned = (sections.header ?? []).filter(
    (l) => !assigned.has(l) && !isContact(l) && l !== locLine,
  );

  const data = cvDataSchema.parse({
    personal,
    summary,
    experience,
    education,
    skills,
    languages,
    certifications,
    projects,
    publications,
    awards,
    memberships,
    references,
  });
  return { data, found: [...found], unassigned, method: 'heuristic' };
}

type DatedEntry = { header: string; start: string; end: string; current: boolean; body: string[] };

function parseDated(lines: string[]): DatedEntry[] {
  const out: DatedEntry[] = [];
  let cur: DatedEntry | null = null;
  let pending: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    const range = line.match(RANGE_RE);
    if (range) {
      const endTok = range[2].toLowerCase();
      const isCurrent = /present|current|now|date|ongoing/.test(endTok);
      const rest = line
        .replace(range[0], '')
        .replace(/[|,–—\-()\s]+$/g, '')
        .replace(/^[|,–—\-()\s]+/g, '')
        .trim();
      let header = rest;
      if (!header && pending.length) header = pending.join(' | ');
      else if (header && pending.length && !cur) header = [...pending, header].join(' | ');
      else if (!header && cur && cur.body.length) header = cur.body.pop() ?? '';
      if (cur) out.push(cur);
      cur = {
        header,
        start: toYm(range[1]),
        end: isCurrent ? '' : toYm(range[2]),
        current: isCurrent,
        body: [],
      };
      pending = [];
      continue;
    }
    if (cur) cur.body.push(stripBullet(line));
    else pending.push(stripBullet(line));
  }
  if (cur) out.push(cur);
  if (!out.length && pending.length) {
    // Entries without date ranges: treat each non-bullet line with a single year as an entry.
    for (const line of pending) {
      const y = line.match(SINGLE_YEAR_RE);
      out.push({
        header: line
          .replace(SINGLE_YEAR_RE, '')
          .replace(/[|,–—\-\s]+$/g, '')
          .trim(),
        start: '',
        end: y ? y[1] : '',
        current: false,
        body: [],
      });
    }
  }
  return out.filter((e) => e.header || e.body.length);
}

function splitTitleOrg(header: string): { title: string; org: string } {
  const h = header.trim();
  for (const sep of [' | ', ' at ', ' — ', ' – ', ' - ', ', ']) {
    const i = h.indexOf(sep);
    if (i > 0)
      return {
        title: h.slice(0, i).trim(),
        org: h
          .slice(i + sep.length)
          .replace(/^\|\s*/, '')
          .trim(),
      };
  }
  return { title: h, org: '' };
}

function splitList(lines: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const l of lines) {
    for (const part of stripBullet(l).split(/[,;|•●▪]|\s{2,}/)) {
      const v = part.replace(BULLET_RE, '').trim().replace(/\.$/, '');
      if (v.length >= 2 && v.length <= 60 && !seen.has(v.toLowerCase())) {
        seen.add(v.toLowerCase());
        out.push(v);
      }
    }
  }
  return out.slice(0, 60);
}
