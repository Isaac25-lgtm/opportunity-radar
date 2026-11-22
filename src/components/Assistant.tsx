import { RotateCcw, Send, X } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ASSISTANT_LIMITS, ASSISTANT_NAME, suggestionsFor } from '../../shared/assistant';
import { api } from '../lib/api';
import { LogoMark } from './Layout';
import { cx } from './ui';

type Msg = { role: 'user' | 'assistant'; content: string; error?: boolean };

const STORE = 'or-assistant-chat';
// Pages where a floating button would cover the work area.
const HIDDEN = [/^\/app\/cvs\/[^/]+\/(edit|print)$/, /^\/admin(\/|$)/];
// Pages with a fixed save bar at the bottom: the button sits above it.
const RAISED = [/^\/app\/profiles\/[^/]+$/, /^\/app\/cvs\/import$/];

const loadChat = (): Msg[] => {
  try {
    const v = JSON.parse(sessionStorage.getItem(STORE) ?? '[]');
    return Array.isArray(v) ? v.filter((m) => m && typeof m.content === 'string').slice(-30) : [];
  } catch {
    return [];
  }
};
const saveChat = (m: Msg[]) => {
  try {
    sessionStorage.setItem(STORE, JSON.stringify(m.slice(-30)));
  } catch {
    /* private mode: the chat simply is not kept */
  }
};

/** The Opportunity Radar mark on a white disc: clear on the dark button and header and on the light chat. */
function Avatar({ size = 'md' }: { size?: 'sm' | 'md' }) {
  return (
    <span
      className={cx(
        'flex flex-none items-center justify-center rounded-full bg-white ring-1 ring-black/10',
        size === 'sm' ? 'h-7 w-7' : 'h-11 w-11',
      )}
      aria-hidden
    >
      <LogoMark className={size === 'sm' ? 'h-5 w-5' : 'h-8 w-8'} />
    </span>
  );
}

/** Renders the assistant's light Markdown (paragraphs, lists, bold, links) as React elements, never as HTML. */
function inline(text: string, onNavigate: () => void): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1]) out.push(<strong key={m.index}>{m[1]}</strong>);
    else {
      const [label, href] = [m[2], m[3]];
      if (href.startsWith('/') && !href.startsWith('//'))
        out.push(
          <Link key={m.index} to={href} className="link" onClick={onNavigate}>
            {label}
          </Link>,
        );
      else if (/^https:\/\//i.test(href))
        out.push(
          <a key={m.index} href={href} className="link" target="_blank" rel="noopener noreferrer nofollow">
            {label}
          </a>,
        );
      else out.push(label);
    }
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const LIST = /^\s*(?:[-*•]|\d+[.)])\s+/;

function Markdown({ text, onNavigate }: { text: string; onNavigate: () => void }) {
  const blocks: ReactNode[] = [];
  const lines = text.replace(/\r/g, '').split('\n');
  let i = 0;
  while (i < lines.length) {
    if (!lines[i].trim()) {
      i++;
      continue;
    }
    if (LIST.test(lines[i])) {
      const ordered = /^\s*\d/.test(lines[i]);
      const items: string[] = [];
      while (i < lines.length && LIST.test(lines[i])) items.push(lines[i++].replace(LIST, ''));
      const Tag = ordered ? 'ol' : 'ul';
      blocks.push(
        <Tag key={i} className={cx('space-y-1 pl-5', ordered ? 'list-decimal' : 'list-disc')}>
          {items.map((t, k) => (
            <li key={k}>{inline(t.replace(/^#+\s*/, ''), onNavigate)}</li>
          ))}
        </Tag>,
      );
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !LIST.test(lines[i]))
      para.push(lines[i++].replace(/^#+\s*/, ''));
    blocks.push(
      <p key={i}>
        {para.map((t, k) => (
          <span key={k}>
            {k > 0 && <br />}
            {inline(t, onNavigate)}
          </span>
        ))}
      </p>,
    );
  }
  return <div className="space-y-2">{blocks}</div>;
}

function Typing() {
  return (
    <span className="flex items-center gap-1 py-1" aria-label="Writing an answer">
      {[0, 150, 300].map((d) => (
        <span
          key={d}
          className="h-2 w-2 animate-bounce rounded-full bg-ink-400"
          style={{ animationDelay: `${d}ms` }}
        />
      ))}
    </span>
  );
}

export function Assistant() {
  const { pathname } = useLocation();
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>(loadChat);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    let live = true;
    api
      .get<{ enabled: boolean }>('/assistant/status')
      .then((r) => live && setEnabled(r.enabled))
      .catch(() => {});
    return () => {
      live = false;
      abort.current?.abort();
    };
  }, []);

  useEffect(() => {
    saveChat(messages.filter((m) => !m.error));
  }, [messages]);

  useEffect(() => {
    if (open) scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [messages, open]);

  useEffect(() => {
    if (!open) return;
    // On phones, focusing would pop up the keyboard over the suggested questions.
    if (window.matchMedia('(min-width: 640px)').matches) input.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  function close() {
    setOpen(false);
    setTimeout(() => launcher.current?.focus(), 0);
  }
  // On phones the chat covers the screen, so following a link closes it.
  const onNavigate = () => {
    if (window.matchMedia('(max-width: 639px)').matches) setOpen(false);
  };

  async function send(text: string) {
    const q = text.trim().slice(0, ASSISTANT_LIMITS.messageChars);
    if (!q || busy) return;
    const history: Msg[] = [...messages.filter((m) => !m.error), { role: 'user', content: q }];
    setMessages([...history, { role: 'assistant', content: '' }]);
    setDraft('');
    setBusy(true);
    const ctrl = new AbortController();
    abort.current = ctrl;
    const setReply = (content: string, error = false) =>
      setMessages([...history, { role: 'assistant', content, error }]);
    try {
      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        credentials: 'same-origin',
        signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', 'X-OR-CSRF': '1' },
        body: JSON.stringify({
          messages: history
            .slice(-ASSISTANT_LIMITS.historyTurns)
            .map(({ role, content }) => ({ role, content: content.slice(0, 4000) })),
          path: pathname,
        }),
      });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error?.message ?? 'Something went wrong. Please try again.');
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let answer = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        answer += decoder.decode(value, { stream: true });
        setReply(answer);
      }
      if (!answer.trim()) throw new Error('No answer came back. Please try again.');
    } catch (e) {
      if (ctrl.signal.aborted) return;
      setReply(e instanceof Error && e.message ? e.message : 'Something went wrong. Please try again.', true);
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send(draft);
  }

  if (!enabled || HIDDEN.some((r) => r.test(pathname))) return null;
  const raised = RAISED.some((r) => r.test(pathname));

  return (
    <div className="print:hidden">
      {!open && (
        <button
          ref={launcher}
          type="button"
          onClick={() => setOpen(true)}
          className={cx(
            'fixed right-4 z-40 flex items-center gap-3 rounded-full bg-night py-2 pl-2 pr-5 text-white shadow-[0_12px_32px_rgba(11,11,12,0.35)] ring-1 ring-white/10 transition hover:bg-night-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-night sm:right-6',
            raised ? 'bottom-24' : 'bottom-4 sm:bottom-6',
          )}
          aria-haspopup="dialog"
        >
          <Avatar />
          <span className="text-[15px] font-semibold">{ASSISTANT_NAME}</span>
        </button>
      )}

      {open && (
        <section
          role="dialog"
          aria-modal="false"
          aria-label={ASSISTANT_NAME}
          className="assistant-panel fixed inset-0 z-50 flex flex-col overflow-hidden bg-white sm:inset-auto sm:bottom-6 sm:right-6 sm:w-[410px] sm:rounded-[22px] sm:shadow-[0_24px_64px_rgba(11,11,12,0.3)] sm:ring-1 sm:ring-black/5"
        >
          <header className="flex items-center gap-3 bg-night px-5 py-4 text-white">
            <Avatar />
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-[17px] font-semibold">{ASSISTANT_NAME}</h2>
              <p className="flex items-center gap-1.5 text-[13px] text-white/70">
                <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden /> Opportunity Radar ·
                Online
              </p>
            </div>
            {messages.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  abort.current?.abort();
                  setBusy(false);
                  setMessages([]);
                  input.current?.focus();
                }}
                className="flex h-10 w-10 flex-none items-center justify-center rounded-full text-white/80 hover:bg-white/10 hover:text-white"
                aria-label="Start a new chat"
                title="New chat"
              >
                <RotateCcw className="h-4 w-4" aria-hidden />
              </button>
            )}
            <button
              type="button"
              onClick={close}
              className="flex h-10 w-10 flex-none items-center justify-center rounded-full border border-white/30 hover:bg-white/10"
              aria-label="Close"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </header>

          <div
            ref={scroller}
            className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-ink-50 px-4 py-5"
            aria-live="polite"
          >
            <div className="flex items-end gap-2">
              <Avatar size="sm" />
              <div className="rounded-2xl rounded-bl-md border border-line bg-white px-4 py-3 text-[15px] leading-relaxed text-ink-800">
                <p>
                  <strong>Hello! I’m {ASSISTANT_NAME}.</strong> Ask me about finding jobs, scholarships and
                  tenders, building your CV, or choosing a plan. I’ll explain and point you to the right page.
                </p>
                <p className="mt-2 text-[13px] leading-snug text-ink-500">
                  I’m an AI and can make mistakes. Always read the official notice before you apply. Please
                  don’t share passwords, ID numbers or payment details here.
                </p>
              </div>
            </div>

            {messages.length === 0 && (
              <div className="flex flex-col items-start gap-2 pl-9">
                {suggestionsFor(pathname).map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => void send(q)}
                    className="rounded-full border border-line bg-white px-4 py-2 text-left text-[14px] text-ink-800 transition hover:border-ink-300 hover:bg-ink-50"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            {messages.map((m, k) =>
              m.role === 'user' ? (
                <div key={k} className="flex justify-end">
                  <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-night px-4 py-2.5 text-[15px] text-white">
                    {m.content}
                  </p>
                </div>
              ) : (
                <div key={k} className="flex items-end gap-2">
                  <Avatar size="sm" />
                  <div
                    className={cx(
                      'min-w-0 max-w-[85%] break-words rounded-2xl rounded-bl-md border px-4 py-3 text-[15px] leading-relaxed',
                      m.error ? 'border-red-200 bg-bad-50 text-bad-700' : 'border-line bg-white text-ink-800',
                    )}
                  >
                    {m.content ? <Markdown text={m.content} onNavigate={onNavigate} /> : <Typing />}
                  </div>
                </div>
              ),
            )}
          </div>

          <form onSubmit={onSubmit} className="flex items-center gap-2 border-t border-line bg-white p-3">
            <label htmlFor="assistant-input" className="sr-only">
              Your question
            </label>
            <input
              id="assistant-input"
              ref={input}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={ASSISTANT_LIMITS.messageChars}
              placeholder="Ask about jobs, scholarships, CVs or plans"
              autoComplete="off"
              className="min-w-0 flex-1 rounded-full border-2 border-ink-200 bg-white px-4 py-3 text-[15px] text-ink outline-none transition placeholder:text-ink-400 focus:border-night"
            />
            <button
              type="submit"
              disabled={busy || !draft.trim()}
              className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-night text-white transition hover:bg-night-700 disabled:bg-ink-200 disabled:text-ink-500"
              aria-label="Send"
            >
              <Send className="h-5 w-5" aria-hidden />
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
