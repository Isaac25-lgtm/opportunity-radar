import { describe, expect, it } from 'vitest';
import {
  COUNTRY_NAMES,
  SKILLS,
  filterOptions,
  suggestAcademic,
  suggestBusiness,
  suggestCareer,
} from '../../shared/suggestions';

describe('profile suggestions', () => {
  it('suggests skills that go with the roles a person entered', () => {
    const s = suggestCareer.skills({ target_titles: ['Civil Engineer'] });
    expect(s.slice(0, 5)).toEqual(expect.arrayContaining(['AutoCAD', 'Road design']));
    expect(s).not.toContain('React');
  });

  it('never re-suggests what is already in the profile', () => {
    const s = suggestCareer.skills({ target_titles: ['Data Analyst'], skills: ['SQL', 'python'] });
    expect(s).not.toContain('SQL');
    expect(s).not.toContain('Python');
    expect(s).toContain('Power BI');
  });

  it('reads roles from titles, so a skill word does not switch families', () => {
    const civil = suggestCareer.skills({ target_titles: ['Civil Engineer'], skills: ['Road design'] });
    expect(civil).not.toContain('Figma');
    const analyst = suggestCareer.skills({ target_titles: ['Data Analyst'], skills: ['Power BI'] });
    expect(analyst).not.toContain('Solar PV design');
    // With no titles yet, skills still point to a family.
    expect(suggestCareer.skills({ skills: ['AutoCAD', 'Road design'] })).toContain('Civil 3D');
  });

  it('falls back to general skills when nothing is known yet', () => {
    expect(suggestCareer.skills({})).toContain('Communication');
  });

  it('suggests job titles from work history and related roles', () => {
    const t = suggestCareer.targetTitles({ experience: [{ title: 'Procurement Officer' }] });
    expect(t[0]).toBe('Procurement Officer');
    expect(t).toContain('Supply Chain Officer');
  });

  it('suggests research interests and programmes for scholarship applicants', () => {
    expect(suggestAcademic.researchInterests({ field_of_study: 'Economics' })).toContain('Public finance');
    expect(
      suggestAcademic.targetProgrammes({ target_levels: ['master'], target_fields: ['Public health'] }),
    ).toEqual(["Master's in Public health"]);
  });

  it('suggests what a company supplies from its description', () => {
    const d = { description: 'We supply laboratory and medical equipment to hospitals' };
    expect(suggestBusiness.serviceLines(d)).toContain('Laboratory equipment supply');
    expect(suggestBusiness.industries(d)).toEqual(['Medical supplies']);
    expect(suggestBusiness.certifications(d)).toContain('ISO 13485');
  });

  it('type-ahead ranks prefix matches first and covers every country', () => {
    expect(filterOptions(SKILLS, 'pow')[0]).toBe('Power BI');
    expect(filterOptions(COUNTRY_NAMES, 'ken')).toEqual(['Kenya']);
    expect(COUNTRY_NAMES).toContain("Côte d'Ivoire");
    expect(COUNTRY_NAMES.length).toBeGreaterThan(190);
    expect(filterOptions(SKILLS, 'sql', ['SQL'])).not.toContain('SQL');
  });
});
