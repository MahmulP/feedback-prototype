/**
 * DOM selector utilities. Deterministic and side-effect-free.
 *
 * Selector priority (see `.kiro/steering/feedback-data-model.md`):
 *   1. data-feedback-id on the target or any ancestor
 *   2. id="…" if it looks stable (no hashes, no auto-generated suffixes)
 *   3. structural tag + nth-child chain, capped at MAX_DEPTH levels
 *   4. tag.classname (single semantic class) as a last resort
 */

const MAX_DEPTH = 5;

/** True if the id looks human-authored, not auto-generated. */
function isStableId(id: string): boolean {
  if (id.length === 0 || id.length > 64) return false;
  // Reject ids that contain long hex/digit runs (likely UUID/hash fragments)
  if (/[0-9a-f]{8,}/i.test(id)) return false;
  // Reject ids with whitespace or characters that need escaping
  if (/[\s"'<>`]/.test(id)) return false;
  return true;
}

/** True if a single class name is a reasonable selector candidate. */
function isStableClass(cls: string): boolean {
  if (cls.length === 0 || cls.length > 48) return false;
  // Reject hashed class names (CSS Modules, etc.) and long hex runs
  if (/[0-9a-f]{6,}/i.test(cls)) return false;
  // Reject classes that look like Tailwind utilities (start with breakpoint or contain ":")
  if (/[:[\]]/.test(cls)) return false;
  if (/^(sm|md|lg|xl|2xl|hover|focus|active|dark)-/.test(cls)) return false;
  return true;
}

/** Find the closest ancestor (including the element itself) carrying `data-feedback-id`. */
function nearestFeedbackId(el: Element): { id: string; node: Element } | null {
  let cur: Element | null = el;
  while (cur && cur !== document.documentElement) {
    const id = cur.getAttribute("data-feedback-id");
    if (id && id.length > 0) return { id, node: cur };
    cur = cur.parentElement;
  }
  return null;
}

/** True when a data-feedback-id value is safe to embed in an attribute selector unescaped. */
function isSlugSafe(value: string): boolean {
  if (value.length === 0 || value.length > 96) return false;
  return /^[A-Za-z0-9_.:\-]+$/.test(value);
}

function pickStableClass(el: Element): string | null {
  const list = Array.from(el.classList);
  for (const cls of list) {
    if (isStableClass(cls)) return cls;
  }
  return null;
}

function nthOfType(el: Element): number {
  const parent = el.parentElement;
  if (!parent) return 1;
  let n = 0;
  for (const sibling of Array.from(parent.children)) {
    if (sibling.tagName === el.tagName) {
      n++;
      if (sibling === el) return n;
    }
  }
  return n;
}

function structuralStep(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const parent = el.parentElement;
  if (!parent) return tag;
  const siblings = Array.from(parent.children).filter((c) => c.tagName === el.tagName);
  if (siblings.length === 1) return tag;
  return `${tag}:nth-of-type(${nthOfType(el)})`;
}function buildStructuralSelector(el: Element): string {
  const parts: string[] = [];
  let cur: Element | null = el;
  let depth = 0;
  while (cur && cur !== document.body && cur !== document.documentElement && depth < MAX_DEPTH) {
    parts.unshift(structuralStep(cur));
    cur = cur.parentElement;
    depth++;
  }
  return parts.join(" > ");
}

/**
 * Build the most stable selector we can for the given element.
 */
export function resolveSelector(target: Element): string {
  if (!(target instanceof Element)) {
    throw new TypeError("resolveSelector: target must be an Element");
  }

  // 1. data-feedback-id on the element or an ancestor (only if it's a safe slug).
  const fid = nearestFeedbackId(target);
  if (fid && isSlugSafe(fid.id)) {
    return `[data-feedback-id="${fid.id}"]`;
  }

  // 2. stable id
  const id = target.id;
  if (id && isStableId(id)) {
    return `#${CSS.escape(id)}`;
  }

  // 3. structural selector
  const structural = buildStructuralSelector(target);
  if (structural.length > 0) return structural;

  // 4. fallback: tag + single class
  const tag = target.tagName.toLowerCase();
  const cls = pickStableClass(target);
  return cls ? `${tag}.${CSS.escape(cls)}` : tag;
}

/**
 * Resolve a previously-stored selector back to an Element. Returns null if not found.
 * Never throws on malformed selectors.
 */
export function findElement(selector: string, root: ParentNode = document): Element | null {
  if (typeof selector !== "string" || selector.length === 0) return null;
  try {
    return root.querySelector(selector);
  } catch {
    return null;
  }
}
