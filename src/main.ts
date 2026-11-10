import { createMarkdownEditor, extendTheme, themes } from "@netherstone/nethermark";
import { calculator } from "./calculator";
import "./style.css";

const STORE_KEY = "smartext:doc";

const SAMPLE = `# Chocolate

46g cocoa powder and 37g Cocoa butter

## As a list

- 43g cocoa powder
- 37g cocoa butter
- 10g powdered sugar
`;

/**
 * Netherstone's colors, set in Atkinson Hyperlegible: its figures and letters
 * are hard to mistake for one another, which matters when the text is amounts.
 */
const type = {
  fontFamily: '"Atkinson Hyperlegible Next", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  monoFamily: '"Atkinson Hyperlegible Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  fontSize: "17px",
  lineHeight: "1.7",
  headingScale: "1.12",
  radius: "8px",
  // A page of prose reads calmer without a band on the current line.
  activeLine: "transparent",
} as const;

const theme = {
  light: extendTheme(themes.light, type),
  dark: extendTheme(themes.dark, type),
};

function load(): string {
  try {
    return localStorage.getItem(STORE_KEY) ?? SAMPLE;
  } catch {
    return SAMPLE;
  }
}

/** Keeps the text on this device. Returns whether it worked. */
function save(doc: string): boolean {
  try {
    localStorage.setItem(STORE_KEY, doc);
    return true;
  } catch {
    return false;
  }
}

const app = document.querySelector<HTMLElement>("#app")!;
const saved = document.querySelector<HTMLElement>("#saved")!;
const words = document.querySelector<HTMLElement>("#words")!;

function showStatus(doc: string, kept: boolean): void {
  const count = doc.trim() === "" ? 0 : doc.trim().split(/\s+/).length;
  words.textContent = count === 1 ? "1 word" : `${count} words`;
  saved.textContent = kept ? "Saved on this device" : "Not saved. This browser has storage turned off.";
  saved.classList.toggle("is-problem", !kept);
}

const editor = createMarkdownEditor({
  parent: app,
  doc: load(),
  theme,
  lineNumbers: false,
  ariaLabel: "Note",
  placeholder: "Write as you normally would. Amounts like 46g or 20% add up as you go.",
  extensions: [calculator()],
  onChange: (doc) => showStatus(doc, save(doc)),
});

// The page's own parts go inside the editor's root, where they read the theme's
// tokens and follow light and dark with it: name, toolbar, help, text, status.
const root = editor.view.dom.parentElement!;
const toolbar = root.querySelector<HTMLElement>(".nme-toolbar");
const brand = app.querySelector<HTMLElement>(":scope > .brand")!;
const actions = app.querySelector<HTMLElement>(":scope > .actions")!;
if (toolbar) {
  toolbar.before(brand);
  toolbar.after(actions);
} else {
  root.prepend(brand, actions);
}
root.append(...app.querySelectorAll<HTMLElement>(":scope > .help, :scope > .status"));

// A click in the margins beside the text column puts the cursor back in the text.
editor.view.scrollDOM.addEventListener("mousedown", (event) => {
  if (event.target !== editor.view.scrollDOM) return;
  event.preventDefault();
  editor.focus();
});

const initial = editor.getValue();
showStatus(initial, save(initial));
editor.focus();
