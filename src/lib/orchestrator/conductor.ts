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
      steps.push(makeStep(order++, 'search_code', { query: intent, k: 3 }, 'Quick code search'));
      break;

    case 'simple':
      strategy = 'direct';
      steps.push(makeStep(order++, 'get_context', { filepath: repoRoot }, 'Load project context'));
      steps.push(makeStep(order++, 'search_code', { query: intent, k: 5 }, 'Search relevant code'));
      break;

    case 'moderate':
      strategy = 'skill';
      steps.push(makeStep(order++, 'get_context', { filepath: repoRoot }, 'Load project context'));
      steps.push(makeStep(order++, 'search_code', { query: intent, k: 8 }, 'Search relevant code'));
      steps.push(makeStep(order++, 'research_topic', { topic: intent }, 'Research the topic'));
      break;

    case 'complex':
      strategy = 'research-first';
      steps.push(makeStep(order++, 'search_code', { query: intent, k: 10 }, 'Broad code search'));
      steps.push(makeStep(order++, 'search_code', { query: `${intent} types interfaces`, k: 5 }, 'Search types and interfaces'));
      steps.push(makeStep(order++, 'research_topic', { topic: intent }, 'Deep research'));
      steps.push(makeStep(order++, 'run_skill', { skill: 'deep-dive', path: repoRoot }, 'Deep dive analysis'));
      steps.push(makeStep(order++, 'run_skill', { skill: 'audit-runner', path: repoRoot }, 'Audit runner'));
      steps.push(makeStep(order++, 'generate_report', { title: `Analysis: ${intent.slice(0, 60)}`, repoRoot }, 'Generate report'));
      break;

    case 'epic':
      strategy = 'spec';
      steps.push(makeStep(order++, 'spec_init', { name: intent.slice(0, 60), description: intent }, 'Initialize spec'));
      steps.push(makeStep(order++, 'spec_generate', { phase: 'requirements' }, 'Generate requirements'));
      steps.push(makeStep(order++, 'spec_generate', { phase: 'design' }, 'Generate design'));
      steps.push(makeStep(order++, 'spec_generate', { phase: 'tasks' }, 'Generate tasks'));
      steps.push(makeStep(order++, 'search_code', { query: intent, k: 10 }, 'Search existing code'));
      steps.push(makeStep(order++, 'research_topic', { topic: intent }, 'Research context'));
      steps.push(makeStep(order++, 'run_skill', { skill: 'deep-dive', path: repoRoot }, 'Deep dive'));
      steps.push(makeStep(order++, 'run_skill', { skill: 'refactor-planner', path: repoRoot }, 'Refactor planning'));
      steps.push(makeStep(order++, 'run_skill', { skill: 'audit-runner', path: repoRoot }, 'Audit'));
      steps.push(makeStep(order++, 'generate_report', { title: `Epic: ${intent.slice(0, 60)}`, repoRoot }, 'Generate final report'));
      break;
  }

  // ── Intent-type specific steps ────────────────────────────────────────────

  if (isBug) {
    strategy = strategy === 'direct' ? 'skill' : strategy;
    steps.push(makeStep(order++, 'audit_file', { filepath: repoRoot }, 'Audit for bug location'));
    steps.push(makeStep(
      order++,
      'run_skill',
      { skill: 'bug-reporter', path: repoRoot },
      'Run bug reporter',
      [],
      'Find the root cause. After this step, use orch_report with type="task" and category="bug" to create a tracked bug task.',
    ));
  }

  if (isSecurity) {
    strategy = 'skill';
    steps.push(makeStep(order++, 'find_secrets', { path: repoRoot }, 'Scan for secrets'));
    steps.push(makeStep(order++, 'security_scan', { path: repoRoot }, 'Full security scan'));
    steps.push(makeStep(
      order++,
      'run_skill',
      { skill: 'security-audit', path: repoRoot },
      'Security audit skill',
      [],
      'For each critical/high finding, call orch_report with type="task", category="bug", priority matching severity.',
    ));
  }

  if (isRefactor) {
    strategy = strategy === 'direct' ? 'research-first' : strategy;
    steps.push(makeStep(order++, 'complexity_score', { filepath: repoRoot }, 'Measure complexity'));
    steps.push(makeStep(
      order++,
      'run_skill',
      { skill: 'impact-analyzer', path: repoRoot },
      'Analyze refactor impact',
      [],
      'Document which files/symbols will be affected. Use orch_report type="note" to record impact before proceeding.',
    ));
    steps.push(makeStep(order++, 'run_skill', { skill: 'refactor-planner', path: repoRoot }, 'Plan refactoring'));
  }

  if (isFeature && analysis.level !== 'epic') {
    strategy = 'spec';
    steps.push(makeStep(order++, 'spec_init', { name: intent.slice(0, 60), description: intent }, 'Initialize feature spec'));
    steps.push(makeStep(order++, 'spec_generate', { phase: 'requirements' }, 'Generate requirements'));
    steps.push(makeStep(order++, 'spec_generate', { phase: 'design' }, 'Generate design'));
    steps.push(makeStep(order++, 'spec_generate', { phase: 'tasks' }, 'Generate tasks'));
  }

  if (isTest) {
    steps.push(makeStep(
      order++,
      'run_skill',
      { skill: 'test-generator', path: repoRoot },
      'Generate tests',
      [],
      'Generate comprehensive tests. Report each test file created via orch_report type="note".',
    ));
  }

  if (isDocs) {
    steps.push(makeStep(
      order++,
      'run_skill',
      { skill: 'doc-generator', path: repoRoot },
      'Generate documentation',
      [],
      'Generate docs for all public APIs. Report completion via orch_report type="step_complete".',
    ));
  }

  if (isResearch && !steps.some(s => s.tool === 'research_topic')) {
    steps.push(makeStep(order++, 'research_topic', { topic: intent }, 'Research topic'));
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

      const miniPrompt = [
        `## Fix: ${issue.title}`,
        ``,
        `**Severity:** ${issue.severity}`,
        `**Category:** ${issue.category}`,
        issue.owaspCategory ? `**OWASP:** ${issue.owaspCategory}` : '',
        issue.cwe ? `**CWE:** ${issue.cwe}` : '',
        ``,
        `**Description:**`,
        issue.description,
        ``,
        `**Fix Steps:**`,
        issue.fix ? issue.fix : 'See OWASP guidance.',
        ``,
        issue.code ? `**Affected Code:**\n\`\`\`\n${issue.code}\n\`\`\`` : '',
      ]
        .filter(line => line !== undefined)
        .join('\n');

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
