import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Component,
  type ErrorInfo,
  type ReactNode,
} from "react";

type DestinationErrorBoundaryProps = {
  destinationLabel: string;
  onRetry?: () => void;
  children: ReactNode;
};

type DestinationErrorBoundaryState = {
  error: Error | null;
};

class DestinationRenderBoundary extends Component<
  DestinationErrorBoundaryProps,
  DestinationErrorBoundaryState
> {
  state: DestinationErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Destination render failed", error, info);
  }

  private retry = () => {
    this.setState({ error: null });
    this.props.onRetry?.();
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <section className="destination-error" role="alert">
        <p className="eyebrow">This view was interrupted</p>
        <h2>Could not open {this.props.destinationLabel}</h2>
        <p>{this.state.error.message}</p>
        <Button type="button" variant="outline" onClick={this.retry}>
          Try again
        </Button>
      </section>
    );
  }
}

export function DestinationLoading({ label }: { label: string }) {
  return (
    <section
      className="destination-loading"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="destination-loading-heading">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-48" />
      </div>
      <div className="destination-loading-grid">
        <Skeleton className="h-28 rounded-[1.25rem]" />
        <Skeleton className="h-28 rounded-[1.25rem]" />
        <Skeleton className="h-52 rounded-[1.25rem]" />
      </div>
      <p className="sr-only">Opening {label}…</p>
    </section>
  );
}

export function DestinationBoundary({
  destinationLabel,
  readError,
  confirmedContent = true,
  onRetry,
  children,
}: DestinationErrorBoundaryProps & {
  readError?: { message: string } | null;
  confirmedContent?: boolean;
}) {
  return (
    <DestinationRenderBoundary
      key={destinationLabel}
      destinationLabel={destinationLabel}
      onRetry={onRetry}
    >
      {readError ? (
        <section className="destination-read-error" role="status">
          <div>
            <strong>Could not refresh {destinationLabel}</strong>
            <span>
              {confirmedContent
                ? "Your last confirmed planner remains visible. "
                : "Your planner data is unchanged. "}
              {readError.message}
            </span>
          </div>
          {onRetry ? (
            <Button type="button" size="sm" variant="outline" onClick={onRetry}>
              Try again
            </Button>
          ) : null}
        </section>
      ) : null}
      {children}
    </DestinationRenderBoundary>
  );
}
