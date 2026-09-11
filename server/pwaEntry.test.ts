import { describe, expect, it } from "vitest";
import { pwaEntryFromSearch } from "../shared/pwaEntry";

describe("PWA manifest entry intent", () => {
  it("opens the task composer only for the allowlisted task value", () => {
    expect(pwaEntryFromSearch("?compose=task&source=pwa-shortcut")).toEqual({
      composeTask: true,
      surface: null,
      cleanedSearch: "",
    });
    expect(pwaEntryFromSearch("?compose=goal&source=pwa-shortcut")).toEqual({
      composeTask: false,
      surface: null,
      cleanedSearch: "?compose=goal",
    });
  });

  it("recognizes Today and removes the consumed shortcut parameter", () => {
    expect(pwaEntryFromSearch("?surface=today&source=pwa-shortcut")).toEqual({
      composeTask: false,
      surface: "today",
      cleanedSearch: "",
    });
  });

  it("removes handled PWA parameters without deleting unrelated parameters", () => {
    expect(pwaEntryFromSearch("?utm_source=home&compose=task&source=pwa-shortcut&q=walk")).toEqual({
      composeTask: true,
      surface: null,
      cleanedSearch: "?utm_source=home&q=walk",
    });
  });

  it("does not consume ordinary application URLs", () => {
    expect(pwaEntryFromSearch("?create=task&surface=tasks")).toEqual({
      composeTask: false,
      surface: null,
      cleanedSearch: "?create=task&surface=tasks",
    });
  });
});
