import { Download, RefreshCw, Share, WifiOff, Wifi, X } from "lucide-react";
import { usePwa } from "@/contexts/PwaContext";
import type { PwaActions, PwaState } from "@/lib/pwaLifecycle";

type StatusContent = {
  icon: typeof Download;
  eyebrow: string;
  title: string;
  detail: string;
  tone: "neutral" | "offline" | "success";
  action?: { label: string; run(): void; disabled?: boolean };
  dismiss?: () => void;
};

function contentFor(state: PwaState, actions: PwaActions): StatusContent | null {
  if (state.update === "ready" || state.update === "activating") {
    return {
      icon: Download,
      eyebrow: "New release",
      title: state.update === "ready" ? "Update ready" : "Updating safely",
      detail: state.message ?? "Refresh the app shell without removing saved or queued work.",
      tone: "neutral",
      action: {
        label: state.update === "ready" ? "Update now" : "Updating…",
        run: () => { void actions.activateUpdate(); },
        disabled: state.update === "activating",
      },
    };
  }
  if (state.connectivity === "offline") {
    return {
      icon: WifiOff,
      eyebrow: "Connection paused",
      title: "You’re offline",
      detail: "Quick captures stay on this device. Full offline planner sync arrives in the next phase.",
      tone: "offline",
      action: { label: "Try again", run: () => { void actions.retryConnection(); } },
    };
  }
  if (state.connectivity === "reconnected") {
    return {
      icon: Wifi,
      eyebrow: "Connection restored",
      title: "Back online",
      detail: "The secure planner service is available again.",
      tone: "success",
    };
  }
  if (state.install === "available" && state.installExperience === "native-prompt") {
    return {
      icon: Download,
      eyebrow: "Use it like an app",
      title: "Install Personal Calendar",
      detail: "Open faster in a standalone window and keep the app shell ready offline.",
      tone: "neutral",
      action: { label: "Install app", run: () => { void actions.install(); } },
      dismiss: actions.dismissInstall,
    };
  }
  if (state.install === "available" && state.installExperience === "ios-guidance") {
    return {
      icon: Share,
      eyebrow: "Install on iPhone",
      title: "Share, then Add to Home Screen",
      detail: "Launch it standalone and enable iPhone notifications later from the installed app.",
      tone: "neutral",
      dismiss: actions.dismissInstall,
    };
  }
  return null;
}

export function PwaStatusView({ state, actions }: { state: PwaState; actions: PwaActions }) {
  const content = contentFor(state, actions);
  if (!content) return null;
  const Icon = content.icon;
  return (
    <aside className="pwa-status-layer" aria-live="polite">
      <div className={`pwa-status-card is-${content.tone}`} role="status">
        <span className="pwa-status-icon" aria-hidden="true"><Icon size={20} strokeWidth={1.9} /></span>
        <span className="pwa-status-copy">
          <small>{content.eyebrow}</small>
          <strong>{content.title}</strong>
          <span>{content.detail}</span>
        </span>
        <span className="pwa-status-actions">
          {content.action ? (
            <button type="button" onClick={content.action.run} disabled={content.action.disabled}>
              {content.action.label}
              {content.action.disabled ? <RefreshCw size={15} aria-hidden="true" /> : null}
            </button>
          ) : null}
          {content.dismiss ? (
            <button type="button" className="pwa-status-dismiss" aria-label="Dismiss install suggestion" onClick={content.dismiss}>
              <X size={18} aria-hidden="true" />
            </button>
          ) : null}
        </span>
      </div>
    </aside>
  );
}

export default function PwaStatus() {
  const { state, actions } = usePwa();
  return <PwaStatusView state={state} actions={actions} />;
}
