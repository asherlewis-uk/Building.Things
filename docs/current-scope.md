# Current Scope

## Canonical product definition

Building.Things is the **desktop workspace surface** of a two-surface product system.

The complete product now consists of:

1. **Building.Things** — desktop workspace shell
2. **AI-UI-100** — separate native mobile app architecture for iOS and Android
3. **Shared protocol layer** — identity, session handoff, detach and attach state, presence, and message synchronization

This project must no longer be framed as a single web app that becomes responsive on mobile.

## What Building.Things owns

Building.Things owns the high-bandwidth desktop workspace:

- workspace selection and persistence
- session selection and message history authority on desktop
- file tree and editor state
- write-mode orchestration
- terminal rail and preview surfaces
- artifacts and pseudo-deployment records
- settings, MCP configuration, and desktop-oriented operational surfaces

The desktop shell remains local-first unless an explicit service layer says otherwise.

## What AI-UI-100 owns

AI-UI-100 owns the native mobile product surfaces:

- native iOS chat app
- native Android chat app
- phone-first chat navigation and composition
- mobile-native keyboard, gestures, haptics, and notifications
- phone-side session resumption and detached chat participation
- quick actions and mobile-first conversation ergonomics

AI-UI-100 is not a wrapper around the desktop shell. It is a separate client with separate UI architecture.

## Shared responsibilities

The following concepts must be shared across both products:

- identity
- workspace identity
- session identity
- conversation timeline shape
- detach and attach state
- active-device and presence state
- handoff links and deep-link payloads
- message synchronization semantics
- attachment and artifact reference model

## Non-goals

The following are explicitly out of scope:

- making the full IDE fit on a phone screen
- calling a responsive web layout a native mobile strategy
- treating the mobile product as a secondary afterthought
- letting desktop-only UI assumptions leak into the mobile app contract
- tightly coupling mobile rendering to desktop panel layout decisions

## Required engineering posture

When changing Building.Things, contributors must assume:

- the chat and session runtime will be mounted outside the desktop shell
- the mobile client will speak to shared identity and session services, not desktop panel internals
- desktop and mobile may both be active against the same session
- presence and handoff must be modeled explicitly rather than inferred from UI state
