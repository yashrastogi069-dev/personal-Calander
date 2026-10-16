// "Only one gesture owner at a time" (spec D3.5 section 3). Priority: sheet/menu drag > row swipe >
// day swipe > pull to refresh. A higher-priority gesture may take over a lower one; the loser sees
// `ownsGesture` turn false on its next move and abandons. Module state, so it works across hooks.

export type GestureKind = "sheet" | "row" | "day" | "pull";

const priority: Record<GestureKind, number> = { sheet: 4, row: 3, day: 2, pull: 1 };

type Owner = { kind: GestureKind; token: symbol };

let owner: Owner | null = null;

/** Claims the gesture. Fails when an equal or higher-priority gesture already owns it. */
export function claimGesture(kind: GestureKind, token: symbol): boolean {
  if (owner && owner.token !== token && priority[owner.kind] >= priority[kind]) return false;
  owner = { kind, token };
  return true;
}

export function ownsGesture(token: symbol): boolean {
  return owner?.token === token;
}

export function releaseGesture(token: symbol): void {
  if (owner?.token === token) owner = null;
}

export function currentGestureOwner(): GestureKind | null {
  return owner?.kind ?? null;
}

/** Test helper. */
export function resetGestureOwner(): void {
  owner = null;
}
