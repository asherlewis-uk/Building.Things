# Platform Split

## Product surfaces

### Building.Things

Purpose:
- desktop IDE-style workspace
- coding, inspection, preview, orchestration, artifacts, and session control

Primary characteristics:
- Next.js App Router web app
- local-first persistence
- panel-based shell
- rich desktop interaction density

### AI-UI-100

Purpose:
- native mobile chat companion
- phone-first conversation surface
- detached participation in active desktop work

Primary characteristics:
- Expo and React Native architecture
- separate navigation model
- separate mobile UI primitives
- native device capabilities

## Architecture rule

The mobile app must connect to the same conceptual system, but it must **not** inherit desktop shell assumptions.

### Do not share

- panel layout logic
- inspector layout
- terminal UI
- sidebar tree assumptions
- desktop-only modals and rail metaphors

### Do share

- types for workspace, session, and message identifiers
- auth and identity semantics
- session lookup and resume behavior
- presence model
- deep-link contract
- message payload contract
- artifact reference model

## Shared contract that must exist

A stable shared contract should eventually define:

- `workspace_id`
- `session_id`
- `message_id`
- `device_id`
- `active_surface` (`desktop` | `ios` | `android`)
- `detach_state` (`attached` | `detached_to_mobile` | `multi_surface`)
- `presence_state`
- `last_seen_at`
- message timeline payloads
- artifact reference payloads
- handoff token and deep-link payload

## Practical implication for Building.Things

The desktop repository should evolve so that:

- chat rendering is extractable from the center panel
- session actions can be called without mounting the full shell
- routes can support chat-only surfaces later
- identity and detach state can be surfaced without pretending remote sync already exists
