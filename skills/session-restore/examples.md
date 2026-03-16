# Examples: Session Restore in Action

## Example 1: Resuming After /clear With .plan/ Files Existing

**User Request:** "/clear — ok, let's get back to work. Where were we?"

### Loop 1: Read disk before doing anything else
```bash
# Check .plan/ directory exists — it does
# Read .plan/task_plan.md → Goal: "Implement OAuth2 provider integration"; Phase 3 of 4 active
# Read .plan/progress.md → Last session ended after creating OAuthCallbackHandler
# Read .plan/findings.md → Open issue: PKCE flow unsupported by legacy provider
```

### Loop 2: Answer 5 questions and cross-reference task system
```bash
task_next                                                           # cross-check with plan's current phase
# Q1: Where am I? → Phase 3, Step 2 of 4 (callback handler done, token exchange not started)
# Q2: Where am I going? → Steps 3-4 of Phase 3, then Phase 4 (testing)
# Q3: What is the goal? → "Implement OAuth2 provider integration" (verbatim from task_plan.md)
# Q4: What have I learned? → Legacy provider lacks PKCE; using state param as fallback
# Q5: What have I done? → Auth initiation, callback handler done; token exchange pending
# Append new session header to progress.md — never overwrite prior sessions
```

### Loop 3: Verify currency of key findings, then resume
```bash
research_topic topic="OAuth2 legacy provider PKCE workaround state parameter"   # finding still current?
get_context filepath="src/auth/OAuthCallbackHandler.ts"                          # pre-edit hook
audit_file filepath="src/auth/OAuthCallbackHandler.ts"                           # verify prior work is intact
# Begin token exchange implementation (Phase 3 Step 3)
```

---

## Example 2: Resuming After Session Timeout (24+ Hours Later)

**User Request:** "Good morning. Back to the payment refactor we started yesterday."

### Loop 1: Read disk and flag stale references for verification
```bash
# Read .plan/task_plan.md → Goal: "Decompose PaymentService into 3 focused services"
# Read .plan/progress.md → Yesterday session ended after Phase 1 (ChargeService extracted)
# Read .plan/findings.md → Key findings: adapter pattern chosen; library: stripe-node 12.x
# Note: findings.md mentions external library version — must verify (>24 hours elapsed)
```

### Loop 2: Verify stale references before resuming
```bash
research_topic topic="stripe-node v12 breaking changes v13 migration"            # library may have changed
get_context filepath="src/payments/ChargeService.ts"                              # verify prior work intact
# Confirm stripe-node finding is still current — update findings.md if stale
task_next                                                                         # Phase 2: RefundService
```

### Loop 3: Append session header and resume implementation
```bash
# Append "Session 2 — 2026-03-16" header to progress.md
# Answer 5-Question Reboot Check — write all 5 answers explicitly
search_code query="PaymentService refund extract"                                 # verify Phase 2 starting point
get_context filepath="src/payments/PaymentService.ts"                             # pre-edit hook for Phase 2
task_create title="Extract RefundService — Phase 2" category="refactor"
```

---

## Example 3: Recovering From a Blocked State

**User Request:** "We got stuck yesterday. Can you figure out where we are and what the blocker was?"

### Loop 1: Read all 3 files and identify the BLOCKED marker
```bash
# Read .plan/task_plan.md → Phase 2 of 3, checkbox 3 of 5 incomplete
# Read .plan/progress.md → "BLOCKED: circular dep between UserService and AuthService"
# Read .plan/findings.md → Issues section: 3 approaches tried, all produced circular dep errors
task_list status="pending"                                                         # check task system context
```

### Loop 2: Assess whether the blocker is still valid
```bash
research_topic topic="circular dependency resolution TypeScript interface layer barrel exports"
search_code query="UserService AuthService import circular"                        # verify dep still exists
# 2 ops — flush new research to findings.md
# Answer Q4 explicitly: what's changed since the block was logged?
```

### Loop 3: Select unblocking strategy and resume
```bash
# Strategy: introduce IUserContext interface as decoupling seam
get_context filepath="src/users/UserService.ts"                                    # pre-edit hook
get_context filepath="src/auth/AuthService.ts"                                     # pre-edit hook
# Create IUserContext interface to break the circular dep
audit_file filepath="src/users/UserService.ts"                                     # verify no regressions
# Update findings.md: blocker resolved via interface extraction
# Update progress.md: Session 3 — unblocked via IUserContext
```

---

## Example 4: Continuing a Multi-Day Task

**User Request:** "Day 3 of the API redesign. Let's keep going."

### Loop 1: Full context reconstruction from .plan/
```bash
# Read .plan/task_plan.md → Goal: "Redesign REST API to GraphQL"; 5 phases; Phase 3 active
# Read .plan/progress.md → Day 1: schema; Day 2: User + Product resolvers; Day 3: remaining + auth
# Read .plan/findings.md → Decisions: DataLoader for N+1; auth via context; open: file upload unclear
```

### Loop 2: Resolve open issue from findings.md before writing code
```bash
task_next                                                                           # confirm Phase 3 next task
research_topic topic="GraphQL file upload multipart resolver pattern Apollo"        # resolve open issue
# 2 ops — flush to findings.md (open issue now resolved, document the approach chosen)
# Append "Session Day 3 — 2026-03-16" to progress.md
```

### Loop 3: Phase 3 execution with 2-Action Rule enforced throughout
```bash
get_context filepath="src/graphql/resolvers/orderResolver.ts"                      # pre-edit hook
search_code query="Order type resolver DataLoader batch"                            # research op 1
audit_file filepath="src/graphql/resolvers/orderResolver.ts"                        # research op 2
# 2 ops — flush to findings.md before writing any resolver code
# Implement Order resolver
audit_diff                                                                           # end-of-day gate
```
