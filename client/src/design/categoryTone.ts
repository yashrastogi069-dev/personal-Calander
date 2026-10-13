// Maps user-defined categories onto the validated v2 palette slots.
// The stored categories.color (a free colour picker) is snapped to the nearest slot by hue,
// so the owner's choice is respected while chips keep validated contrast.

export const CATEGORY_TONES = ["work", "health", "learning", "personal", "social"] as const;
export type CategoryTone = (typeof CATEGORY_TONES)[number];
export type ToneOrNeutral = CategoryTone | "neutral";

export type CategoryLike = { id: string; name: string; color?: string | null; sortOrder?: number | null } | null | undefined;

/** Hue (degrees) of each slot's light base colour. */
const SLOT_HUES: Record<CategoryTone, number> = { work: 219, health: 172, learning: 34, personal: 253, social: 344 };

const KEYWORDS: ReadonlyArray<[CategoryTone, RegExp]> = [
  ["work", /\b(work|job|jobs|career|office|business|client|clients)\b/i],
  ["health", /\b(health|fitness|gym|run|running|workout|exercise|wellbeing|wellness|sleep|diet)\b/i],
  ["learning", /\b(learn|learning|study|studies|course|courses|school|uni|university|reading|skill|skills)\b/i],
  ["personal", /\b(personal|home|life|admin|errands|household|finance|money)\b/i],
  ["social", /\b(social|friends|family|community|network|networking|relationships)\b/i],
];

function parseHue(color: string | null | undefined): number | null {
  const match = /^#?([0-9a-f]{6})$/i.exec((color ?? "").trim());
  if (!match) return null;
  const value = match[1];
  const [r, g, b] = [0, 2, 4].map(offset => parseInt(value.slice(offset, offset + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const lightness = (max + min) / 2;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  // Greys and near-black/white carry no usable hue.
  if (saturation < 0.15 || lightness < 0.08 || lightness > 0.95) return null;
  let hue: number;
  if (max === r) hue = ((g - b) / delta) % 6;
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;
  return (hue * 60 + 360) % 360;
}

function hueDistance(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Slots ordered by preference for one category: stored colour hue, then name keyword, then a stable hash. */
function preferredTones(category: NonNullable<CategoryLike>): CategoryTone[] {
  const hue = parseHue(category.color);
  if (hue != null) {
    return [...CATEGORY_TONES].sort((a, b) => hueDistance(hue, SLOT_HUES[a]) - hueDistance(hue, SLOT_HUES[b]));
  }
  const keyword = KEYWORDS.find(([, pattern]) => pattern.test(category.name))?.[0];
  const start = keyword ? CATEGORY_TONES.indexOf(keyword) : stableHash(category.id) % CATEGORY_TONES.length;
  return CATEGORY_TONES.map((_, offset) => CATEGORY_TONES[(start + offset) % CATEGORY_TONES.length]);
}

export function resolveCategoryTone(category: CategoryLike): ToneOrNeutral {
  if (!category) return "neutral";
  return preferredTones(category)[0];
}

/**
 * Resolves every category in a workspace at once. A category whose first choice is taken by an
 * earlier one (by sortOrder, then id) moves to its next free slot. With more than five categories,
 * slots repeat; the label always disambiguates.
 */
export function resolveCategoryTones(categories: ReadonlyArray<NonNullable<CategoryLike>>): Map<string, CategoryTone> {
  const ordered = [...categories].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.id.localeCompare(b.id)
  );
  const taken = new Set<CategoryTone>();
  const result = new Map<string, CategoryTone>();
  for (const category of ordered) {
    const preferences = preferredTones(category);
    const tone = preferences.find(candidate => !taken.has(candidate)) ?? preferences[0];
    taken.add(tone);
    if (taken.size === CATEGORY_TONES.length) taken.clear();
    result.set(category.id, tone);
  }
  return result;
}

export function toneClassName(tone: ToneOrNeutral): string {
  return `pc-tone-${tone}`;
}
