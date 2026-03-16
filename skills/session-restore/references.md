# References: Context Recovery Principles

These principles are adapted from the Manus AI agent design philosophy, applied specifically to session recovery. The central insight is that every valuable piece of working context — every decision, every finding, every completed step — must exist on disk before it can be recovered. Context that lives only in the context window is irretrievably lost the moment the session ends.

---

## Principle 1: The RAM/Disk Model of Agent Memory
> "The context window is RAM. Files are disk. /clear is a power cycle. Recovery = reading disk."

Every computing system separates volatile memory (RAM) from persistent storage (disk). RAM is fast and immediately accessible — everything the system is actively working with lives there. Disk is slower to access but durable — data written to disk survives power cycles, crashes, shutdowns.

The context window is RAM:
- It holds everything currently being worked on
- It is fast to access (everything is already "loaded")
- It is completely wiped on session end, /clear, or context window compression
- It cannot be recovered once wiped — there is no "undo" for a session reset

The filesystem is disk:
- It holds what was explicitly written down during prior sessions
- It requires a read operation to access
- It survives session resets, /clear commands, days of inactivity, computer restarts
- It is always recoverable as long as the files exist

Recovery after a session reset is identical to a computer booting from disk: read the persistent state back into volatile memory, reconstruct the working context, and resume. This is not a metaphor — it is the literal mechanism. The session-restore skill is the boot sequence. The .plan/ files are the boot disk.

---

## Principle 2: Context Offloading — What to Write and When
> "If you cannot afford to lose it, write it to disk immediately."

Context offloading is the practice of writing important context to persistent storage before it is needed for recovery. The question is not "should I write this down?" — everything should be written down. The question is "how quickly after discovery must I write this?"

Priority tiers for offloading:
- **Write immediately:** Architectural decisions, library choices, rejected approaches, resolved blockers. These are irreversible — if lost, the decision may be re-made differently, invalidating completed work.
- **Write within 2 ops:** Research findings, code patterns discovered, file relationships. The 2-Action Rule enforces this tier automatically.
- **Write at session end:** Session summary, open items for next session, current phase status. Progress.md gets a session-end entry before the session closes.
- **Write only if blocking:** Trivial observations, implementation details obvious from reading the code. These don't need offloading — they can be re-discovered cheaply.

The 2-Action Rule is the enforcement mechanism for the second tier. Without an explicit rule, the natural tendency is to defer writing until "there's more to say" — which means never writing at all if the session ends first.

---

## Principle 3: Filesystem as Memory — The .plan/ Directory as Working Memory Architecture
> "The three files are not documentation. They are the working memory of the task."

The distinction between "documentation" and "working memory" matters:
- Documentation is written after work is done, for future readers
- Working memory is written during work, for the same agent in a future session

The .plan/ files are working memory. This means:
- **task_plan.md** is not a spec document — it is the decision-making anchor. Re-read it before every major choice.
- **findings.md** is not a notes file — it is the research cache. Check it before running any research tool.
- **progress.md** is not a log — it is the resume point. Read the last entry before taking any action in a new session.

The difference shows up in behavior: working memory is consulted before acting; documentation is consulted after acting (if at all). Session-restore depends entirely on these files being written as working memory, not as documentation. If they were written as documentation (after the fact, summarized, cleaned up), they would not contain the granular state needed for precise resume.

---

## Principle 4: Never Repeat Failures — The Open Issues Scan
> "Before resuming work, check what was blocked. A resolved blocker might have become unblocked."

One of the five reboot questions — "What have I learned?" — specifically surfaces the Issues section of findings.md. This is intentional. Open issues from prior sessions are:

1. **Potential re-blockers:** If an issue was logged as open and unresolved, the same action that caused it before will cause it again. Knowing this prevents repeating a known failure.

2. **Potential self-resolvers:** In multi-day tasks, external dependencies sometimes resolve between sessions — a dependency gets updated, an API changes, a team member merges a fix. An issue logged 3 days ago as "blocked: waiting for API endpoint" might now be unblocked.

3. **Pattern indicators:** A cluster of related issues in findings.md reveals a systemic problem. Three separate "null reference in user context" issues logged over 3 sessions are not 3 separate bugs — they are one architectural gap.

The rule: before writing a single line of code in a restored session, read the Issues section of findings.md and classify each open issue as: still open, now resolved, or partially resolved. This takes 2 minutes and prevents hours of re-discovering known problems.

---

## Principle 5: The Append-Only Progress Log — Audit Trail as Safety Net
> "Never overwrite a session. Each session header is a timestamp in the audit trail."

progress.md is append-only by design. Every new session header goes at the bottom. The full history of all sessions is preserved indefinitely.

This matters for three failure modes in particular:

1. **Debugging regressions**: If something went wrong in Phase 2 that isn't discovered until Phase 4, the Phase 2 session log shows exactly what was done and when. Without the log, the investigation starts from zero.

2. **Decision tracing**: Decisions are timestamped. "We chose approach X on March 15" is a verifiable fact. Without the log, the only answer is "I think we chose X" — exactly the uncertainty that causes re-work.

3. **Partial-restore recovery**: If findings.md is missing, progress.md contains enough action history to reconstruct what was done and what research was run. It is the fallback layer when the primary layer is gone.

The cost of keeping old session headers is negligible. The cost of losing them can be hours of re-investigation.

---

## Principle 6: Partial Recovery Is Better Than No Recovery
> "Use every scrap of available context before starting fresh."

When one or two of the three files are missing, do not abandon the restore. Use what is available:

**task_plan.md missing:** Use `task_list` and `spec_list` to find active tasks. Use progress.md to infer which phase was active (last logged action). Reconstruct task_plan.md and document that it was reconstructed.

**progress.md missing:** Use task_plan.md to identify the current phase (last `[x]` before first `[ ]`). Use findings.md for timestamped decisions and research. Create a new progress.md noting the missing history.

**findings.md missing:** This is the most serious loss. Use progress.md to identify what research was run, then re-run key research operations. Create new findings.md and explicitly note what context was lost.

**All files missing:** Run deep-planner to create a fresh planning baseline. Ask the user for key decisions they remember. Document the fresh start explicitly.

The principle: partial context is always better than no context. Even a single recovered file reduces re-work. Start fresh only when every recovery path has been exhausted.

---

## The Agent Loop in session-restore Context

```
ANALYZE  → Does .plan/ exist? Which files are present?
THINK    → Read all present files. Note any stale references (>24h for external resources).
SELECT   → Verify stale references with research_topic or get_context
EXECUTE  → Answer the 5-Question Reboot Check — write all 5 answers explicitly
OBSERVE  → Call task_next and cross-reference with task_plan.md unchecked boxes
ITERATE  → Append new session header to progress.md, then begin work
```

The loop has one non-negotiable invariant: the 5-Question Reboot Check must be answered in writing before any implementation action is taken. Answering mentally (without writing) provides no protection against drift and creates no audit trail.
