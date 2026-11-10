import { StateField, type EditorState, type Extension, type Range } from "@codemirror/state";
import { Decoration, EditorView, WidgetType, type DecorationSet } from "@codemirror/view";
import {
  calculate,
  formatShare,
  formatTotal,
  readNumber,
  rescaleAmounts,
  unitAffixes,
  writeNumber,
  type Sheet,
  type Total,
} from "./calc";

/**
 * The calculator as a CodeMirror extension. What it shows is not part of the
 * doc, so the Markdown stays as typed:
 *
 * - each amount that takes part in a sum is underlined,
 * - its share of the total follows it as a small tag,
 * - the total reads as a short line of text under the last line of the sum.
 *
 * A total can be changed: its amounts are then rewritten in the doc, scaled to
 * add up to the new total, as one undo step.
 */

const amountMark = Decoration.mark({ class: "st-amount" });

class ShareWidget extends WidgetType {
  constructor(readonly text: string) {
    super();
  }

  override eq(other: ShareWidget): boolean {
    return other.text === this.text;
  }

  override toDOM(): HTMLElement {
    const dom = document.createElement("span");
    dom.className = "st-share";
    dom.textContent = this.text;
    return dom;
  }

  override ignoreEvent(): boolean {
    return false;
  }
}

type Results = {
  readonly sheet: Sheet;
  readonly decorations: DecorationSet;
};

const listFormat = new Intl.ListFormat("en", { style: "long", type: "conjunction" });

/** The parts of a total line that are the calculator's own controls, not text to put a cursor in. */
const CONTROLS = ".st-total-amount, .st-total-edit";

class TotalWidget extends WidgetType {
  readonly amounts: readonly string[];

  constructor(readonly totals: readonly Total[]) {
    super();
    this.amounts = totals.map(formatTotal);
  }

  override eq(other: TotalWidget): boolean {
    return other.amounts.join("\n") === this.amounts.join("\n");
  }

  /** "83 g in total", or "83 g and 250 ml in total". Each amount is a button that changes it. */
  override toDOM(view: EditorView): HTMLElement {
    const dom = document.createElement("div");
    dom.className = "st-total";
    let index = 0;
    for (const part of listFormat.formatToParts(this.amounts)) {
      const total = part.type === "element" ? this.totals[index++] : undefined;
      if (!total) {
        dom.append(part.value);
        continue;
      }
      const button = dom.appendChild(document.createElement("button"));
      button.type = "button";
      button.className = "st-total-amount";
      button.textContent = part.value;
      button.title = "Change this total";
      button.setAttribute("aria-label", `${part.value} in total. Change this total`);
      button.addEventListener("click", () => editTotal(view, dom, button, total));
    }
    dom.append(" in total");
    return dom;
  }

  /** CodeMirror leaves the buttons and the field to themselves; a click on the rest places the cursor. */
  override ignoreEvent(event: Event): boolean {
    return event.target instanceof Element && event.target.closest(CONTROLS) !== null;
  }
}

/** Swaps a total's button for a field. Enter rescales the sum, Escape or leaving the field keeps it. */
function editTotal(view: EditorView, widget: HTMLElement, button: HTMLButtonElement, total: Total): void {
  const edit = document.createElement("span");
  edit.className = "st-total-edit";
  const input = edit.appendChild(document.createElement("input"));
  input.className = "st-total-input";
  input.type = "text";
  input.inputMode = "decimal";
  input.autocomplete = "off";
  input.value = writeNumber(total.sum, total.decimals);
  // The field sits where the number was: "$" before it, or " kg" after it.
  const { before, after } = unitAffixes(total.unit, total.sum);
  input.setAttribute("aria-label", `New total, in ${(before || after).trim()}`);
  edit.prepend(before);
  edit.append(after);

  const fit = () => (input.style.width = `${Math.max(2, input.value.length) + 1}ch`);
  let open = true;
  const close = () => {
    if (!open) return;
    open = false;
    if (edit.isConnected) edit.replaceWith(button);
  };

  input.addEventListener("input", () => {
    fit();
    input.removeAttribute("aria-invalid");
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      view.focus();
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (!rescaleTotal(view, widget, total.kind, input.value)) {
        input.setAttribute("aria-invalid", "true");
        return;
      }
      close();
      view.focus();
    }
  });
  input.addEventListener("blur", close);

  button.replaceWith(edit);
  fit();
  input.focus();
  input.select();
}

/**
 * Rewrites the amounts behind one total so they add up to what was typed.
 * Returns false when the text isn't a number above zero.
 */
function rescaleTotal(view: EditorView, widget: HTMLElement, kind: string, text: string): boolean {
  const raw = text.trim();
  if (!/^\d+(?:[.,]\d+)*$/.test(raw)) return false;

  const { doc } = view.state;
  const { sheet } = view.state.field(results);
  // The total's widget sits at the end of its sum's last line.
  const lastLine = doc.lineAt(view.posAtDOM(widget)).number - 1;
  const group = sheet.groups.find((found) => found.lastLine === lastLine);
  const total = group?.totals.find((found) => found.kind === kind);
  if (!group || !total) return false;

  // Only the amounts of this kind change: a new weight leaves the minutes alone.
  const members = group.members.filter((member) => member.amount.kind === kind);
  const written = rescaleAmounts(
    members.map((member) => member.amount),
    total,
    readNumber(raw),
  );
  if (!written) return false;

  // Each number is replaced where it stands; its unit or currency sign stays as typed.
  const changes = members
    .map(({ line, amount }, index) => {
      const start = doc.line(line + 1).from;
      return { from: start + amount.numberFrom, to: start + amount.numberTo, insert: written[index]! };
    })
    .filter((change) => doc.sliceString(change.from, change.to) !== change.insert);
  if (changes.length > 0) {
    // The cursor lands at the end of the sum, next to the total that was changed.
    const changeSet = view.state.changes(changes);
    const end = changeSet.mapPos(doc.line(lastLine + 1).to, 1);
    view.dispatch({ changes: changeSet, selection: { anchor: end }, userEvent: "input.rescale" });
  }
  return true;
}

function compute(state: EditorState): Results {
  const { doc } = state;
  const sheet = calculate(Array.from(doc.iterLines()));
  const decorations: Range<Decoration>[] = [];

  sheet.lines.forEach((counted, index) => {
    if (counted.length === 0) return;
    const line = doc.line(index + 1);
    for (const { amount, share } of counted) {
      const end = line.from + amount.to;
      decorations.push(amountMark.range(line.from + amount.from, end));
      if (share === null) continue;
      decorations.push(Decoration.widget({ widget: new ShareWidget(formatShare(share)), side: 1 }).range(end));
    }
  });

  for (const group of sheet.groups) {
    const line = doc.line(group.lastLine + 1);
    const widget = Decoration.widget({ widget: new TotalWidget(group.totals), block: true, side: 1 });
    decorations.push(widget.range(line.to));
  }

  return { sheet, decorations: Decoration.set(decorations, true) };
}

const results = StateField.define<Results>({
  create: compute,
  update: (value, transaction) => (transaction.docChanged ? compute(transaction.state) : value),
  provide: (field) => EditorView.decorations.from(field, (value) => value.decorations),
});

// Colors come from the nethermark theme's tokens, so the results follow light and dark.
const accent = "var(--nme-link)";
const tint = `color-mix(in srgb, ${accent} 12%, transparent)`;
const ring = "var(--nme-focus-ring-width) solid var(--nme-focus-ring)";

const styles = EditorView.baseTheme({
  ".st-amount": {
    textDecoration: "underline",
    textDecorationColor: `color-mix(in srgb, ${accent} 55%, transparent)`,
    textDecorationThickness: "1.5px",
    textUnderlineOffset: "3px",
  },
  // A small tag after the amount, so it reads as a note on the text and not as typed text.
  ".st-share": {
    display: "inline-block",
    marginLeft: "0.35em",
    padding: "0 0.5em",
    borderRadius: "999px",
    backgroundColor: tint,
    color: accent,
    fontSize: "0.74em",
    fontWeight: "600",
    lineHeight: "1.55",
    verticalAlign: "0.1em",
    fontVariantNumeric: "tabular-nums",
    cursor: "text",
  },
  ".st-total": {
    padding: "1px 2px 6px 6px",
    color: "var(--nme-markup)",
    fontVariantNumeric: "tabular-nums",
  },
  // The total is a button: a dotted line under it says it can be changed.
  ".st-total-amount": {
    margin: "0 -4px",
    padding: "0 4px",
    border: "0",
    borderRadius: "6px",
    background: "transparent",
    color: accent,
    font: "inherit",
    fontWeight: "700",
    textDecoration: "underline dotted",
    textDecorationColor: `color-mix(in srgb, ${accent} 60%, transparent)`,
    textUnderlineOffset: "4px",
    cursor: "pointer",
  },
  ".st-total-amount:hover": { backgroundColor: tint },
  ".st-total-amount:focus-visible": { outline: ring, outlineOffset: "1px" },
  ".st-total-edit": { color: accent, fontWeight: "700" },
  ".st-total-input": {
    boxSizing: "content-box",
    minWidth: "2ch",
    margin: "0",
    padding: "0 4px",
    border: "0",
    borderRadius: "6px",
    outline: ring,
    backgroundColor: tint,
    color: "inherit",
    font: "inherit",
    fontVariantNumeric: "tabular-nums",
  },
  // Not a number above zero: the ring turns to the text color and dashes.
  '.st-total-input[aria-invalid="true"]': { outlineStyle: "dashed", outlineColor: "var(--nme-foreground)" },
});

/** Adds live shares and totals to a Markdown editor. */
export function calculator(): Extension {
  return [results, styles];
}
