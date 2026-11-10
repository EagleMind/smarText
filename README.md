# smarText

A Markdown editor that adds up the amounts you write.

Live at https://smartext.hassen-ben-mbarek.workers.dev, with a [guide](https://smartext.hassen-ben-mbarek.workers.dev/guide/).

## What it is

smarText is a note editor for writing that has numbers in it: recipes, mixes and formulas, shopping lists, workouts, cutting lists. You write the way you would on paper, and the note does the arithmetic.

Write "46g cocoa powder and 37g Cocoa butter" and it shows each amount's share (55.4% and 44.6%) and "83 g in total" underneath. There are no formulas, no cells and nothing to set up.

- **It reads plain text.** Amounts count wherever they are: in a sentence, a list or a table.
- **Units mix.** 1 kg and 500 g make 1.5 kg; 2 cups and 100 ml make 2.42 cups. It knows weight, volume, length, area, time, energy, power, data, pieces and money.
- **Totals work both ways.** Change "83 g in total" to 500 and every amount is rescaled in proportion, which is how you scale a recipe.
- **Your text stays yours.** Shares and totals are drawn on top of the note and are not written into the Markdown. The note is saved in your browser, with no account and no server.

Built on [nethermark](https://github.com/Netherstone-HQ/nethermark), a Markdown source editor for CodeMirror 6.

## Run it

Needs Node.js 22 or later.

```bash
npm install
```

```bash
npm run dev
```

Then open the address Vite prints, usually http://localhost:5173.

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the editor with live reload |
| `npm test` | Runs the calculation tests |
| `npm run build` | Type-checks, then builds to `dist/` |
| `npm run preview` | Serves the built `dist/` |
| `npm run deploy` | Builds, then publishes to Cloudflare |
| `npm run images` | Redraws the share card and app icons in `public/` |

Your note is saved in the browser's local storage, on that device only.

## Deploy

The site is a Cloudflare Worker named `smartext` that serves the built pages as static assets. There is no server code. The settings are in `wrangler.jsonc`.

```bash
npx wrangler login
```

```bash
npm run deploy
```

The site's address is written in three places, for canonical links, share cards and the sitemap. Change all three when it moves, for example to a custom domain:

- `.env` (`VITE_SITE_URL`)
- `public/robots.txt`
- `public/sitemap.xml`

### What search engines get

- A title, description and canonical link on each page, plus Open Graph and Twitter card tags with a share image (`public/og.png`).
- Structured data: `WebApplication` on the editor, `FAQPage` and `BreadcrumbList` on the guide.
- A guide page at `/guide/` in plain HTML, readable without running the app.
- `robots.txt`, `sitemap.xml`, a web manifest, icons and a 404 page.

## How sums work

- **Amounts.** A number with a unit, a currency or a `%`, anywhere in the text: `46g`, `2 cups`, `45 minutes`, `$12.50`, `20%`. A bare number such as "3 eggs" or "2024" is not an amount.
- **What adds up.** Amounts on the same line and on the lines that follow, even across blank lines. A heading, a rule, a code block or a line with no amount in it starts a new sum.
- **Shares.** Each amount shows its part of the total as a small tag. Percentages have no share.
- **Totals.** The total appears under the last line of the sum. A kind of unit gets a total only when it appears at least twice.
- **Lists and tables** work the same way as sentences.
- **Not counted.** Amounts in headings, code blocks, inline code, URLs and link targets.

### Units

| Kind | Units |
| --- | --- |
| Weight | µg, mg, g, kg, tonne, oz, lb, stone |
| Volume | µl, ml, cl, dl, l, cm³, m³, tsp, tbsp, fl oz, cup, pint, quart, gallon |
| Length | mm, cm, m, km, inch, ft, yd, mile |
| Area | mm², cm², m², km², hectare, acre, sq ft |
| Time | ms, s, min, h, day, week |
| Energy | J, kJ, kcal, Wh, kWh |
| Power | W, kW, MW |
| Data | KB, MB, GB, TB |
| Pieces | pcs, dozen |
| Money | $, €, £, ¥, ₹ and currency codes such as USD, EUR, TND |

Full words work too: "4 ounces", "2 tablespoons", "45 minutes".

- **Units of one kind mix.** 1 kg and 500 g make 1.5 kg; 2 cups and 100 ml make 2.42 cups.
- **The total's unit** is the one written most often in the sum, or the first one written when it's a tie.
- **Each kind has its own total**, so one sum can end with "1,520 g, 2.61 cups, and 140 min in total".
- **Currencies are never exchanged.** Dollars and euros add up apart.
- **Cups, spoons, pints and gallons are US measures.** A cup is 236.6 ml.
- **"cal" is the food calorie**, a kilocalorie.
- **Ambiguous short forms are ignored:** "5 in the morning", "5G", "5M", "the 1990s". Written together, "5in" is inches.

### Changing a total

Click a total, type a new value and press Enter. Every amount in that sum is rewritten in proportion, as one undo step. Escape or clicking away cancels.

- Each amount keeps its own unit, spacing and decimal mark.
- Only amounts of that kind change: a new weight leaves the minutes alone.
- Amounts in one unit always add up to exactly what you typed. Amounts in mixed units are rounded to about three figures each.
- Money is written whole or to the cent.

Scaling far down and back up loses some precision, because the rounded numbers are what go into the note. Undo is the safe way back.

## Code

| File | What it holds |
| --- | --- |
| `src/calc.ts` | The calculation, with no editor in it: the unit table, finding amounts, sums, shares and rescaling |
| `src/calc.test.ts` | Its tests |
| `src/calculator.ts` | The CodeMirror extension that draws shares and totals and makes totals editable |
| `src/main.ts` | Builds the editor, the theme, saving and the status line |
| `src/style.css` | The page around the editor |
| `index.html` | The editor page, with the help panel and its search tags |
| `guide/index.html` | The guide page |
| `public/` | Files served as they are: icons, share card, robots, sitemap, headers, 404 |
| `scripts/images.mjs` | Draws the share card and icons |
| `wrangler.jsonc` | The Cloudflare Worker settings |

To add a unit, add a row to `KINDS` in `src/calc.ts`: its name, how many base units it is, and the ways it can be written.

## Not done yet

- Counted things, like "3 eggs"
- Metric or UK cups, spoons and pints
- Months and years
- More than one note
