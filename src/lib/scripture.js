// Scripture reference parsing for the LDS standard works.
//
// Used in two places — the app (when you save a prayer, prompting, or note)
// and the Obsidian sync script — so it's plain ESM with no imports.
// Everything it finds becomes a row in scripture_refs, which is what makes
// "show me everything I've ever written touching Alma 32" answerable.

// canonical name -> accepted spellings/abbreviations (canonical included).
// Order within a book doesn't matter; the matcher sorts every alternative by
// length so "1 Nephi" wins over a bare "Nephi"-style prefix and "1 John"
// never gets eaten by "John".
const BOOKS = {
  Genesis: ["Genesis", "Gen"],
  Exodus: ["Exodus", "Ex", "Exod"],
  Leviticus: ["Leviticus", "Lev"],
  Numbers: ["Numbers", "Num"],
  Deuteronomy: ["Deuteronomy", "Deut"],
  Joshua: ["Joshua", "Josh"],
  Judges: ["Judges", "Judg"],
  Ruth: ["Ruth"],
  "1 Samuel": ["1 Samuel", "1 Sam", "1Sam"],
  "2 Samuel": ["2 Samuel", "2 Sam", "2Sam"],
  "1 Kings": ["1 Kings", "1 Kgs", "1Kgs"],
  "2 Kings": ["2 Kings", "2 Kgs", "2Kgs"],
  "1 Chronicles": ["1 Chronicles", "1 Chr", "1Chr"],
  "2 Chronicles": ["2 Chronicles", "2 Chr", "2Chr"],
  Ezra: ["Ezra"],
  Nehemiah: ["Nehemiah", "Neh"],
  Esther: ["Esther", "Esth"],
  Job: ["Job"],
  Psalms: ["Psalms", "Psalm", "Ps"],
  Proverbs: ["Proverbs", "Prov"],
  Ecclesiastes: ["Ecclesiastes", "Eccl"],
  "Song of Solomon": ["Song of Solomon", "Song"],
  Isaiah: ["Isaiah", "Isa"],
  Jeremiah: ["Jeremiah", "Jer"],
  Lamentations: ["Lamentations", "Lam"],
  Ezekiel: ["Ezekiel", "Ezek"],
  Daniel: ["Daniel", "Dan"],
  Hosea: ["Hosea", "Hos"],
  Joel: ["Joel"],
  Amos: ["Amos"],
  Obadiah: ["Obadiah", "Obad"],
  Jonah: ["Jonah"],
  Micah: ["Micah", "Micah"],
  Nahum: ["Nahum", "Nah"],
  Habakkuk: ["Habakkuk", "Hab"],
  Zephaniah: ["Zephaniah", "Zeph"],
  Haggai: ["Haggai", "Hag"],
  Zechariah: ["Zechariah", "Zech"],
  Malachi: ["Malachi", "Mal"],

  Matthew: ["Matthew", "Matt"],
  Mark: ["Mark"],
  Luke: ["Luke"],
  John: ["John"],
  Acts: ["Acts"],
  Romans: ["Romans", "Rom"],
  "1 Corinthians": ["1 Corinthians", "1 Cor", "1Cor"],
  "2 Corinthians": ["2 Corinthians", "2 Cor", "2Cor"],
  Galatians: ["Galatians", "Gal"],
  Ephesians: ["Ephesians", "Eph"],
  Philippians: ["Philippians", "Philip", "Phil"],
  Colossians: ["Colossians", "Col"],
  "1 Thessalonians": ["1 Thessalonians", "1 Thes", "1 Thess"],
  "2 Thessalonians": ["2 Thessalonians", "2 Thes", "2 Thess"],
  "1 Timothy": ["1 Timothy", "1 Tim"],
  "2 Timothy": ["2 Timothy", "2 Tim"],
  Titus: ["Titus"],
  Philemon: ["Philemon", "Philem"],
  Hebrews: ["Hebrews", "Heb"],
  James: ["James", "Jas"],
  "1 Peter": ["1 Peter", "1 Pet"],
  "2 Peter": ["2 Peter", "2 Pet"],
  "1 John": ["1 John", "1 Jn"],
  "2 John": ["2 John", "2 Jn"],
  "3 John": ["3 John", "3 Jn"],
  Jude: ["Jude"],
  Revelation: ["Revelation", "Rev"],

  "1 Nephi": ["1 Nephi", "1 Ne", "1Ne"],
  "2 Nephi": ["2 Nephi", "2 Ne", "2Ne"],
  Jacob: ["Jacob"],
  Enos: ["Enos"],
  Jarom: ["Jarom"],
  Omni: ["Omni"],
  "Words of Mormon": ["Words of Mormon", "W of M", "WofM"],
  Mosiah: ["Mosiah"],
  Alma: ["Alma"],
  Helaman: ["Helaman", "Hel"],
  "3 Nephi": ["3 Nephi", "3 Ne", "3Ne"],
  "4 Nephi": ["4 Nephi", "4 Ne", "4Ne"],
  Mormon: ["Mormon", "Morm"],
  Ether: ["Ether"],
  Moroni: ["Moroni", "Moro"],

  "Doctrine and Covenants": ["Doctrine and Covenants", "D&C", "DC"],

  Moses: ["Moses"],
  Abraham: ["Abraham", "Abr"],
  "Joseph Smith—Matthew": ["Joseph Smith—Matthew", "Joseph Smith-Matthew", "JS—M", "JS-M"],
  "Joseph Smith—History": ["Joseph Smith—History", "Joseph Smith-History", "JS—H", "JS-H"],
  "Articles of Faith": ["Articles of Faith", "A of F", "AofF"],
};

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// alias -> canonical, sorted longest-first so the matcher never settles for
// a shorter alias that happens to prefix a longer one.
const ALIAS_TO_BOOK = new Map();
for (const [canonical, aliases] of Object.entries(BOOKS)) {
  for (const alias of aliases) ALIAS_TO_BOOK.set(alias.toLowerCase(), canonical);
}
const SORTED_ALIASES = [...ALIAS_TO_BOOK.keys()].sort((a, b) => b.length - a.length);

// "<book>[.] <chapter>[:<verse>[-<verse>]]" — the trailing period after an
// abbreviation is optional, and the chapter is required (a bare book name on
// its own is too loose to be worth indexing: "Job", "Mark", and "Alma" are
// all ordinary English words or names).
const REFERENCE_RE = new RegExp(
  "\\b(" + SORTED_ALIASES.map(escapeRegex).join("|") + ")\\.?\\s*(\\d+)(?:\\s*:\\s*(\\d+)(?:\\s*[-–]\\s*(\\d+))?)?",
  "gi"
);

// Every scripture reference in a block of text, de-duplicated by its
// normalized form. Returns {book, chapter, verseStart, verseEnd, rawRef}.
export function parseScriptureRefs(text) {
  if (!text) return [];
  const found = new Map();

  for (const match of text.matchAll(REFERENCE_RE)) {
    const [raw, aliasRaw, chapterRaw, verseStartRaw, verseEndRaw] = match;
    const book = ALIAS_TO_BOOK.get(aliasRaw.toLowerCase());
    if (!book) continue;

    const chapter = Number(chapterRaw);
    const verseStart = verseStartRaw ? Number(verseStartRaw) : null;
    const verseEnd = verseEndRaw ? Number(verseEndRaw) : null;

    const rawRef = formatRef(book, chapter, verseStart, verseEnd);
    if (!found.has(rawRef)) {
      found.set(rawRef, { book, chapter, verseStart, verseEnd, rawRef, matched: raw.trim() });
    }
  }

  return [...found.values()];
}

export function formatRef(book, chapter, verseStart, verseEnd) {
  let ref = `${book} ${chapter}`;
  if (verseStart) {
    ref += `:${verseStart}`;
    if (verseEnd && verseEnd !== verseStart) ref += `-${verseEnd}`;
  }
  return ref;
}

export const CANONICAL_BOOKS = Object.keys(BOOKS);
