import {
  AlertCircle,
  ArchiveRestore,
  Bell,
  ChevronRight,
  CircleUserRound,
  CloudOff,
  Laptop,
  Link2,
  LoaderCircle,
  LockKeyhole,
  MonitorCog,
  Palette,
  RefreshCw,
  Repeat2,
  Settings2,
  Smartphone,
  Tags,
  TriangleAlert,
  WifiOff,
} from "lucide-react";
import { phase4PrototypeFixture } from "@shared/phase4Prototype";
import type { PrototypeDensity } from "./PrototypeShell";

type PrototypeSettingsProps = {
  density: PrototypeDensity;
  onDensityChange: (density: PrototypeDensity) => void;
};

type SettingsRowProps = {
  icon: typeof Settings2;
  title: string;
  description: string;
  value?: string;
  disabled?: boolean;
};

function SettingsRow({ icon: Icon, title, description, value, disabled }: SettingsRowProps) {
  return (
    <button className="p4-settings-row" type="button" disabled={disabled}>
      <Icon aria-hidden="true" />
      <span><strong>{title}</strong><small>{description}</small></span>
      {value && <em>{value}</em>}
      <ChevronRight aria-hidden="true" />
    </button>
  );
}

export default function PrototypeSettings({ density, onDensityChange }: PrototypeSettingsProps) {
  return (
    <div className="p4-settings">
      <header className="p4-page-intro p4-page-intro-compact">
        <div><p className="p4-kicker">Account utility</p><h2>Settings,<br /><em>grouped by consequence.</em></h2><p>Device choices, planner defaults, and connection boundaries stay clearly separated.</p></div>
        <div className="p4-settings-identity"><span>MM</span><div><strong>Maya Mehta</strong><small>Owner · Personal workspace</small></div></div>
      </header>

      <div className="p4-settings-layout">
        <div className="p4-settings-sections">
          <section aria-labelledby="p4-account-settings">
            <header><p>Identity</p><h3 id="p4-account-settings">Account</h3></header>
            <SettingsRow icon={CircleUserRound} title="Profile & owned workspace" description="maya@example.com · Personal workspace" value="Owner" />
          </section>

          <section aria-labelledby="p4-appearance-settings">
            <header><p>On this device</p><h3 id="p4-appearance-settings">Appearance</h3></header>
            <SettingsRow icon={Palette} title="Visual style" description="The prototype switcher stays in the header." value="Variant preview" />
            <div className="p4-settings-row p4-density-row">
              <MonitorCog aria-hidden="true" /><span><strong>Density</strong><small>Spacing changes; hit targets remain at least 44px.</small></span>
              <div className="p4-inline-segment"><button type="button" aria-pressed={density === "comfortable"} onClick={() => onDensityChange("comfortable")}>Comfortable</button><button type="button" aria-pressed={density === "compact"} onClick={() => onDensityChange("compact")}>Compact</button></div>
            </div>
          </section>

          <section aria-labelledby="p4-planning-settings">
            <header><p>Workspace defaults</p><h3 id="p4-planning-settings">Planning</h3></header>
            <SettingsRow icon={Settings2} title="Timezone & planning defaults" description="Asia/Kolkata · Structured accountability" value="IST" />
            <SettingsRow icon={Bell} title="Review cadence" description="Weekly review · Monday morning" value="Weekly" />
          </section>

          <section aria-labelledby="p4-sync-settings">
            <header><p>Record safety</p><h3 id="p4-sync-settings">Sync & Offline</h3></header>
            <SettingsRow icon={RefreshCw} title="Pending task operations" description="One task change is safely held on this device." value="1 pending" />
            <SettingsRow icon={TriangleAlert} title="Conflict review" description="Local and remote follow-up dates are both preserved." value="Review" />
          </section>

          <section aria-labelledby="p4-categories-settings">
            <header><p>Organization & retention</p><h3 id="p4-categories-settings">Categories & Recycle Bin</h3></header>
            <SettingsRow icon={Tags} title="Categories" description={`${phase4PrototypeFixture.stress.hiddenCategoryCount} hidden categories remain discoverable.`} value="Manage" />
            <SettingsRow icon={ArchiveRestore} title="Archived records" description="History and goal links are retained." value="Restore available" />
          </section>

          <section aria-labelledby="p4-device-settings">
            <header><p>Installation</p><h3 id="p4-device-settings">App & Device</h3></header>
            <SettingsRow icon={Smartphone} title="Phone navigation" description="Home, Tasks, Plan, Projects & Goals, More" value="5 pins" />
            <SettingsRow icon={Laptop} title="Installed app" description="Prototype reports capability without changing device state." value="Ready" />
          </section>

          <section aria-labelledby="p4-connections-settings">
            <header><p>External boundaries</p><h3 id="p4-connections-settings">Connections</h3></header>
            <SettingsRow icon={Link2} title="Apple Calendar subscription" description="Outgoing, private, and read-only—not incoming sync." value="Not connected" />
            <SettingsRow icon={Bell} title="Notifications" description="Device opt-in and test delivery require the real settings flow." value="Preview" disabled />
          </section>
        </div>

        <aside className="p4-state-ledger" aria-labelledby="p4-state-ledger-title">
          <header><p className="p4-kicker">Shared state matrix</p><h3 id="p4-state-ledger-title">Honest system states</h3><span>Review examples only</span></header>
          <div className="p4-state-example" data-testid="state-loading"><LoaderCircle aria-hidden="true" /><span><strong>Loading</strong><small>Shell stays stable while this region resolves.</small></span></div>
          <div className="p4-state-example" data-testid="state-empty"><span aria-hidden="true">0</span><span><strong>Empty</strong><small>No milestones in this period. Change period.</small></span></div>
          <div className="p4-state-example is-danger" data-testid="state-error"><AlertCircle aria-hidden="true" /><span><strong>Read error</strong><small>Confirmed records remain visible. Retry this region.</small></span></div>
          <div className="p4-state-example is-warning" data-testid="state-conflict"><TriangleAlert aria-hidden="true" /><span><strong>Conflict · review required</strong><small>Local: Wednesday · Remote: Friday</small></span></div>
          <div className="p4-state-example is-disabled" data-testid="state-disabled"><LockKeyhole aria-hidden="true" /><span><strong>Disabled</strong><small>Apply is unavailable in this prototype.</small></span></div>
          <div className="p4-state-example is-positive" data-testid="state-saved-locally"><RefreshCw aria-hidden="true" /><span><strong>Saved locally</strong><small>Task change is pending on this device.</small></span></div>
          <div className="p4-state-example is-warning" data-testid="state-unsupported-offline"><WifiOff aria-hidden="true" /><span><strong>Unsupported offline</strong><small>Goal and habit drafts require reconnection.</small></span></div>
          <div className="p4-state-example" data-testid="state-long-content"><span aria-hidden="true">Aa</span><span><strong>Long content</strong><small>{phase4PrototypeFixture.stress.longTitle}</small></span></div>
          <div className="p4-state-example" data-testid="state-archived"><ArchiveRestore aria-hidden="true" /><span><strong>Archived</strong><small>Restore available · history retained.</small></span></div>
          <div className="p4-state-example" data-testid="state-recurring-boundary"><Repeat2 aria-hidden="true" /><span><strong>Recurring boundary</strong><small>Skip occurrence ≠ pause series.</small></span></div>
          <div className="p4-state-example"><CloudOff aria-hidden="true" /><span><strong>Connection truth</strong><small>No incoming calendar is implied.</small></span></div>
        </aside>
      </div>

      <footer className="p4-signout-placement">
        <div><strong>Sign out on this device</strong><span>Retained offline data is hidden, not deleted.</span></div>
        <button type="button" aria-disabled="true" title="Preview only — sign out is not connected">Preview only — sign out is not connected</button>
      </footer>
    </div>
  );
}
