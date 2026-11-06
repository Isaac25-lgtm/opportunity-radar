import { describe, expect, it } from 'vitest';
import {
  matchProfile,
  rankMatches,
  type MatchOpportunity,
  countryAllowed,
  yearsFromExperience,
  mergeWeights,
} from '../../worker/domain/matching';

const NOW = new Date('2026-11-06T10:00:00Z');
const future = '2026-12-01T20:59:00.000Z';

function opp(over: Partial<MatchOpportunity> & { requirements?: any }): MatchOpportunity {
  return {
    id: 'o1',
    category: 'job',
    title: 'Data Analyst',
    organization: 'Org',
    description: '',
    country: 'Uganda',
    countries: ['Uganda'],
    location: 'Kampala',
    remote: 'onsite',
    deadline_at: future,
    status: 'open',
    requirements: {} as any,
    requirements_source: 'structured',
    meta: {},
    ...over,
  };
}

const career = {
  headline: 'Data analyst',
  nationality: 'Ugandan',
  country: 'Uganda',
  highest_education: 'bachelor',
  target_titles: ['Data Analyst'],
  skills: ['SQL', 'Python', 'Power BI', 'Excel', 'Statistics'],
  employment_types: ['full_time'],
  work_modes: ['onsite', 'hybrid'],
  preferred_countries: ['Uganda'],
  experience: [
    { title: 'Data Analyst', employer: 'Bank', start: '2020-01', end: '', current: true, description: '' },
  ],
};

describe('career matching', () => {
  it('matches a relevant job and explains why using profile facts', () => {
    const m = matchProfile(
      { id: 'p', type: 'career', data: career },
      opp({
        description: 'We need SQL, Python and Power BI skills.',
        requirements: {
          skills: ['SQL', 'Python', 'Power BI'],
          min_experience_years: 3,
          education_level: 'bachelor',
        },
      }),
      undefined,
      NOW,
    );
    expect(m.eligibility).toBe('eligible');
    expect(m.score).toBeGreaterThanOrEqual(80);
    expect(m.reasons.map((r) => r.label)).toEqual(
      expect.arrayContaining(['Skills', 'Role', 'Education', 'Experience']),
    );
    expect(m.facts_used.join(' ')).toContain('SQL');
    expect(m.requirements_used.join(' ')).toContain('Minimum experience: 3 years');
    expect(m.disqualifiers).toHaveLength(0);
  });

  it('rejects a clearly incompatible mandatory requirement even when relevance is high', () => {
    const m = matchProfile(
      { id: 'p', type: 'career', data: career },
      opp({
        description: 'SQL Python Power BI',
        requirements: { skills: ['SQL', 'Python'], education_level: 'phd' },
      }),
      undefined,
      NOW,
    );
    expect(m.eligibility).toBe('not_eligible');
    expect(m.disqualifiers[0]).toMatch(/PhD/);
    expect(m.next_action).toMatch(/^Not recommended/);
  });

  it('rejects when years of experience are far below the stated minimum', () => {
    const m = matchProfile(
      { id: 'p', type: 'career', data: { ...career, years_experience: 1 } },
      opp({ requirements: { min_experience_years: 8 } }),
      undefined,
      NOW,
    );
    expect(m.eligibility).toBe('not_eligible');
  });

  it('flags nationality as missing rather than assuming eligibility', () => {
    const m = matchProfile(
      { id: 'p', type: 'career', data: { ...career, nationality: '' } },
      opp({ requirements: { eligible_countries: ['Uganda'] } }),
      undefined,
      NOW,
    );
    expect(m.eligibility).toBe('potential');
    expect(m.missing.join(' ')).toMatch(/nationality/i);
  });

  it('respects nationality restrictions', () => {
    const m = matchProfile(
      { id: 'p', type: 'career', data: { ...career, nationality: 'Kenyan' } },
      opp({ requirements: { eligible_countries: ['Uganda'] } }),
      undefined,
      NOW,
    );
    expect(m.eligibility).toBe('not_eligible');
  });

  it('does not fabricate a score for an empty profile', () => {
    const m = matchProfile(
      { id: 'p', type: 'career', data: {} },
      opp({ requirements: { skills: ['SQL'] } }),
      undefined,
      NOW,
    );
    expect(m.score).toBeNull();
    expect(m.eligibility).toBe('insufficient');
    expect(m.confidence).toBe('low');
  });

  it('treats a passed deadline as not eligible', () => {
    const m = matchProfile(
      { id: 'p', type: 'career', data: career },
      opp({ deadline_at: '2026-01-01T00:00:00Z' }),
      undefined,
      NOW,
    );
    expect(m.eligibility).toBe('not_eligible');
    expect(m.disqualifiers).toContain('The application deadline has passed.');
  });

  it('does not let a career profile pursue a registered-firm tender', () => {
    const m = matchProfile(
      { id: 'p', type: 'career', data: career },
      opp({ category: 'consultancy', requirements: { applicant_type: 'business' } }),
      undefined,
      NOW,
    );
    expect(m.eligibility).toBe('not_eligible');
  });

  it('a single extracted skill cannot max out relevance', () => {
    const m = matchProfile(
      { id: 'p', type: 'career', data: career },
      opp({
        title: 'Field Officer',
        description: 'Use Excel daily.',
        requirements: { skills: ['Excel'] },
        requirements_source: 'heuristic',
      }),
      undefined,
      NOW,
    );
    const skills = m.components.find((c) => c.key === 'skills')!;
    expect(skills.value).toBeLessThan(0.7);
    expect(m.confidence).not.toBe('high');
  });
});

const academic = {
  current_level: 'bachelor',
  field_of_study: 'Public Health',
  research_interests: ['epidemiology', 'malaria'],
  target_levels: ['master'],
  target_fields: ['Public Health'],
  nationality: 'Ugandan',
  preferred_countries: ['United Kingdom'],
  languages: [{ name: 'English', level: 'Fluent' }],
  funding_need: 'full',
  qualifications: [
    {
      qualification: 'BSc Public Health',
      level: 'bachelor',
      field: 'Public Health',
      institution: 'Makerere',
      gpa: 4.2,
      gpa_scale: 5,
    },
  ],
};

describe('academic matching', () => {
  const scholarship = (req: any, over: Partial<MatchOpportunity> = {}) =>
    opp({
      category: 'scholarship',
      title: "Master's scholarship in Public Health",
      country: 'United Kingdom',
      requirements: req,
      ...over,
    });

  it('matches a scholarship based on the stated criteria', () => {
    const m = matchProfile(
      { id: 'a', type: 'academic', data: academic },
      scholarship({
        eligible_countries: ['Africa'],
        degree_levels: ['master'],
        fields: ['Public Health'],
        funding: 'full',
        languages: ['English'],
        min_gpa: 3.5,
        gpa_scale: 5,
      }),
      undefined,
      NOW,
    );
    expect(m.eligibility).toBe('eligible');
    expect(m.score).toBeGreaterThanOrEqual(85);
    expect(m.reasons.map((r) => r.label)).toEqual(
      expect.arrayContaining(['Eligibility', 'Level', 'Field', 'Grades', 'Funding']),
    );
  });

  it('reports insufficient information when nationality is missing but required', () => {
    const m = matchProfile(
      { id: 'a', type: 'academic', data: { ...academic, nationality: '', residence_country: '' } },
      scholarship({ eligible_countries: ['Uganda'], degree_levels: ['master'] }),
      undefined,
      NOW,
    );
    expect(m.eligibility).toBe('insufficient');
    expect(m.missing[0]).toMatch(/nationality/i);
  });

  it('rejects when GPA is below the stated minimum', () => {
    const m = matchProfile(
      { id: 'a', type: 'academic', data: academic },
      scholarship({ degree_levels: ['master'], min_gpa: 3.8, gpa_scale: 4 }),
      undefined,
      NOW,
    );
    expect(m.eligibility).toBe('not_eligible');
  });

  it('rejects a PhD place when the applicant only holds a bachelor', () => {
    const m = matchProfile(
      { id: 'a', type: 'academic', data: academic },
      scholarship({ degree_levels: ['phd'] }),
      undefined,
      NOW,
    );
    expect(m.eligibility).toBe('not_eligible');
    expect(m.disqualifiers[0]).toMatch(/Master/);
  });
});

const business = {
  registered_name: 'Kato Supplies Ltd',
  is_registered: true,
  registration_country: 'Uganda',
  operating_locations: ['Uganda', 'Kampala'],
  procurement_categories: ['goods'],
  service_lines: ['medical equipment', 'laboratory supplies'],
  industries: ['health'],
  year_established: 2015,
  turnover_band: '200m_1b',
  certifications: ['PPDA register of providers'],
  licenses: ['Trading licence'],
  tax_compliance: 'valid',
  past_contracts: [
    { title: 'Supply of laboratory supplies to district hospitals', client: 'MoH', year: '2023' },
  ],
};

describe('business matching', () => {
  const tender = (req: any, over: Partial<MatchOpportunity> = {}) =>
    opp({
      category: 'tender',
      title: 'Supply of medical equipment and laboratory supplies',
      description: 'Health facilities in Uganda need medical equipment.',
      requirements: { applicant_type: 'business', procurement_categories: ['goods'], ...req },
      ...over,
    });

  it('matches a relevant tender', () => {
    const m = matchProfile(
      { id: 'b', type: 'business', data: business },
      tender({
        registration_required: true,
        certifications: ['PPDA register of providers'],
        tax_clearance_required: true,
      }),
      undefined,
      NOW,
    );
    expect(m.eligibility).toBe('eligible');
    expect(m.score).toBeGreaterThanOrEqual(70);
    expect(m.reasons.map((r) => r.label)).toEqual(
      expect.arrayContaining(['Scope', 'Compliance', 'Registration']),
    );
  });

  it('flags missing certifications and unconfirmed turnover instead of assuming them', () => {
    const m = matchProfile(
      { id: 'b', type: 'business', data: { ...business, turnover_band: null, certifications: [] } },
      tender({ certifications: ['ISO 9001'], min_turnover_ugx: 500_000_000 }),
      undefined,
      NOW,
    );
    expect(m.eligibility).toBe('potential');
    expect(m.missing.join(' ')).toMatch(/ISO 9001/);
    expect(m.missing.join(' ')).toMatch(/turnover/i);
  });

  it('rejects when stated turnover is clearly below the minimum', () => {
    const m = matchProfile(
      { id: 'b', type: 'business', data: { ...business, turnover_band: 'lt_50m' } },
      tender({ min_turnover_ugx: 2_000_000_000 }),
      undefined,
      NOW,
    );
    expect(m.eligibility).toBe('not_eligible');
  });

  it('flags too few past contracts', () => {
    const m = matchProfile(
      { id: 'b', type: 'business', data: business },
      tender({ min_past_contracts: 3 }),
      undefined,
      NOW,
    );
    expect(m.missing.join(' ')).toMatch(/3 similar contracts/);
  });

  it('never treats an individual-consultant assignment as a company tender', () => {
    const m = matchProfile(
      { id: 'b', type: 'business', data: business },
      opp({ category: 'consultancy', requirements: { applicant_type: 'individual' } }),
      undefined,
      NOW,
    );
    expect(m.eligibility).toBe('not_eligible');
    expect(m.disqualifiers[0]).toMatch(/individual consultants/);
  });

  it('rejects an expired tax clearance', () => {
    const m = matchProfile(
      { id: 'b', type: 'business', data: { ...business, tax_compliance: 'expired' } },
      tender({ tax_clearance_required: true }),
      undefined,
      NOW,
    );
    expect(m.eligibility).toBe('not_eligible');
  });
});

describe('helpers', () => {
  it('country eligibility understands regions and open lists', () => {
    expect(countryAllowed([], 'Uganda')).toBe(true);
    expect(countryAllowed(['East Africa'], 'Ugandan')).toBe(true);
    expect(countryAllowed(['Africa'], 'Kenya')).toBe(true);
    expect(countryAllowed(['International'], 'Brazil')).toBe(true);
    expect(countryAllowed(['Kenya'], 'Uganda')).toBe(false);
  });
  it('computes years of experience from dated roles', () => {
    expect(yearsFromExperience([{ start: '2020-01', end: '2023-01' }])).toBe(3);
    expect(yearsFromExperience([{ start: '', end: '' }])).toBeNull();
  });
  it('ranks eligible above not-eligible regardless of score', () => {
    const items = [
      { id: 1, match: { eligibility: 'not_eligible', score: 99 } },
      { id: 2, match: { eligibility: 'eligible', score: 50 } },
      { id: 3, match: { eligibility: 'potential', score: 80 } },
    ] as any;
    expect(rankMatches(items).map((x: any) => x.id)).toEqual([2, 3, 1]);
  });
  it('weight overrides are bounded and only apply to known components', () => {
    const w = mergeWeights({ career: { skills: 50, bogus: 10, role: 500 } } as any);
    expect(w.career.skills).toBe(50);
    expect(w.career.role).toBe(25);
    expect((w.career as any).bogus).toBeUndefined();
  });
});
