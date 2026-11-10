// Draws the share card and the app icons into public/. Run with `npm run images` after changing them.
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Resvg } from "@resvg/resvg-js";

const out = (name) => resolve(import.meta.dirname, "../public", name);
const font = "Segoe UI, Helvetica Neue, Arial, sans-serif";
const green = "#2b6a5b";

const tag = (x, y, text) => `
  <rect x="${x}" y="${y - 31}" width="118" height="42" rx="21" fill="${green}" fill-opacity="0.13"/>
  <text x="${x + 59}" y="${y}" text-anchor="middle" font-size="27" font-weight="700" fill="${green}">${text}</text>`;

const card = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" font-family="${font}">
  <rect width="1200" height="630" fill="#f6f5f2"/>
  <rect x="80" y="76" width="56" height="56" rx="14" fill="${green}"/>
  <path d="M96 98h24M96 111h24" stroke="#f6f5f2" stroke-width="5.5" stroke-linecap="round"/>
  <text x="156" y="117" font-size="40" font-weight="700" fill="#141516">smarText</text>

  <text x="80" y="262" font-size="68" font-weight="700" fill="#141516">Write it down.</text>
  <text x="80" y="344" font-size="68" font-weight="700" fill="${green}">It adds itself up.</text>

  <g font-size="38" fill="#141516">
    <text x="80" y="462">46g</text>
    <path d="M80 472h62" stroke="${green}" stroke-opacity="0.55" stroke-width="3"/>
    ${tag(156, 460, "55.4%")}
    <text x="290" y="462">cocoa powder and</text>
    <text x="612" y="462">37g</text>
    <path d="M612 472h62" stroke="${green}" stroke-opacity="0.55" stroke-width="3"/>
    ${tag(688, 460, "44.6%")}
    <text x="822" y="462">cocoa butter</text>
  </g>
  <text x="80" y="528" font-size="38"><tspan font-weight="700" fill="${green}">83 g</tspan><tspan fill="#6b6862"> in total</tspan></text>
</svg>`;

const icon = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="7" fill="${green}"/>
  <path d="M9 12.5h14M9 19.5h14" stroke="#f6f5f2" stroke-width="3" stroke-linecap="round"/>
</svg>`;

const render = (svg) => new Resvg(svg, { font: { loadSystemFonts: true } }).render().asPng();

writeFileSync(out("og.png"), render(card));
writeFileSync(out("apple-touch-icon.png"), render(icon(180)));
writeFileSync(out("icon-512.png"), render(icon(512)));
console.log("Wrote og.png, apple-touch-icon.png and icon-512.png");
