import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CheckButton, checkButtonLabel } from "./CheckButton";

describe("CheckButton", () => {
  it("names the action and the task, and carries a block reason in the name", () => {
    expect(checkButtonLabel({ title: "Pay rent", checked: false })).toBe("Complete Pay rent");
    expect(checkButtonLabel({ title: "Pay rent", checked: true })).toBe("Reopen Pay rent");
    expect(checkButtonLabel({ title: "Pay rent", checked: false, blockedReason: "Waiting on 1 task." })).toBe("Complete Pay rent. Waiting on 1 task.");
  });

  it("does not celebrate on first paint, even when already checked", () => {
    const html = renderToStaticMarkup(<CheckButton title="Pay rent" checked onToggle={() => {}} />);
    expect(html).toContain("is-checked");
    expect(html).not.toContain("is-celebrating");
  });

  it("keeps a guarded check focusable but aria-disabled, with the reason as tooltip and name", () => {
    const html = renderToStaticMarkup(<CheckButton title="Pay rent" checked={false} blockedReason="Waiting on 1 task." onToggle={() => {}} />);
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain("is-blocked");
    expect(html).toContain('title="Waiting on 1 task."');
    expect(html).toContain("Complete Pay rent. Waiting on 1 task.");
    expect(html).not.toMatch(/ disabled(=|>| )/);
  });

  it("does not treat a checked task as blocked", () => {
    const html = renderToStaticMarkup(<CheckButton title="Pay rent" checked blockedReason="x" onToggle={() => {}} />);
    expect(html).not.toContain("is-blocked");
    expect(html).toContain('aria-label="Reopen Pay rent"');
  });

  it("is aria-disabled when inert or pending and takes its tone from the category", () => {
    expect(renderToStaticMarkup(<CheckButton title="t" checked={false} inert onToggle={() => {}} />)).toContain('aria-disabled="true"');
    expect(renderToStaticMarkup(<CheckButton title="t" checked={false} pending onToggle={() => {}} />)).toContain('aria-disabled="true"');
    expect(renderToStaticMarkup(<CheckButton title="t" checked={false} tone="health" onToggle={() => {}} />)).toContain("pc-tone-health");
  });
});
