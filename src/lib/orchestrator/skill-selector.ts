import { SkillDefinition } from '../../types/index.js';
import { ComplexityAnalysis } from '../../types/v2.js';

export function selectSkills(
  intent: string,
  allSkills: SkillDefinition[],
  analysis: ComplexityAnalysis,
): SkillDefinition[] {
  const lower = intent.toLowerCase();
  const scores: Array<{ skill: SkillDefinition; score: number }> = [];

  for (const skill of allSkills) {
    let score = 0;

    // Keyword trigger matching
    for (const trigger of skill.triggers) {
      if (lower.includes(trigger.toLowerCase())) score += 2;
    }

    // Suggested skill bonus from complexity analysis
    if (analysis.suggestedSkills.includes(skill.name)) score += 5;

    // Category bonuses
    if (analysis.requiresResearch && skill.category === 'analysis') score += 3;
    if (analysis.requiresSpec && skill.category === 'planning') score += 3;
    if (analysis.level === 'epic' && skill.type === 'composite') score += 2;

    if (score > 0) scores.push({ skill, score });
  }

  scores.sort((a, b) => b.score - a.score);
  return scores.slice(0, 3).map(s => s.skill);
}
