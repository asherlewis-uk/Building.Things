# Start Here — Native Mobile Scope Reset

This file is the fastest way to understand the project's updated scope.

## Scope reset

Building.Things is no longer only a local-first desktop IDE shell.
It is now the **desktop workspace surface** in a larger product system that also includes a **separate native mobile chat product**.

The product is intentionally split into:

1. **Building.Things** — desktop workspace shell
2. **AI-UI-100** — separate native iOS and Android app architecture
3. **Shared protocol + identity layer** — session lookup, detach and attach state, presence, auth, handoff, and message synchronization

## Non-negotiable rule

The phone product is **not** a responsive version of the desktop IDE.

Do not try to make the full IDE fit on a phone screen.
Do not treat mobile as a stylesheet problem.
Do not collapse native mobile work into desktop panel assumptions.

## Canonical docs

- `docs/current-scope.md`
- `docs/platform-split.md`
- `docs/ai-ui-100-implantation-plan.md`

## Short version

### Building.Things owns

- desktop workspace and orchestration
- workspace, session, file, artifact, and preview flows
- local-first desktop shell behavior
- future extractable chat-core service boundaries

### AI-UI-100 owns

- native iOS app
- native Android app
- phone-first chat UX
- mobile-native navigation, haptics, notifications, and reconnect behavior
- detached participation in active desktop sessions

### Shared contract must eventually define

- `workspace_id`
- `session_id`
- `message_id`
- `device_id`
- `active_surface`
- `detach_state`
- `presence_state`
- handoff token and deep-link payloads
- message timeline payloads
- artifact reference payloads

## Immediate engineering implication

Inside Building.Things, the chat and session runtime should be made portable.
That means extracting a chat-core service boundary before porting UI into AI-UI-100.
