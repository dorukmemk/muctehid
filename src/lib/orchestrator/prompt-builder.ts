import { OrchSession, OrchStep, OrchEvent } from './session-store.js';
import { Task } from '../../types/v2.js';

// ─── Prompt Builder ───────────────────────────────────────────────────────────

export function buildOrchestratorPrompt(
  session: OrchSession,
  pendingTasks: Task[],
  recentEvents: OrchEvent[],
): string {
  const doneSteps = session.steps.filter(s => s.status === 'done');
  const failedSteps = session.steps.filter(s => s.status === 'failed');
  const pendingSteps = session.steps.filter(s => s.status === 'pending');
  const currentStep = session.steps[session.currentStepIdx] ?? session.steps.find(s => s.status === 'pending') ?? null;
  const total = session.steps.length;
  const done = doneSteps.length;

  const contextSnippet = session.context.length > 2000
    ? session.context.slice(session.context.length - 2000)
    : session.context;

  // ── Current step block ───────────────────────────────────────────────────

  const currentStepBlock = currentStep
    ? `## ⚡ EXECUTE NOW — Step ${currentStep.order} of ${total}

**Tool:** \`${currentStep.tool}\`
**Args:**
\`\`\`json
${JSON.stringify(currentStep.args, null, 2)}
\`\`\`
**Why:** ${currentStep.description}

${currentStep.miniPrompt ? currentStep.miniPrompt : '_No additional instructions for this step._'}`
    : `## ⚡ EXECUTE NOW

_(All steps complete — call \`orch_end sessionId="${session.id}"\` immediately.)_`;

  // ── Completed steps ──────────────────────────────────────────────────────

  const completedList = doneSteps.length > 0
    ? doneSteps.map(s => {
        const resultSnippet = s.result ? `: ${s.result.slice(0, 200)}${s.result.length > 200 ? '…' : ''}` : '';
        return `- ✅ **[${s.order}]** \`${s.tool}\` — ${s.description}${resultSnippet}`;
      }).join('\n')
    : '_(none yet)_';

  const failedList = failedSteps.length > 0
    ? failedSteps.map(s => `- ❌ **[${s.order}]** \`${s.tool}\` — ${s.description}: ${s.result?.slice(0, 120) ?? 'unknown error'}`).join('\n')
    : '';

  // ── Upcoming steps ───────────────────────────────────────────────────────

  const upcomingList = pendingSteps
    .filter(s => s.id !== currentStep?.id)
    .map(s => `- ⏳ **[${s.order}]** \`${s.tool}\` — ${s.description}${s.miniPrompt ? '\n  > ' + s.miniPrompt.split('\n')[0] : ''}`)
    .join('\n') || '_(none)_';

  // ── Tasks created this session ───────────────────────────────────────────

  const tasksCreatedList = session.tasksCreated.length > 0
    ? session.tasksCreated.map(id => `- \`${id}\``).join('\n')
    : '_(none)_';

  // ── Pending project tasks ────────────────────────────────────────────────

  const inProgressCount = pendingTasks.filter(t => t.status === 'in-progress').length;
  const blockedCount = pendingTasks.filter(t => t.status === 'blocked').length;
  const pendingCount = pendingTasks.filter(t => t.status === 'pending').length;

  // ── Recent events ────────────────────────────────────────────────────────

  const recentEventsBlock = recentEvents.length > 0
    ? recentEvents
        .slice(-8)
        .map(e => {
          const ts = new Date(e.timestamp).toISOString().slice(11, 19);
          const resultSnippet = e.result ? `: ${e.result.slice(0, 150)}` : '';
          return `- \`${ts}\` **${e.type}**${e.tool ? ` (${e.tool})` : ''}${resultSnippet}`;
        })
        .join('\n')
    : '_(no events yet)_';

  return `# 🎯 Orchestrator — Active Session
**Intent:** ${session.intent}
**Session:** \`${session.id}\` | **Strategy:** ${session.strategy} | **Status:** ${session.status}

---

${currentStepBlock}

---

## ✅ Completed Steps (${done}/${total})
${completedList}
${failedList ? `\n**Failed:**\n${failedList}` : ''}

## ⏳ Upcoming Steps
${upcomingList}

## 📋 Tasks Created This Session (${session.tasksCreated.length})
${tasksCreatedList}

## 🧠 Context Accumulated
${contextSnippet || '_(empty)_'}

## 📊 Project State
**Pending tasks:** ${pendingCount} | **In progress:** ${inProgressCount} | **Blocked:** ${blockedCount}

## 🕐 Recent Events
${recentEventsBlock}

---

## ⚠️ STRICT RULES
1. **Execute the "EXECUTE NOW" step IMMEDIATELY** — do not ask for confirmation, do not pause
2. **After EVERY tool call:** call \`orch_report sessionId="${session.id}" type="step_complete" result="<summary of what you found>"\` — the summary must be meaningful (not just "done")
3. **Creating a task:** call \`orch_report type="task" taskData={...}\` — never call \`task_create\` directly
4. **Blocked?** call \`orch_report type="blocked" error="<specific reason why you cannot proceed>"\`
5. **ALL steps done?** call \`orch_end sessionId="${session.id}"\` — do not stop without calling this
6. **Never repeat a failed step** — report it as blocked and move on
7. **Never stop and ask** "should I continue?" — continue autonomously until all steps are done or session is ended
8. **Result summaries must be detailed** — include counts, file paths, key findings — not just "success"

## 🔧 Failure Recovery
If the current step fails or returns an error:
1. Log it immediately: \`orch_report sessionId="${session.id}" type="error" result="<exact error message>"\`
2. Try once more with adjusted args (e.g. narrower path, different query)
3. On second failure: \`orch_report sessionId="${session.id}" type="blocked" error="<what failed and why — be specific>"\`
4. Then continue to the next pending step — do not halt the session
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

**Goal:** Complete this step and produce a detailed result summary.
**Expected output:** Specific findings — file paths, counts, issues found, code snippets — not generic confirmations.

${step.miniPrompt ? `**Additional Instructions:**\n${step.miniPrompt}\n` : ''}
${contextSnippet ? `**Accumulated Context (last 800 chars):**\n${contextSnippet}\n` : ''}
After calling the tool, immediately report back using \`orch_report\` with:
- type: "step_complete"
- tool: "${step.tool}"
- result: detailed summary of what the tool returned (include key findings, paths, counts — max 500 chars)

**On failure:** use type="error" and include the exact error message in result.
`;
}
