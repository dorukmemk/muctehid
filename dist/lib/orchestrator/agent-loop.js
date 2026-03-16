"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runAgentLoop = runAgentLoop;
async function runAgentLoop(steps, executor, opts = {}) {
    const maxSteps = opts.maxSteps ?? 20;
    const results = new Map();
    const stepResults = [];
    const totalStart = Date.now();
    const levels = buildLevels(steps).map(level => level.slice(0, maxSteps));
    let remaining = maxSteps;
    for (const level of levels) {
        if (remaining <= 0)
            break;
        const batch = level.slice(0, remaining);
        remaining -= batch.length;
        await Promise.all(batch.map(async (step) => {
            const start = Date.now();
            try {
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
            }
            catch (e) {
                const error = e instanceof Error ? e.message : String(e);
                stepResults.push({ step, result: '', duration: Date.now() - start, error });
                results.set(step.id, `ERROR: ${error}`);
            }
        }));
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
/** Groups steps into parallel levels: level 0 has no deps, level N deps only on levels < N */
function buildLevels(steps) {
    const levelMap = new Map();
    const stepMap = new Map(steps.map(s => [s.id, s]));
    function getLevel(step) {
        if (levelMap.has(step.id))
            return levelMap.get(step.id);
        const level = step.dependsOn.length === 0
            ? 0
            : 1 + Math.max(...step.dependsOn.map(id => {
                const dep = stepMap.get(id);
                return dep ? getLevel(dep) : 0;
            }));
        levelMap.set(step.id, level);
        return level;
    }
    for (const step of steps)
        getLevel(step);
    const maxLevel = Math.max(...levelMap.values(), 0);
    const levels = Array.from({ length: maxLevel + 1 }, () => []);
    for (const step of steps)
        levels[levelMap.get(step.id)].push(step);
    return levels;
}
function buildFinalOutput(results) {
    const successful = results.filter(r => !r.error);
    if (successful.length === 0)
        return 'No successful steps.';
    const last = successful.at(-1);
    return last.result || successful.map(r => `**${r.step.description}**\n${r.result}`).join('\n\n---\n\n');
}
//# sourceMappingURL=agent-loop.js.map