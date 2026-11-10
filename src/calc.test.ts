import { describe, expect, test } from "vitest";
import {
  calculate,
  findAmounts,
  formatShare,
  formatTotal,
  parseNumber,
  readNumber,
  rescale,
  rescaleAmounts,
  writeNumber,
} from "./calc";

const amounts = (line: string) =>
  findAmounts(line).map((found) => `${found.value}|${found.unit}|${line.slice(found.from, found.to)}`);

const sheet = (doc: string) => calculate(doc.split("\n"));

const totals = (doc: string) => sheet(doc).groups.map((group) => group.totals.map(formatTotal).join(", "));

const shares = (doc: string) =>
  sheet(doc).lines.map((line) => line.map((counted) => (counted.share === null ? null : formatShare(counted.share))));

/** The doc after its first total is changed to `typed`. */
const retotal = (doc: string, typed: string, which = 0) => {
  const lines = doc.split("\n");
  const [group] = calculate(lines).groups;
  const total = group?.totals[which];
  if (!group || !total) return null;
  const members = group.members.filter((member) => member.amount.kind === total.kind);
  const written = rescaleAmounts(
    members.map((member) => member.amount),
    total,
    readNumber(typed),
  );
  if (!written) return null;
  // From the last amount back, so earlier offsets stay right.
  members
    .map((member, index) => ({ ...member, text: written[index]! }))
    .reverse()
    .forEach(({ line, amount, text }) => {
      lines[line] = lines[line]!.slice(0, amount.numberFrom) + text + lines[line]!.slice(amount.numberTo);
    });
  return lines.join("\n");
};

describe("findAmounts", () => {
  test.each([
    ["46g cocoa powder and 37g Cocoa butter", ["46|g|46g", "37|g|37g"]],
    ["43 g cocoa powder", ["43|g|43 g"]],
    ["- [ ] 250 ml milk", ["250|ml|250 ml"]],
    ["**43g** cocoa powder (plus 2g salt)", ["43|g|43g", "2|g|2g"]],
    ["We used 43g of cocoa powder today.", ["43|g|43g"]],
    ["Cream, 80g, and butter: 12,5 g.", ["80|g|80g", "12.5|g|12,5 g"]],
    ["1,000 g flour and 1.5kg sugar", ["1000|g|1,000 g", "1.5|kg|1.5kg"]],
    ["70% cocoa, 30 % sugar", ["70|%|70%", "30|%|30 %"]],
    ["500 Grams butter and 0.5 L water", ["500|g|500 Grams", "0.5|l|0.5 L"]],
    ["| cocoa powder | 43g |", ["43|g|43g"]],
  ])("%s", (line, expected) => {
    expect(amounts(line)).toEqual(expected);
  });

  test.each([
    ["2 cups flour, 3 tbsp sugar, 1 tsp. salt", ["2|cup|2 cups", "3|tbsp|3 tbsp", "1|tsp|1 tsp"]],
    ["8 fl oz milk and 1 pint cream", ["8|fl oz|8 fl oz", "1|pt|1 pint"]],
    ["1 lb butter, 4 ounces chocolate", ["1|lb|1 lb", "4|oz|4 ounces"]],
    ["Rest 45 minutes, then bake 1.5 hours", ["45|min|45 minutes", "1.5|h|1.5 hours"]],
    ["Plank 30s, rest 2 min", ["30|s|30s", "2|min|2 min"]],
    ["A shelf of 120cm, 2 m and 5in", ["120|cm|120cm", "2|m|2 m", "5|in|5in"]],
    ["A 12 m² room and 4 sq ft of tile", ["12|m²|12 m²", "4|ft²|4 sq ft"]],
    ["250 kcal plus 120 calories", ["250|kcal|250 kcal", "120|kcal|120 calories"]],
    ["A 60W bulb and a 2 kW heater", ["60|W|60W", "2|kW|2 kW"]],
    ["500 MB of photos, 2 GB of video", ["500|MB|500 MB", "2|GB|2 GB"]],
    ["2 dozen eggs and 6 pcs of fruit", ["2|dozen|2 dozen", "6|pcs|6 pcs"]],
    ["$12.50 coffee, 3 € bread, £4, 20 TND", ["12.5|USD|$12.50", "3|EUR|3 €", "4|GBP|£4", "20|TND|20 TND"]],
    ["€ 1.000,50 rent", ["1000.5|EUR|€ 1.000,50"]],
  ])("%s", (line, expected) => {
    expect(amounts(line)).toEqual(expected);
  });

  test.each([
    "Melt the butter first",
    "3 eggs and 2 lemons",
    "Done in 2024, at 10:30",
    "3D printers and the 2nd batch",
    "Use 1-2g of salt",
    "Run `add 43g` again",
    "See https://example.com/43g and [the notes](notes/5g.md)",
    "Version v2g",
    "A 5G phone with 5M users",
    "Up at 5 in the morning",
    "Music of the 1990s",
    "I will 5 try it, about 2 mb",
    "$5k budget",
    "",
  ])("no amount in %j", (line) => {
    expect(amounts(line)).toEqual([]);
  });
});

describe("parseNumber", () => {
  test.each([
    ["43", 43],
    ["1.5", 1.5],
    ["1,5", 1.5],
    ["1,000", 1000],
    ["1,000,000", 1000000],
    ["1.000,5", 1000.5],
    ["0,125", 0.125],
  ])("%s", (raw, expected) => {
    expect(parseNumber(raw)).toBe(expected);
  });
});

describe("readNumber", () => {
  test("keeps how the number was written", () => {
    expect(readNumber("12,5")).toEqual({ value: 12.5, decimals: 1, mark: "," });
    expect(readNumber("0.125")).toEqual({ value: 0.125, decimals: 3, mark: "." });
    expect(readNumber("1,000")).toEqual({ value: 1000, decimals: 0, mark: null });
    expect(readNumber("43")).toEqual({ value: 43, decimals: 0, mark: null });
  });
});

describe("calculate", () => {
  test("two amounts on one line", () => {
    const doc = "46g cocoa powder and 37g Cocoa butter";
    expect(totals(doc)).toEqual(["83 g"]);
    expect(shares(doc)).toEqual([["55.4%", "44.6%"]]);
  });

  test("one amount per line, with blank lines between the lines", () => {
    const doc = "43g cocoa powder\n\n37g Cocoa butter\n\n10g powdered sugar";
    expect(totals(doc)).toEqual(["90 g"]);
    expect(shares(doc)).toEqual([["47.8%"], [], ["41.1%"], [], ["11.1%"]]);
    expect(sheet(doc).groups[0]?.lastLine).toBe(4);
  });

  test("lines that follow each other add up together", () => {
    const doc = "46g cocoa powder and 37g Cocoa butter\nSweeten with 10g powdered sugar.";
    expect(totals(doc)).toEqual(["93 g"]);
  });

  test("a list and a table work the same way", () => {
    expect(totals("- 43g cocoa powder\n- 37g cocoa butter\n- 10g powdered sugar")).toEqual(["90 g"]);
    expect(totals("| Ingredient | Amount |\n| --- | --- |\n| Cocoa | 43g |\n| Butter | 37g |")).toEqual(["80 g"]);
  });

  test("a heading or a line with no amount starts a new sum", () => {
    const doc =
      "Chocolate bar\n46g cocoa powder and 37g cocoa butter\nTemper and pour.\n\nGanache\n100g cream, 80g chocolate\n\n## Notes\n5g salt";
    expect(totals(doc)).toEqual(["83 g", "180 g"]);
  });

  test("a note indented under a line with amounts doesn't end the sum", () => {
    expect(totals("- 43g cocoa powder\n  - Dutch processed\n- 37g cocoa butter")).toEqual(["80 g"]);
  });

  test("kinds are summed apart, and a kind that appears once gets no total", () => {
    const doc = "43g cocoa and 37g butter\n200ml water";
    expect(totals(doc)).toEqual(["80 g"]);
    expect(shares(doc)).toEqual([["53.8%", "46.3%"], []]);
    expect(sheet(doc).groups[0]?.lastLine).toBe(1);
  });

  test("a single amount has nothing to add up", () => {
    expect(sheet("43g cocoa powder\n\nMelt it slowly.").groups).toEqual([]);
  });

  test("percentages add up and have no share", () => {
    const doc = "70% cocoa and 30% sugar";
    expect(totals(doc)).toEqual(["100%"]);
    expect(shares(doc)).toEqual([[null, null]]);
  });

  test("amounts in headings and code blocks are left alone", () => {
    expect(sheet("# 43g and 37g\n```\n43g cocoa\n37g butter\n```").groups).toEqual([]);
  });

  test("decimal sums are tidy", () => {
    expect(totals("0.1 kg salt and 0.2 kg sugar")).toEqual(["0.3 kg"]);
  });

  test("a group lists the amounts behind its totals, with their lines", () => {
    const [group] = sheet("43g cocoa and 37g butter\n200ml water\n\n10g sugar").groups;
    expect(group?.members.map((member) => [member.line, member.amount.value])).toEqual([
      [0, 43],
      [0, 37],
      [3, 10],
    ]);
  });
});

describe("mixing units", () => {
  test("units of one kind add up, in the unit written most", () => {
    const doc = "1 kg flour\n500 g sugar\n10 g salt";
    expect(totals(doc)).toEqual(["1,510 g"]);
    expect(shares(doc)).toEqual([["66.2%"], ["33.1%"], ["0.7%"]]);
  });

  test("the first unit written wins a tie", () => {
    expect(totals("1 kg flour and 500 g sugar")).toEqual(["1.5 kg"]);
    expect(totals("500 g sugar and 1 kg flour")).toEqual(["1,500 g"]);
  });

  test("metric and US measures mix", () => {
    expect(totals("1 lb butter and 200 g sugar")).toEqual(["1.441 lb"]);
    expect(totals("2 cups milk, 100 ml cream")).toEqual(["2.423 cups"]);
    expect(totals("3 tsp vanilla and 1 tbsp rum")).toEqual(["6 tsp"]);
    expect(totals("8 fl oz milk, 1 cup water")).toEqual(["16 fl oz"]);
  });

  test("time, length, area, energy, power, data and pieces", () => {
    expect(totals("Rest 45 minutes, then bake 1.5 hours")).toEqual(["135 min"]);
    expect(totals("90s plank and 2 min rest, 3 min walk")).toEqual(["6.5 min"]);
    expect(totals("A shelf of 120cm and one of 2 m")).toEqual(["320 cm"]);
    expect(totals("12 m² bedroom, 20 m² lounge")).toEqual(["32 m²"]);
    expect(totals("250 kcal lunch, 120 calories snack")).toEqual(["370 kcal"]);
    expect(totals("A 60W bulb and a 2 kW heater")).toEqual(["2,060 W"]);
    expect(totals("500 MB of photos, 2 GB of video")).toEqual(["2,500 MB"]);
    expect(totals("2 dozen eggs and 6 pcs of fruit")).toEqual(["2.5 dozen"]);
  });

  test("each kind keeps its own total", () => {
    expect(totals("1 kg flour, 500 g sugar, 250 ml milk, 1 cup water, bake 20 min, rest 1 h")).toEqual([
      "1.5 kg, 486.6 ml, 80 min",
    ]);
  });

  test("money adds up per currency, with no exchange between them", () => {
    expect(totals("$12.50 coffee and $3 tip")).toEqual(["$15.50"]);
    expect(totals("Rent 800 EUR, power 45.5 €, phone €20")).toEqual(["€865.50"]);
    expect(totals("$10 lunch, 5 € bread, 20 TND taxi, 15 TND tip")).toEqual(["35 TND"]);
    expect(shares("$30 and $10")).toEqual([["75.0%", "25.0%"]]);
  });
});

describe("changing a total", () => {
  test("one unit: proportions kept, the sum exact", () => {
    expect(retotal("46g cocoa powder and 37g Cocoa butter", "500")).toBe("277g cocoa powder and 223g Cocoa butter");
    expect(retotal("- 43g cocoa\n- 37g butter\n- 10g sugar", "100")).toBe("- 48g cocoa\n- 41g butter\n- 11g sugar");
    expect(retotal("Butter: 12,5 g and cream: 37,5 g", "100")).toBe("Butter: 25 g and cream: 75 g");
  });

  test("mixed units: each amount keeps its unit", () => {
    const doubled = retotal("1 kg flour and 500 g sugar", "3");
    expect(doubled).toBe("2 kg flour and 1000 g sugar");
    expect(totals(doubled ?? "")).toEqual(["3 kg"]);

    const odd = retotal("1 kg flour and 500 g sugar", "2");
    expect(odd).toBe("1.33 kg flour and 670 g sugar");
    expect(totals(odd ?? "")).toEqual(["2 kg"]);
  });

  test("mixed measures land on the total that was typed", () => {
    const scaled = retotal("2 cups milk, 100 ml cream", "5");
    expect(totals(scaled ?? "")).toEqual(["5 cups"]);
  });

  test("money stays whole or to the cent", () => {
    expect(retotal("$12.50 coffee and $3 tip", "31")).toBe("$25.00 coffee and $6.00 tip");
    expect(retotal("Rent 800 EUR and food 200 EUR", "1500")).toBe("Rent 1200 EUR and food 300 EUR");
  });

  test("another kind in the same sum is left alone", () => {
    expect(retotal("100 g flour, 50 g sugar, 20 min rest, 10 min bake", "300")).toBe(
      "200 g flour, 100 g sugar, 20 min rest, 10 min bake",
    );
    expect(retotal("100 g flour, 50 g sugar, 20 min rest, 10 min bake", "60", 1)).toBe(
      "100 g flour, 50 g sugar, 40 min rest, 20 min bake",
    );
  });

  test("nothing to scale", () => {
    expect(retotal("46g cocoa and 37g butter", "0")).toBeNull();
  });
});

describe("rescale", () => {
  const scaled = (values: number[], target: number, minDecimals?: number) => rescale(values, target, minDecimals)?.values;
  const sum = (values: number[] | undefined) => Math.round((values ?? []).reduce((a, b) => a + b, 0) * 1e6) / 1e6;

  test("keeps proportions and lands on the target", () => {
    expect(scaled([46, 37], 500)).toEqual([277, 223]);
    expect(scaled([43, 37, 10], 100)).toEqual([48, 41, 11]);
    expect(scaled([43, 37, 10], 180)).toEqual([86, 74, 20]);
  });

  test("uses decimals when whole numbers would lose the proportions", () => {
    expect(scaled([46, 37], 5)).toEqual([2.8, 2.2]);
    expect(scaled([70, 29, 1], 10)).toEqual([7, 2.9, 0.1]);
  });

  test("never fewer decimals than asked for", () => {
    expect(scaled([12.5, 37.5], 100, 1)).toEqual([25, 75]);
    expect(scaled([1, 2], 10, 2)).toEqual([3.33, 6.67]);
  });

  test("the result always adds up to the target", () => {
    for (const target of [1, 7, 99.5, 250, 1000, 12345]) {
      expect(sum(scaled([43, 37, 10, 3.5, 0.25], target, 1))).toBe(target);
    }
  });

  test("nothing to scale", () => {
    expect(rescale([0, 0], 100)).toBeNull();
    expect(rescale([46, 37], 0)).toBeNull();
    expect(rescale([46, 37], Number.NaN)).toBeNull();
  });
});

describe("writeNumber", () => {
  test.each([
    [277, 0, ".", false, "277"],
    [2.8, 1, ".", false, "2.8"],
    [25, 1, ".", false, "25"],
    [3.33, 2, ",", false, "3,33"],
    [100, 0, ",", false, "100"],
    [6, 2, ".", true, "6.00"],
  ] as const)("%s", (value, decimals, mark, keepZeros, expected) => {
    expect(writeNumber(value, decimals, mark, keepZeros)).toBe(expected);
  });
});
