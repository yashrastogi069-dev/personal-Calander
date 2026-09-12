function canonical(value: unknown): string {
  if (value instanceof Date) return JSON.stringify({ $date: value.toISOString() });
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function syncValuesEqual(left: unknown, right: unknown) {
  return Object.is(left, right) || canonical(left) === canonical(right);
}

export function classifyFieldMerge(input: { base: unknown; local: unknown; server: unknown }):
  | { kind: "apply_local"; value: unknown }
  | { kind: "already_applied"; value: unknown }
  | { kind: "conflict"; base: unknown; local: unknown; server: unknown } {
  if (syncValuesEqual(input.local, input.server)) return { kind: "already_applied", value: input.server };
  if (syncValuesEqual(input.base, input.server)) return { kind: "apply_local", value: input.local };
  return { kind: "conflict", base: input.base, local: input.local, server: input.server };
}

export function mergeOperationPatch(input: {
  baseValues: Record<string, unknown>;
  patch: Record<string, unknown>;
  server: Record<string, unknown>;
}) {
  const safePatch: Record<string, unknown> = {};
  const conflicts: Array<{ field: string; baseValue: unknown; localValue: unknown; serverValue: unknown }> = [];
  const alreadyApplied: string[] = [];

  for (const [field, local] of Object.entries(input.patch)) {
    const result = classifyFieldMerge({ base: input.baseValues[field], local, server: input.server[field] });
    if (result.kind === "apply_local") safePatch[field] = result.value;
    else if (result.kind === "already_applied") alreadyApplied.push(field);
    else conflicts.push({ field, baseValue: result.base, localValue: result.local, serverValue: result.server });
  }
  return { safePatch, conflicts, alreadyApplied };
}
