// D3 TaskSkeleton: loading shapes that match the final row, card and lane. One 1.2s sweep, then static
// (no spinner, no endless shimmer). The wrapper is a polite status so the load is announced once.
import { cn } from "@/lib/utils";
import "./tasks-premium.css";

export type TaskSkeletonVariant = "list" | "board";

function RowShape({ index }: { index: number }) {
  return (
    <li className="tk-skel-row" style={{ ["--tk-i" as string]: index }} aria-hidden="true">
      <span className="tk-skel tk-skel-check" />
      <span className="tk-skel tk-skel-title" style={{ width: `${54 + ((index * 17) % 30)}%` }} />
      <span className="tk-skel tk-skel-pill" />
      <span className="tk-skel tk-skel-pill is-short" />
    </li>
  );
}

function CardShape({ index }: { index: number }) {
  return (
    <li className="tk-skel-card" style={{ ["--tk-i" as string]: index }} aria-hidden="true">
      <span className="tk-skel tk-skel-pill" />
      <span className="tk-skel tk-skel-line" />
      <span className="tk-skel tk-skel-line is-short" />
      <span className="tk-skel tk-skel-pill is-short" />
    </li>
  );
}

export function TaskSkeleton({ variant = "list", rows = 6, lanes = 4, cardsPerLane = 3, className }: { variant?: TaskSkeletonVariant; rows?: number; lanes?: number; cardsPerLane?: number; className?: string }) {
  return (
    <div className={cn("tk-skeleton", `is-${variant}`, className)} role="status" aria-live="polite" aria-label="Loading tasks">
      {variant === "list" ? (
        <ul className="tk-skel-rows">{Array.from({ length: rows }, (_, index) => <RowShape key={index} index={index} />)}</ul>
      ) : (
        <div className="tk-skel-lanes">
          {Array.from({ length: lanes }, (_, lane) => (
            <div className="tk-skel-lane" key={lane} aria-hidden="true">
              <span className="tk-skel tk-skel-lane-head" />
              <ul className="tk-skel-cards">{Array.from({ length: cardsPerLane }, (_, index) => <CardShape key={index} index={lane + index} />)}</ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
