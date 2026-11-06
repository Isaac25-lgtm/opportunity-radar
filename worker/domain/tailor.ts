/**
 * Deterministic CV tailoring and cover-letter drafting. Neither function invents facts: they reorder and
 * quote what the user already wrote, and they mark anything the user must supply as a [bracketed prompt].
 */
import type { CvData } from '../../shared/cv';
import { rid } from '../../shared/cv';
import type { Requirements } from '../../shared/schemas';
import { containsTerm, norm } from './matching/common';

export type TailorAnalysis = {
  matched_skills: string[];
  missing_keywords: string[];
  experience_highlights: Array<{ id: string; title: string; reason: string }>;
  suggestions: string[];
};

export function analyzeForOpportunity(
  cv: CvData,
  opp: { title: string; description: string; requirements: Partial<Requirements> },
): TailorAnalysis {
  const text = norm(`${opp.title} ${opp.description}`);
  const reqSkills = opp.requirements.skills ?? [];
  const cvSkillNames = cv.skills.map((s) => s.name).filter(Boolean);
  const cvText = norm(
    [cv.summary, ...cv.experience.map((e) => `${e.title} ${e.description}`), cvSkillNames.join(' | ')].join(
      ' ',
    ),
  );
  const matched = cvSkillNames.filter(
    (s) => containsTerm(text, s) || reqSkills.some((r) => norm(r) === norm(s)),
  );
  const missing = reqSkills.filter((r) => !containsTerm(cvText, r));
  const highlights = cv.experience
    .map((e) => {
      const hits = [...reqSkills, ...cvSkillNames].filter(
        (k) => containsTerm(norm(`${e.title} ${e.description}`), k) && containsTerm(text, k),
      );
      return {
        id: e.id,
        title: e.title || e.employer,
        reason: hits.length ? `Mentions ${[...new Set(hits)].slice(0, 4).join(', ')}` : '',
      };
    })
    .filter((h) => h.reason);
  const suggestions: string[] = [];
  if (matched.length)
    suggestions.push(
      `Move the matching skills (${matched.slice(0, 5).join(', ')}) to the top of your skills list.`,
    );
  if (missing.length)
    suggestions.push(
      `The notice mentions ${missing.slice(0, 6).join(', ')}. Add them only if you genuinely have this experience, ideally with an example.`,
    );
  if (highlights.length)
    suggestions.push(
      `Lead with the most relevant roles: ${highlights
        .slice(0, 3)
        .map((h) => h.title)
        .join(', ')}.`,
    );
  if (!cv.summary.trim())
    suggestions.push('Write a 2–3 sentence summary that names the role you are applying for.');
  if (opp.requirements.min_experience_years)
    suggestions.push(
      `Make dates clear — the notice asks for ${opp.requirements.min_experience_years}+ years of experience.`,
    );
  return {
    matched_skills: matched,
    missing_keywords: missing,
    experience_highlights: highlights,
    suggestions,
  };
}

/** Reorders skills and experience so the most relevant facts come first. Content is unchanged. */
export function tailoredCopy(cv: CvData, a: TailorAnalysis): CvData {
  const matchedSet = new Set(a.matched_skills.map(norm));
  const skills = [...cv.skills].sort(
    (x, y) => Number(matchedSet.has(norm(y.name))) - Number(matchedSet.has(norm(x.name))),
  );
  const hi = new Set(a.experience_highlights.map((h) => h.id));
  const experience = [...cv.experience].sort((x, y) => Number(hi.has(y.id)) - Number(hi.has(x.id)));
  return {
    ...cv,
    skills: skills.map((s) => ({ ...s, id: rid() })),
    experience: experience.map((e) => ({ ...e })),
  };
}

export function draftCoverLetter(
  cv: CvData,
  opp: {
    title: string;
    organization: string;
    reference_no?: string | null;
    requirements: Partial<Requirements>;
    description: string;
  },
): string {
  const p = cv.personal;
  const a = analyzeForOpportunity(cv, opp);
  const recent = cv.experience[0];
  const edu = cv.education[0];
  const lines: string[] = [];
  lines.push(`Dear ${opp.organization} recruitment team,`);
  lines.push('');
  lines.push(
    `I am writing to apply for the ${opp.title} opportunity${opp.reference_no ? ` (reference ${opp.reference_no})` : ''} at ${opp.organization}.` +
      (cv.summary.trim()
        ? ` ${firstSentence(cv.summary)}`
        : ' [Add one sentence about who you are professionally.]'),
  );
  lines.push('');
  if (recent && (recent.title || recent.employer)) {
    const role = [recent.title, recent.employer && `at ${recent.employer}`].filter(Boolean).join(' ');
    const duty = firstSentence(recent.description);
    lines.push(
      `${recent.current ? 'In my current role as' : 'Most recently, as'} ${role}, ${duty ? lowerFirst(duty) : '[describe your main responsibility]'}` +
        ' [Add one specific achievement with a result you can evidence.]',
    );
  } else lines.push('[Describe your most relevant experience and one result you can evidence.]');
  lines.push('');
  if (a.matched_skills.length)
    lines.push(
      `The notice calls for skills I use regularly, including ${listJoin(a.matched_skills.slice(0, 5))}.`,
    );
  if (edu && (edu.degree || edu.institution))
    lines.push(
      `I hold ${[edu.degree, edu.institution && `from ${edu.institution}`].filter(Boolean).join(' ')}.`,
    );
  lines.push('');
  lines.push(
    `I would welcome the opportunity to discuss how I can contribute to ${opp.organization}. Thank you for considering my application.`,
  );
  lines.push('');
  lines.push('Yours sincerely,');
  lines.push(p.fullName || '[Your name]');
  const contact = [p.email, p.phone].filter(Boolean).join(' · ');
  if (contact) lines.push(contact);
  return lines.join('\n');
}

function firstSentence(s: string): string {
  const t = s.replace(/\s+/g, ' ').trim();
  if (!t) return '';
  const m = t.match(/^(.{20,300}?[.!?])(\s|$)/);
  const out = m ? m[1] : t.slice(0, 300);
  return /[.!?]$/.test(out) ? out : out + '.';
}
const lowerFirst = (s: string) => (s ? s[0].toLowerCase() + s.slice(1) : s);
function listJoin(a: string[]) {
  return a.length <= 1 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`;
}
