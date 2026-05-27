---
inclusion: always
---

# Repository Structure

## Target monorepo layout
The product will live in a Bun workspace with this shape:

```
feedback-prototype/
â”œâ”€â”€ apps/
â”‚   â”œâ”€â”€ dashboard/         # Next.js + React dashboard app
â”‚   â””â”€â”€ api/               # Hono backend
â”œâ”€â”€ packages/
â”‚   â”œâ”€â”€ feedback-sdk/      # @mahmulp/feedback-sdk (published)
â”‚   â””â”€â”€ shared-types/      # internal: shared TS types/contracts
â”œâ”€â”€ package.json           # workspace root
â”œâ”€â”€ bun.lock
â”œâ”€â”€ tsconfig.base.json     # shared compiler options (added during migration)
â””â”€â”€ .kiro/                 # specs + steering
```

### Boundaries between packages
- `packages/shared-types` may not import from `apps/*` or `packages/feedback-sdk`. It is the leaf.
- `packages/feedback-sdk` may import from `packages/shared-types` only.
- `apps/api` may import from `packages/shared-types` only.
- `apps/dashboard` may import from `packages/shared-types` only.
- **Never** import from `apps/*` into a package. Apps depend on packages, not the other way around.

If a piece of logic is needed in two places, lift it into `packages/shared-types` (for types) or create a new package (for runtime code) â€” do not copy-paste.

## Current repo layout (transitional)
Today the repo is a single Next.js app:

```
app/                       # Next.js App Router scaffold (placeholder)
public/
.next/                     # build output, gitignored
next.config.ts
tsconfig.json
package.json
AGENTS.md                  # contains nextjs-agent-rules
```

When migrating to the monorepo:
1. Move (don't recreate) the existing scaffolding only if any of it is actually useful â€” most of `app/page.tsx` is template content and can be deleted.
2. Update `AGENTS.md` only if the Next.js note no longer applies.
3. Keep `.kiro/` at the repo root.

## Naming conventions
- **Files:** `kebab-case.ts` for source files. React components use `PascalCase.tsx`. Svelte components (in the SDK's Svelte wrapper or in any Svelte example app) use `PascalCase.svelte`.
- **Directories:** `kebab-case`.
- **Types & interfaces:** `PascalCase`. Don't prefix interfaces with `I`.
- **Functions & variables:** `camelCase`. Boolean flags read as predicates: `isOpen`, `hasScreenshot`.
- **Constants:** `SCREAMING_SNAKE_CASE` only for true module-level constants.
- **Tests:** colocated as `*.test.ts` next to the file under test. No separate `__tests__` directories unless a package already has one.

## Path aliases
- Each package declares its own aliases in its local `tsconfig.json`. Do not rely on root-level path aliases bleeding into packages.
- The current root alias `@/*` belongs to the Next.js scaffold and will be removed during the migration.

## Public vs. internal modules
- Each package has a single entry point (`src/index.ts`) that defines its public surface.
- Anything not re-exported from `src/index.ts` is internal and may change without notice.
- The SDK in particular must keep its public API minimal â€” every export is part of the contract.

## Spec & steering files
- Specs live under `.kiro/specs/{feature-name}/` (kebab-case feature names).
- Steering files live under `.kiro/steering/`.
- Reference other files from steering using `#[[file:<relative-path>]]` when you need to pull an external spec/schema into context.
