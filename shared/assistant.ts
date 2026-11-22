/** "Ask Opportunity Radar AI": the in-site help assistant. Shared by the widget and the Worker. */
import { z } from 'zod';

export const ASSISTANT_NAME = 'Ask Opportunity Radar AI';

/** Shown as one-tap questions under the greeting. */
export const SUGGESTED_QUESTIONS = [
  'How does matching work?',
  'Which plan do I need for scholarships?',
  'How do I build or import my CV?',
  'What does “You may qualify” mean?',
  'Can I search in specific countries?',
  'How do I find tenders for my company?',
];

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
