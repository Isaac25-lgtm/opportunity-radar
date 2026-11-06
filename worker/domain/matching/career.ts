import { EDUCATION_LABELS, educationRank, type EducationLevel } from '../../../shared/constants';
import type { CareerProfile } from '../../../shared/schemas';
import { guessEducationLevel } from '../../../shared/cv';
import {
  Evidence,
  canonicalCountry,
  containsTerm,
  countryAllowed,
  deadlinePassed,
  finalize,
  isEastAfrican,
  norm,
  phraseSimilarity,
  yearsFromExperience,
  type MatchOpportunity,
  type MatchResult,
  type Weights,
} from './common';

export function highestEducation(p: CareerProfile): EducationLevel | null {
  let best: EducationLevel | null = p.highest_education ?? null;
  for (const e of p.education) {
    const lvl = e.level ?? guessEducationLevel(e.qualification);
    if (lvl && educationRank(lvl) > educationRank(best)) best = lvl;
  }
  return best;
}

export function matchCareer(
  p: CareerProfile,
  o: MatchOpportunity,
  w: Weights,
  now = new Date(),
): MatchResult {
  const ev = new Evidence();
  const r = o.requirements;
  const text = norm(`${o.title} ${o.description}`);

  // ---- Hard constraints ----
  if (o.status !== 'open' && o.status !== 'status_uncertain')
    ev.disqualify(`The opportunity is ${o.status}.`);
  if (deadlinePassed(o, now)) ev.disqualify('The application deadline has passed.');
  if (r.applicant_type === 'business') {
    ev.req('Applicants: registered businesses');
    ev.disqualify('This notice is for registered firms, not individual applicants. Use a business profile.');
  }

  const nationality = p.nationality || '';
  if (r.eligible_countries.length) {
    ev.req(`Eligible nationalities/residency: ${r.eligible_countries.join(', ')}`);
    if (!nationality) ev.miss('Add your nationality to confirm the stated country eligibility.');
    else {
      ev.fact(`Nationality: ${nationality}`);
      if (!countryAllowed(r.eligible_countries, nationality))
        ev.disqualify(
          `Open to ${r.eligible_countries.join(', ')} only; your profile nationality is ${nationality}.`,
        );
    }
  }

  const edu = highestEducation(p);
  if (r.education_level) {
    ev.req(`Minimum education: ${EDUCATION_LABELS[r.education_level]}`);
    if (edu === null) {
      ev.miss(`Add your education to confirm the ${EDUCATION_LABELS[r.education_level]} requirement.`);
      ev.component('education', w.education, null);
    } else {
      ev.fact(`Highest education: ${EDUCATION_LABELS[edu]}`);
      if (educationRank(edu) < educationRank(r.education_level)) {
        ev.disqualify(
          `Requires ${EDUCATION_LABELS[r.education_level]}; your profile shows ${EDUCATION_LABELS[edu]}.`,
        );
        ev.component('education', w.education, 0);
      } else {
        ev.reason(
          'Education',
          `Your ${EDUCATION_LABELS[edu]} meets the ${EDUCATION_LABELS[r.education_level]} requirement.`,
        );
        ev.component('education', w.education, 1);
      }
    }
  } else if (edu) {
    ev.component('education', w.education, null);
  }

  const years = p.years_experience ?? yearsFromExperience(p.experience, now);
  if (r.min_experience_years) {
    ev.req(`Minimum experience: ${r.min_experience_years} years`);
    if (years === null) {
      ev.miss(`Add your work history to confirm the ${r.min_experience_years}-year experience requirement.`);
      ev.component('experience', w.experience, null);
    } else {
      ev.fact(`Experience: about ${years} years`);
      const gap = r.min_experience_years - years;
      if (gap >= 2) {
        ev.disqualify(
          `Requires ${r.min_experience_years} years of experience; your profile shows about ${years}.`,
        );
        ev.component('experience', w.experience, Math.max(0, years / r.min_experience_years));
      } else if (gap > 0) {
        ev.miss(
          `Requires ${r.min_experience_years} years; your profile shows about ${years}. Confirm any experience not yet listed.`,
        );
        ev.component('experience', w.experience, years / r.min_experience_years);
      } else {
        ev.reason(
          'Experience',
          `About ${years} years of experience meets the ${r.min_experience_years}-year minimum.`,
        );
        ev.component('experience', w.experience, 1);
      }
    }
  } else {
    ev.component('experience', w.experience, years === null ? null : 0.7);
  }

  for (const lang of r.languages) {
    ev.req(`Language: ${lang}`);
    const has = p.languages.some((l) => norm(l.name) === norm(lang));
    if (has) ev.reason('Language', `You list ${lang}.`);
    else ev.miss(`Confirm ${lang} proficiency (not in your profile).`);
  }

  // ---- Relevance ----
  // Skills
  if (p.skills.length) {
    let matched: string[] = [];
    if (r.skills.length) {
      ev.req(`Skills sought: ${r.skills.slice(0, 8).join(', ')}`);
      matched = r.skills.filter(
        (s) => p.skills.some((ps) => norm(ps) === norm(s)) || containsTerm(norm(p.skills.join(' | ')), s),
      );
      // A short (automatically extracted) skill list is weak evidence on its own: blend it with how many
      // of the profile's skills the notice mentions, so one matching keyword cannot max out relevance.
      const reqOverlap = matched.length / r.skills.length;
      const inText = p.skills.filter((s) => containsTerm(text, s)).length / Math.min(5, p.skills.length);
      const share = r.skills.length >= 4 ? 0.75 : r.skills.length >= 2 ? 0.6 : 0.5;
      ev.component('skills', w.skills, share * reqOverlap + (1 - share) * Math.min(1, inText));
      const missingSkills = r.skills.filter((s) => !matched.includes(s));
      if (missingSkills.length && missingSkills.length <= 5)
        ev.reason('Skills gap', `Not in your profile: ${missingSkills.join(', ')}.`);
    } else {
      matched = p.skills.filter((s) => containsTerm(text, s));
      ev.component('skills', w.skills, Math.min(1, matched.length / Math.min(5, p.skills.length)));
    }
    if (matched.length) {
      ev.fact(`Skills: ${matched.slice(0, 8).join(', ')}`);
      ev.reason('Skills', `Your skills ${matched.slice(0, 6).join(', ')} appear in this opportunity.`);
    }
  } else {
    ev.component('skills', w.skills, null);
    ev.miss('Add your skills so relevance can be scored.');
  }

  // Role/title
  const titles = [...p.target_titles, p.headline, ...p.experience.map((e) => e.title)].filter(Boolean);
  if (titles.length) {
    const sim = phraseSimilarity(titles, o.title);
    ev.component('role', w.role, sim.value);
    if (sim.value >= 0.5) {
      ev.fact(`Role: ${sim.best}`);
      ev.reason('Role', `“${o.title}” is close to “${sim.best}” in your profile.`);
    }
  } else ev.component('role', w.role, null);

  // Location / work mode
  const oppCountry = canonicalCountry(o.country);
  const excluded = p.excluded_locations.some(
    (x) =>
      (oppCountry && canonicalCountry(x) === oppCountry) || (o.location && containsTerm(norm(o.location), x)),
  );
  if (excluded) {
    ev.reason('Location', `${o.location || o.country} is in your excluded locations.`);
    ev.component('location', w.location, 0);
  } else if (o.remote === 'remote') {
    const wantsRemote = !p.work_modes.length || p.work_modes.includes('remote');
    ev.component('location', w.location, wantsRemote ? 1 : 0.4);
    if (wantsRemote) ev.reason('Location', 'Remote role, which fits your work-mode preference.');
  } else if (oppCountry) {
    const prefs = p.preferred_countries.map(canonicalCountry);
    const home = canonicalCountry(p.country || 'Uganda');
    let v = 0.25;
    if (prefs.includes(oppCountry) || home === oppCountry) v = 1;
    else if (isEastAfrican(oppCountry) && isEastAfrican(home)) v = 0.6;
    ev.component('location', w.location, v);
    if (v === 1) ev.reason('Location', `Based in ${o.country}, which matches your location preferences.`);
    if (p.work_modes.length === 1 && p.work_modes[0] === 'remote')
      ev.reason('Work mode', 'On-site role; you prefer remote work.');
  } else ev.component('location', w.location, null);

  // Employment type
  const wantType = p.employment_types;
  if (wantType.length) {
    const map: Record<string, string> = {
      internship: 'internship',
      consultancy: 'consultancy',
      graduate_programme: 'full_time',
    };
    const oppType =
      map[o.category] ?? (r.employment_type ? norm(r.employment_type).replace(/[\s-]/g, '_') : 'full_time');
    ev.component('employment_type', w.employment_type, wantType.includes(oppType as any) ? 1 : 0.3);
  } else ev.component('employment_type', w.employment_type, null);

  const result = finalize('career', o, ev);
  return result;
}
