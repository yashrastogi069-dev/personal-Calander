import { useId, type ReactNode } from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { motion } from "framer-motion";
import { GLIDE, RADIUS } from "@/design/motion";
import { cn } from "@/lib/utils";

export type SegmentedItem<T extends string> = { value: T; label: ReactNode; badge?: number | null };

export function SegmentedTabs<T extends string>({
  items,
  value,
  onValueChange,
  label,
  className,
  activationMode = "automatic",
}: {
  items: ReadonlyArray<SegmentedItem<T>>;
  value: T;
  onValueChange: (value: T) => void;
  label: string;
  className?: string;
  /** Use "manual" when selecting a tab navigates, so arrow keys only move focus. */
  activationMode?: "automatic" | "manual";
}) {
  const indicatorId = useId();
  return (
    <TabsPrimitive.Root value={value} onValueChange={next => onValueChange(next as T)} activationMode={activationMode}>
      <TabsPrimitive.List aria-label={label} className={cn("pc-seg", className)}>
        {items.map(item => {
          const active = item.value === value;
          return (
            <TabsPrimitive.Trigger key={item.value} value={item.value} className="pc-seg-tab">
              {/* Reduced motion comes from the app-level <MotionConfig reducedMotion="user">. */}
              {active && (
                <motion.span
                  layoutId={`pc-seg-${indicatorId}`}
                  className="pc-seg-indicator"
                  aria-hidden="true"
                  // Numeric radius lets framer correct the pill's corners while it scales between tabs of different widths.
                  style={{ borderRadius: RADIUS.pill }}
                  transition={GLIDE}
                />
              )}
              <span className="pc-seg-label">{item.label}</span>
              {item.badge != null && item.badge > 0 && <span className="pc-seg-badge">{item.badge}</span>}
            </TabsPrimitive.Trigger>
          );
        })}
      </TabsPrimitive.List>
    </TabsPrimitive.Root>
  );
}
