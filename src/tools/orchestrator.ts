import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { detectComplexity } from '../lib/orchestrator/complexity-detector.js';
import { selectSkills } from '../lib/orchestrator/skill-selector.js';
import { routeTask } from '../lib/orchestrator/task-router.js';
import { SkillRegistry } from '../lib/skills/registry.js';

export function registerOrchestratorTools(
  server: Server,
  deps: { skillRegistry: SkillRegistry }
): void {
  server.setRequestHandler(
    CallToolRequestSchema,
    async (req) => {
      const { name, arguments: args = {} } = req.params;

      if (!['analyze_complexity', 'route_task', 'suggest_skill'].includes(name)) {
        throw new Error(`Unknown orchestrator tool: ${name}`);
      }

      try {
        if (name === 'analyze_complexity') {
          const request = args.request as string;
          if (!request) throw new Error('request is required');
          const context = args.context as string | undefined;
          const analysis = detectComplexity(context ? `${request} ${context}` : request);
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                level: analysis.level,
                requiresMemory: analysis.requiresMemory,
                requiresResearch: analysis.requiresResearch,
                requiresSpec: analysis.requiresSpec,
                requiresMultiStep: analysis.requiresMultiStep,
                estimatedSteps: analysis.estimatedSteps,
                suggestedSkills: analysis.suggestedSkills,
                confidence: analysis.confidence,
                reasoning: analysis.reasoning,
              }, null, 2),
            }],
          };
        }

        if (name === 'route_task') {
          const request = args.request as string;
          if (!request) throw new Error('request is required');
          const context = args.context as string | undefined;
          const intent = context ? `${request} ${context}` : request;
          const analysis = detectComplexity(intent);
          const allSkills = deps.skillRegistry.list();
          const selected = selectSkills(intent, allSkills, analysis);
          const decision = routeTask(intent, analysis, selected);
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                strategy: decision.strategy,
                primarySkill: decision.primarySkill,
                tools: decision.tools,
                steps: decision.steps,
                requiresApproval: decision.requiresApproval,
                rationale: decision.rationale,
              }, null, 2),
            }],
          };
        }

        if (name === 'suggest_skill') {
          const request = args.request as string;
          if (!request) throw new Error('request is required');
          const topK = (args.topK as number) ?? 3;
          const allSkills = deps.skillRegistry.list();
          const analysis = detectComplexity(request);
          const selected = selectSkills(request, allSkills, analysis);
          const results = selected.slice(0, topK);
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify(results.map(s => ({
                skillName: s.name,
                description: s.description,
                category: s.category,
                triggers: s.triggers,
              })), null, 2),
            }],
          };
        }

        throw new Error(`Unhandled tool: ${name}`);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return { content: [{ type: 'text' as const, text: `Hata: ${msg}` }], isError: true };
      }
    }
  );
}
