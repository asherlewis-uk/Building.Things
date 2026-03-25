# Implanting AI-UI-100 into the Building.Things System

## Goal

Use `AI-UI-100` as the native iOS and Android companion to `Building.Things` without collapsing both products into one frontend architecture.

## The correct mental model

Do **not** implant AI-UI-100 by copying its entire app into Building.Things.

Instead, implant it at the **system boundary**:

- Building.Things remains the desktop workspace authority
- AI-UI-100 becomes the native mobile chat client
- both products consume a shared identity and session contract

## Implementation sequence

### Phase 1 — stabilize the desktop contract

Before moving UI across repositories, Building.Things should expose a stable shared contract for:

- current user and identity
- workspace list and active workspace
- session list and active session
- message timeline read
- message send
- detach and attach intent
- mobile handoff token generation
- presence indicator read

This does not require moving all data to a remote store on day one. It does require a coherent service boundary.

### Phase 2 — extract chat runtime from desktop-only presentation

In Building.Things, separate:

- session and message logic
- message composer logic
- timeline rendering primitives
- session actions

from:

- center panel layout
- desktop chrome
- sidebar assumptions
- inspector coupling

The objective is to make the chat runtime portable, not to make the desktop panel responsive.

### Phase 3 — define the shared protocol

Create or formalize a shared contract package or spec covering:

- identifiers (`workspace_id`, `session_id`, `message_id`)
- timeline payloads
- send-message request and response shapes
- presence payloads
- detach-to-mobile payloads
- artifact link payloads
- deep-link contract used by AI-UI-100

### Phase 4 — connect AI-UI-100 as a native client

AI-UI-100 should then implement:

- sign-in and identity bootstrap
- workspace selection when appropriate
- chat list or session list
- detached active-session screen
- message send and receive
- deep-link resume from desktop handoff
- native presence and reconnect behavior

### Phase 5 — add mobile-specific strengths

Once the shared protocol works, add phone-native advantages only in AI-UI-100:

- push notifications
- biometrics
- haptics
- share sheet integration
- deep native navigation
- offline queueing and reconnect semantics

## What not to do

- do not move the desktop panel system into React Native
- do not treat AI-UI-100 as a second skin on top of the web shell
- do not let desktop route structure dictate native navigation hierarchy
- do not merge both codebases prematurely

## Recommended repo relationship

### Building.Things owns
- desktop workspace UX
- desktop orchestration logic
- local-first shell behavior
- shared protocol definitions if you keep them server-adjacent

### AI-UI-100 owns
- native app UX
- native navigation
- native device integrations
- mobile-first session participation

## Immediate next engineering step

Inside Building.Things, extract a **chat-core service boundary** before porting screens.

That means creating a clear layer for:

- reading session timeline
- sending messages
- selecting active session
- surfacing detach state
- resolving current identity and presence

Once that exists, AI-UI-100 can be attached to the same system without inheriting the desktop shell.
