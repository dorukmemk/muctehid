# Examples: Deep Planner in Action

## Example 1: Complex Feature Implementation

**User Request:** "Add a full authentication system with JWT, refresh tokens, and role-based access control."

### Loop 1: Complexity assessment and spec creation
```bash
research_topic topic="JWT refresh token rotation patterns"     # understand the domain
search_code query="auth middleware existing implementation"    # find current state
spec_init name="auth-system" description="JWT + RBAC with refresh token rotation"
spec_generate specId="auth-system" phase="requirements"
```

### Loop 2: Design and planning — write .plan/ files
```bash
spec_generate specId="auth-system" phase="design"
spec_generate specId="auth-system" phase="tasks"
# Write .plan/task_plan.md — Goal: "Implement JWT auth with RBAC and refresh token rotation"
# Write .plan/findings.md — JWT rotation decision, library selection
# Write .plan/progress.md — Session 1 header, 5-Question Reboot Check baseline
```

### Loop 3: Phase 1 implementation with 2-Action Rule enforcement
```bash
get_context filepath="src/middleware/auth.ts"                  # pre-edit hook
search_code query="token blacklist storage redis"              # research op 1
audit_file filepath="src/auth/tokenService.ts"                 # research op 2 — flush to findings.md now
task_next                                                       # confirm next task aligns with Phase 1
```

### Loop 4: Phase gate and handoff to Phase 2
```bash
audit_diff                                                      # verify no regressions before Phase 2
# Check all Phase 1 boxes [x] in task_plan.md — hard stop, no exceptions
# Append "Phase 1 complete" to progress.md
task_next                                                       # begin Phase 2
```

---

## Example 2: Multi-File Bug Hunt

**User Request:** "Users are getting logged out randomly. It's happening in production but I can't reproduce it."

### Loop 1: Understand the blast area and create plan
```bash
research_topic topic="session invalidation race conditions JWT"    # domain context
search_code query="session expiry logout invalidate token"         # find all related code
# Write .plan/task_plan.md — Goal: "Identify and fix root cause of random logouts"
# Write .plan/findings.md and .plan/progress.md
```

### Loop 2: Evidence gathering — flush after every 2 ops
```bash
git_blame_context filepath="src/auth/sessionManager.ts"           # who last changed this?
commit_history_search query="logout session expire fix"            # any prior fixes on this file?
# 2 research ops done — append findings to .plan/findings.md immediately
complexity_score filepath="src/auth/sessionManager.ts"            # is the code fragile?
audit_file filepath="src/auth/sessionManager.ts"                   # any obvious quality issues?
# 2 more research ops — flush to findings.md again
```

### Loop 3: Hypothesis, task creation, and fix
```bash
search_code query="setInterval clearTimeout session refresh"       # find timer-based issues
research_topic topic="Node.js timer drift long-running processes"  # validate hypothesis
# 2 ops — flush to findings.md
task_create title="Fix: session timer drift causing premature expiry" category="bug"
get_context filepath="src/auth/sessionManager.ts"                  # pre-edit hook
audit_file filepath="src/auth/sessionManager.ts"                   # verify fix is clean
audit_diff                                                          # full diff before close
```

---

## Example 3: Large Module Refactor

**User Request:** "The payment module is a 900-line God object. Break it into smaller services."

### Loop 1: Measure before touching anything
```bash
complexity_score filepath="src/payments/PaymentService.ts"         # baseline CC score
search_code query="PaymentService import"                           # find all consumers
get_dependencies filepath="src/payments/PaymentService.ts"          # map what it imports
# Write .plan/task_plan.md — Goal: "Decompose PaymentService into 3 focused services"
# Write .plan/findings.md — current CC, consumer list, dependency map
```

### Loop 2: Plan the decomposition with run_skill
```bash
research_topic topic="service decomposition patterns charge refund reporting"
run_skill skill="refactor-planner" filepath="src/payments/PaymentService.ts"
# Append refactor plan to .plan/findings.md
task_create title="Extract ChargeService from PaymentService" category="refactor"
task_create title="Extract RefundService from PaymentService" category="refactor"
task_create title="Extract ReportingService from PaymentService" category="refactor"
```

### Loop 3: Phase 1 — extract ChargeService and verify
```bash
get_context filepath="src/payments/PaymentService.ts"              # pre-edit hook
# Create src/payments/ChargeService.ts
audit_file filepath="src/payments/ChargeService.ts"                # verify new file is clean
complexity_score filepath="src/payments/ChargeService.ts"          # confirm CC improvement
# Update .plan/progress.md — Phase 1 complete, Phase 2 queued
```

### Loop 4: Final verification with before/after delta
```bash
complexity_score filepath="src/payments/PaymentService.ts"         # residual complexity delta
audit_diff                                                          # full changeset audit
# Append final before/after CC delta to progress.md
task_next                                                           # confirm Phase 2 is queued correctly
```

---

## Example 4: Session Restored After Context Reset

**User Request:** "Continue where we left off on the auth system."

### Loop 1: Restore context from disk (disk → RAM reboot)
```bash
# Read .plan/task_plan.md — Goal sentence + which phase was active + unchecked boxes
# Read .plan/progress.md — last session's last logged action
# Read .plan/findings.md — open issues, key decisions, locked-in library choices
# Answer 5-Question Reboot Check verbatim — write out all 5 answers
task_next                                                           # cross-reference with plan checkboxes
```

### Loop 2: Resume Phase 2 from the exact checkpoint
```bash
get_context filepath="src/auth/rbacMiddleware.ts"                  # pre-edit hook for Phase 2 file
search_code query="role permission check middleware"               # verify what's already done
# 2 ops — flush to findings.md before any implementation
# Append new session header to progress.md
audit_diff                                                          # end-of-session gate before finishing
```
