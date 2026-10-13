// Dev-only gallery for visually checking D0 primitives against the v2.1 boards. Sample labels only; no planner data.
import { useState } from "react";
import { CategoryChip, Pill, StatusPill, TimeChip } from "@/components/premium/Pills";
import { SegmentedTabs } from "@/components/premium/SegmentedTabs";
import { resolveCategoryTones } from "@/design/categoryTone";

const SAMPLE_CATEGORIES = [
  { id: "sample-work", name: "Work", color: "#2f6fe4", sortOrder: 0 },
  { id: "sample-health", name: "Health", color: "#0f9d8a", sortOrder: 1 },
  { id: "sample-learning", name: "Learning", color: "#c27612", sortOrder: 2 },
  { id: "sample-personal", name: "Personal", color: "#7a5af0", sortOrder: 3 },
  { id: "sample-social", name: "Social", color: "#e0567a", sortOrder: 4 },
];

type HomeView = "dashboard" | "today" | "calendar";

export default function PremiumGallery() {
  const [view, setView] = useState<HomeView>("dashboard");
  const tones = resolveCategoryTones(SAMPLE_CATEGORIES);
  return (
    <main className="pc-gallery" style={{ minHeight: "100vh", padding: "24px 16px", background: "var(--pc-page)", color: "var(--ink)", fontFamily: "var(--pc-font)" }}>
      <div style={{ maxWidth: 960, margin: "0 auto", display: "grid", gap: 16 }}>
        <h1 style={{ margin: 0, fontSize: "var(--pc-text-h1)", lineHeight: "var(--pc-lh-h1)", fontWeight: 750, letterSpacing: "-.03em" }}>Premium primitives</h1>
        <section className="pc-rise" style={card(0)}>
          <h2 style={h2}>Segmented tabs</h2>
          <SegmentedTabs<HomeView>
            label="Home view"
            value={view}
            onValueChange={setView}
            items={[
              { value: "dashboard", label: "Dashboard" },
              { value: "today", label: "Today", badge: 3 },
              { value: "calendar", label: "Calendar" },
            ]}
          />
        </section>
        <section className="pc-rise" style={card(1)}>
          <h2 style={h2}>Category chips</h2>
          <div style={row}>
            {SAMPLE_CATEGORIES.map(category => <CategoryChip key={category.id} category={category} tone={tones.get(category.id)} />)}
            <Pill>Neutral</Pill>
          </div>
        </section>
        <section className="pc-rise" style={card(2)}>
          <h2 style={h2}>Status pills</h2>
          <div style={row}><StatusPill status="on" /><StatusPill status="risk" /><StatusPill status="off" /></div>
        </section>
        <section className="pc-rise" style={card(3)}>
          <h2 style={h2}>Time chips</h2>
          <div style={row}>
            <TimeChip plannedMinutes={45} />
            <TimeChip plannedMinutes={60} actualMinutes={55} />
            <TimeChip plannedMinutes={45} actualMinutes={65} />
            <TimeChip actualMinutes={90} />
          </div>
        </section>
        <section className="pc-rise" style={card(4)}>
          <h2 style={h2}>Data motion</h2>
          <div style={{ display: "flex", height: 10, gap: 2, borderRadius: 999, overflow: "hidden", background: "var(--pc-track)" }}>
            <span className="pc-grow-x" style={{ width: "30%", background: "var(--pc-cat-work)", ["--pc-i" as string]: 0 }} />
            <span className="pc-grow-x" style={{ width: "15%", background: "var(--pc-cat-health)", ["--pc-i" as string]: 1 }} />
            <span className="pc-grow-x" style={{ width: "15%", background: "var(--pc-cat-learning)", ["--pc-i" as string]: 2 }} />
          </div>
        </section>
      </div>
    </main>
  );
}

const h2 = { margin: "0 0 12px", fontSize: "var(--pc-text-h2)", lineHeight: "var(--pc-lh-h2)", fontWeight: 650 } as const;
const row = { display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" } as const;
function card(index: number) {
  return {
    padding: 20,
    borderRadius: "var(--pc-r-panel)",
    background: "var(--pc-card)",
    border: "1px solid var(--border)",
    boxShadow: "var(--pc-e1)",
    ["--pc-i" as string]: index,
  };
}
