/**
 * Source content is untrusted. We never store or render source HTML: descriptions are reduced to plain
 * text here and rendered as text (React escapes it), which removes XSS vectors from feeds.
 */
/** HTML named entities for code points 160–255, in order (HTML 4 Latin-1 set). */
const LATIN1 =
  'nbsp iexcl cent pound curren yen brvbar sect uml copy ordf laquo not shy reg macr deg plusmn sup2 sup3 acute ' +
  'micro para middot cedil sup1 ordm raquo frac14 frac12 frac34 iquest Agrave Aacute Acirc Atilde Auml Aring AElig ' +
  'Ccedil Egrave Eacute Ecirc Euml Igrave Iacute Icirc Iuml ETH Ntilde Ograve Oacute Ocirc Otilde Ouml times Oslash ' +
  'Ugrave Uacute Ucirc Uuml Yacute THORN szlig agrave aacute acirc atilde auml aring aelig ccedil egrave eacute ' +
  'ecirc euml igrave iacute icirc iuml eth ntilde ograve oacute ocirc otilde ouml divide oslash ugrave uacute ucirc ' +
  'uuml yacute thorn yuml';

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  OElig: 'Œ',
  oelig: 'œ',
  Scaron: 'Š',
  scaron: 'š',
  Yuml: 'Ÿ',
  fnof: 'ƒ',
  circ: 'ˆ',
  tilde: '˜',
  ensp: ' ',
  emsp: ' ',
  thinsp: ' ',
  zwnj: '',
  zwj: '',
  lrm: '',
  rlm: '',
  ndash: '–',
  mdash: '—',
  lsquo: '‘',
  rsquo: '’',
  sbquo: '‚',
  ldquo: '“',
  rdquo: '”',
  bdquo: '„',
  dagger: '†',
  Dagger: '‡',
  bull: '•',
  hellip: '…',
  permil: '‰',
  prime: '′',
  Prime: '″',
  lsaquo: '‹',
  rsaquo: '›',
  oline: '‾',
  euro: '€',
  trade: '™',
  larr: '←',
  rarr: '→',
  minus: '−',
};
LATIN1.split(' ').forEach((name, i) => {
  ENTITIES[name] = name === 'nbsp' ? ' ' : String.fromCharCode(160 + i);
});

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      if (!Number.isFinite(code) || code < 9 || code > 0x10ffff) return '';
      try {
        return String.fromCodePoint(code);
      } catch {
        return '';
      }
    }
    return ENTITIES[e] ?? ENTITIES[e.toLowerCase()] ?? m;
  });
}

// Control characters are stripped from source text on purpose.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;

export function htmlToText(input: string | null | undefined, max = 20000): string {
  if (!input) return '';
  let s = String(input);
  // Some feeds double-encode HTML
  if (/&lt;\/?[a-z]/i.test(s) && !/<[a-z]/i.test(s)) s = decodeEntities(s);
  s = s
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|iframe|object|embed|svg|template)[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<(br|hr)\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n• ')
    .replace(/<\/(p|div|h[1-6]|li|ul|ol|tr|table|section|article|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  s = decodeEntities(s)
    .replace(CONTROL_CHARS, '')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return s.length > max ? s.slice(0, max) + '…' : s;
}

export function clean(s: unknown, max = 300): string {
  if (typeof s !== 'string') return '';
  return htmlToText(s, max).replace(/\s+/g, ' ').trim();
}

export function summarize(text: string, max = 320): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const dot = cut.lastIndexOf('. ');
  return (
    (dot > max * 0.5 ? cut.slice(0, dot + 1) : cut.replace(/\s+\S*$/, '')) + (dot > max * 0.5 ? '' : '…')
  );
}
