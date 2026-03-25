# Implementation Readiness Checklist

Use this checklist before doing cross-repo implementation work.

## Shared system readiness

- desktop repo and native repo use the same branch intent
- shared protocol changes are written down before code changes begin
- paired PR plan exists if both repos will change
- environment variable naming is aligned where possible

## Building.Things readiness

- identify the service boundary that owns the change
- keep route handlers thin
- keep workspace and session scoping intact
- avoid fake remote or sync states

## AI-UI-100 readiness

- do not change native app architecture to resemble the desktop shell
- keep native navigation native
- consume only the shared contract, not desktop UI assumptions

## First implementation target

The first implementation branch should be in Building.Things and should focus on:

- chat-core service boundary extraction
- mobile-safe session endpoints
- handoff payload generation
- presence and detach state model

## Validation

- desktop still works without native client present
- native contract is documented before native consumption changes
- no cross-repo drift in names or identifiers
