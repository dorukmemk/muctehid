import { detectComplexity } from '../lib/orchestrator/complexity-detector.js';
import { selectSkills } from '../lib/orchestrator/skill-selector.js';
import { routeTask } from '../lib/orchestrator/task-router.js';
import { Conductor, TaskReportData } from '../lib/orchestrator/conductor.js';
import { SkillRegistry } from '../lib/skills/registry.js';
import { TaskCategory, TaskPriority } from '../types/v2.js';

// ─── Orchestrator Tool Handler ────────────────────────────────────────────────

export async function handleOrchestratorTool(
  name: string,
  args: Record<string, unknown>,
  conductor: Conductor,
  skillRegistry: SkillRegistry,
  repoRoot: string,
): Promise<string> {
  // ── orchestrate — start new session ────────────────────────────────────────
  if (name === 'orchestrate') {
    const intent = args.intent as string;
    if (!intent) throw new Error('intent is required');

    const { session, prompt, firstStep } = conductor.start(intent, repoRoot);

    const firstStepSummary = firstStep
      ? {
          tool: firstStep.tool,
          args: firstStep.args,
          description: firstStep.description,
          miniPrompt: firstStep.miniPrompt,
        }
      : null;

    return [
      `## Orchestrator Session Started`,
      ``,
      `**Session ID:** \`${session.id}\``,
      `**Strategy:** ${session.strategy}`,
      `**Total Steps:** ${session.steps.length}`,
      ``,
      `---`,
      ``,
      prompt,
      ``,
      firstStepSummary
        ? [
            `## First Step to Execute`,
            `**Tool:** \`${firstStepSummary.tool}\``,
            `**Description:** ${firstStepSummary.description}`,
            `**Args:**`,
            '```json',
            JSON.stringify(firstStepSummary.args, null, 2),
            '```',
            firstStepSummary.miniPrompt ? `\n**Mini-Prompt:**\n${firstStepSummary.miniPrompt}` : '',
          ].filter(Boolean).join('\n')
        : '_(no steps — call `orch_end` to close)_',
    ].join('\n');
  }

  // ── orch_status — get current status ───────────────────────────────────────
  if (name === 'orch_status') {
    const sessionId = args.sessionId as string | undefined;
    const { session, prompt, nextStep } = conductor.status(sessionId);
    return [
      prompt,
      ``,
      nextStep
        ? [
            `## Next Step`,
            `**Tool:** \`${nextStep.tool}\``,
            `**Description:** ${nextStep.description}`,
            `**Args:** \`${JSON.stringify(nextStep.args)}\``,
          ].join('\n')
        : `## All steps complete — call \`orch_end\` to finalize`,
    ].join('\n');
  }

  // ── orch_report — report event to orchestrator ─────────────────────────────
  if (name === 'orch_report') {
    const sessionId = args.sessionId as string | undefined;

    // Resolve session ID: use provided or get active
    let resolvedSessionId = sessionId;
    if (!resolvedSessionId) {
      const active = conductor.status();
      resolvedSessionId = active.session.id;
    }

    const type = args.type as string;
    if (!type) throw new Error('type is required');

    const taskDataRaw = args.taskData as Record<string, unknown> | undefined;
    const taskData: TaskReportData | undefined = taskDataRaw
      ? {
          title: taskDataRaw.title as string,
          description: taskDataRaw.description as string,
          category: (taskDataRaw.category as TaskCategory) ?? 'chore',
          priority: (taskDataRaw.priority as TaskPriority) ?? 'medium',
          filepath: taskDataRaw.filepath as string | undefined,
          line: taskDataRaw.line as number | undefined,
          severity: taskDataRaw.severity as string | undefined,
        }
      : undefined;

    const { nextStep, prompt, action } = conductor.report(resolvedSessionId, type, {
      tool: args.tool as string | undefined,
      result: args.result as string | undefined,
      taskData,
      error: args.error as string | undefined,
      note: args.note as string | undefined,
    });

    return [
      `## Report Received`,
      `**Action:** ${action}`,
      ``,
      prompt,
      ``,
      nextStep
        ? [
            `## Execute Next Step`,
            `**Tool:** \`${nextStep.tool}\``,
            `**Description:** ${nextStep.description}`,
            `**Args:**`,
            '```json',
            JSON.stringify(nextStep.args, null, 2),
            '```',
            nextStep.miniPrompt ? `\n**Mini-Prompt:**\n${nextStep.miniPrompt}` : '',
          ].filter(Boolean).join('\n')
        : `## All steps complete — call \`orch_end\` to finalize`,
    ].join('\n');
  }

  // ── orch_next — get next step ───────────────────────────────────────────────
  if (name === 'orch_next') {
    const sessionId = args.sessionId as string | undefined;
    const { session, nextStep, prompt } = conductor.status(sessionId);

    if (!nextStep) {
      return `## No Pending Steps\n\nSession \`${session.id}\` has no more pending steps.\nCall \`orch_end\` to finalize.`;
    }

    return [
      `## Next Step for Session \`${session.id}\``,
      ``,
      `**Step [${nextStep.order}]:** ${nextStep.description}`,
      `**Tool:** \`${nextStep.tool}\``,
      `**Args:**`,
      '```json',
      JSON.stringify(nextStep.args, null, 2),
      '```',
      nextStep.miniPrompt ? `\n**Mini-Prompt:**\n${nextStep.miniPrompt}` : '',
      ``,
      `After executing, call \`orch_report\` with type="step_complete" and the result.`,
    ].filter(Boolean).join('\n');
  }

  // ── orch_end — end session ──────────────────────────────────────────────────
  if (name === 'orch_end') {
    const sessionId = args.sessionId as string | undefined;

    let resolvedSessionId = sessionId;
    if (!resolvedSessionId) {
      const active = conductor.status();
      resolvedSessionId = active.session.id;
    }

    const { summary, tasksCreated, stepsCompleted } = conductor.end(resolvedSessionId);

    return [
      `## Session Complete`,
      ``,
      summary,
      ``,
      `**Tasks Created:** ${tasksCreated}`,
      `**Steps Completed:** ${stepsCompleted}`,
      ``,
      tasksCreated > 0
        ? `Use \`task_list\` to see all created tasks, or \`task_next\` to start working on them.`
        : ``,
    ].filter(Boolean).join('\n');
  }

  // ── analyze_complexity — unchanged ─────────────────────────────────────────
  if (name === 'analyze_complexity') {
    const intent = (args.request as string) ?? '';
    if (!intent) throw new Error('request is required');
    const context = args.context as string | undefined;
    const analysis = detectComplexity(context ? `${intent} ${context}` : intent);
    return [
      `## Complexity Analysis`,
      ``,
      `**Level:** ${analysis.level}`,
      `**Estimated Steps:** ${analysis.estimatedSteps}`,
      `**Requires Memory:** ${analysis.requiresMemory}`,
      `**Requires Research:** ${analysis.requiresResearch}`,
      `**Requires Spec:** ${analysis.requiresSpec}`,
      `**Confidence:** ${(analysis.confidence * 100).toFixed(0)}%`,
      `**Suggested Skills:** ${analysis.suggestedSkills.join(', ') || 'none'}`,
      ``,
      `**Reasoning:** ${analysis.reasoning}`,
    ].join('\n');
  }

  // ── route_task — unchanged ──────────────────────────────────────────────────
  if (name === 'route_task') {
    const intent = (args.request as string) ?? '';
    if (!intent) throw new Error('request is required');
    const context = args.context as string | undefined;
    const fullIntent = context ? `${intent} ${context}` : intent;
    const analysis = detectComplexity(fullIntent);
    const allSkills = skillRegistry.list();
    const selected = selectSkills(fullIntent, allSkills, analysis);
    const decision = routeTask(fullIntent, analysis, selected);
    return [
      `## Routing Decision`,
      ``,
      `**Strategy:** ${decision.strategy}`,
      `**Primary Skill:** ${decision.primarySkill ?? 'none'}`,
      `**Requires Approval:** ${decision.requiresApproval}`,
      `**Rationale:** ${decision.rationale}`,
      ``,
      `### Steps (${decision.steps.length})`,
      ``,
      decision.steps.map(s =>
        `${s.order}. **${s.tool}** — ${s.description}${s.miniPrompt ? `\n   > ${s.miniPrompt.slice(0, 100)}` : ''}`
      ).join('\n'),
    ].join('\n');
  }

  // ── suggest_skill — unchanged ───────────────────────────────────────────────
  if (name === 'suggest_skill') {
    const intent = (args.request as string) ?? '';
    if (!intent) throw new Error('request is required');
    const topK = (args.topK as number) ?? 3;
    const allSkills = skillRegistry.list();
    const analysis = detectComplexity(intent);
    const selected = selectSkills(intent, allSkills, analysis);
    const top = selected.slice(0, topK);
    if (top.length === 0) return 'No matching skills found.';
    return [
      `## Suggested Skills`,
      ``,
      top.map((s, i) =>
        `${i + 1}. **${s.name}** — ${s.description}\n   Category: ${s.category}`
      ).join('\n\n'),
    ].join('\n');
  }

  throw new Error(`Unknown orchestrator tool: ${name}`);
}

// ─── Tool Schema Definitions ──────────────────────────────────────────────────

export const ORCHESTRATOR_TOOL_NAMES = [
  'orchestrate',
  'orch_status',
  'orch_report',
  'orch_next',
  'orch_end',
  'analyze_complexity',
  'route_task',
  'suggest_skill',
] as const;

export type OrchestratorToolName = typeof ORCHESTRATOR_TOOL_NAMES[number];

export const ORCHESTRATOR_TOOL_DEFS = [
  {
    name: 'orchestrate',
    description: 'Start a stateful orchestration session. The orchestrator creates a step plan, stores it in SQLite, and returns a prompt guiding the AI through each step in order. Use for ANY complex or multi-step task.',
    inputSchema: {
      type: 'object',
      required: ['intent'],
      properties: {
        intent: { type: 'string', description: 'What you want to accomplish (be descriptive)' },
        mode: { type: 'string', enum: ['auto', 'interactive'], description: 'auto = AI executes steps autonomously; interactive = AI waits for confirmation each step' },
      },
    },
  },
  {
    name: 'orch_status',
    description: 'Get the current status, prompt, and next step for an active orchestration session. Use when resuming a session or checking progress.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID (omit to use most recent active session)' },
      },
    },
  },
  {
    name: 'orch_report',
    description: 'Report an event back to the orchestrator after executing a step. ALWAYS call this after every tool execution during an orchestrated session. Use type="task" to create tracked tasks (do NOT use task_create directly during orchestration).',
    inputSchema: {
      type: 'object',
      required: ['type'],
      properties: {
        sessionId: { type: 'string', description: 'Session ID (omit to use active session)' },
        type: {
          type: 'string',
          enum: ['step_complete', 'tool_result', 'task', 'error', 'blocked', 'note'],
          description: 'step_complete: finished a step; task: create a tracked task; error: step failed; blocked: cannot continue; note: add context',
        },
        tool: { type: 'string', description: 'Tool that was called' },
        result: { type: 'string', description: 'Summary of the tool result (max 500 chars)' },
        taskData: {
          type: 'object',
          description: 'Required when type="task"',
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            category: { type: 'string', enum: ['feature', 'bug', 'refactor', 'docs', 'test', 'research', 'chore'] },
            priority: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
            filepath: { type: 'string' },
            line: { type: 'number' },
            severity: { type: 'string' },
          },
        },
        error: { type: 'string', description: 'Error message when type="error" or type="blocked"' },
        note: { type: 'string', description: 'Context note when type="note"' },
      },
    },
  },
  {
    name: 'orch_next',
    description: 'Get the next pending step in the active orchestration session without changing state. Use when you need a reminder of what to do next.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string' },
      },
    },
  },
  {
    name: 'orch_end',
    description: 'End an orchestration session and get a summary of what was accomplished. Call after all steps are complete.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID (omit to use active session)' },
      },
    },
  },
  {
    name: 'analyze_complexity',
    description: 'Use when a request is ambiguous or potentially large — classify as trivial/simple/moderate/complex/epic to decide the right approach before acting.',
    inputSchema: {
      type: 'object',
      required: ['request'],
      properties: {
        request: { type: 'string' },
        context: { type: 'string' },
      },
    },
  },
  {
    name: 'route_task',
    description: 'Use for any multi-step task to get an ordered execution plan. Use BEFORE starting complex work so steps are done in the right order with the right tools.',
    inputSchema: {
      type: 'object',
      required: ['request'],
      properties: {
        request: { type: 'string' },
        context: { type: 'string' },
      },
    },
  },
  {
    name: 'suggest_skill',
    description: 'Use when unsure which skill fits the user request — returns ranked skill suggestions with confidence scores.',
    inputSchema: {
      type: 'object',
      required: ['request'],
      properties: {
        request: { type: 'string' },
        topK: { type: 'number' },
      },
    },
  },
];
