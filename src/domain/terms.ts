import type { TermCode, TermSeason } from "./types";

/**
 * UW term codes are (year - 1900) followed by a season digit, so Fall 2024 is
 * 1249. Note there is no leading "1" of its own - writing it that way yields a
 * five-digit code that the Open Data API rejects with a 404.
 */
const SEASON_DIGIT: Record<TermSeason, string> = { W: "1", S: "5", F: "9" };

const SEASON_NAME: Record<TermSeason, string> = {
  W: "Winter",
  S: "Spring",
  F: "Fall",
};

export function termCodeFor(season: TermSeason, year: number): TermCode {
  return `${year - 1900}${SEASON_DIGIT[season]}`;
}

export function seasonOfTerm(code: TermCode): TermSeason | null {
  switch (code.at(-1)) {
    case "1":
      return "W";
    case "5":
      return "S";
    case "9":
      return "F";
    default:
      return null;
  }
}

export function yearOfTerm(code: TermCode): number | null {
  const digits = code.slice(0, -1);
  if (!/^\d{3}$/.test(digits)) return null;
  return Number(digits) + 1900;
}

/** "1249" -> "Fall 2024". Falls back to the raw code when it is not parseable. */
export function describeTerm(code: TermCode): string {
  const season = seasonOfTerm(code);
  const year = yearOfTerm(code);
  if (!season || year === null) return code;
  return `${SEASON_NAME[season]} ${year}`;
}

const SEASON_FROM_NAME: Record<string, TermSeason> = {
  fall: "F",
  winter: "W",
  spring: "S",
};

/**
 * "Fall 2024", "Winter 2025 (1251)", "1249" -> a term code. Transcripts label
 * terms by name, so this is how a parsed transcript is anchored to a term.
 */
export function parseTermLabel(text: string): TermCode | null {
  // The named form is checked first because a bare four-digit year looks like
  // a term code: "Winter 2025" would otherwise parse as term "2025".
  const named = /\b(fall|winter|spring)\s+(\d{4})\b/i.exec(text);
  if (named) {
    const season = SEASON_FROM_NAME[named[1].toLowerCase()];
    return termCodeFor(season, Number(named[2]));
  }

  // Codes for 2000 onward begin with 1 (2024 -> 124 + season digit), which is
  // what keeps a year like 2025 from matching here.
  const explicit = /\b(1\d{2}[159])\b/.exec(text);
  return explicit ? explicit[1] : null;
}
