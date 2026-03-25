# Qwen Finisher Stack — `qwen3.5-coder:480b:cloud`

## Scope of this document

This document assumes you intend to use the model string:

`qwen3.5-coder:480b:cloud`

through an **Ollama-compatible cloud endpoint** as the finishing model for the project.

Because model hosting products and exact endpoint semantics can change, this document is intentionally written around the **operating pattern** rather than a single vendor-specific control panel.

---

## What this model should be used for

Use the finisher model for:

- final code shaping
- architecture-preserving refactors
- large diff cleanup
- documentation completion
- contract alignment across desktop and native repos
- branch finish passes before PR

Do **not** make this model the first-pass ideation model for every task.

Best pattern:

1. cheaper / faster model for exploration
2. `qwen3.5-coder:480b:cloud` for consolidation and finishing

---

## Recommended deployment posture

For a 480B-class model, the most efficient posture is usually:

- **remote cloud inference** for the model itself
- **local Codespaces** for implementation work
- **one GUI for human steering**
- **one API-compatible endpoint for tooling**

That means the model should usually **not** be self-hosted inside a GitHub Codespace.

Codespaces should act as the engineering environment, not the heavy inference host.

---

## Recommended GUI and operator environment

### Best general-purpose GUI

**Open WebUI** is usually the most efficient GUI choice when you want:

- an Ollama-friendly operator surface
- model switching
- reusable system prompts
- artifact review and iteration
- one human control panel for both repos

Why this is the best default:

- it keeps model steering separate from your implementation IDE
- it is simple to operate
- it maps well to an Ollama-style serving model
- it gives you a persistent place for finisher prompts and branch-finish checklists

### Best engineering environment

Use **GitHub Codespaces + VS Code** as the implementation environment.

Why:

- immediate access to both repos
- branch-based work and PR flow
- terminal, diff, and code search together
- clean separation between model runtime and code workspace

### Recommended split

- **Open WebUI** = model steering / finishing / review
- **GitHub Codespaces** = actual coding and validation

---

## Efficient environment layout

### Window 1 — Desktop repo Codespace

Repository:
- `Building.Things`

Responsibilities:
- desktop shell changes
- protocol documentation
- API and service boundary work

### Window 2 — Native repo Codespace

Repository:
- `AI-UI-100`

Responsibilities:
- native client work
- deep-link handling
- mobile session UX

### Window 3 — Open WebUI

Responsibilities:
- run `qwen3.5-coder:480b:cloud`
- keep pinned finisher prompts
- perform end-of-branch review
- produce final cleanup instructions

---

## Required environment variables

The exact names will depend on your serving layer, but the operating pattern should include:

- `OLLAMA_HOST`
- `OLLAMA_MODEL=qwen3.5-coder:480b:cloud`
- any required auth token or gateway secret for the remote endpoint

If you are fronting the model through a gateway or compatibility layer, keep the model name stable and swap the endpoint behind it.

That prevents prompt and tooling churn.

---

## Performance and efficiency rules

1. **Do not run the finisher model for trivial edits**
   - reserve it for high-value passes

2. **Keep context small and structured**
   - branch goal
   - changed files
   - invariants
   - acceptance criteria

3. **Always provide repository role context**
   - tell the model whether it is finishing desktop code or native code

4. **Use paired branch names across repos**
   - this reduces confusion when the model reasons across both systems

5. **Prefer spec-first prompts**
   - give the model the contract and ask it to finish toward the contract

---

## Best usage pattern for this project

### For Building.Things

Use the finisher model to:

- clean up route and service boundaries
- preserve local-first truthfulness
- extract chat-core boundaries
- tighten docs and protocol definitions

### For AI-UI-100

Use the finisher model to:

- refine native session flows
- improve reconnect and handoff behavior
- clean up navigation and typing
- ensure native features do not violate shared contract assumptions

---

## Anti-patterns

Do not:

- ask the finisher model to invent architecture without constraints
- dump both repos in raw form without a goal
- let it rewrite platform boundaries casually
- rely on one giant conversational context instead of explicit task packets
- host the 480B-class model directly in Codespaces

---

## Golden operating loop

1. define the exact branch goal
2. identify which repo owns the change
3. identify whether the change affects the shared contract
4. implement in Codespaces
5. use `qwen3.5-coder:480b:cloud` for finish pass
6. run validation
7. open paired PRs if both repos changed

---

## Minimal task packet for the finisher model

Every prompt to the finisher model should include:

- repo name
- branch name
- task goal
- files in scope
- invariants that must not break
- acceptance checks
- output format required

This is more important than adding lots of prose.
