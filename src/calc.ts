/**
 * The calculation behind smarText, with no editor in it: it takes the lines of
 * a Markdown doc and says where the amounts are, what each one's share is, and
 * what they add up to.
 *
 * An amount is a number with a unit, a currency or a `%`, anywhere in the
 * text: "46g cocoa powder and 37g Cocoa butter" holds two. Amounts add up with
 * the others on their line and on the lines around it. Blank lines don't end
 * a sum; a heading, a rule, a code block or a line with no amount in it does.
 *
 * Units of the same kind mix: 1 kg and 500 g make 1.5 kg. Each kind (weight,
 * volume, time, a currency…) is summed apart, and only kinds that appear
 * twice or more get a total and shares.
 */

// ---------- Units ----------

/** A unit: how it is shown and how it converts to the base unit of its kind. */
type Unit = {
  /** Its name in a total, such as "kg", and its identity. */
  readonly key: string;
  /** What it measures. Units of one kind add up together. */
  readonly kind: string;
  readonly toBase: number;
  /** Its name after a number other than 1. */
  readonly plural: string;
  /** A currency's sign, written before the number. */
  readonly symbol?: string;
};

/** key, how many base units it is, names in any case, names in this exact case, plural. */
type Row = readonly [key: string, toBase: number, loose: string, exact?: string, plural?: string];

/**
 * Every unit, by kind. The first number is the unit in the kind's base: grams,
 * milliliters, meters, square meters, seconds, joules, watts, bytes, pieces.
 *
 * Single letters count only in the case people write them in, so "5G" and "5M"
 * aren't grams and meters. Cups, spoons, pints and gallons are US measures.
 * "cal" is the food calorie, a kilocalorie.
 */
const KINDS: Readonly<Record<string, readonly Row[]>> = {
  weight: [
    ["µg", 1e-6, "µg|μg|mcg|microgram|micrograms"],
    ["mg", 1e-3, "mg|milligram|milligrams"],
    ["g", 1, "gram|grams|gramme|grammes|gr", "g"],
    ["kg", 1e3, "kg|kgs|kilo|kilos|kilogram|kilograms"],
    ["tonne", 1e6, "tonne|tonnes", "", "tonnes"],
    ["oz", 28.349523125, "oz|ounce|ounces"],
    ["lb", 453.59237, "lb|lbs|pound|pounds"],
    ["stone", 6350.29318, "stone"],
  ],
  volume: [
    ["µl", 1e-3, "µl|μl|microliter|microliters|microlitre|microlitres"],
    ["ml", 1, "ml|milliliter|milliliters|millilitre|millilitres"],
    ["cl", 10, "cl|centiliter|centiliters|centilitre|centilitres"],
    ["dl", 100, "dl|deciliter|deciliters|decilitre|decilitres"],
    ["l", 1e3, "liter|liters|litre|litres", "l|L"],
    ["cm³", 1, "cm³|cm3|cc"],
    ["m³", 1e6, "m³|m3"],
    ["tsp", 4.92892159375, "tsp|tsps|teaspoon|teaspoons"],
    ["tbsp", 14.78676478125, "tbsp|tbsps|tbs|tablespoon|tablespoons"],
    ["fl oz", 29.5735295625, "fl oz|floz|fluid ounce|fluid ounces"],
    ["cup", 236.5882365, "cup|cups", "", "cups"],
    ["pt", 473.176473, "pt|pint|pints"],
    ["qt", 946.352946, "qt|quart|quarts"],
    ["gal", 3785.411784, "gal|gallon|gallons"],
  ],
  length: [
    ["mm", 1e-3, "mm|millimeter|millimeters|millimetre|millimetres"],
    ["cm", 1e-2, "cm|centimeter|centimeters|centimetre|centimetres"],
    ["m", 1, "meter|meters|metre|metres", "m"],
    ["km", 1e3, "km|kilometer|kilometers|kilometre|kilometres"],
    ["in", 0.0254, "in|inch|inches"],
    ["ft", 0.3048, "ft|foot|feet"],
    ["yd", 0.9144, "yd|yard|yards"],
    ["mi", 1609.344, "mi|mile|miles"],
  ],
  area: [
    ["mm²", 1e-6, "mm²|mm2"],
    ["cm²", 1e-4, "cm²|cm2"],
    ["m²", 1, "m²|m2|sqm|sq m|square meter|square meters|square metre|square metres"],
    ["km²", 1e6, "km²|km2"],
    ["ha", 1e4, "ha|hectare|hectares"],
    ["acre", 4046.8564224, "acre|acres", "", "acres"],
    ["ft²", 0.09290304, "ft²|ft2|sqft|sq ft|square foot|square feet"],
  ],
  time: [
    ["ms", 1e-3, "ms|millisecond|milliseconds"],
    ["s", 1, "sec|secs|second|seconds", "s"],
    ["min", 60, "min|mins|minute|minutes"],
    ["h", 3600, "hr|hrs|hour|hours", "h"],
    ["day", 86400, "day|days", "", "days"],
    ["week", 604800, "week|weeks|wk|wks", "", "weeks"],
  ],
  energy: [
    ["J", 1, "joule|joules", "J"],
    ["kJ", 1e3, "kj|kilojoule|kilojoules"],
    ["kcal", 4184, "kcal|cal|calorie|calories|kilocalorie|kilocalories"],
    ["Wh", 3600, "wh|watt hour|watt hours"],
    ["kWh", 3.6e6, "kwh"],
  ],
  power: [
    ["W", 1, "watt|watts", "W"],
    ["kW", 1e3, "kw|kilowatt|kilowatts"],
    ["MW", 1e6, "megawatt|megawatts", "MW"],
  ],
  data: [
    ["KB", 1e3, "", "KB|kB"],
    ["MB", 1e6, "", "MB"],
    ["GB", 1e9, "", "GB"],
    ["TB", 1e12, "", "TB"],
  ],
  count: [
    ["pcs", 1, "pcs|pc|piece|pieces"],
    ["dozen", 12, "dozen"],
  ],
};

/** Signs for the currencies that have one. Each currency is its own kind: there are no exchange rates here. */
const SYMBOLS: Readonly<Record<string, string>> = { $: "USD", "€": "EUR", "£": "GBP", "¥": "JPY", "₹": "INR" };
const CURRENCIES =
  "USD EUR GBP JPY CNY INR CHF CAD AUD NZD SEK NOK DKK PLN CZK HUF RON TRY BRL MXN ZAR AED SAR QAR KWD EGP MAD TND DZD ILS KRW SGD HKD THB".split(
    " ",
  );

/** Names that are also common words, so they count only right against the number: "5in", not "5 in". */
const ATTACHED_ONLY: ReadonlySet<string> = new Set(["in"]);

const PERCENT: Unit = { key: "%", kind: "%", toBase: 1, plural: "%" };
const UNITS = new Map<string, Unit>([[PERCENT.key, PERCENT]]);
const LOOSE = new Map<string, Unit>();
const EXACT = new Map<string, Unit>();

for (const [kind, rows] of Object.entries(KINDS)) {
  for (const [key, toBase, loose, exact = "", plural = key] of rows) {
    const unit: Unit = { key, kind, toBase, plural };
    UNITS.set(key, unit);
    for (const name of loose.split("|").filter(Boolean)) LOOSE.set(name, unit);
    for (const name of exact.split("|").filter(Boolean)) EXACT.set(name, unit);
  }
}
for (const code of CURRENCIES) {
  const symbol = Object.keys(SYMBOLS).find((sign) => SYMBOLS[sign] === code);
  const unit: Unit = { key: code, kind: `money:${code}`, toBase: 1, plural: code, ...(symbol ? { symbol } : {}) };
  UNITS.set(code, unit);
  EXACT.set(code, unit);
}

function isMoney(unit: Unit): boolean {
  return unit.kind.startsWith("money:");
}

// ---------- Finding amounts ----------

/** An amount found on a line. Offsets are in that line's text. */
export type Amount = {
  readonly value: number;
  /** The unit's key, such as "g", "USD" or "%". */
  readonly unit: string;
  /** What the unit measures. Amounts of one kind add up together. */
  readonly kind: string;
  /** The value in the base unit of its kind. */
  readonly base: number;
  readonly from: number;
  readonly to: number;
  /** Where the number itself starts and ends, without its unit or currency sign. */
  readonly numberFrom: number;
  readonly numberTo: number;
  /** How many decimal places the number was written with. */
  readonly decimals: number;
  /** The decimal mark it was written with, or null for a whole number. */
  readonly mark: DecimalMark | null;
};

export type DecimalMark = "." | ",";

// Longest first, so "grams" is tried before "g". A space in a name is one space or tab.
const NAMES = [...new Set([...LOOSE.keys(), ...EXACT.keys()].map((name) => name.toLowerCase()))]
  .sort((a, b) => b.length - a.length)
  .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "[ \\t]"))
  .join("|");
const NUMBER = String.raw`\d+(?:[.,]\d+)*`;
const SIGN = `[${Object.keys(SYMBOLS).join("")}]`;

/**
 * "$12.50", or a number and what follows it: a unit, a currency sign or a `%`.
 * The number can't be the tail of a word, a longer number, a path or a range:
 * "v2g", "x/43g" and the "2g" of "1-2g" don't count.
 */
const AMOUNT = new RegExp(
  String.raw`(?<![\p{L}\d.,/#_@&=-])(${SIGN})[ \t]?(${NUMBER})(?![\p{L}\d]|[.,]\d)` +
    "|" +
    String.raw`(?<![\p{L}\d.,/#_@&=$€£¥₹-])(${NUMBER})([ \t]?(?:%|${SIGN}|(?:${NAMES})(?![\p{L}\d])))`,
  "dgiu",
);

/** Inline code, URLs and link targets: text that is not prose. */
const NOT_PROSE = /`[^`]*`|https?:\/\/\S+|\]\([^)]*\)/g;

const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const HEADING = /^ {0,3}#{1,6}(?:\s|$)/;
const RULE = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;

export type WrittenNumber = {
  readonly value: number;
  readonly decimals: number;
  readonly mark: DecimalMark | null;
};

/**
 * A number as written. "1,5" and "1.5" are one and a half; "1,000" and
 * "1.000,5" use the other mark for thousands.
 */
export function readNumber(raw: string): WrittenNumber {
  const marks = raw.match(/[.,]/g) ?? [];
  const whole = (digits: string): WrittenNumber => ({ value: Number(digits), decimals: 0, mark: null });
  if (marks.length === 0) return whole(raw);

  const last = Math.max(raw.lastIndexOf("."), raw.lastIndexOf(","));
  const before = raw.slice(0, last);
  const after = raw.slice(last + 1);
  const thousands =
    marks.length === 1
      ? marks[0] === "," && after.length === 3 && before.length <= 3 && before !== "0"
      : marks.every((mark) => mark === raw[last]);
  if (thousands) return whole(raw.replace(/[.,]/g, ""));

  return {
    value: Number(`${before.replace(/[.,]/g, "")}.${after}`),
    decimals: after.length,
    mark: raw[last] as DecimalMark,
  };
}

export function parseNumber(raw: string): number {
  return readNumber(raw).value;
}

/** The unit written after a number, or null when the text only looks like one. */
function unitAfter(written: string, number: string): Unit | null {
  const spaced = /^\s/.test(written);
  const name = written.trim().replace(/\s+/g, " ");
  if (name === "%") return PERCENT;
  const currency = SYMBOLS[name];
  if (currency) return UNITS.get(currency) ?? null;

  const unit = EXACT.get(name) ?? LOOSE.get(name.toLowerCase());
  if (!unit) return null;
  if (spaced && ATTACHED_ONLY.has(name.toLowerCase())) return null;
  // "the 1990s" is a decade, not 1990 seconds.
  if (!spaced && name === "s" && /^\d{4}$/.test(number)) return null;
  return unit;
}

/** Every amount in a line, in the order written. */
export function findAmounts(line: string): Amount[] {
  // Blanked out, not cut, so offsets still point into the line.
  const prose = line.replace(NOT_PROSE, (skipped) => " ".repeat(skipped.length));
  const amounts: Amount[] = [];

  for (const match of prose.matchAll(AMOUNT)) {
    const at = match.indices;
    if (!at) continue;
    const signFirst = match[1] !== undefined;
    const number = signFirst ? at[2] : at[3];
    const rest = signFirst ? at[1] : at[4];
    const raw = (signFirst ? match[2] : match[3]) ?? "";
    const unit = signFirst ? UNITS.get(SYMBOLS[match[1] ?? ""] ?? "") : unitAfter(match[4] ?? "", raw);
    if (!number || !rest || !unit) continue;

    const written = readNumber(raw);
    if (!Number.isFinite(written.value)) continue;
    amounts.push({
      ...written,
      unit: unit.key,
      kind: unit.kind,
      base: written.value * unit.toBase,
      from: Math.min(number[0], rest[0]),
      to: Math.max(number[1], rest[1]),
      numberFrom: number[0],
      numberTo: number[1],
    });
  }
  return amounts;
}

// ---------- Adding up ----------

/** An amount that takes part in a sum. */
export type Counted = {
  readonly amount: Amount;
  /** This amount's part of its kind's total, 0 to 100. Null for percentages and zero totals. */
  readonly share: number | null;
};

export type Total = {
  readonly kind: string;
  /** The unit the total is shown in: the one written most, or first when it's a tie. */
  readonly unit: string;
  /** The sum in that unit, rounded to `decimals`. */
  readonly sum: number;
  /** The sum in the base unit of its kind. */
  readonly base: number;
  readonly count: number;
  readonly decimals: number;
  /** Whether the amounts were written in more than one unit. */
  readonly mixed: boolean;
};

/** A counted amount and the 0-based index of the line it is on. */
export type Member = {
  readonly line: number;
  readonly amount: Amount;
};

/** The amounts of one sum. `lastLine` is the 0-based index of the last line that holds one. */
export type Group = {
  readonly lastLine: number;
  readonly totals: readonly Total[];
  /** Every amount behind the totals, in the order written. */
  readonly members: readonly Member[];
};

export type Sheet = {
  /** One entry per doc line: that line's amounts that take part in a sum, in order. */
  readonly lines: readonly (readonly Counted[])[];
  readonly groups: readonly Group[];
};

/** Leading whitespace, with a tab counted as four columns. */
function indentOf(line: string): number {
  let columns = 0;
  for (const char of line) {
    if (char === " ") columns += 1;
    else if (char === "\t") columns += 4;
    else break;
  }
  return columns;
}

function round(value: number, decimals: number): number {
  const steps = 10 ** decimals;
  return Math.round(value * steps) / steps;
}

/** The total of amounts of one kind. */
function totalOf(kind: string, amounts: readonly Amount[]): Total {
  const written = new Map<string, number>();
  for (const { unit } of amounts) written.set(unit, (written.get(unit) ?? 0) + 1);
  // A Map keeps the order units were first written in, so the first one wins a tie.
  let shown = amounts[0]!.unit;
  for (const [unit, times] of written) if (times > (written.get(shown) ?? 0)) shown = unit;

  const unit = UNITS.get(shown)!;
  const mixed = written.size > 1;
  const base = amounts.reduce((sum, amount) => sum + amount.base, 0);
  const exact = mixed ? base / unit.toBase : amounts.reduce((sum, amount) => sum + amount.value, 0);

  // One unit: as exact as the amounts were written. Several: three or four figures are plenty.
  let decimals = mixed
    ? Math.abs(exact) >= 100 ? 1 : Math.abs(exact) >= 10 ? 2 : 3
    : Math.min(6, Math.max(...amounts.map((amount) => amount.decimals)));
  if (isMoney(unit) && decimals > 0) decimals = 2;

  return { kind, unit: shown, sum: round(exact, decimals), base, count: amounts.length, decimals, mixed };
}

export function calculate(lines: readonly string[]): Sheet {
  const results: Counted[][] = lines.map(() => []);
  const groups: Group[] = [];

  let run: Member[] = [];
  let runIndent = 0;
  let fence: string | null = null;

  const closeRun = () => {
    const found = run;
    run = [];

    const byKind = new Map<string, Amount[]>();
    for (const { amount } of found) byKind.set(amount.kind, [...(byKind.get(amount.kind) ?? []), amount]);

    const totals = new Map<string, Total>();
    for (const [kind, amounts] of byKind) {
      if (amounts.length >= 2) totals.set(kind, totalOf(kind, amounts));
    }
    if (totals.size === 0) return;

    const members: Member[] = [];
    for (const member of found) {
      const total = totals.get(member.amount.kind);
      if (!total) continue;
      const share = total.kind === "%" || total.base === 0 ? null : (member.amount.base / total.base) * 100;
      results[member.line]!.push({ amount: member.amount, share });
      members.push(member);
    }
    groups.push({ lastLine: found[found.length - 1]!.line, totals: [...totals.values()], members });
  };

  lines.forEach((text, index) => {
    const marker = FENCE.exec(text)?.[1];
    if (fence) {
      if (marker && marker[0] === fence[0] && marker.length >= fence.length) fence = null;
      return;
    }
    if (marker) {
      closeRun();
      fence = marker;
      return;
    }

    if (text.trim() === "") return;
    if (HEADING.test(text) || RULE.test(text)) {
      closeRun();
      return;
    }

    const amounts = findAmounts(text);
    if (amounts.length > 0) {
      for (const amount of amounts) run.push({ line: index, amount });
      runIndent = indentOf(text);
      return;
    }
    // A note indented under a line with amounts belongs to it, and doesn't end the sum.
    if (run.length > 0 && indentOf(text) > runIndent) return;
    closeRun();
  });
  closeRun();

  return { lines: results, groups };
}

// ---------- Showing results ----------

/** What goes before and after a number in this unit: "$" and "", or "" and " kg". */
export function unitAffixes(unitKey: string, value: number): { before: string; after: string } {
  const unit = UNITS.get(unitKey);
  if (!unit) return { before: "", after: unitKey ? ` ${unitKey}` : "" };
  if (unit === PERCENT) return { before: "", after: "%" };
  if (unit.symbol) return { before: unit.symbol, after: "" };
  return { before: "", after: ` ${value === 1 ? unit.key : unit.plural}` };
}

/** "90 g", "2.42 cups", "$17.50" or "100%". */
export function formatAmount(value: number, unitKey: string, decimals = 3): string {
  const unit = UNITS.get(unitKey);
  const number = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: decimals,
    minimumFractionDigits: unit && isMoney(unit) ? decimals : 0,
  }).format(value);
  const { before, after } = unitAffixes(unitKey, value);
  return `${before}${number}${after}`;
}

export function formatTotal(total: Total): string {
  return formatAmount(total.sum, total.unit, total.decimals);
}

/** "47.8%". */
export function formatShare(share: number): string {
  return `${share.toFixed(1)}%`;
}

// ---------- Changing a total ----------

/**
 * The values scaled so they add up to `target`, keeping their proportions.
 * They are rounded to whole numbers when that keeps two significant figures
 * of the smallest one, and to more places when it doesn't, between
 * `minDecimals` and `maxDecimals`. The rounding is shared out so the sum is
 * exactly the target. Null when there is nothing to scale: a zero sum, or a
 * target that isn't above zero.
 */
export function rescale(
  values: readonly number[],
  target: number,
  minDecimals = 0,
  maxDecimals = 6,
): { values: number[]; decimals: number } | null {
  const sum = values.reduce((total, value) => total + value, 0);
  if (!(sum > 0) || !(target > 0) || !Number.isFinite(target)) return null;

  const scaled = values.map((value) => (value * target) / sum);
  const smallest = Math.min(...scaled.filter((value) => value > 0));
  const forDetail = Math.max(0, 1 - Math.floor(Math.log10(smallest)));
  const decimals = Math.min(maxDecimals, Math.max(minDecimals, Math.min(3, forDetail)));

  // In steps of the last decimal place: round down, then hand the steps that
  // are left to the values that lost the most.
  const steps = 10 ** decimals;
  const exact = scaled.map((value) => value * steps);
  const rounded = exact.map((value) => Math.floor(value + 1e-9));
  const left = Math.round(target * steps) - rounded.reduce((total, value) => total + value, 0);
  if (left < 0 || left > values.length) {
    return { values: exact.map((value) => Math.round(value) / steps), decimals };
  }
  exact
    .map((value, index) => ({ index, lost: value - rounded[index]! }))
    .sort((a, b) => b.lost - a.lost)
    .slice(0, left)
    .forEach(({ index }) => (rounded[index]! += 1));

  return { values: rounded.map((value) => value / steps), decimals };
}

/**
 * Amounts in different units, scaled so they add up to `targetBase`. Each
 * keeps its own unit and three significant figures. What rounding leaves over
 * goes to an amount in the finest unit, where it shows least.
 */
function rescaleMixed(amounts: readonly Amount[], targetBase: number): { value: number; decimals: number }[] | null {
  const sumBase = amounts.reduce((total, amount) => total + amount.base, 0);
  if (!(sumBase > 0) || !(targetBase > 0) || !Number.isFinite(targetBase)) return null;

  const factor = targetBase / sumBase;
  const scaled = amounts.map((amount) => {
    const exact = amount.value * factor;
    const forDetail = exact > 0 ? Math.min(3, Math.max(0, 2 - Math.floor(Math.log10(exact)))) : 0;
    const decimals = Math.min(6, Math.max(amount.decimals, forDetail));
    return { value: round(exact, decimals), decimals };
  });

  const toBase = (index: number) => amounts[index]!.base / amounts[index]!.value;
  const reached = scaled.reduce((total, { value }, index) => total + (value > 0 ? value * toBase(index) : 0), 0);
  let finest = -1;
  scaled.forEach(({ value }, index) => {
    if (value > 0 && (finest < 0 || toBase(index) < toBase(finest))) finest = index;
  });
  if (finest >= 0) {
    const decimals = Math.min(6, scaled[finest]!.decimals + 1);
    const adjusted = round(scaled[finest]!.value + (targetBase - reached) / toBase(finest), decimals);
    if (adjusted > 0) scaled[finest] = { value: adjusted, decimals };
  }
  return scaled;
}

/** A number as it goes back into the text: no thousands marks, and no trailing zeros unless they're kept. */
export function writeNumber(value: number, decimals: number, mark: DecimalMark = ".", keepZeros = false): string {
  const fixed = value.toFixed(decimals);
  const trimmed = keepZeros || !fixed.includes(".") ? fixed : fixed.replace(/\.?0+$/, "");
  return mark === "," ? trimmed.replace(".", ",") : trimmed;
}

/**
 * The numbers to write in place of each amount so the sum becomes `typed`, a
 * number in the total's own unit. Null when there is nothing to scale.
 */
export function rescaleAmounts(amounts: readonly Amount[], total: Total, typed: WrittenNumber): string[] | null {
  const unit = UNITS.get(total.unit);
  if (!unit || amounts.length === 0) return null;
  // Numbers go back with the decimal mark the note already uses.
  const mark = amounts.map((amount) => amount.mark).find((used) => used !== null) ?? typed.mark ?? ".";

  if (total.mixed) {
    const scaled = rescaleMixed(amounts, typed.value * unit.toBase);
    return scaled?.map(({ value, decimals }) => writeNumber(value, decimals, mark)) ?? null;
  }

  const values = amounts.map((amount) => amount.value);
  let minDecimals = Math.max(typed.decimals, ...amounts.map((amount) => amount.decimals));
  let maxDecimals = 6;
  if (isMoney(unit)) {
    // Money is whole or to the cent, never in between.
    const sum = values.reduce((a, b) => a + b, 0);
    const smallest = Math.min(...values.filter((value) => value > 0)) * (typed.value / sum);
    minDecimals = minDecimals > 0 || smallest < 10 ? 2 : 0;
    maxDecimals = 2;
  }
  const scaled = rescale(values, typed.value, minDecimals, maxDecimals);
  if (!scaled) return null;
  const keepZeros = isMoney(unit) && scaled.decimals > 0;
  return scaled.values.map((value) => writeNumber(value, scaled.decimals, mark, keepZeros));
}
