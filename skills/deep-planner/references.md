# References: Manus Planning Principles for Persistent Context

These principles are adapted from the Manus AI agent design philosophy, applied specifically to multi-session code tasks. The core insight is that an AI agent's context window behaves exactly like computer RAM — fast, powerful, but completely volatile. Treating the filesystem as persistent external memory is not an optimization; it is the foundation of reliable long-horizon task execution.

---

## Principle 1: Filesystem as External Memory (KV-Cache for Tasks)
> "Write to disk what you cannot afford to lose. Read from disk before every consequential decision."

The context window can hold roughly 200K tokens. A large codebase, a research session, two rounds of tool calls, and some back-and-forth fills that budget quickly. Any finding, decision, or intermediate result that lives only in the context window is at risk of evaporation by compression, session reset, or simply being pushed out of the active window by subsequent tokens.

The three-file system creates three durability layers:

- **task_plan.md** = the contract. What was agreed to build and in what order. Never changes except to check boxes.
- **findings.md** = the knowledge base. Everything discovered, every decision, everything that went wrong. Append-only.
- **progress.md** = the timeline. Session-by-session record of what happened. The audit trail.

In KV-cache terms: every research operation is a "key-value write." The findings.md file is the persistent cache. A cache miss (finding not in findings.md) costs a full research re-run. A cache hit (finding already in findings.md) costs one read operation. The 2-Action Rule is the write policy: flush to cache every 2 research operations, never accumulate more than 2 un-flushed findings.

A task that uses all three files has zero risk of losing context across sessions. A task that uses none is one `/clear` away from starting over.

---

## Principle 2: Manipulate Attention Through Recitation
> "Re-reading is not busywork. Re-reading is the mechanism that prevents drift."

Language models are susceptible to local-optimum thinking: the current context biases the next decision. After 20 minutes of debugging a specific function, the natural tendency is to over-invest in that function — even when the goal was to ship a complete feature. The Goal sentence in task_plan.md exists to interrupt this pattern.

Before every major decision, re-read task_plan.md. The act of reading the Goal sentence re-weights the entire context toward the original intent. This is not a procedural formality — it is an active cognitive reset.

In practice, recitation catches:
- "I was about to refactor this unrelated function, but the goal is just to ship the login endpoint."
- "I was about to add a new feature, but Phase 2 isn't finished."
- "I was about to choose option B, but the Decisions log already evaluated B and rejected it in Session 1."

The cost of re-reading is seconds. The cost of not re-reading is hours of drift.

---

## Principle 3: Log Failures — They Are the Most Valuable Part of the Record
> "The error log is more valuable than the success log."

Standard documentation logs successes: "We implemented X using approach Y." The error log documents failures: "We tried X using approach Y, it failed because Z. We then tried approach W and it succeeded."

The failure log is more valuable because:
1. It prevents the same mistake from being made later in the same task
2. It shows the decision-making process, not just the outcome
3. It provides full transparency if the user needs to review or override a decision
4. In a future session, reading "we tried this and it failed" is faster than discovering it fails again through experimentation

The `.plan/findings.md` Issues section must log every error, even resolved ones. The resolution note goes in the same entry: "Tried X (failed: reason). Resolved by: Y."

---

## Principle 4: The 2-Action Rule — The Cache Write Policy
> "Two research operations → one flush. No exceptions."

The 2-Action Rule exists because of a specific failure pattern: an agent runs 5 or 6 tool calls in sequence, accumulates rich findings in its context window, then the session ends before those findings are written. The next session starts with an empty findings.md and redoes all the research.

The rule is calibrated at 2 (not 5, not 10) because:
- 2 tool calls produce at most a few hundred tokens of findings — easy to summarize
- Flushing at 2 creates a reliable rhythm: research, research, write. Research, research, write.
- The psychological cost of flushing is low when the batch is small; it grows when the batch is large

Research operations that trigger the rule: `search_code`, `research_topic`, `get_context` (for understanding, not editing), `audit_file`, `git_blame_context`, `commit_history_search`.

Operations that do NOT trigger the rule: writing or editing files, `task_create` / `task_list` / `task_next`, reading the plan files themselves.

---

## Principle 5: Phase Gates as Commitment Devices
> "A phase gate makes 'I'll finish this later' structurally impossible."

Phases create irreversible progress. When a phase gate is enforced — all boxes checked before proceeding — there is never an ambiguous state where "half the authentication system exists." Either Phase 2 is done or it isn't. This matters especially for session restore: a partial phase is ambiguous; a complete phase is unambiguous.

The gate also prevents the most common multi-step failure mode: starting the next exciting thing before the current necessary thing is finished.

DEFERRED items are the escape valve. If a sub-task turns out to be impossible in the current session, mark it `[DEFERRED: reason]` and close the phase. A DEFERRED item is explicitly acknowledged debt, not invisible incompleteness. The difference matters: invisible incompleteness creates false confidence; explicit deferral creates an actionable record.

---

## Principle 6: The 3-Strike Protocol
> "Three genuine attempts, then escalate. Never attempt a 4th approach autonomously."

The 3-strike protocol exists because autonomous agents have a specific failure mode: they can try variations of the same broken approach indefinitely, each attempt slightly different but fundamentally flawed. The 3-strike rule sets a hard ceiling on autonomous problem-solving before involving the user.

The three attempts must be categorically different:
- Attempt 1: The original approach as designed
- Attempt 2: A categorically different approach (different tool, different algorithm, different mental model)
- Attempt 3: Minimal reproduction — isolate the smallest possible failing case to understand the root cause

After 3 failures, the escalation note in progress.md must be specific:
- What was tried (all 3 attempts, briefly)
- What failed each time (the specific error or wrong outcome, not "it didn't work")
- What the agent believes the root cause is
- What specific information or decision from the user would unblock the task

Vague escalations ("I couldn't figure it out") are not acceptable. The user should be able to read the escalation note and immediately know what to decide.

---

## The Agent Loop in deep-planner Context

```
ANALYZE  → Read task_plan.md: what is the current phase and unchecked box?
THINK    → Check findings.md: is there relevant prior research that avoids re-work?
SELECT   → Choose the single best next tool call for this phase step
EXECUTE  → Run the tool call
OBSERVE  → Has a 2-research-op threshold been reached? → flush to findings.md
ITERATE  → Mark checkbox if step is done; check phase gate before advancing
```

Every iteration of the loop has one invariant: findings.md must never be more than 2 research operations behind the current context. This is the guarantee that makes session restore reliable.
