import { describe, expect, it } from 'vitest';
import { parseCvText, toYm } from '../../shared/cvParser';
import {
  cvCompleteness,
  cvDataSchema,
  cvFromCareerProfile,
  careerFieldsFromCv,
  emptyCv,
} from '../../shared/cv';
import { analyzeForOpportunity, draftCoverLetter, tailoredCopy } from '../../worker/domain/tailor';
import { profileCompleteness } from '../../shared/completeness';

const CV_TEXT = `Sarah Nambi
Procurement Officer
sarah.nambi@example.com | +256 772 123456 | Kampala, Uganda
linkedin.com/in/sarahnambi

PROFESSIONAL SUMMARY
Procurement officer with six years managing public tenders for health programmes.

WORK EXPERIENCE
Procurement Officer | Mulago Hospital
Jan 2020 - Present
- Managed bid evaluations for medical supplies
- Coordinated contract management with suppliers
Assistant Procurement Officer at Kampala Capital City Authority
03/2017 – 12/2019
- Prepared requests for quotations

EDUCATION
Bachelor of Commerce, Makerere University
2013 - 2016

SKILLS
Procurement, Contract management, Excel; Report writing

LANGUAGES
English (Fluent), Luganda (Native)

CERTIFICATIONS
CIPS Level 4 Diploma 2021
`;

/** Every extracted string must exist in the source text (no fabrication). */
function collectStrings(v: unknown, out: string[] = []): string[] {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => collectStrings(x, out));
  else if (v && typeof v === 'object')
    for (const [k, x] of Object.entries(v))
      if (!['id', 'start', 'end', 'accent', 'order', 'hidden', 'date', 'year'].includes(k))
        collectStrings(x, out);
  return out;
}

describe('CV parser', () => {
  const r = parseCvText(CV_TEXT);
  it('extracts contact details, sections and dated entries', () => {
    expect(r.data.personal.fullName).toBe('Sarah Nambi');
    expect(r.data.personal.headline).toBe('Procurement Officer');
    expect(r.data.personal.email).toBe('sarah.nambi@example.com');
    expect(r.data.personal.phone).toContain('772');
    expect(r.data.personal.location).toBe('Kampala');
    expect(r.data.summary).toMatch(/six years/);
    expect(r.data.experience).toHaveLength(2);
    expect(r.data.experience[0]).toMatchObject({
      title: 'Procurement Officer',
      employer: 'Mulago Hospital',
      start: '2020-01',
      current: true,
    });
    expect(r.data.experience[1]).toMatchObject({
      title: 'Assistant Procurement Officer',
      employer: 'Kampala Capital City Authority',
      start: '2017-03',
      end: '2019-12',
    });
    expect(r.data.education[0]).toMatchObject({
      degree: 'Bachelor of Commerce',
      institution: 'Makerere University',
      start: '2013',
      end: '2016',
    });
    expect(r.data.skills.map((s) => s.name)).toEqual([
      'Procurement',
      'Contract management',
      'Excel',
      'Report writing',
    ]);
    expect(r.data.languages).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'English', level: 'Fluent' })]),
    );
    expect(r.data.certifications[0].name).toMatch(/CIPS/);
    expect(r.method).toBe('heuristic');
  });

  it('never invents content: every extracted value appears in the source', () => {
    const flat = CV_TEXT.replace(/\s+/g, ' ');
    for (const s of collectStrings(r.data)) {
      for (const line of s.split('\n').filter(Boolean))
        expect(flat, `"${line}" not in source`).toContain(line.trim());
    }
  });

  it('returns an empty draft (not invented data) for unstructured text', () => {
    const e = parseCvText('hello world this is not a cv at all just some words without structure');
    expect(e.data.experience).toHaveLength(0);
    expect(e.data.education).toHaveLength(0);
    expect(e.data.personal.email).toBe('');
  });

  it('normalises date tokens', () => {
    expect(toYm('Sept 2021')).toBe('2021-09');
    expect(toYm('03/2018')).toBe('2018-03');
    expect(toYm('2019')).toBe('2019');
    expect(toYm('13/2019')).toBe('');
  });
});

describe('CV model', () => {
  it('builds a CV from a career profile and back without losing facts', () => {
    const cv = cvFromCareerProfile(
      {
        headline: 'Analyst',
        summary: 'S',
        skills: ['SQL'],
        experience: [
          {
            title: 'A',
            employer: 'B',
            location: '',
            start: '2020-01',
            end: '',
            current: true,
            description: 'd',
          },
        ],
        education: [],
        certifications: [],
        languages: [],
        projects: [],
        memberships: [],
      } as any,
      'Jane',
      'j@x.test',
    );
    expect(cv.personal.fullName).toBe('Jane');
    expect(cv.experience[0].employer).toBe('B');
    const back = careerFieldsFromCv(cv);
    expect(back.skills).toEqual(['SQL']);
    expect(back.experience?.[0]).toMatchObject({
      title: 'A',
      employer: 'B',
      start: '2020-01',
      current: true,
    });
  });

  it('completeness warns about missing dates and contact details', () => {
    const cv = emptyCv('Jane', '');
    cv.experience.push({
      id: 'x',
      title: 'Officer',
      employer: '',
      location: '',
      start: '',
      end: '',
      current: false,
      description: '',
    });
    const { score, warnings } = cvCompleteness(cv);
    expect(score).toBeLessThan(50);
    const msgs = warnings.map((w) => w.message).join(' ');
    expect(msgs).toMatch(/email/);
    expect(msgs).toMatch(/start date/);
    expect(msgs).toMatch(/employer/);
  });

  it('schema rejects invalid accent colours and unknown sections', () => {
    expect(cvDataSchema.safeParse({ accent: 'red' }).success).toBe(false);
    expect(cvDataSchema.safeParse({ order: ['hacking'] }).success).toBe(false);
  });

  it('profile completeness lists missing items per type', () => {
    expect(profileCompleteness('business', {}).score).toBe(0);
    expect(profileCompleteness('business', {}).missing).toContain('Service lines / products');
  });
});

describe('tailoring and cover letters (no fabrication)', () => {
  const cv = parseCvText(CV_TEXT).data;
  const opp = {
    title: 'Procurement Specialist',
    organization: 'UNICEF',
    reference_no: 'RFP-1',
    description: 'Requires procurement, contract management and SAP experience.',
    requirements: { skills: ['procurement', 'sap'] },
  };

  it('separates matching skills from gaps', () => {
    const a = analyzeForOpportunity(cv, opp);
    expect(a.matched_skills).toEqual(expect.arrayContaining(['Procurement', 'Contract management']));
    expect(a.missing_keywords).toEqual(['sap']);
    expect(a.suggestions.join(' ')).toMatch(/only if you genuinely/);
  });

  it('tailored copy only reorders content', () => {
    const a = analyzeForOpportunity(cv, opp);
    const t = tailoredCopy(cv, a);
    expect(t.skills.map((s) => s.name).sort()).toEqual(cv.skills.map((s) => s.name).sort());
    expect(t.experience.map((e) => e.title).sort()).toEqual(cv.experience.map((e) => e.title).sort());
    expect(t.skills.map((s) => s.name)).not.toContain('sap');
  });

  it('cover letter uses CV facts and marks what the user must supply', () => {
    const letter = draftCoverLetter(cv, opp);
    expect(letter).toContain('Procurement Specialist');
    expect(letter).toContain('reference RFP-1');
    expect(letter).toContain('Mulago Hospital');
    expect(letter).toContain('[Add one specific achievement');
    expect(letter).not.toMatch(/SAP/);
    expect(letter).toContain('Sarah Nambi');
  });
});
