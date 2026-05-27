---
inclusion: always
---

# Feedback Data Model — Core Contract

The data model below is the **contract that ties the SDK, API, and dashboard together**. Changes here ripple across all three packages, so update `packages/shared-types` first and let the change propagate.

## What every pin captures
Every feedback record stores **all of these together**, not one or the other:

1. A **stable DOM selector** for the target element the user clicked.
2. **Coordinates** of the click — both:
   - **Relative** as percentages of the target element's bounding box (or of the viewport when no element resolves), used to re-render the pin after a layout change.
   - **Absolute** pixel position within the page at capture time, used as a debugging fallback and for the screenshot overlay.
3. The **viewport size** at capture time (`width`, `height`, `devicePixelRatio`).
4. The **page URL** (path + meaningful query) where the comment was made.
5. A **screenshot** of the page taken at the moment the pin is created. Screenshot is **always captured by default** in v1; a project-level setting can disable it.

When rendering a pin later, the SDK first tries to resolve the selector. If found, it places the pin at `xPercent / yPercent` of that element. If the selector no longer resolves, the pin is shown as **orphaned** at the absolute pixel coordinate, anchored to the page, and the dashboard surfaces an "element not found" warning. The screenshot is still viewable in the dashboard regardless.

## DOM target selection (SDK behavior)
When feedback mode is on:

- **Hover** highlights the element under the cursor (an outline overlay, no layout shift).
- **Click** picks that element as the pin target. The SDK captures the click coordinates *and* records the selected element.
- **Modifier-click** (e.g. Alt-click) walks up to the parent element, letting the user "select up" the DOM tree until they hit the right granularity. The currently selected element is shown in the overlay.
- **Escape** cancels selection without creating a pin.

The SDK exports two helpers:

- `resolveSelector(target: Element): string` — produces a selector following the priority list below.
- `findElement(selector: string): Element | null` — re-resolves a selector at render time.

Both must be deterministic and side-effect-free.

## Selector strategy (priority order)
1. `data-feedback-id="…"` if present on the target or an ancestor. **This is the preferred attribute** — encourage prototype authors to add it on key elements.
2. `id="…"` if stable-looking (no hashes, no auto-generated suffixes).
3. A short structural selector built from `tag + nth-child` chains, capped at a reasonable depth (≤ 5 levels).
4. As a last resort, a selector that includes a single semantic class name. Never long auto-generated class chains (Tailwind utility soup, hashed CSS Modules names).

## Wire format example
```json
{
  "id": "fb_01HXYZ...",
  "projectId": "prototype-a",
  "pageUrl": "/checkout",
  "selector": "[data-feedback-id='submit-btn']",
  "coordinates": {
    "xPercent": 0.72,
    "yPercent": 0.31,
    "xPx": 1037,
    "yPx": 279
  },
  "viewport": {
    "width": 1440,
    "height": 900,
    "devicePixelRatio": 2
  },
  "screenshotKey": "screenshots/fb_01HXYZ.png",
  "status": "open",
  "thread": [
    {
      "id": "cm_01...",
      "author": { "name": "Anita", "email": "anita@example.com" },
      "body": "Button label should be 'Pay now'",
      "createdAt": "2026-05-27T08:14:00Z"
    }
  ],
  "createdAt": "2026-05-27T08:14:00Z",
  "updatedAt": "2026-05-27T08:14:00Z"
}
```

## Status state machine
- `open` → `resolved` (a reviewer marks it done)
- `resolved` → `open` (regression / reopened)
- Any state may be `archived` (hidden from default views, never deleted automatically)

The API enforces these transitions; the SDK and dashboard never mutate status fields directly without going through it.

## Screenshot handling
- **Captured on every new pin by default.** A project-level toggle can disable capture if a deployment doesn't want it.
- The SDK uses `html2canvas` (dynamically imported) to render the visible viewport into a PNG, then uploads it to the API.
- Storage lives on the **API host's local filesystem** — see `api-conventions.md` for upload flow and path rules.
- Storage keys follow `screenshots/{feedbackId}.png` so a feedback ID always maps to a deterministic file path.
- The screenshot is purely a visual record. It is never relied on for re-positioning a pin — that's what the selector + coordinates are for.

## Identity
- IDs are server-issued. The SDK may use a temporary client-side draft ID, but the canonical ID returned by the API is what the dashboard and pins display.
- Use a sortable ID format (ULID or KSUID) so feedback can be ordered by creation time without a separate index.

## Backwards compatibility rule
Once the SDK is published, any change to the wire format must be additive (new optional fields) or come with a version bump and migration notes. The API must accept older payload shapes for at least one minor version.
