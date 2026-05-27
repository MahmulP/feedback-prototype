---
inclusion: always
---

# Product Overview

## What we are building
An **open-source, self-hosted visual feedback platform** for prototype websites and applications. Users (clients, internal QA, designers, PMs) can leave comments pinned directly to UI elements on a live prototype, replacing the typical "screenshot + chat message" workflow.

Think of it as a lightweight, self-hostable alternative to Marker.io / BugHerd / Pastel.

## System parts
The product is composed of three deliverables that ship together as one monorepo:

1. **Feedback SDK** â€” a framework-agnostic browser package that injects an overlay into any prototype, captures comments pinned to DOM elements, and syncs them with the API. Published to npm/Bun registry as `@mahmulp/feedback-sdk`.
2. **Backend API** â€” persistence, authentication, project management, screenshot upload, and feedback sync.
3. **Dashboard** â€” web UI for browsing projects, reviewing feedback threads, viewing screenshots, and managing issue status (open / resolved / reopened).

## Primary use cases
- A client opens a staging URL of a prototype, toggles feedback mode, clicks an element, and writes a comment. Reply threads form on each pin.
- A designer opens the dashboard, filters by page or project, and walks through every open comment with its screenshot context.
- A QA engineer reopens a previously resolved issue when a regression appears.

## Non-goals (for now)
Keep scope tight. The following are explicitly out of scope for the initial product and live in a "future features" backlog:
- Realtime collaboration / live cursors / websocket sync
- Session replay or video recording
- Browser console log / network log capture
- Issue assignment workflows
- Slack, Discord, Jira integrations

When a request touches one of these, flag it as future work rather than silently expanding scope.

## Design principles
- **Lightweight first.** The SDK runs on a stranger's prototype â€” every kilobyte and every global side effect matters.
- **Svelte-first SDK.** Prototypes are built in Svelte/SvelteKit, so the SDK is designed and tested against Svelte first. The core is plain TypeScript that touches the DOM directly, so it remains usable from any browser context, but Svelte is the only officially supported integration in v1.
- **Self-host friendly.** No mandatory third-party SaaS dependencies. Screenshots and uploads are stored on the **API host's local filesystem** â€” no S3, no R2, no MinIO.
- **Selector + coordinates + screenshot, together.** Every pin captures all three: a stable DOM selector, the relative viewport position (and raw pixel coordinates), and a screenshot of the page at the moment of capture. The combination is what makes a pin survive layout changes and stay reviewable later.
- **Open-source posture.** Code, defaults, and documentation should be friendly to external contributors.
