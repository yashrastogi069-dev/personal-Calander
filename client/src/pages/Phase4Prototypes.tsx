import { useReducer, useState } from "react";
import {
  createPrototypeState,
  phase4PrototypeVariants,
  reducePrototypeState,
} from "@shared/phase4Prototype";
import PrototypeShell, {
  type PrototypeDensity,
  type PrototypeVariant,
  type PrototypeViewport,
} from "@/features/phase4-prototypes/PrototypeShell";
import "@/features/phase4-prototypes/phase4-prototypes.css";

function readQueryChoice<T extends string>(key: string, choices: readonly T[], fallback: T): T {
  if (typeof window === "undefined") return fallback;
  const value = new URLSearchParams(window.location.search).get(key);
  return choices.includes(value as T) ? (value as T) : fallback;
}

export default function Phase4Prototypes() {
  const [prototypeState, dispatch] = useReducer(reducePrototypeState, undefined, createPrototypeState);
  const [variant, setVariant] = useState<PrototypeVariant>(() =>
    readQueryChoice("variant", phase4PrototypeVariants.map(item => item.id), "a"),
  );
  const [density, setDensity] = useState<PrototypeDensity>("comfortable");
  const [viewport, setViewport] = useState<PrototypeViewport>(() =>
    readQueryChoice("viewport", ["phone", "desktop"] as const, "desktop"),
  );
  const [recoveryChoice, setRecoveryChoice] = useState<string | null>(null);
  const [selectedLane, setSelectedLane] = useState<"todo" | "doing" | "done">("todo");

  return (
    <PrototypeShell
      state={prototypeState}
      dispatch={dispatch}
      variant={variant}
      density={density}
      viewport={viewport}
      recoveryChoice={recoveryChoice}
      selectedLane={selectedLane}
      onVariantChange={setVariant}
      onDensityChange={setDensity}
      onViewportChange={setViewport}
      onRecoveryChoice={setRecoveryChoice}
      onSelectedLaneChange={setSelectedLane}
    />
  );
}
