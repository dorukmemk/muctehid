import { AgentStep, AgentLoopResult } from '../../types/v2.js';

type ToolExecutor = (tool: string, args: Record<string, unknown>) => Promise<string>;

export interface AgentLoopOptions {
  maxSteps?: number;
  onStepComplete?: (step: AgentStep, result: string) => void;
  taskId?: string;
}

export async function runAgentLoop(
  steps: AgentStep[],
  executor: ToolExecutor,
  opts: AgentLoopOptions = {},
): Promise<AgentLoopResult> {
  const maxSteps = opts.maxSteps ?? 20;
  const results = new Map<string, string>();
  const stepResults: AgentLoopResult['steps'] = [];
  const totalStart = Date.now();

  const sorted = topologicalSort(steps);

  for (const step of sorted.slice(0, maxSteps)) {
    const start = Date.now();
    try {
      // Inject context from dependencies
      const depContext = step.dependsOn
        .map(id => results.get(id))
        .filter(Boolean)
        .join('\n\n---\n\n');

      const args = depContext
        ? { ...step.args, _previousContext: depContext.slice(0, 2000) }
        : step.args;

      const result = await executor(step.tool, args);
      results.set(step.id, result);
      stepResults.push({ step, result, duration: Date.now() - start });
      opts.onStepComplete?.(step, result);
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      stepResults.push({ step, result: '', duration: Date.now() - start, error });
      results.set(step.id, `ERROR: ${error}`);
    }
  }

  const finalOutput = buildFinalOutput(stepResults);

  return {
    success: stepResults.every(s => !s.error),
    steps: stepResults,
    totalDuration: Date.now() - totalStart,
    finalOutput,
    taskId: opts.taskId,
  };
}

function topologicalSort(steps: AgentStep[]): AgentStep[] {
  const sorted: AgentStep[] = [];
  const visited = new Set<string>();
  const stepMap = new Map(steps.map(s => [s.id, s]));

  function visit(step: AgentStep) {
    if (visited.has(step.id)) return;
    visited.add(step.id);
    for (const depId of step.dependsOn) {
      const dep = stepMap.get(depId);
      if (dep) visit(dep);
    }
    sorted.push(step);
  }

  for (const step of steps) visit(step);
  return sorted;
}

function buildFinalOutput(results: AgentLoopResult['steps']): string {
  const successful = results.filter(r => !r.error);
  if (successful.length === 0) return 'No successful steps.';
  const last = successful.at(-1)!;
  return last.result || successful.map(r => `**${r.step.description}**\n${r.result}`).join('\n\n---\n\n');
}
