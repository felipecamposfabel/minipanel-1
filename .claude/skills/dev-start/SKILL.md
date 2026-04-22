# Skill: Dev Start

Triggered when user runs /dev-start or wants to bootstrap a new project with the dev agent framework.

## Responsibility

This skill owns everything interactive:
- Requirements interview (dev-po)
- Domain expert interviews (dev-pm discovery)
- Human confirmation of decisions

When the human confirms, it launches `dev-harness.sh` for the automated build phase.
The harness only runs after `phase == "build"` — never skip to it early.

---

## Step 1: Get project context

Ask the user:
> "What are we building? Give me a name and a one-line description, or share an existing spec document if you have one."

If they provide a spec document path, read it and skip to Step 3.
If they provide a description, continue to Step 2.

---

## Step 2: Set up the project directory

Ask:
> "Where should I create the project? (e.g. ~/Developer/my-project — or press Enter to use the current directory)"

Create the directory if it doesn't exist.

---

## Step 3: Check existing state

Read `HARNESS_STATE.json` in the project root if it exists.

- `phase == "build"` → skip to Step 7 (launch harness)
- `phase == "awaiting_confirm"` → skip to Step 6
- `phase == "discovery"` → skip to Step 5 (resume domain interviews)
- `phase == "done"` → tell the user the project is already complete
- No state file → continue to Step 4

---

## Step 4: Requirements interview (dev-po)

**Always run this if PROJECT_SPEC.md does not exist.**

Use the `dev-po` agent to conduct the requirements interview. Pass it:
- The project directory path
- Any description or brief the user already provided

dev-po will ask the user questions one at a time and produce `PROJECT_SPEC.md`.
Wait for it to finish before proceeding.

---

## Step 5: Domain discovery (dev-pm)

**Always run this if `decisions/` is incomplete or missing.**

Use the `dev-pm` agent to:
- Read PROJECT_SPEC.md
- Detect which domains are relevant (backend, frontend, designer, tester)
- Run each domain expert interview — these ask the human real questions about tech stack, patterns, and constraints. Do not skip or abbreviate them.
- Produce `decisions/<domain>.json` for each domain

Wait for dev-pm to reach `phase == "awaiting_confirm"` before proceeding.

---

## Step 6: Human confirmation

Read and summarize all `decisions/<domain>.json` files for the user in plain language.

Ask:
> "Here's what was decided:
> [summary]
>
> Ready to start building? Reply 'yes' to proceed, or tell me what to change."

If the user requests changes: re-invoke dev-pm for the relevant domain with the correction noted. Loop back to this step until confirmed.

When confirmed: use dev-pm to transition `HARNESS_STATE.json` phase to `"build"`.

---

## Step 7: Launch the build harness

Run:
```bash
~/.claude/agents/dev-harness.sh "<absolute_project_root>"
```

This runs in the foreground. The harness will loop dev-pm through all tickets automatically until `phase == "done"`.

Tell the user:
> "Starting the build loop. This runs automatically — I'll report back when it's done or if anything gets blocked."

---

## Resumability

- If `PROJECT_SPEC.md` already exists, skip Step 4
- If all `decisions/<domain>.json` files exist and `phase == "build"`, skip to Step 7
- If `phase == "awaiting_confirm"`, skip to Step 6
- Never re-run a completed phase — check state before each step
