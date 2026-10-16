// SSR safety: every hook renders on the server (node has no window or document) without throwing,
// and starts in its resting state. Behaviour is covered by the engine tests beside each hook.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { useDaySwipe } from "./useDaySwipe";
import { useLongPress } from "./useLongPress";
import { usePullToRefresh } from "./usePullToRefresh";
import { useScrollShrink } from "./useScrollShrink";
import { useSwipeRow } from "./useSwipeRow";

function Probe() {
  const row = useSwipeRow({ enabled: true, canCommit: () => null, onCommit: vi.fn() });
  const pull = usePullToRefresh({ enabled: true, canRefresh: () => null, onRefresh: () => Promise.resolve() });
  const bar = useScrollShrink();
  const press = useLongPress({ onLongPress: vi.fn() });
  const day = useDaySwipe({ enabled: true, onShift: vi.fn() });
  const rowProps = row.bind() as { style: { touchAction: string }; "data-swipe-phase": string };
  const dayProps = day.bind() as { style: { touchAction: string } };
  return (
    <output
      data-row={`${row.phase}:${row.x.get()}:${row.progress.complete.get()}:${rowProps.style.touchAction}:${rowProps["data-swipe-phase"]}`}
      data-pull={`${pull.phase}:${pull.progress.get()}:${pull.message ?? "none"}`}
      data-bar={`${bar.state}:${bar.keyboardOpen}`}
      data-press={String(press.pressing)}
      data-day={`${day.offset.get()}:${dayProps.style.touchAction}`}
    />
  );
}

describe("gesture hooks on the server", () => {
  it("render without touching window and start at rest", () => {
    expect(typeof window).toBe("undefined");
    const html = renderToStaticMarkup(<Probe />);
    expect(html).toContain('data-row="idle:0:0:pan-y:idle"');
    expect(html).toContain('data-pull="idle:0:none"');
    expect(html).toContain('data-bar="rest:false"');
    expect(html).toContain('data-press="false"');
    expect(html).toContain('data-day="0:pan-y"');
  });
});
