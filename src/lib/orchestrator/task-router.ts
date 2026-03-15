import * as crypto from 'crypto';
import { ComplexityAnalysis, RoutingDecision, AgentStep } from '../../types/v2.js';
import { SkillDefinition } from '../../types/index.js';

export function routeTask(
  intent: string,
  analysis: ComplexityAnalysis,
  selectedSkills: SkillDefinition[],
): RoutingDecision {
  const steps: AgentStep[] = [];

  if (analysis.level === 'trivial') {
    return {
      strategy: 'direct',
      tools: ['health_score', 'memory_stats'],
      steps: [],
      requiresApproval: false,
      rationale: 'Simple query — direct tool call',
    };
  }

  if (analysis.requiresResearch) {
    steps.push(makeStep(1, 'research', { topic: intent }, [], 'Research background knowledge'));
  }

  if (analysis.requiresMemory) {
    steps.push(makeStep(steps.length + 1, 'search_code', { query: intent, k: 10 }, [], 'Search codebase for relevant context'));
  }

  if (selectedSkills.length > 0) {
    const primary = selectedSkills[0];
    steps.push(makeStep(
      steps.length + 1,
      'run_skill',
      { skill: primary.name, context: intent },
      steps.map(s => s.id),
      `Run skill: ${primary.name}`,
      buildMiniPrompt(intent, primary),
    ));

    // Parallel secondary skills
    for (const skill of selectedSkills.slice(1)) {
      steps.push(makeStep(
        steps.length + 1,
        'run_skill',
        { skill: skill.name, context: intent },
        [],
        `Run skill: ${skill.name}`,
      ));
    }
  }

  if (analysis.requiresSpec) {
    steps.push(makeStep(steps.length + 1, 'spec_init', { name: slugify(intent) }, steps.map(s => s.id), 'Initialize spec workflow'));
    steps.push(makeStep(steps.length + 1, 'spec_generate_requirements', { description: intent }, [steps.at(-1)!.id], 'Generate requirements'));
    steps.push(makeStep(steps.length + 1, 'spec_generate_design', {}, [steps.at(-1)!.id], 'Generate design'));
    steps.push(makeStep(steps.length + 1, 'spec_generate_tasks', {}, [steps.at(-1)!.id], 'Generate tasks with mini-prompts'));
  }

  const strategy: RoutingDecision['strategy'] = analysis.requiresSpec
    ? 'spec'
    : analysis.requiresResearch
    ? 'research-first'
    : selectedSkills.length > 1
    ? 'parallel'
    : 'skill';

  return {
    strategy,
    primarySkill: selectedSkills[0]?.name,
    tools: [...new Set(steps.map(s => s.tool))],
    steps,
    requiresApproval: analysis.level === 'epic',
    rationale: `Level: ${analysis.level}, Skills: ${selectedSkills.map(s => s.name).join(', ')}`,
  };
}

function makeStep(order: number, tool: string, args: Record<string, unknown>, dependsOn: string[], description: string, miniPrompt?: string): AgentStep {
  return {
    id: crypto.randomUUID().slice(0, 8),
    order,
    tool,
    args,
    dependsOn,
    description,
    miniPrompt,
  };
}

function buildMiniPrompt(intent: string, skill: SkillDefinition): string {
  return `## ${skill.name}\n\n**Goal:** ${intent}\n\n**Skill:** ${skill.description}\n\n**Instructions:**\n${skill.instructions.slice(0, 500)}`;
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40).replace(/-+$/, '');
}
