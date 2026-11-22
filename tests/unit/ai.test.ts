import { describe, expect, it } from 'vitest';
import { PythonAi, aiProvider, cvFromAi } from '../../worker/lib/providers';
import { emptyCv } from '../../shared/cv';
import type { Env } from '../../worker/env';

const CV_TEXT = `Carlos Mendez
carlos@example.com

EXPERIENCE
Senior React Developer, Nube Labs, 2021 - Present
Built the customer dashboard.

SKILLS
React, TypeScript`;

const env = (over: Partial<Env>): Env => ({ ENVIRONMENT: 'development', ...over }) as Env;

function stub(status: number, body: unknown, seen: Array<{ url: string; init?: RequestInit }> = []) {
  return (async (url: string, init?: RequestInit) => {
    seen.push({ url, init });
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  }) as unknown as typeof fetch;
}

const aiCv = {
  data: {
    personal: { fullName: 'Carlos Mendez', email: 'carlos@example.com' },
    summary: '',
    experience: [
      {
        title: 'Senior React Developer',
        employer: 'Nube Labs',
        location: '',
        start: '2021',
        end: '',
        current: true,
        description: 'Built the customer dashboard.',
      },
    ],
    skills: [{ name: 'React', level: '' }],
  },
  found: ['personal', 'experience', 'skills'],
  unassigned: [],
  method: 'ai',
  dropped: [],
};

describe('AI provider selection', () => {
  it('uses the built-in tools by default', () => {
    expect(aiProvider(env({})).name).toBe('none');
  });
  it('needs both the URL and the token for the Python service', () => {
    expect(aiProvider(env({ AI_PROVIDER: 'python', AI_SERVICE_URL: 'https://ai.example.com' })).name).toBe(
      'none',
    );
    expect(
      aiProvider(
        env({ AI_PROVIDER: 'python', AI_SERVICE_URL: 'https://ai.example.com', AI_SERVICE_TOKEN: 't' }),
      ).name,
    ).toBe('python');
  });
  it('refuses a plain-http service address in production', () => {
    const e = env({
      ENVIRONMENT: 'production',
      AI_PROVIDER: 'python',
      AI_SERVICE_URL: 'http://ai.example.com',
      AI_SERVICE_TOKEN: 't',
    });
    expect(aiProvider(e).name).toBe('none');
  });
});

describe('Python AI service client', () => {
  it('sends the token and returns a valid CV with ids', async () => {
    const seen: Array<{ url: string; init?: RequestInit }> = [];
    const ai = new PythonAi('https://ai.example.com/', 'secret', stub(200, aiCv, seen));
    const r = await ai.extractCv(CV_TEXT);
    expect(r.method).toBe('ai');
    expect(r.data.experience[0].employer).toBe('Nube Labs');
    expect(r.data.experience[0].id).toBeTruthy();
    expect(r.data.skills[0].name).toBe('React');
    expect(seen[0].url).toBe('https://ai.example.com/v1/cv/parse');
    expect((seen[0].init?.headers as Record<string, string>).authorization).toBe('Bearer secret');
  });

  it('falls back to the built-in parser when the service fails', async () => {
    const ai = new PythonAi('https://ai.example.com', 'secret', stub(503, { detail: 'busy' }));
    const r = await ai.extractCv(CV_TEXT);
    expect(r.method).toBe('heuristic');
  });

  it('falls back when the service is unreachable', async () => {
    const broken = (async () => {
      throw new TypeError('network down');
    }) as unknown as typeof fetch;
    const r = await new PythonAi('https://ai.example.com', 'secret', broken).extractCv(CV_TEXT);
    expect(r.method).toBe('heuristic');
  });

  it('falls back when the answer does not fit the CV schema', async () => {
    const bad = { ...aiCv, data: { ...aiCv.data, summary: 'x'.repeat(5000) } };
    const r = await new PythonAi('https://ai.example.com', 'secret', stub(200, bad)).extractCv(CV_TEXT);
    expect(r.method).toBe('heuristic');
  });

  it('returns null for a refused cover letter so the built-in draft is used', async () => {
    const ai = new PythonAi(
      'https://ai.example.com',
      'secret',
      stub(422, { detail: { code: 'ungrounded' } }),
    );
    const letter = await ai.coverLetter(emptyCv(), {
      title: 'Frontend Engineer',
      organization: 'Acme',
      description: '',
      requirements: {},
    });
    expect(letter).toBeNull();
  });

  it('returns the letter body when the service succeeds', async () => {
    const ai = new PythonAi('https://ai.example.com', 'secret', stub(200, { body: 'Dear Acme team,' }));
    const letter = await ai.coverLetter(emptyCv(), {
      title: 'Frontend Engineer',
      organization: 'Acme',
      description: '',
      requirements: {},
    });
    expect(letter).toBe('Dear Acme team,');
  });
});

describe('cvFromAi', () => {
  it('ignores non-object list items', () => {
    const cv = cvFromAi({ skills: ['React', { name: 'TypeScript', level: '' }] });
    expect(cv?.skills.map((s) => s.name)).toEqual(['TypeScript']);
  });
});
