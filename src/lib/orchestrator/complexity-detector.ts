import { ComplexityAnalysis, ComplexityLevel } from '../../types/v2.js';

const TRIVIAL_PATTERNS = [/^(health|stats|status|list|show|get)\b/i, /\?$/, /^(how many|what is the)/i];
const EPIC_PATTERNS = [/\b(architecture|greenfield|new (module|service|system)|migrate|refactor (entire|whole|all))\b/i];
const COMPLEX_PATTERNS = [/\b(refactor|redesign|restructure|decompose|extract|modularize)\b/i, /\b(multiple files|across the codebase|end.to.end)\b/i];
const RESEARCH_PATTERNS = [/\b(how to|best practice|what is|compare|vs|versus|should i use|pattern for)\b/i, /\b(unknown|unfamiliar|research|investigate|explore)\b/i];
const SPEC_PATTERNS = [/\b(spec|design doc|requirements|plan|feature|implement|build|create a new)\b/i];

export function detectComplexity(intent: string): ComplexityAnalysis {
  const lower = intent.toLowerCase();
  const wordCount = intent.split(/\s+/).length;

  let level: ComplexityLevel = 'simple';
  let estimatedSteps = 2;
  const suggestedSkills: string[] = [];
  const reasons: string[] = [];

  // Check patterns in order of severity
  if (TRIVIAL_PATTERNS.some(p => p.test(lower)) && wordCount < 10) {
    level = 'trivial';
    estimatedSteps = 1;
    reasons.push('simple query pattern');
  } else if (EPIC_PATTERNS.some(p => p.test(lower)) || wordCount > 80) {
    level = 'epic';
    estimatedSteps = 15;
    reasons.push('architectural scope');
    suggestedSkills.push('refactor-planner', 'feature-planner');
  } else if (COMPLEX_PATTERNS.some(p => p.test(lower)) || wordCount > 40) {
    level = 'complex';
    estimatedSteps = 8;
    reasons.push('multi-file operation');
    suggestedSkills.push('refactor-planner');
  } else if (wordCount > 20) {
    level = 'moderate';
    estimatedSteps = 4;
    reasons.push('multi-step task');
  }

  // Bug detection
  if (/\b(bug|error|exception|crash|broken|fix|failing)\b/i.test(lower)) {
    suggestedSkills.push('bug-reporter');
    if (level === 'trivial' || level === 'simple') level = 'simple';
  }

  // Security
  if (/\b(security|vulnerability|owasp|secret|injection)\b/i.test(lower)) {
    suggestedSkills.push('security-audit');
  }

  // Audit
  if (/\b(audit|review|scan|analyze|quality)\b/i.test(lower)) {
    suggestedSkills.push('audit-runner');
  }

  // Docs
  if (/\b(document|doc|jsdoc|readme|comment)\b/i.test(lower)) {
    suggestedSkills.push('doc-analyzer');
  }

  // Performance
  if (/\b(performance|slow|optimize|bottleneck|speed)\b/i.test(lower)) {
    suggestedSkills.push('performance-audit');
  }

  const requiresResearch = RESEARCH_PATTERNS.some(p => p.test(lower));
  const requiresSpec = SPEC_PATTERNS.some(p => p.test(lower)) && (level === 'complex' || level === 'epic');
  const requiresMemory = level !== 'trivial';
  const requiresMultiStep = estimatedSteps > 2;

  if (requiresResearch) {
    reasons.push('requires research');
    suggestedSkills.push('deep-dive');
  }

  return {
    level,
    requiresMemory,
    requiresResearch,
    requiresSpec,
    requiresMultiStep,
    estimatedSteps,
    suggestedSkills: [...new Set(suggestedSkills)],
    confidence: level === 'trivial' || level === 'epic' ? 0.9 : 0.7,
    reasoning: reasons.join(', ') || 'default classification',
  };
}
