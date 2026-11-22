import { describe, expect, it } from 'vitest';
import { PAGE_SUGGESTIONS, SUGGESTED_QUESTIONS, suggestionsFor } from '../../shared/assistant';

describe('Ask Opportunity Radar AI: page suggestions', () => {
  const pages: Array<[string, string]> = [
    ['/', 'What is Opportunity Radar?'],
    ['/cv-builder', 'How do I build my CV?'],
    ['/templates', 'Which CV template should I choose?'],
    ['/how-it-works', 'What does the fit score mean?'],
    ['/pricing', 'Which plan is right for me?'],
    ['/app/billing', 'Which plan is right for me?'],
    ['/help', 'How do I create a profile?'],
    ['/contact', 'How do I contact the team?'],
    ['/sources', 'How often are listings updated?'],
    ['/privacy', 'What does the chat send to the AI?'],
    ['/signup', 'Is it free to sign up?'],
    ['/signin', 'Can I sign in with Google?'],
    ['/opportunities', 'How are these opportunities ranked?'],
    ['/app/opportunities', 'How are these opportunities ranked?'],
    ['/opportunities/opp_123', 'How do I know if I qualify?'],
    ['/app/opportunities/opp_123', 'How do I know if I qualify?'],
    ['/app', 'What should I do first?'],
    ['/app/onboarding', 'Which profile should I choose?'],
    ['/app/profiles', 'What is the difference between the three profiles?'],
    ['/app/profiles/career', 'Which skills should I add?'],
    ['/app/profiles/academic', 'What field of study should I enter?'],
    ['/app/profiles/business', 'What services should I list?'],
    ['/app/saved', 'How does the tracker work?'],
    ['/app/tracker', 'How does the tracker work?'],
    ['/app/cvs', 'How do I create a new CV?'],
    ['/app/cvs/import', 'Which file types can I upload?'],
    ['/app/cover-letters/cl_1', 'How do I improve this cover letter?'],
    ['/app/documents', 'Which documents should I store here?'],
    ['/app/notifications', 'How do alerts work?'],
    ['/app/settings', 'How do I delete my account?'],
  ];

  it.each(pages)('%s gets questions about that page', (path, expected) => {
    expect(suggestionsFor(path)).toContain(expected);
  });

  it('ignores query strings and trailing slashes', () => {
    expect(suggestionsFor('/pricing?plan=pro')).toContain('Which plan is right for me?');
    expect(suggestionsFor('/app/cvs/')).toContain('How do I create a new CV?');
  });

  it('falls back to general questions on other pages', () => {
    expect(suggestionsFor('/some/unknown/page')).toEqual(SUGGESTED_QUESTIONS);
  });

  it('keeps every set short enough to fit the chat', () => {
    for (const [, qs] of PAGE_SUGGESTIONS) {
      expect(qs.length).toBeGreaterThanOrEqual(3);
      expect(qs.length).toBeLessThanOrEqual(6);
      for (const q of qs) expect(q.length).toBeLessThanOrEqual(60);
    }
  });
});
