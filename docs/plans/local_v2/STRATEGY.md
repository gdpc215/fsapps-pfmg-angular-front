# Sub-Agent Build Strategy

This guide explains how to use the work package files in this folder to build the PFMG app with parallel sub-agents.

---

## The idea

Each WP file is a self-contained brief for one sub-agent. It tells the agent exactly what files to create, what code to write, and what to verify — without needing to read the full design docs. Agents working on independent WPs can run at the same time.

---

## Two-wave execution

### Wave 1 — Foundation (run sequentially, then in parallel)

**First, alone:**
> Run WP01. It installs SheetJS and creates all models and core services. Every other WP depends on these files existing.

**Then, all at once:**
> Once WP01 is done, launch WP02 through WP06 in parallel. They don't depend on each other — only on WP01.

```
WP01  →  WP02 + WP03 + WP04 + WP05 + WP06  (all parallel)
```

Wave 1 is done when all six WPs pass `npm run build`.

### Wave 2 — Features (all parallel)

Once Wave 1 is complete, launch WP07 through WP14 all at the same time. Each feature is isolated in its own lazy-loaded module.

```
WP07 + WP08 + WP09 + WP10 + WP11 + WP12 + WP13 + WP14  (all parallel)
```

---

## How to prompt each agent

Give the agent three things:

1. The WP file as the primary instruction.
2. The relevant sections of the spec (each WP lists which sections apply).
3. This instruction at the end:

> "Work in the repo at `d:/Development/fsapps/fsapps-pfmg-angular-front`. Follow the global coding rules in INDEX.md. When done, run `npm run build` and fix any TypeScript errors before reporting completion."

### Example prompt for WP04

```
Build the account feature services for the PFMG Angular app.

Instructions: docs/plans/local_v2/WP04-services-accounts.md
Spec reference: docs/plans/local_v1/DESIGN_LOCAL_v5.md §6.1, §6.3, §6.7
Global rules: docs/plans/local_v2/INDEX.md (Global Coding Rules section)

Work in: d:/Development/fsapps/fsapps-pfmg-angular-front
When done: run `npm run build` and fix any TypeScript errors.
```

---

## What each agent needs to know upfront

Tell every agent these facts about the project so they don't have to rediscover them:

- **Angular 19, NgModule-based** (not standalone). All components use `standalone: false`.
- **Zoneless change detection** is active. Use `ChangeDetectionStrategy.OnPush` and `async` pipe. Never rely on zone.js to trigger updates.
- **No HTTP** — all data goes through `StorageService` → `localStorage`.
- **Angular Material 19 and Tailwind CSS 3** are already installed.
- **SheetJS** (`xlsx`) is installed by WP01 — Wave 2 agents can assume it's present.
- **No test files** — skip `.spec.ts` generation.

---

## Handling merge conflicts between Wave 2 agents

Wave 2 agents each own a separate feature module directory and don't edit the same files — except for two shared files that multiple agents might touch:

| Shared file | Who touches it | Risk |
|---|---|---|
| `app.routes.module.ts` | WP02 creates it with stubs; no Wave 2 agent should modify it | Low |
| `shared.module.ts` | WP03 owns it; Wave 2 agents only import it, never modify it | None |
| `app.module.ts` | WP01/WP02 set it up; Wave 2 agents don't touch it | None |

If two agents accidentally edit the same file, the fix is simple: the second agent should import the first agent's version and add its additions without removing anything.

---

## Verifying a completed WP

Each WP file has an **Acceptance Criteria** section at the bottom. Use these as the checklist when reviewing an agent's output:

1. `npm run build` passes with no TypeScript errors.
2. Check each criterion item manually or by running the app (`npm start`).
3. If a criterion fails, re-prompt the same agent with the failing item described explicitly.

---

## If an agent gets stuck

Common issues and quick fixes:

**"Cannot find module" errors** — the agent is probably referencing a service from another WP that hasn't been built yet. Check that Wave 1 is fully complete before starting Wave 2.

**Circular dependency warnings** — most likely in WP04 or WP05. The solution is already in the WP files: services that need other services for cascade-delete receive them as a `deps` parameter at call time (from the component), not via constructor injection.

**`localStorage` not defined** — only happens in SSR or test environments. The app runs in the browser only; this is a non-issue in `ng serve`.

**Change detection not updating** — the app uses zoneless change detection. Any component that computes derived state must call `cdr.markForCheck()` after updating, or use the `async` pipe on an observable.
