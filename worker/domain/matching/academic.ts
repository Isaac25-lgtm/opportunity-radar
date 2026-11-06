import { EDUCATION_LABELS, educationRank, type EducationLevel } from '../../../shared/constants';
import type { AcademicProfile } from '../../../shared/schemas';
import {
  Evidence,
  canonicalCountry,
  containsTerm,
  countryAllowed,
  deadlinePassed,
  finalize,
  norm,
  phraseSimilarity,
  type MatchOpportunity,
  type MatchResult,
  type Weights,
} from './common';

/** Qualification normally required before entering each target level. */
const PREREQ: Record<string, EducationLevel> = {
  bachelor: 'secondary',
  master: 'bachelor',
  phd: 'master',
  postdoc: 'phd',
};
const LEVEL_LABEL: Record<string, string> = {
  bachelor: "Bachelor's",
  master: "Master's",
  phd: 'PhD',
  postdoc: 'Postdoctoral',
  short_course: 'Short course',
  exchange: 'Exchange',
};

function academicLevel(p: AcademicProfile): EducationLevel | null {
  let best: EducationLevel | null = p.current_level ?? null;
  for (const q of p.qualifications)
    if (q.level && educationRank(q.level) > educationRank(best)) best = q.level;
  return best;
}

function bestGpa(p: AcademicProfile): { gpa: number; scale: number } | null {
  let best: { gpa: number; scale: number } | null = null;
  for (const q of p.qualifications) {
    if (q.gpa === null || q.gpa === undefined) continue;
    const scale = q.gpa_scale || 5;
    if (!best || q.gpa / scale > best.gpa / best.scale) best = { gpa: q.gpa, scale };
  }
  return best;
}

export function matchAcademic(
  p: AcademicProfile,
  o: MatchOpportunity,
  w: Weights,
  now = new Date(),
): MatchResult {
  const ev = new Evidence();
  const r = o.requirements;
  const text = norm(`${o.title} ${o.description}`);

  if (o.status !== 'open' && o.status !== 'status_uncertain')
    ev.disqualify(`The opportunity is ${o.status}.`);
  if (deadlinePassed(o, now)) ev.disqualify('The application deadline has passed.');
  if (r.applicant_type === 'business')
    ev.disqualify('This call is for organisations/businesses, not individual students or researchers.');

  // Nationality / residency eligibility — a required fact.
  if (r.eligible_countries.length) {
    ev.req(`Eligible countries: ${r.eligible_countries.join(', ')}`);
    const nat = p.nationality || p.residence_country;
    if (!nat) {
      ev.miss('Add your nationality — this opportunity restricts eligible countries.');
      ev.insufficient = true;
    } else {
      ev.fact(`Nationality/residence: ${nat}`);
      const ok =
        countryAllowed(r.eligible_countries, p.nationality || '') ||
        countryAllowed(r.eligible_countries, p.residence_country || '');
      if (!ok)
        ev.disqualify(
          `Open to nationals/residents of ${r.eligible_countries.join(', ')}; your profile shows ${nat}.`,
        );
      else ev.reason('Eligibility', `${nat} is within the stated eligible countries.`);
    }
  }

  // Level: does the opportunity offer the level the user targets, and do they hold the prerequisite?
  const lvl = academicLevel(p);
  if (lvl) ev.fact(`Current level: ${EDUCATION_LABELS[lvl]}`);
  if (r.degree_levels.length) {
    ev.req(`Levels offered: ${r.degree_levels.map((l) => LEVEL_LABEL[l]).join(', ')}`);
    if (p.target_levels.length) {
      const overlap = r.degree_levels.filter((l) => p.target_levels.includes(l as any));
      ev.component('level', w.level, overlap.length ? 1 : 0);
      if (overlap.length)
        ev.reason(
          'Level',
          `Offers ${overlap.map((l) => LEVEL_LABEL[l]).join(', ')}, which you are targeting.`,
        );
      else
        ev.reason(
          'Level',
          `Offers ${r.degree_levels.map((l) => LEVEL_LABEL[l]).join(', ')}; you are targeting ${p.target_levels.map((l) => LEVEL_LABEL[l]).join(', ')}.`,
        );
    } else ev.component('level', w.level, null);

    const prereqs = r.degree_levels.map((l) => PREREQ[l]).filter(Boolean) as EducationLevel[];
    if (prereqs.length) {
      const easiest = prereqs.reduce((a, b) => (educationRank(a) <= educationRank(b) ? a : b));
      if (lvl === null)
        ev.miss(`Add your highest qualification (entry normally needs ${EDUCATION_LABELS[easiest]}).`);
      else if (educationRank(lvl) < educationRank(easiest))
        ev.disqualify(
          `Entry normally requires ${EDUCATION_LABELS[easiest]}; your profile shows ${EDUCATION_LABELS[lvl]}.`,
        );
    }
  } else ev.component('level', w.level, p.target_levels.length ? 0.5 : null);

  if (r.education_level) {
    ev.req(`Minimum qualification: ${EDUCATION_LABELS[r.education_level]}`);
    if (lvl === null) ev.miss(`Confirm you hold ${EDUCATION_LABELS[r.education_level]}.`);
    else if (educationRank(lvl) < educationRank(r.education_level))
      ev.disqualify(
        `Requires ${EDUCATION_LABELS[r.education_level]}; your profile shows ${EDUCATION_LABELS[lvl]}.`,
      );
  }

  // Academic standing
  const gpa = bestGpa(p);
  if (r.min_gpa) {
    const reqScale = r.gpa_scale || 5;
    ev.req(`Minimum grade: ${r.min_gpa}/${reqScale}`);
    if (!gpa) {
      ev.miss(`Add your GPA/grade — a minimum of ${r.min_gpa}/${reqScale} is stated.`);
      ev.component('academic_standing', w.academic_standing, null);
    } else {
      ev.fact(`GPA: ${gpa.gpa}/${gpa.scale}`);
      const ok = gpa.gpa / gpa.scale >= r.min_gpa / reqScale - 1e-9;
      if (!ok)
        ev.disqualify(
          `Requires at least ${r.min_gpa}/${reqScale}; your profile shows ${gpa.gpa}/${gpa.scale}.`,
        );
      else ev.reason('Grades', `Your GPA ${gpa.gpa}/${gpa.scale} meets the stated minimum.`);
      ev.component('academic_standing', w.academic_standing, ok ? 1 : 0);
    }
  } else ev.component('academic_standing', w.academic_standing, gpa ? 0.7 : null);

  // Field fit
  const myFields = [
    p.field_of_study,
    ...p.target_fields,
    ...p.research_interests,
    ...p.qualifications.map((q) => q.field),
  ].filter(Boolean);
  if (myFields.length) {
    if (r.fields.length) {
      ev.req(`Fields: ${r.fields.slice(0, 8).join(', ')}`);
      const sim = Math.max(...r.fields.map((f) => phraseSimilarity(myFields, f).value));
      const best = r.fields.find((f) => phraseSimilarity(myFields, f).value === sim) ?? '';
      ev.component('field', w.field, sim);
      if (sim >= 0.5) ev.reason('Field', `Your field fits “${best}”.`);
      else ev.reason('Field', `Stated fields (${r.fields.slice(0, 4).join(', ')}) differ from your profile.`);
    } else {
      const hits = myFields.filter((f) => containsTerm(text, f));
      ev.component('field', w.field, hits.length ? Math.min(1, 0.6 + 0.2 * hits.length) : 0.2);
      if (hits.length) ev.reason('Field', `Mentions ${hits.slice(0, 4).join(', ')} from your profile.`);
    }
    ev.fact(`Fields/interests: ${myFields.slice(0, 5).join(', ')}`);
  } else {
    ev.component('field', w.field, null);
    ev.miss('Add your field of study or research interests.');
  }

  // Destination
  const dest = canonicalCountry(o.country);
  if (p.preferred_countries.length && dest) {
    const hit = p.preferred_countries.some((c) => canonicalCountry(c) === dest);
    ev.component('destination', w.destination, hit ? 1 : 0.3);
    if (hit) ev.reason('Destination', `${o.country} is one of your preferred study countries.`);
  } else ev.component('destination', w.destination, null);

  // Language
  if (r.languages.length) {
    ev.req(`Language: ${r.languages.join(', ')}`);
    const have = r.languages.filter((l) => p.languages.some((pl) => norm(pl.name) === norm(l)));
    ev.component('language', w.language, have.length / r.languages.length);
    for (const l of r.languages.filter((x) => !have.includes(x)))
      ev.miss(`Confirm ${l} proficiency/test score.`);
  } else ev.component('language', w.language, p.languages.length ? 0.8 : null);

  // Funding
  if (p.funding_need) {
    ev.fact(`Funding need: ${p.funding_need}`);
    if (r.funding === 'full') ev.component('funding', w.funding, 1);
    else if (r.funding === 'partial') {
      const ok = p.funding_need !== 'full' || p.accepts_partial;
      ev.component('funding', w.funding, ok ? 0.7 : 0.1);
      if (!ok) ev.reason('Funding', 'Partially funded; you indicated you need full funding.');
    } else ev.component('funding', w.funding, null);
    if (r.funding === 'full') ev.reason('Funding', 'Stated as fully funded.');
  } else ev.component('funding', w.funding, null);

  for (const d of r.required_documents.slice(0, 6)) ev.req(`Document: ${d}`);
  return finalize('academic', o, ev, 0.35);
}
