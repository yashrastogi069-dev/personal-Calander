import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ChipMultiSelect, ChipSelect, firstEnabledIndex, lastEnabledIndex, nextEnabledIndex, typeaheadIndex } from "./ChipSelect";

const options = [
  { value: "manual", label: "Manual" },
  { value: "due", label: "Deadline", disabled: true },
  { value: "priority", label: "Priority" },
  { value: "created", label: "Created" },
];

describe("ChipSelect keyboard helpers", () => {
  it("skips disabled options and clamps at the ends", () => {
    expect(nextEnabledIndex(options, 0, 1)).toBe(2);
    expect(nextEnabledIndex(options, 3, 1)).toBe(3);
    expect(nextEnabledIndex(options, 2, -1)).toBe(0);
    expect(nextEnabledIndex(options, 0, -1)).toBe(0);
    expect(firstEnabledIndex(options)).toBe(0);
    expect(lastEnabledIndex(options)).toBe(3);
    expect(firstEnabledIndex([{ disabled: true }])).toBe(-1);
  });

  it("types ahead, and cycles when one letter repeats", () => {
    expect(typeaheadIndex(options, "pr", 0)).toBe(2);
    expect(typeaheadIndex(options, "c", 0)).toBe(3);
    expect(typeaheadIndex(options, "d", 0)).toBe(-1);
    expect(typeaheadIndex(options, "zz", 0)).toBe(-1);
    expect(typeaheadIndex(options, "", 0)).toBe(-1);
    const repeated = [{ label: "Alpha" }, { label: "Alps" }, { label: "Beta" }];
    expect(typeaheadIndex(repeated, "aa", 0)).toBe(1);
  });
});

describe("ChipSelect markup", () => {
  it("is a listbox button that carries its label and value in the accessible name", () => {
    const html = renderToStaticMarkup(<ChipSelect label="Sort" showLabel value="priority" onValueChange={() => {}} options={options} />);
    expect(html).toContain('aria-haspopup="listbox"');
    expect(html).toContain('aria-label="Sort: Priority"');
    expect(html).toContain('type="button"');
    expect(html).toContain("pc-cselect-key");
  });

  it("shows the placeholder when nothing is chosen and the field variant on request", () => {
    const html = renderToStaticMarkup(<ChipSelect label="Project" variant="field" placeholder="No project" value={null} onValueChange={() => {}} options={options} />);
    expect(html).toContain("is-field");
    expect(html).toContain("is-placeholder");
    expect(html).toContain('aria-label="Project: No project"');
  });

  it("summarises a multi-select", () => {
    const html = renderToStaticMarkup(<ChipMultiSelect label="Category" values={["manual", "created"]} onValuesChange={() => {}} options={options} />);
    expect(html).toContain("Manual, Created");
    const custom = renderToStaticMarkup(<ChipMultiSelect label="Category" values={["manual", "created"]} onValuesChange={() => {}} options={options} summary={chosen => `${chosen.length} chosen`} />);
    expect(custom).toContain("2 chosen");
  });
});
