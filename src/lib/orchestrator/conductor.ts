import * as crypto from 'crypto';
import { SessionStore, OrchSession, OrchStep } from './session-store.js';
import { TaskStore } from '../tasks/task-store.js';
import { detectComplexity } from './complexity-detector.js';
import { buildOrchestratorPrompt, buildStepMiniPrompt } from './prompt-builder.js';
import { AuditIssue } from '../../types/index.js';
import { TaskCategory, TaskPriority } from '../../types/v2.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TaskReportData {
  title: string;
  description: string;
  category: TaskCategory;
  priority: TaskPriority;
  filepath?: string;
  line?: number;
  severity?: string;
}

// ─── Step Builder Helpers ─────────────────────────────────────────────────────

function makeStep(
  order: number,
  tool: string,
  args: Record<string, unknown>,
  description: string,
  dependsOn: string[] = [],
  miniPrompt?: string,
): OrchStep {
  return {
    id: crypto.randomUUID(),
    order,
    tool,
    args,
    description,
    status: 'pending',
    dependsOn,
    miniPrompt,
  };
}

function buildStepPlan(intent: string, repoRoot: string): { steps: OrchStep[]; strategy: string } {
  const analysis = detectComplexity(intent);
  const lower = intent.toLowerCase();
  const steps: OrchStep[] = [];
  let order = 1;
  let strategy = 'direct';

  // ── Detect intent type ────────────────────────────────────────────────────

  const isBug = /\b(bug|error|exception|crash|broken|fix|failing)\b/i.test(lower);
  const isSecurity = /\b(security|vulnerability|owasp|secret|injection|audit)\b/i.test(lower);
  const isRefactor = /\b(refactor|restructure|decompose|extract|modularize|rename)\b/i.test(lower);
  const isFeature = /\b(feature|implement|build|create|add|develop)\b/i.test(lower);
  const isTest = /\b(test|spec|coverage|unit test|integration test)\b/i.test(lower);
  const isDocs = /\b(document|doc|jsdoc|readme|comment|annotate)\b/i.test(lower);
  const isResearch = /\b(how to|best practice|what is|compare|investigate|explore|research)\b/i.test(lower);

  // ── Base steps by complexity ──────────────────────────────────────────────

  switch (analysis.level) {
    case 'trivial':
      strategy = 'direct';
      steps.push(makeStep(
        order++,
        'search_code',
        { query: intent, k: 3 },
        'Quick code search',
        [],
        `## Step: Quick code search
**Goal:** Find the most relevant code snippets for the intent.
**Input:** query="${intent}", k=3
**Expected output:** File paths and matching code lines.
**On success:** call orch_report with result summarizing what was found (file paths + snippet count).
**On failure:** call orch_report with error describing why search failed.`,
      ));
      break;

    case 'simple':
      strategy = 'direct';
      steps.push(makeStep(
        order++,
        'search_code',
        { query: intent, k: 5 },
        'Search relevant code',
        [],
        `## Step: Search relevant code
**Goal:** Locate all code relevant to the intent.
**Input:** query="${intent}", k=5
**Expected output:** List of files with matching lines and context snippets.
**On success:** call orch_report with result listing the top 3 matching files and what was found.
**On failure:** call orch_report with error.`,
      ));
      steps.push(makeStep(
        order++,
        'get_context',
        { filepath: repoRoot },
        'Load project context',
        [],
        `## Step: Load project context
**Goal:** Understand the overall project structure before acting.
**Input:** filepath="${repoRoot}"
**Expected output:** Directory tree, key files, module boundaries.
**On success:** call orch_report summarizing the project layout and any key entry points.
**On failure:** call orch_report with error.`,
      ));
      break;

    case 'moderate':
      strategy = 'skill';
      steps.push(makeStep(
        order++,
        'search_code',
        { query: intent, k: 8 },
        'Search relevant code',
        [],
        `## Step: Search relevant code
**Goal:** Find all code related to the intent across the codebase.
**Input:** query="${intent}", k=8
**Expected output:** File paths, function/class names, and matching lines.
**On success:** call orch_report listing files found and key patterns observed.
**On failure:** call orch_report with error.`,
      ));
      steps.push(makeStep(
        order++,
        'get_context',
        { filepath: repoRoot },
        'Load project context',
        [],
        `## Step: Load project context
**Goal:** Load architectural context to understand how pieces connect.
**Input:** filepath="${repoRoot}"
**Expected output:** Module structure, entry points, dependencies.
**On success:** call orch_report summarizing the architecture relevant to this intent.
**On failure:** call orch_report with error.`,
      ));
      steps.push(makeStep(
        order++,
        'research_topic',
        { topic: intent },
        'Research the topic',
        [],
        `## Step: Research the topic
**Goal:** Gather best practices and patterns relevant to this intent.
**Input:** topic="${intent}"
**Expected output:** Key findings, recommended approaches, potential pitfalls.
**On success:** call orch_report summarizing top 3 findings and recommended approach.
**On failure:** call orch_report with error.`,
      ));
      steps.push(makeStep(
        order++,
        'generate_report',
        { title: `Report: ${intent.slice(0, 60)}`, repoRoot, save: true },
        'Generate and save report',
        [],
        `## Step: Generate report
**Goal:** Produce a structured report of findings so far.
**Input:** title, repoRoot, save=true
**Expected output:** Saved report file path.
**On success:** call orch_report with the report file path and key findings count.
**On failure:** call orch_report with error.`,
      ));
      break;

    case 'complex':
      strategy = 'research-first';
      steps.push(makeStep(
        order++,
        'search_code',
        { query: intent, k: 10 },
        'Broad code search',
        [],
        `## Step: Broad code search
**Goal:** Cast a wide net to find all relevant code.
**Input:** query="${intent}", k=10
**Expected output:** All matching files, function names, and key lines.
**On success:** call orch_report listing top 5 files and the primary patterns found.
**On failure:** call orch_report with error.`,
      ));
      steps.push(makeStep(
        order++,
        'search_code',
        { query: `${intent} types interfaces`, k: 5 },
        'Search types and interfaces',
        [],
        `## Step: Search types and interfaces
**Goal:** Find all type definitions and interfaces related to this intent.
**Input:** query="${intent} types interfaces", k=5
**Expected output:** TypeScript interfaces, type aliases, enums relevant to the intent.
**On success:** call orch_report listing the type names and their file locations.
**On failure:** call orch_report with error.`,
      ));
      steps.push(makeStep(
        order++,
        'research_topic',
        { topic: intent },
        'Deep research',
        [],
        `## Step: Deep research
**Goal:** Research best practices, architecture patterns, and solutions for this intent.
**Input:** topic="${intent}"
**Expected output:** Concrete recommendations with justification.
**On success:** call orch_report with top 3 recommendations and any caveats.
**On failure:** call orch_report with error.`,
      ));
      steps.push(makeStep(
        order++,
        'run_skill',
        { skill: 'deep-dive', path: repoRoot },
        'Deep dive analysis',
        [],
        `## Step: Deep dive analysis
**Goal:** Run a thorough analysis of the codebase in context of the intent.
**Input:** skill="deep-dive", path="${repoRoot}"
**Expected output:** Detailed findings — complexity hotspots, coupling issues, anti-patterns.
**On success:** call orch_report with a summary of issues found (count by severity).
**On failure:** call orch_report with error.`,
      ));
      steps.push(makeStep(
        order++,
        'run_skill',
        { skill: 'audit-runner', path: repoRoot },
        'Audit runner',
        [],
        `## Step: Audit runner
**Goal:** Run a full quality audit on the codebase.
**Input:** skill="audit-runner", path="${repoRoot}"
**Expected output:** Audit results with severity breakdown — critical/high/medium/low counts.
**On success:** call orch_report with counts per severity and top 3 most critical issues.
**On failure:** call orch_report with error.`,
      ));
      steps.push(makeStep(
        order++,
        'task_next',
        {},
        'Check next priority task',
        [],
        `## Step: Check next priority task
**Goal:** Surface the highest priority pending task after the analysis.
**Input:** none
**Expected output:** The next task to action with its description.
**On success:** call orch_report with the task title and ID.
**On failure:** call orch_report with error.`,
      ));
      steps.push(makeStep(
        order++,
        'generate_report',
        { title: `Analysis: ${intent.slice(0, 60)}`, repoRoot, save: true },
        'Generate and save final report',
        [],
        `## Step: Generate final report
**Goal:** Produce a comprehensive saved report of all findings.
**Input:** title, repoRoot, save=true
**Expected output:** Saved report path with full findings.
**On success:** call orch_report with the saved path and total issues documented.
**On failure:** call orch_report with error.`,
      ));
      break;

    case 'epic':
      strategy = 'spec';
      steps.push(makeStep(
        order++,
        'spec_init',
        { name: intent.slice(0, 60), description: intent },
        'Initialize spec',
        [],
        `## Step: Initialize spec
**Goal:** Create a new spec document for this epic intent.
**Input:** name="${intent.slice(0, 60)}", description="${intent}"
**Expected output:** A spec ID that will be used in subsequent spec_generate calls.
**On success:** call orch_report with the spec ID and spec name.
**On failure:** call orch_report with error.`,
      ));
      steps.push(makeStep(
        order++,
        'spec_generate',
        { phase: 'requirements' },
        'Generate requirements',
        [],
        `## Step: Generate requirements
**Goal:** Generate the requirements phase of the spec.
**Input:** phase="requirements" (use the specId from the previous step)
**Expected output:** A structured requirements document.
**On success:** call orch_report summarizing the top 5 requirements generated.
**On failure:** call orch_report with error.`,
      ));
      steps.push(makeStep(
        order++,
        'spec_generate',
        { phase: 'design' },
        'Generate design',
        [],
        `## Step: Generate design
**Goal:** Generate the technical design phase of the spec.
**Input:** phase="design"
**Expected output:** Architecture diagram description, component breakdown, data flow.
**On success:** call orch_report summarizing the design decisions made.
**On failure:** call orch_report with error.`,
      ));
      steps.push(makeStep(
        order++,
        'spec_generate',
        { phase: 'tasks' },
        'Generate tasks',
        [],
        `## Step: Generate tasks
**Goal:** Break down the spec into actionable tasks.
**Input:** phase="tasks"
**Expected output:** Numbered task list with priorities and dependencies.
**On success:** call orch_report with total task count and the first 3 task titles.
**On failure:** call orch_report with error.`,
      ));
      steps.push(makeStep(
        order++,
        'search_code',
        { query: intent, k: 10 },
        'Search existing code',
        [],
        `## Step: Search existing code
**Goal:** Find any existing code that overlaps with or will be affected by this epic.
**Input:** query="${intent}", k=10
**Expected output:** Files that will need modification or serve as reference.
**On success:** call orch_report listing affected files and what needs to change.
**On failure:** call orch_report with error.`,
      ));
      steps.push(makeStep(
        order++,
        'research_topic',
        { topic: intent },
        'Research context',
        [],
        `## Step: Research context
**Goal:** Research implementation patterns and best practices for this epic.
**Input:** topic="${intent}"
**Expected output:** Libraries, patterns, and approaches to use.
**On success:** call orch_report with the recommended approach and key libraries.
**On failure:** call orch_report with error.`,
      ));
      steps.push(makeStep(
        order++,
        'run_skill',
        { skill: 'deep-dive', path: repoRoot },
        'Deep dive',
        [],
        `## Step: Deep dive
**Goal:** Thoroughly analyze current codebase to understand impact of this epic.
**Input:** skill="deep-dive", path="${repoRoot}"
**Expected output:** Complexity map, coupling analysis, areas of risk.
**On success:** call orch_report with top 3 risk areas identified.
**On failure:** call orch_report with error.`,
      ));
      steps.push(makeStep(
        order++,
        'run_skill',
        { skill: 'impact-analyzer', path: repoRoot },
        'Impact analysis',
        [],
        `## Step: Impact analysis
**Goal:** Determine what will be affected by implementing this epic.
**Input:** skill="impact-analyzer", path="${repoRoot}"
**Expected output:** List of files/symbols that will change and what depends on them.
**On success:** call orch_report with impact count (files affected) and blast radius assessment.
**On failure:** call orch_report with error.`,
      ));
      steps.push(makeStep(
        order++,
        'run_skill',
        { skill: 'refactor-planner', path: repoRoot },
        'Refactor planning',
        [],
        `## Step: Refactor planning
**Goal:** Plan any refactoring needed before or during this epic.
**Input:** skill="refactor-planner", path="${repoRoot}"
**Expected output:** Ordered list of refactoring steps with rationale.
**On success:** call orch_report with refactoring step count and first step description.
**On failure:** call orch_report with error.`,
      ));
      steps.push(makeStep(
        order++,
        'run_skill',
        { skill: 'audit-runner', path: repoRoot },
        'Audit',
        [],
        `## Step: Audit
**Goal:** Run a full audit before implementation begins, to establish baseline.
**Input:** skill="audit-runner", path="${repoRoot}"
**Expected output:** Baseline audit with severity counts — these will be compared post-implementation.
**On success:** call orch_report with baseline counts: critical/high/medium/low.
**On failure:** call orch_report with error.`,
      ));
      steps.push(makeStep(
        order++,
        'task_next',
        {},
        'Surface first task to action',
        [],
        `## Step: Surface first task
**Goal:** Identify the first task to start working on from the spec.
**Input:** none
**Expected output:** The highest priority pending task from this epic.
**On success:** call orch_report with task ID and title.
**On failure:** call orch_report with error.`,
      ));
      steps.push(makeStep(
        order++,
        'generate_report',
        { title: `Epic: ${intent.slice(0, 60)}`, repoRoot, save: true },
        'Generate final report',
        [],
        `## Step: Generate final report
**Goal:** Produce and save a comprehensive report covering the entire epic planning session.
**Input:** title, repoRoot, save=true
**Expected output:** Saved report file path with full analysis, spec summary, and task list.
**On success:** call orch_report with the saved path.
**On failure:** call orch_report with error.`,
      ));
      break;
  }

  // ── Intent-type specific steps ────────────────────────────────────────────

  if (isBug) {
    strategy = strategy === 'direct' ? 'skill' : strategy;
    steps.push(makeStep(
      order++,
      'search_code',
      { query: intent, k: 8 },
      'Find relevant code for bug',
      [],
      `## Step: Find relevant code for bug
**Goal:** Locate all code related to the bug described in the intent.
**Input:** query="${intent}", k=8
**Expected output:** File paths and function names where the bug likely lives.
**On success:** call orch_report listing the top candidate files.
**On failure:** call orch_report with error.`,
    ));
    steps.push(makeStep(
      order++,
      'get_context',
      { filepath: repoRoot },
      'Load full file context for bug location',
      [],
      `## Step: Load full file context
**Goal:** Load the full context of the most likely bug location file.
**Input:** filepath = the top candidate file from the previous search step
**Expected output:** Full file content and surrounding code context.
**On success:** call orch_report summarizing the code around the bug location.
**On failure:** call orch_report with error.`,
    ));
    steps.push(makeStep(
      order++,
      'audit_file',
      { filepath: repoRoot },
      'Audit file for bug root cause',
      [],
      `## Step: Audit file for bug root cause
**Goal:** Run a targeted audit to find the exact issue and related problems.
**Input:** filepath = the most likely bug file (from context loaded in previous step)
**Expected output:** Specific issues with line numbers, severity, and fix recommendations.
**On success:** call orch_report with issue count and severity breakdown.
**On failure:** call orch_report with error.`,
    ));
    steps.push(makeStep(
      order++,
      'run_skill',
      { skill: 'bug-reporter', path: repoRoot },
      'Run bug reporter for full analysis',
      [],
      `## Step: Run bug reporter
**Goal:** Produce a comprehensive bug report with root cause analysis.
**Input:** skill="bug-reporter", path="${repoRoot}"
**Expected output:** Root cause, affected code paths, reproduction steps, fix recommendation.
**On success:** For EACH issue found, call orch_report with type="task" and category="bug" to create a tracked task. Then call orch_report type="step_complete" with total issues found.
**On failure:** call orch_report with error.`,
    ));
    steps.push(makeStep(
      order++,
      'generate_report',
      { title: `Bug Report: ${intent.slice(0, 50)}`, repoRoot, save: true },
      'Save bug report',
      [],
      `## Step: Save bug report
**Goal:** Persist the bug analysis as a saved report.
**Input:** title, repoRoot, save=true
**Expected output:** Saved report file path.
**On success:** call orch_report with the saved path.
**On failure:** call orch_report with error.`,
    ));
  }

  if (isSecurity) {
    strategy = 'skill';
    steps.push(makeStep(
      order++,
      'index_codebase',
      { repoRoot },
      'Index codebase for security scan',
      [],
      `## Step: Index codebase
**Goal:** Ensure the codebase index is up to date before scanning.
**Input:** repoRoot="${repoRoot}"
**Expected output:** Confirmation that index is current.
**On success:** call orch_report with file count indexed.
**On failure:** call orch_report with error (non-fatal — continue to next step).`,
    ));
    steps.push(makeStep(
      order++,
      'find_secrets',
      { path: repoRoot },
      'Scan for hardcoded secrets',
      [],
      `## Step: Scan for hardcoded secrets
**Goal:** Find any hardcoded API keys, passwords, tokens, or credentials.
**Input:** path="${repoRoot}"
**Expected output:** List of files and line numbers where secrets were found.
**On success:** call orch_report with count of secrets found and their file locations. For each CRITICAL secret found, also call orch_report type="task" with category="bug", priority="critical".
**On failure:** call orch_report with error.`,
    ));
    steps.push(makeStep(
      order++,
      'security_scan',
      { path: `${repoRoot}/src` },
      'Full security scan of src/',
      [],
      `## Step: Full security scan
**Goal:** Scan the src/ directory for OWASP-category vulnerabilities.
**Input:** path="${repoRoot}/src"
**Expected output:** Vulnerabilities with OWASP category, severity, file, and line.
**On success:** call orch_report with counts by severity (critical/high/medium/low). For each CRITICAL or HIGH issue, call orch_report type="task" with category="bug", priority matching severity, and include filepath and line.
**On failure:** call orch_report with error.`,
    ));
    steps.push(makeStep(
      order++,
      'run_skill',
      { skill: 'security-audit', path: repoRoot },
      'Deep security audit',
      [],
      `## Step: Deep security audit
**Goal:** Run the security-audit skill for comprehensive analysis including logic flaws.
**Input:** skill="security-audit", path="${repoRoot}"
**Expected output:** Full audit report with severity breakdown and remediation steps.
**On success:** For each CRITICAL and HIGH finding, call orch_report type="task" with category="bug", priority matching severity. Then call orch_report type="step_complete" with total critical+high count.
**On failure:** call orch_report with error.`,
    ));
    steps.push(makeStep(
      order++,
      'generate_report',
      { title: `Security Audit: ${intent.slice(0, 50)}`, repoRoot, save: true },
      'Save security report',
      [],
      `## Step: Save security report
**Goal:** Persist the full security audit as a saved report.
**Input:** title, repoRoot, save=true
**Expected output:** Saved report file path.
**On success:** call orch_report with the saved path and total vulnerability count.
**On failure:** call orch_report with error.`,
    ));
  }

  if (isRefactor) {
    strategy = strategy === 'direct' ? 'research-first' : strategy;
    steps.push(makeStep(
      order++,
      'complexity_score',
      { filepath: repoRoot },
      'Measure code complexity',
      [],
      `## Step: Measure code complexity
**Goal:** Identify the most complex files that are refactoring candidates.
**Input:** filepath="${repoRoot}"
**Expected output:** Complexity scores per file, sorted by score descending.
**On success:** call orch_report with top 5 most complex files and their scores.
**On failure:** call orch_report with error.`,
    ));
    steps.push(makeStep(
      order++,
      'run_skill',
      { skill: 'impact-analyzer', path: repoRoot },
      'Analyze refactor impact',
      [],
      `## Step: Analyze refactor impact
**Goal:** Determine exactly which files and symbols will be affected by the refactor.
**Input:** skill="impact-analyzer", path="${repoRoot}"
**Expected output:** List of affected files, exported symbols that change, callers/importers.
**On success:** call orch_report type="note" recording the impact scope (file count + symbol count). Then call orch_report type="step_complete" summarizing the blast radius.
**On failure:** call orch_report with error.`,
    ));
    steps.push(makeStep(
      order++,
      'run_skill',
      { skill: 'refactor-planner', path: repoRoot },
      'Plan refactoring steps',
      [],
      `## Step: Plan refactoring steps
**Goal:** Generate an ordered, safe refactoring plan with rollback points.
**Input:** skill="refactor-planner", path="${repoRoot}"
**Expected output:** Numbered refactoring steps in safe order, with what to test after each.
**On success:** call orch_report with total step count and first 3 step titles.
**On failure:** call orch_report with error.`,
    ));
  }

  if (isFeature && analysis.level !== 'epic') {
    strategy = 'spec';
    steps.push(makeStep(
      order++,
      'spec_init',
      { name: intent.slice(0, 60), description: intent },
      'Initialize feature spec',
      [],
      `## Step: Initialize feature spec
**Goal:** Create a spec document for this feature so implementation is structured.
**Input:** name="${intent.slice(0, 60)}", description="${intent}"
**Expected output:** A spec ID to use in subsequent spec_generate calls.
**On success:** call orch_report with the spec ID.
**On failure:** call orch_report with error.`,
    ));
    steps.push(makeStep(
      order++,
      'spec_generate',
      { phase: 'requirements' },
      'Generate feature requirements',
      [],
      `## Step: Generate feature requirements
**Goal:** Define what the feature must do (functional + non-functional requirements).
**Input:** phase="requirements"
**Expected output:** Numbered requirement list with acceptance criteria.
**On success:** call orch_report with requirement count and top 3 requirements.
**On failure:** call orch_report with error.`,
    ));
    steps.push(makeStep(
      order++,
      'spec_generate',
      { phase: 'design' },
      'Generate feature design',
      [],
      `## Step: Generate feature design
**Goal:** Define the technical design — components, data flow, APIs.
**Input:** phase="design"
**Expected output:** Component breakdown, interface definitions, data model changes.
**On success:** call orch_report summarizing the design approach chosen.
**On failure:** call orch_report with error.`,
    ));
    steps.push(makeStep(
      order++,
      'spec_generate',
      { phase: 'tasks' },
      'Generate implementation tasks',
      [],
      `## Step: Generate implementation tasks
**Goal:** Break down the feature into concrete, ordered implementation tasks.
**Input:** phase="tasks"
**Expected output:** Task list with priorities and dependencies between tasks.
**On success:** call orch_report with total task count and first task to start.
**On failure:** call orch_report with error.`,
    ));
  }

  if (isTest) {
    steps.push(makeStep(
      order++,
      'run_skill',
      { skill: 'test-generator', path: repoRoot },
      'Generate tests',
      [],
      `## Step: Generate tests
**Goal:** Create comprehensive tests covering unit, integration, and edge cases.
**Input:** skill="test-generator", path="${repoRoot}"
**Expected output:** Test files created, number of test cases, coverage targets.
**On success:** For each test file created, call orch_report type="note" with the file path and test count. Then call orch_report type="step_complete" with total test count.
**On failure:** call orch_report with error.`,
    ));
  }

  if (isDocs) {
    steps.push(makeStep(
      order++,
      'run_skill',
      { skill: 'doc-generator', path: repoRoot },
      'Generate documentation',
      [],
      `## Step: Generate documentation
**Goal:** Generate JSDoc/TSDoc for all public APIs and update README if needed.
**Input:** skill="doc-generator", path="${repoRoot}"
**Expected output:** Documentation files created or updated, public API count documented.
**On success:** call orch_report with file count updated and public symbols documented.
**On failure:** call orch_report with error.`,
    ));
  }

  if (isResearch && !steps.some(s => s.tool === 'research_topic')) {
    steps.push(makeStep(
      order++,
      'research_topic',
      { topic: intent },
      'Research topic',
      [],
      `## Step: Research topic
**Goal:** Gather knowledge and best practices relevant to the intent.
**Input:** topic="${intent}"
**Expected output:** Key findings, recommended approaches, libraries, or patterns.
**On success:** call orch_report with top 3 findings summarized.
**On failure:** call orch_report with error.`,
    ));
  }

  // Re-assign orders after all insertions
  steps.forEach((s, i) => { s.order = i + 1; });

  return { steps, strategy };
}

// ─── Conductor ────────────────────────────────────────────────────────────────

export class Conductor {
  constructor(
    private sessionStore: SessionStore,
    private taskStore: TaskStore,
  ) {}

  start(
    intent: string,
    repoRoot: string,
  ): { session: OrchSession; prompt: string; firstStep: OrchStep | null } {
    const { steps, strategy } = buildStepPlan(intent, repoRoot);
    const session = this.sessionStore.createSession(intent, strategy, steps);
    const firstStep = steps[0] ?? null;

    if (firstStep) {
      this.sessionStore.logEvent(session.id, 'tool_call', {
        tool: firstStep.tool,
        args: JSON.stringify(firstStep.args),
      });
    }

    const pendingTasks = this.taskStore.list({ status: 'pending' });
    const recentEvents = this.sessionStore.getEvents(session.id);
    const freshSession = this.sessionStore.getSession(session.id)!;
    const prompt = buildOrchestratorPrompt(freshSession, pendingTasks, recentEvents);

    return { session: freshSession, prompt, firstStep };
  }

  report(
    sessionId: string,
    type: string,
    data: {
      tool?: string;
      result?: string;
      taskData?: TaskReportData;
      error?: string;
      note?: string;
    },
  ): { nextStep: OrchStep | null; prompt: string; action: string } {
    let session = this.sessionStore.getSession(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    let action = 'continue';

    if (type === 'task' && data.taskData) {
      // Create task with correct metadata
      const td = data.taskData;
      const priority: TaskPriority = (['critical', 'high', 'medium', 'low'] as TaskPriority[]).includes(td.priority as TaskPriority)
        ? td.priority
        : 'medium';
      const category: TaskCategory = (['feature', 'bug', 'refactor', 'docs', 'test', 'research', 'chore'] as TaskCategory[]).includes(td.category as TaskCategory)
        ? td.category
        : 'chore';

      const task = this.taskStore.create({
        title: td.title,
        description: td.description,
        status: 'pending',
        priority,
        category,
        filepath: td.filepath,
        startLine: td.line,
        dependsOn: [],
        tags: ['orchestrator', `session:${sessionId}`],
        createdBy: 'agent',
      });

      this.sessionStore.addTaskCreated(sessionId, task.id);
      this.sessionStore.logEvent(sessionId, 'task_created', {
        tool: data.tool,
        result: `Created task ${task.id}: ${task.title}`,
      });
      action = 'task_created';

      if (data.result) {
        this.sessionStore.appendContext(sessionId, `[task_created] ${task.id}: ${td.title}\n${data.result}`);
      }
    } else if (type === 'step_complete') {
      const currentStep = session.steps[session.currentStepIdx];
      if (currentStep) {
        this.sessionStore.markStepDone(sessionId, currentStep.id, data.result ?? '');
        if (data.result) {
          this.sessionStore.appendContext(sessionId, `[${currentStep.tool}] ${data.result}`);
        }
        action = 'step_advanced';
      }
    } else if (type === 'blocked') {
      this.sessionStore.updateStatus(sessionId, 'blocked');
      this.sessionStore.logEvent(sessionId, 'blocked', { result: data.error ?? data.note ?? 'Blocked without reason' });
      action = 'blocked';
    } else if (type === 'error') {
      const currentStep = session.steps[session.currentStepIdx];
      if (currentStep) {
        this.sessionStore.markStepFailed(sessionId, currentStep.id, data.error ?? 'Unknown error');
        // Try to advance past the failed step
        const nextPending = this.sessionStore.nextPendingStep(sessionId);
        if (nextPending) {
          action = 'step_failed_advancing';
        } else {
          action = 'all_failed';
        }
      }
    } else if (type === 'tool_result') {
      this.sessionStore.logEvent(sessionId, 'tool_result', {
        tool: data.tool,
        result: data.result,
      });
      if (data.result) {
        this.sessionStore.appendContext(sessionId, `[${data.tool ?? 'tool'}] ${data.result}`);
      }
    } else if (type === 'note') {
      this.sessionStore.logEvent(sessionId, 'note', { result: data.note ?? data.result });
      if (data.note) {
        this.sessionStore.appendContext(sessionId, `[note] ${data.note}`);
      }
    }

    session = this.sessionStore.getSession(sessionId)!;
    const nextStep = this.sessionStore.nextPendingStep(sessionId);
    const pendingTasks = this.taskStore.list({ status: 'pending' });
    const recentEvents = this.sessionStore.getEvents(sessionId);
    const prompt = buildOrchestratorPrompt(session, pendingTasks, recentEvents);

    return { nextStep, prompt, action };
  }

  status(sessionId?: string): { session: OrchSession; prompt: string; nextStep: OrchStep | null } {
    const session = sessionId
      ? this.sessionStore.getSession(sessionId)
      : this.sessionStore.getActive();

    if (!session) throw new Error('No active session found');

    const nextStep = this.sessionStore.nextPendingStep(session.id);
    const pendingTasks = this.taskStore.list({ status: 'pending' });
    const recentEvents = this.sessionStore.getEvents(session.id);
    const prompt = buildOrchestratorPrompt(session, pendingTasks, recentEvents);

    return { session, prompt, nextStep };
  }

  end(sessionId: string): { summary: string; tasksCreated: number; stepsCompleted: number } {
    const session = this.sessionStore.getSession(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    this.sessionStore.updateStatus(sessionId, 'done');

    const stepsCompleted = session.steps.filter(s => s.status === 'done').length;
    const tasksCreated = session.tasksCreated.length;

    const summary = [
      `Session ${sessionId} completed.`,
      `Intent: ${session.intent}`,
      `Strategy: ${session.strategy}`,
      `Steps completed: ${stepsCompleted}/${session.steps.length}`,
      `Tasks created: ${tasksCreated}`,
      tasksCreated > 0
        ? `Task IDs: ${session.tasksCreated.join(', ')}`
        : '',
    ]
      .filter(Boolean)
      .join('\n');

    return { summary, tasksCreated, stepsCompleted };
  }

  autoCreateBugTasks(sessionId: string, issues: AuditIssue[]): string[] {
    const createdIds: string[] = [];

    for (const issue of issues) {
      const priorityMap: Record<string, TaskPriority> = {
        critical: 'critical',
        high: 'high',
        medium: 'medium',
        low: 'low',
        info: 'low',
      };
      const priority: TaskPriority = priorityMap[issue.severity] ?? 'medium';

      const miniPrompt = `## Bug Fix Task

**Issue:** ${issue.title}
**Severity:** ${issue.severity} | **OWASP:** ${issue.owaspCategory || 'N/A'} | **CWE:** ${issue.cwe || 'N/A'}

**Location:** \`${issue.filepath}:${issue.line || '?'}\`

**Problem:** ${issue.description}

**Fix Required:** ${issue.fix ?? 'See OWASP guidance.'}

**Steps to fix:**
1. Read the file: \`get_context filepath="${issue.filepath}"\`
2. Understand the context around line ${issue.line ?? '?'}
3. Apply the fix: ${issue.fix ?? 'See OWASP guidance.'}
4. Verify fix doesn't introduce new issues: \`audit_file filepath="${issue.filepath}"\`
5. Mark complete: \`task_update id="<task_id>" status="done"\`

**Code found:**
\`\`\`
${issue.code || '(see file)'}
\`\`\`
`;

      const task = this.taskStore.create({
        title: `Fix: ${issue.title}`,
        description: `${issue.description}\n\nFix: ${issue.fix ?? 'See OWASP guidance.'}`,
        miniPrompt,
        status: 'pending',
        priority,
        category: 'bug',
        filepath: issue.filepath,
        startLine: issue.line,
        dependsOn: [],
        tags: ['orchestrator', `session:${sessionId}`, issue.category, issue.severity],
        createdBy: 'agent',
      });

      this.sessionStore.addTaskCreated(sessionId, task.id);
      createdIds.push(task.id);
    }

    return createdIds;
  }
}
