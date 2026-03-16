import { OrchSession, OrchStep, OrchEvent } from './session-store.js';
import { Task } from '../../types/v2.js';

// ─── Prompt Builder ───────────────────────────────────────────────────────────

export function buildOrchestratorPrompt(
  session: OrchSession,
  pendingTasks: Task[],
  recentEvents: OrchEvent[],
): string {
  const doneSteps = session.steps.filter(s => s.status === 'done');
  const pendingSteps = session.steps.filter(s => s.status === 'pending');
  const currentStep = session.steps[session.currentStepIdx] ?? session.steps.find(s => s.status === 'pending') ?? null;
  const total = session.steps.length;
  const done = doneSteps.length;

  const contextSnippet = session.context.length > 1500
    ? session.context.slice(session.context.length - 1500)
    : session.context;

  const completedList = doneSteps.length > 0
    ? doneSteps.map(s => `- ✅ [${s.order}] ${s.description} (\`${s.tool}\`)`).join('\n')
    : '_(none yet)_';

  const pendingList = pendingSteps.length > 0
    ? pendingSteps
        .filter(s => s.id !== currentStep?.id)
        .map(s => `- ⏳ [${s.order}] ${s.description} (\`${s.tool}\`)`)
        .join('\n') || '_(none)_'
    : '_(none)_';

  const tasksCreatedList = session.tasksCreated.length > 0
    ? session.tasksCreated.map(id => `- ${id}`).join('\n')
    : '_(none)_';

  const pendingProjectTasks = pendingTasks
    .slice(0, 5)
    .map(t => `- [${t.priority.toUpperCase()}] ${t.category}/${t.title}${t.filepath ? ` — ${t.filepath}${t.startLine ? `:${t.startLine}` : ''}` : ''}`)
    .join('\n') || '_(none)_';

  const currentStepBlock = currentStep
    ? `## Current Step → ${currentStep.description}
Tool: \`${currentStep.tool}\`
Args: \`\`\`json
${JSON.stringify(currentStep.args, null, 2)}
\`\`\`
${currentStep.miniPrompt ? `\n### Mini-Prompt\n${currentStep.miniPrompt}\n` : ''}`
    : '## Current Step → _(all steps complete — call `orch_end`)_';

  const recentEventsBlock = recentEvents.length > 0
    ? recentEvents
        .slice(-5)
        .map(e => `- [${new Date(e.timestamp).toISOString()}] ${e.type}${e.tool ? ` (${e.tool})` : ''}${e.result ? `: ${e.result.slice(0, 120)}` : ''}`)
        .join('\n')
    : '_(no events yet)_';

  return `# Orchestrator Brain — Active Session

## Session ID
\`${session.id}\`

## Intent
${session.intent}

## Strategy: ${session.strategy}

## Progress: ${done}/${total} steps completed

## Completed Steps
${completedList}

${currentStepBlock}

## Pending Steps
${pendingList}

## Context Accumulated
${contextSnippet || '_(empty)_'}

## Tasks Created This Session (${session.tasksCreated.length})
${tasksCreatedList}

## Pending Project Tasks (${pendingTasks.length})
${pendingProjectTasks}

## Recent Events
${recentEventsBlock}

## RULES — FOLLOW EXACTLY
1. Execute the Current Step NOW using the tool shown
2. After each tool call, call \`orch_report\` with the result
3. Do NOT skip steps or change order
4. Do NOT create tasks manually — use \`orch_report\` with type="task" to let orchestrator create them properly
5. If blocked: call \`orch_report\` with type="blocked" and reason
6. When all steps done: call \`orch_end\`
`;
}

export function buildStepMiniPrompt(step: OrchStep, context: string): string {
  const contextSnippet = context.length > 800
    ? context.slice(context.length - 800)
    : context;

  return `## Step: ${step.description}

You are executing step [${step.order}] of an orchestrated session.

**Tool to call:** \`${step.tool}\`
**Args:**
\`\`\`json
${JSON.stringify(step.args, null, 2)}
\`\`\`

${step.miniPrompt ? `**Additional Instructions:**\n${step.miniPrompt}\n` : ''}
${contextSnippet ? `**Accumulated Context (last 800 chars):**\n${contextSnippet}\n` : ''}
After calling the tool, immediately report back using \`orch_report\` with:
- type: "step_complete"
- tool: "${step.tool}"
- result: the tool output summary (max 500 chars)
`;
}
