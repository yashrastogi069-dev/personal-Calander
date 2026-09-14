import { AlertTriangle, ArrowRight, CalendarDays, Check, CornerDownRight, Flag, Link2, MoveRight, X } from "lucide-react";
import { useState, type CSSProperties, type Dispatch } from "react";
import { phase4PrototypeFixture, type PrototypeAction, type PrototypeState } from "@shared/phase4Prototype";

type PrototypeRoadmapProps = {
  state: PrototypeState;
  dispatch: Dispatch<PrototypeAction>;
};

export default function PrototypeRoadmap({ state, dispatch }: PrototypeRoadmapProps) {
  const [scale, setScale] = useState<"month" | "quarter" | "year">("quarter");
  const preview = state.roadmapPreview;

  return (
    <div className="p4-roadmap">
      <header className="p4-page-intro p4-page-intro-compact">
        <div><p className="p4-kicker">Plan / Portfolio roadmap</p><h2>See the horizon.<br /><em>Move dates deliberately.</em></h2><p>Projects and milestones only—task detail stays one level deeper.</p></div>
        <div className="p4-mode-switch" aria-label="Roadmap scale">
          <button type="button" aria-pressed={scale === "month"} onClick={() => setScale("month")}>Month</button>
          <button type="button" aria-pressed={scale === "quarter"} onClick={() => setScale("quarter")}>Quarter</button>
          <button type="button" aria-pressed={scale === "year"} onClick={() => setScale("year")}>Year</button>
        </div>
      </header>

      <section className="p4-roadmap-frame" aria-labelledby="p4-roadmap-heading">
        <header>
          <div><p className="p4-kicker">{scale} view · Sep—Dec 2026</p><h3 id="p4-roadmap-heading">Home & health portfolio</h3></div>
          <span><i />Today · 14 Sep</span>
        </header>
        <div className="p4-roadmap-scale" aria-hidden="true"><span>SEP</span><span>OCT</span><span>NOV</span><span>DEC</span></div>
        <div className="p4-roadmap-grid">
          <div className="p4-roadmap-label"><span>PROJECT 01</span><strong>{phase4PrototypeFixture.projects[0].title}</strong><small>Goal · Preventative health</small></div>
          <div className="p4-roadmap-track">
            <div className="p4-project-bar p4-project-bar-one"><span>20 Sep</span><strong>Planning refresh</strong><span>30 Nov</span></div>
            <i className="p4-today-line" />
            <button type="button" data-testid="preview-roadmap-move" onClick={() => dispatch({ type: "preview-roadmap-move", projectId: "project-quarterly", startLocalDate: "2026-10-01", dueLocalDate: "2026-12-15" })}><MoveRight aria-hidden="true" />Preview move</button>
          </div>
          <div className="p4-roadmap-label"><span>PROJECT 02</span><strong>{phase4PrototypeFixture.projects[1].title}</strong><small>Goal · Settle into the new home</small></div>
          <div className="p4-roadmap-track">
            <div className="p4-project-bar p4-project-bar-two"><span>15 Oct</span><strong>Move follow-through</strong><span>20 Dec</span></div>
            <i className="p4-today-line" />
          </div>
          <div className="p4-roadmap-label p4-milestone-label"><Flag aria-hidden="true" /><span>MILESTONES</span><strong>Meaningful checkpoints</strong></div>
          <div className="p4-roadmap-track p4-milestones">
            <span style={{ "--point": "37%" } as CSSProperties}><i /><b>Health shortlist</b><small>15 Oct</small></span>
            <span style={{ "--point": "72%" } as CSSProperties}><i /><b>First screening</b><small>15 Nov</small></span>
          </div>
        </div>
        <div className="p4-dependency"><Link2 aria-hidden="true" /><span>Declared dependency</span><strong>Planning refresh</strong><ArrowRight aria-hidden="true" /><strong>Home move follow-through</strong></div>
      </section>

      {preview && (
        <section className="p4-move-preview" aria-live="polite" aria-labelledby="p4-preview-title">
          <header><span><CalendarDays aria-hidden="true" />Change preview</span><button className="p4-icon-button" type="button" data-testid="cancel-roadmap-move" onClick={() => dispatch({ type: "cancel-roadmap-preview" })} aria-label="Cancel roadmap move"><X aria-hidden="true" /></button></header>
          <h3 id="p4-preview-title">Quarterly planning refresh</h3>
          <div><span><small>Current</small>20 Sep → 30 Nov</span><MoveRight aria-hidden="true" /><span><small>Proposed</small>01 Oct → 15 Dec</span></div>
          <p><Check aria-hidden="true" />Goal due date stays unchanged. The dependency will need review; no child task moves automatically.</p>
          <button type="button" disabled>Apply dates · disabled in prototype</button>
        </section>
      )}

      <section className="p4-undated" aria-labelledby="p4-undated-title">
        <header><div><p className="p4-kicker">Visible by design</p><h3 id="p4-undated-title">Not yet dated</h3></div><span>1 workstream</span></header>
        <article><CornerDownRight aria-hidden="true" /><div><strong>Choose the next project for “Settle into the new home”</strong><span>No invented bar · goal remains valid without a project date.</span></div><button type="button" aria-disabled="true">Open goal <ArrowRight aria-hidden="true" /></button></article>
      </section>

      <aside className="p4-roadmap-risk"><AlertTriangle aria-hidden="true" /><span><strong>One dependency crosses the proposed finish.</strong>Preview the effect before any dates are applied.</span></aside>
    </div>
  );
}
