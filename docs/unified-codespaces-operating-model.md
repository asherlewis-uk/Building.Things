# Unified Two-Codespaces Operating Model

## Purpose

This document defines how to operate **Building.Things** and **AI-UI-100** as **one product system** while keeping them in separate GitHub repositories and separate GitHub Codespaces.

## Reality check

You cannot literally merge two GitHub Codespaces into one runtime or one filesystem unless you restructure the repositories into a monorepo.

The correct goal is different:

> Treat the two repositories, two branches, and two Codespaces as one coordinated product system with one source of architectural truth, one protocol, one release story, and one implementation cadence.

That is the operating model this document defines.

---

## Product split

### Repository A — Building.Things

Role:
- desktop workspace shell
- workspace, session, file, artifact, preview, and write-mode orchestration
- desktop-only interaction density
- shared protocol ownership unless later extracted into a third contract package

### Repository B — AI-UI-100

Role:
- native iOS and Android product
- detached chat participation
- deep link and handoff client
- native notifications, haptics, biometrics, reconnect, and mobile-first conversation UX

---

## Non-negotiable rules

1. **One product, two clients**
   - Do not talk about these as two separate apps with optional overlap.
   - They are two clients of one product system.

2. **Desktop owns desktop concerns**
   - Files, terminal, preview, editor density, and desktop shell orchestration stay in Building.Things.

3. **Native owns mobile concerns**
   - Navigation, keyboard behavior, haptics, notifications, and mobile composition stay in AI-UI-100.

4. **Shared protocol is sacred**
   - Both repos must use the same identifiers, payload shapes, and handoff semantics.

5. **No UI leakage across platforms**
   - Desktop panel assumptions must not leak into native app architecture.
   - Native navigation assumptions must not leak into desktop layout design.

---

## How to make the two Codespaces behave as one system

### 1. Use the same branch intent in both repos

When doing cross-system work, create a paired branch set.

Recommended naming:

- Building.Things: `feat/mobile-handoff-core`
- AI-UI-100: `feat/mobile-handoff-core`

Branch names should match whenever the change spans both repositories.

### 2. Pin one canonical work item

Every cross-repo task needs one short system brief at the top of both branches or PRs:

- goal
- protocol impact
- desktop impact
- native impact
- test plan
- rollback plan

### 3. Keep one source of protocol truth

Pick one place to define the shared contract.

Best default for now:
- keep the canonical protocol docs in **Building.Things/docs/**
- mirror only what AI-UI-100 needs into its own docs

If drift starts, extract a dedicated shared package or spec repo later.

### 4. Run both Codespaces side-by-side

Recommended daily setup:

- one Codespace open for `Building.Things`
- one Codespace open for `AI-UI-100`
- one issue / branch name / implementation goal
- one changelog note describing the joint change

### 5. Use deep links and environment parity

Both repos should agree on:

- base environment names (`local`, `staging`, `prod`)
- handoff link format
- session resume payload shape
- auth environment variable naming
- shared API base URL naming

### 6. Merge as a pair

When work crosses repos:

- do not merge one side casually and forget the other
- open paired PRs
- link each PR to the other
- include a short section named `Paired change` with the companion repo and branch

---

## Required shared contract

Both repositories must agree on at least the following fields:

- `workspace_id`
- `session_id`
- `message_id`
- `device_id`
- `active_surface`
- `detach_state`
- `presence_state`
- `handoff_token`
- `deep_link_path`
- `artifact_reference`

Recommended enumerations:

- `active_surface`: `desktop` | `ios` | `android`
- `detach_state`: `attached` | `detached_to_mobile` | `multi_surface`
- `presence_state`: `offline` | `idle` | `active`

---

## Environment setup policy

### Shared variables by intent

Both repos should use consistent variable naming where possible:

- `APP_ENV`
- `API_BASE_URL`
- `APPWRITE_ENDPOINT`
- `APPWRITE_PROJECT_ID`
- `APPWRITE_API_KEY` or equivalent server secret
- `APPWRITE_AUTH_MODE`
- `MOBILE_DEEP_LINK_SCHEME`
- `WEB_HANDOFF_BASE_URL`

### Desktop-only variables

Keep Building.Things-specific local state and shell variables in Building.Things only.

### Native-only variables

Keep mobile push, native bundle IDs, and device-specific settings in AI-UI-100 only.

---

## Daily workflow

### Desktop-first feature

1. Change protocol or service contract in Building.Things
2. Update docs in Building.Things
3. Implement native consumption in AI-UI-100
4. Verify handoff and session continuity
5. Merge both PRs together

### Native-first feature

1. Define required contract change in Building.Things docs first
2. Add or adapt server/service support in Building.Things
3. Implement native UX in AI-UI-100
4. Validate against the agreed contract
5. Merge both PRs together

---

## What success looks like

The two Codespaces are behaving as one system when:

- both repos use the same branch intent
- protocol changes are documented once and implemented consistently
- paired PRs move together
- desktop and native can both address the same session truthfully
- handoff and presence are modeled explicitly

---

## What failure looks like

You are drifting if:

- AI-UI-100 invents payloads that Building.Things does not define
- Building.Things changes session semantics without updating native assumptions
- one repo merges while the paired repo stays stale
- mobile is treated like a responsive mode of the desktop shell
- desktop panel layout decisions leak into native navigation
