/** "Ask Opportunity Radar AI": the in-site help assistant. Shared by the widget and the Worker. */
import { z } from 'zod';

export const ASSISTANT_NAME = 'Ask Opportunity Radar AI';

/** One-tap questions under the greeting, used where no page-specific set applies. */
export const SUGGESTED_QUESTIONS = [
  'How does matching work?',
  'Which plan do I need for scholarships?',
  'How do I build or import my CV?',
  'What does “You may qualify” mean?',
  'Can I search in specific countries?',
  'How do I find tenders for my company?',
];

const PLAN_QUESTIONS = [
  'Which plan is right for me?',
  'What do I get on the Free plan?',
  'Which plan do I need for scholarships?',
  'Which plan covers tenders for my company?',
  'How do I pay, and does my plan renew automatically?',
];
const LISTING_QUESTIONS = [
  'How are these opportunities ranked?',
  'Can I see opportunities in specific countries?',
  'What does “Job board” mean on a listing?',
  'Why is a score blank?',
  'How do I save an opportunity for later?',
];
const DETAIL_QUESTIONS = [
  'How do I know if I qualify?',
  'What should I check before I apply?',
  'How do I tailor my CV for this?',
  'How do I track this application?',
];
const SIGN_IN_QUESTIONS = [
  'Is it free to sign up?',
  'Can I sign in with Google?',
  'What happens after I sign up?',
  'How is my personal data used?',
];

/**
 * Suggestions for the page the person is on, so the chat guides them through that part of the site.
 * The first matching pattern wins; every question must be answerable from the assistant's product guide.
 */
export const PAGE_SUGGESTIONS: Array<[RegExp, string[]]> = [
  [
    /^\/$/,
    [
      'What is Opportunity Radar?',
      'How does matching work?',
      'Is it free to start?',
      'Can I search in specific countries?',
      'Which plan is right for me?',
    ],
  ],
  [
    /^\/(cv-builder|templates)$/,
    [
      'How do I build my CV?',
      'Can I import my existing CV?',
      'Which CV template should I choose?',
      'Can I download my CV as a Word file?',
      'Will it add anything I did not write?',
    ],
  ],
  [
    /^\/how-it-works$/,
    [
      'What does “You may qualify” mean?',
      'What does the fit score mean?',
      'Why is a score blank?',
      'Where do the listings come from?',
    ],
  ],
  [/^\/(pricing|app\/billing(\/.*)?)$/, PLAN_QUESTIONS],
  [
    /^\/(help|contact)$/,
    [
      'How do I create a profile?',
      'How do I export my data?',
      'How do I delete my account?',
      'How do I contact the team?',
    ],
  ],
  [
    /^\/sources$/,
    [
      'Where do the listings come from?',
      'How often are listings updated?',
      'What does “Checked by our team” mean?',
      'Is every listing guaranteed to be open?',
    ],
  ],
  [
    /^\/(privacy|terms)$/,
    [
      'What does the chat send to the AI?',
      'Do you share my CV with employers?',
      'How do I export my data?',
      'How do I delete my account?',
    ],
  ],
  [/^\/(signin|signup|forgot-password|reset-password)$/, SIGN_IN_QUESTIONS],
  [/^\/(app\/)?opportunities\/[^/]+$/, DETAIL_QUESTIONS],
  [/^\/(app\/)?opportunities$/, LISTING_QUESTIONS],
  [
    /^\/app$/,
    [
      'What should I do first?',
      'How do I get better matches?',
      'How do alerts work?',
      'How do I upgrade my plan?',
    ],
  ],
  [
    /^\/app\/onboarding$/,
    [
      'Which profile should I choose?',
      'Can I have more than one profile?',
      'What should I choose for “Where should we look?”',
      'Can I skip this and come back later?',
    ],
  ],
  [
    /^\/app\/profiles\/career$/,
    [
      'Which skills should I add?',
      'How do I choose the job titles I want?',
      'Why do you ask for my nationality?',
      'How do I get better job matches?',
    ],
  ],
  [
    /^\/app\/profiles\/academic$/,
    [
      'What field of study should I enter?',
      'Which study levels can I choose?',
      'Which plan covers scholarships?',
      'Why do you ask for my nationality?',
    ],
  ],
  [
    /^\/app\/profiles\/business$/,
    [
      'What services should I list?',
      'Why do you ask about turnover and registration?',
      'How are tenders matched to my company?',
      'Which plan covers tenders?',
    ],
  ],
  [
    /^\/app\/profiles$/,
    [
      'What is the difference between the three profiles?',
      'Can I have more than one profile?',
      'Why is a profile locked?',
      'How do I get better matches?',
    ],
  ],
  [
    /^\/app\/(saved|tracker)$/,
    [
      'How does the tracker work?',
      'Will I get deadline reminders?',
      'What is the difference between saved and tracked?',
      'How many applications can I track?',
    ],
  ],
  [
    /^\/app\/cvs\/import$/,
    [
      'Which file types can I upload?',
      'Is my CV file uploaded to your servers?',
      'What if a section was not recognised?',
      'Is anything saved before I confirm?',
    ],
  ],
  [
    /^\/app\/cvs$/,
    [
      'How do I create a new CV?',
      'How do I tailor a CV for a specific job?',
      'How do I download my CV as a PDF?',
      'Can I restore an older version?',
    ],
  ],
  [
    /^\/app\/cover-letters\/[^/]+$/,
    [
      'How do I improve this cover letter?',
      'What should I write in the bracketed parts?',
      'How long should a cover letter be?',
      'Which plans include cover letters?',
    ],
  ],
  [
    /^\/app\/documents$/,
    ['Which documents should I store here?', 'Who can see my documents?', 'How many documents can I store?'],
  ],
  [
    /^\/app\/notifications$/,
    ['How do alerts work?', 'How do I get daily or instant alerts?', 'Why did I not get an alert?'],
  ],
  [
    /^\/app\/settings$/,
    [
      'How do I change my password?',
      'How do I connect Google sign-in?',
      'How do I export my data?',
      'How do I delete my account?',
    ],
  ],
];

export function suggestionsFor(path: string): string[] {
  const clean = path.split(/[?#]/)[0].replace(/(.)\/+$/, '$1');
  return PAGE_SUGGESTIONS.find(([re]) => re.test(clean))?.[1] ?? SUGGESTED_QUESTIONS;
}

export const ASSISTANT_LIMITS = {
  /** Characters in one message from the person. */
  messageChars: 1500,
  /** Earlier turns sent with each question (older ones are dropped). */
  historyTurns: 12,
  /** Tokens in one reply. */
  replyTokens: 700,
};

export const assistantRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().trim().min(1).max(4000),
      }),
    )
    .min(1)
    .max(40)
    .refine((m) => m[m.length - 1].role === 'user', 'The last message must be a question.')
    .refine(
      (m) => m[m.length - 1].content.length <= ASSISTANT_LIMITS.messageChars,
      `Please keep questions under ${ASSISTANT_LIMITS.messageChars} characters.`,
    ),
  /** The page the person is on, so answers can refer to it. */
  path: z.string().max(200).default('/'),
});
export type AssistantRequest = z.infer<typeof assistantRequestSchema>;
