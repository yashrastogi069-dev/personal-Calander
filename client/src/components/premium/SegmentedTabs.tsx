import { useId, type ReactNode } from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export type SegmentedItem<T extends string> = { value: T; label: ReactNode; badge?: number | null };

export function SegmentedTabs<T extends string>({
  items,
  value,
  onValueChange,
  label,
  className,
}: {
  items: ReadonlyArray<SegmentedItem<T>>;
  value: T;
  onValueChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  const indicatorId = useId();
  return (
    <TabsPrimitive.Root value={value} onValueChange={next => onValueChange(next as T)} activationMode="automatic">
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
                  transition={{ type: "tween", duration: 0.24, ease: [0.23, 1, 0.32, 1] }}
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
