import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { phase4DefaultPreferences } from "@shared/phase4Preferences";
import { PhoneNavigation } from "./PhoneNavigation";

describe("exact phone navigation announcements", () => {
  it("highlights a parent but does not announce it as the exact child page", () => {
    const html = renderToStaticMarkup(<PhoneNavigation location={{ destination: "home", view: "overview" }} preferences={phase4DefaultPreferences} moreOpen={false} onMoreOpenChange={vi.fn()} onNavigate={vi.fn()} />);
    expect(html).toContain('class="is-active"');
    expect(html).not.toContain('aria-current="page"');
  });
  it("labels a customized child pin and reserves current for that exact location", () => {
    const html = renderToStaticMarkup(<PhoneNavigation location={{ destination: "plan", view: "weekly" }} preferences={{ ...phase4DefaultPreferences, primary: [{ destination: "plan", view: "weekly" }, { destination: "plan", view: "daily" }] }} moreOpen={false} onMoreOpenChange={vi.fn()} onNavigate={vi.fn()} />);
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(html).toContain("Weekly plan");
  });
  it("does not silently refill a deliberately unpinned primary slot", () => {
    const html = renderToStaticMarkup(<PhoneNavigation location={{ destination: "home", view: "today" }} preferences={{ ...phase4DefaultPreferences, primary: [{ destination: "home", view: "today" }] }} moreOpen={false} onMoreOpenChange={vi.fn()} onNavigate={vi.fn()} />);
    expect(html.match(/<button/g)).toHaveLength(2);
    expect(html).toContain("Today");
    expect(html).toContain("More");
    expect(html).not.toContain("Tasks</span>");
  });
});
