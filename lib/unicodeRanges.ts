import { UnicodeChar, UnicodeGroup } from "./types";

export function toHex(codepoint: number): string {
  return codepoint.toString(16).toUpperCase().padStart(4, "0");
}

function range(
  start: number,
  end: number,
  names?: Record<number, string>,
  fallbackPrefix = "CHARACTER"
): UnicodeChar[] {
  const out: UnicodeChar[] = [];
  for (let cp = start; cp <= end; cp++) {
    out.push({
      codepoint: cp,
      hex: toHex(cp),
      char: String.fromCodePoint(cp),
      name: names?.[cp] ?? `${fallbackPrefix} U+${toHex(cp)}`,
    });
  }
  return out;
}

// --- Basic Latin (printable ASCII) -----------------------------------------

const LATIN_NAMES: Record<number, string> = {
  0x0020: "SPACE",
  0x0021: "EXCLAMATION MARK",
  0x0022: "QUOTATION MARK",
  0x0023: "NUMBER SIGN",
  0x0024: "DOLLAR SIGN",
  0x0025: "PERCENT SIGN",
  0x0026: "AMPERSAND",
  0x0027: "APOSTROPHE",
  0x0028: "LEFT PARENTHESIS",
  0x0029: "RIGHT PARENTHESIS",
  0x002a: "ASTERISK",
  0x002b: "PLUS SIGN",
  0x002c: "COMMA",
  0x002d: "HYPHEN-MINUS",
  0x002e: "FULL STOP",
  0x002f: "SOLIDUS",
  0x003a: "COLON",
  0x003b: "SEMICOLON",
  0x003c: "LESS-THAN SIGN",
  0x003d: "EQUALS SIGN",
  0x003e: "GREATER-THAN SIGN",
  0x003f: "QUESTION MARK",
  0x0040: "COMMERCIAL AT",
  0x005b: "LEFT SQUARE BRACKET",
  0x005c: "REVERSE SOLIDUS",
  0x005d: "RIGHT SQUARE BRACKET",
  0x005e: "CIRCUMFLEX ACCENT",
  0x005f: "LOW LINE",
  0x0060: "GRAVE ACCENT",
  0x007b: "LEFT CURLY BRACKET",
  0x007c: "VERTICAL LINE",
  0x007d: "RIGHT CURLY BRACKET",
  0x007e: "TILDE",
};
for (let d = 0; d <= 9; d++) LATIN_NAMES[0x0030 + d] = `DIGIT ${["ZERO", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE"][d]}`;
for (let i = 0; i < 26; i++) LATIN_NAMES[0x0041 + i] = `LATIN CAPITAL LETTER ${String.fromCharCode(65 + i)}`;
for (let i = 0; i < 26; i++) LATIN_NAMES[0x0061 + i] = `LATIN SMALL LETTER ${String.fromCharCode(65 + i)}`;

// --- Khmer (U+1780 - U+17FF) --------------------------------------------------

const KHMER_CONSONANTS = [
  "KA", "KHA", "KO", "KHO", "NGO", "CA", "CHA", "CO", "CHO", "NYO",
  "DA", "TTHA", "DO", "TTHO", "NNO", "TA", "THA", "TO", "THO", "NO",
  "BA", "PHA", "PO", "PHO", "MO", "YO", "RO", "LO", "VO", "SHA",
  "SSO", "SA", "HA", "LA", "QA",
];
const KHMER_INDEPENDENT_VOWELS = [
  "QAQ", "QAA", "QI", "QII", "QU", "QUK", "QUU", "QUUV", "RY", "RYY",
  "LY", "LYY", "QE", "QAI", "QOO TYPE ONE", "QOO TYPE TWO", "QAU",
];
const KHMER_DEPENDENT_VOWELS: Record<number, string> = {
  0x17b6: "SIGN AA", 0x17b7: "SIGN I", 0x17b8: "SIGN II", 0x17b9: "SIGN Y",
  0x17ba: "SIGN YY", 0x17bb: "SIGN U", 0x17bc: "SIGN UU", 0x17bd: "SIGN UA",
  0x17be: "SIGN OE", 0x17bf: "SIGN YA", 0x17c0: "SIGN IE", 0x17c1: "SIGN E",
  0x17c2: "SIGN AE", 0x17c3: "SIGN AI", 0x17c4: "SIGN OO", 0x17c5: "SIGN AU",
};
const KHMER_SIGNS: Record<number, string> = {
  0x17b4: "SIGN VOWEL INHERENT AQ", 0x17b5: "SIGN VOWEL INHERENT AA",
  0x17c6: "SIGN NIKAHIT", 0x17c7: "SIGN REAHMUK", 0x17c8: "SIGN YUUKALEAPINTU",
  0x17c9: "SIGN MUUSIKATOAN", 0x17ca: "SIGN TRIISAP", 0x17cb: "SIGN BANTOC",
  0x17cc: "SIGN ROBAT", 0x17cd: "SIGN TOANDAKHIAT", 0x17ce: "SIGN KAKABAT",
  0x17cf: "SIGN AHSDA", 0x17d0: "SIGN SAMYOK SANNYA", 0x17d1: "SIGN VIRIAM",
  0x17d2: "SIGN COENG", 0x17d3: "SIGN BATHAMASAT", 0x17dd: "SIGN ATTHACAN",
};
const KHMER_DIGITS = ["ZERO", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE"];
const KHMER_PUNCTUATION: Record<number, string> = {
  0x17d4: "SIGN KHAN",
  0x17d5: "SIGN BARIYOOSAN",
  0x17d6: "SIGN CAMNUC PII KUUH",
  0x17d7: "SIGN LEK TOO",
  0x17d8: "SIGN BEYYAL",
  0x17d9: "SIGN PHNAEK MUAN",
  0x17da: "SIGN KOOMUUT",
  0x17db: "CURRENCY SYMBOL RIEL",
  0x17dc: "SIGN AVAKRAHASANYA",
};
const LATIN1_EXTRA: Record<number, string> = {
  0x00a0: "NO-BREAK SPACE",
  0x00ab: "LEFT-POINTING DOUBLE ANGLE QUOTATION MARK",
  0x00bb: "RIGHT-POINTING DOUBLE ANGLE QUOTATION MARK",
};

const KHMER_CONSONANT_KHMER_NAMES = [
  "ក", "ខ", "គ", "ឃ", "ង", "ច", "ឆ", "ជ", "ឈ", "ញ",
  "ដ", "ឋ", "ឌ", "ឍ", "ណ", "ត", "ថ", "ទ", "ធ", "ន",
  "ប", "ផ", "ព", "ភ", "ម", "យ", "រ", "ល", "វ", "ឝ",
  "ឞ", "ស", "ហ", "ឡ", "អ",
];

function khmerConsonants(): UnicodeChar[] {
  return KHMER_CONSONANTS.map((n, i) => {
    const cp = 0x1780 + i;
    return { codepoint: cp, hex: toHex(cp), char: String.fromCodePoint(cp), name: `KHMER LETTER ${n}` };
  });
}
function khmerSubjoinedConsonants(): UnicodeChar[] {
  return KHMER_CONSONANTS.map((n, i) => {
    const cp = 0x1780 + i;
    const khChar = KHMER_CONSONANT_KHMER_NAMES[i] || "";
    return {
      baseCodepoint: cp,
      hex: `17D2_${toHex(cp)}`,
      char: `\u17D2${khChar}`,
      name: `KHMER SUBJOINED ${n} (ជើង${khChar})`,
      isSubscript: true,
    };
  });
}
function khmerIndependentVowels(): UnicodeChar[] {
  return KHMER_INDEPENDENT_VOWELS.map((n, i) => {
    const cp = 0x17a3 + i;
    return { codepoint: cp, hex: toHex(cp), char: String.fromCodePoint(cp), name: `KHMER INDEPENDENT VOWEL ${n}` };
  });
}
function khmerDependentVowels(): UnicodeChar[] {
  return range(0x17b6, 0x17c5, Object.fromEntries(Object.entries(KHMER_DEPENDENT_VOWELS).map(([k, v]) => [Number(k), `KHMER VOWEL ${v}`])));
}
function khmerSigns(): UnicodeChar[] {
  const cps = [0x17b4, 0x17b5, 0x17c6, 0x17c7, 0x17c8, 0x17c9, 0x17ca, 0x17cb, 0x17cc, 0x17cd, 0x17ce, 0x17cf, 0x17d0, 0x17d1, 0x17d2, 0x17d3, 0x17dd];
  return cps.map((cp) => ({ codepoint: cp, hex: toHex(cp), char: String.fromCodePoint(cp), name: `KHMER ${KHMER_SIGNS[cp]}` }));
}
function khmerDigits(): UnicodeChar[] {
  return KHMER_DIGITS.map((n, i) => {
    const cp = 0x17e0 + i;
    return { codepoint: cp, hex: toHex(cp), char: String.fromCodePoint(cp), name: `KHMER DIGIT ${n}` };
  });
}
function khmerPunctuation(): UnicodeChar[] {
  return Object.entries(KHMER_PUNCTUATION).map(([cpStr, name]) => {
    const cp = Number(cpStr);
    return { codepoint: cp, hex: toHex(cp), char: String.fromCodePoint(cp), name: `KHMER ${name}` };
  });
}
function latin1Extra(): UnicodeChar[] {
  return Object.entries(LATIN1_EXTRA).map(([cpStr, name]) => {
    const cp = Number(cpStr);
    return { codepoint: cp, hex: toHex(cp), char: String.fromCodePoint(cp), name };
  });
}

export const UNICODE_GROUPS: UnicodeGroup[] = [
  { id: "basic-latin", label: "Basic Latin", chars: [...range(0x0020, 0x007e, LATIN_NAMES), ...latin1Extra()] },
  { id: "khmer-consonants", label: "Khmer Consonants", chars: khmerConsonants() },
  { id: "khmer-subjoined", label: "Khmer Subjoined Consonants (ជើង)", chars: khmerSubjoinedConsonants() },
  { id: "khmer-independent-vowels", label: "Khmer Independent Vowels", chars: khmerIndependentVowels() },
  { id: "khmer-dependent-vowels", label: "Khmer Dependent Vowels", chars: khmerDependentVowels() },
  { id: "khmer-signs", label: "Khmer Signs & Coeng (Subscript Marker)", chars: khmerSigns() },
  { id: "khmer-punctuation", label: "Khmer Punctuation & Symbols", chars: [...khmerPunctuation(), { codepoint: 0x25cc, hex: toHex(0x25cc), char: String.fromCodePoint(0x25cc), name: "DOTTED CIRCLE (diacritic placeholder)" }] },
  { id: "khmer-digits", label: "Khmer Digits", chars: khmerDigits() },
];

export const ALL_UNICODE_CHARS: UnicodeChar[] = UNICODE_GROUPS.flatMap((g) => g.chars);

export function findUnicodeChar(hex: string): UnicodeChar | undefined {
  const norm = hex.trim().toLowerCase().replace(/^u\+/i, "");
  return ALL_UNICODE_CHARS.find((c) => c.hex.toLowerCase() === norm);
}
