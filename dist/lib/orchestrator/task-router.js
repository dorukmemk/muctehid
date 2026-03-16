"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.routeTask = routeTask;
const crypto = __importStar(require("crypto"));
function routeTask(intent, analysis, selectedSkills) {
    const steps = [];
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
        steps.push(makeStep(steps.length + 1, 'run_skill', { skill: primary.name, context: intent }, steps.map(s => s.id), `Run skill: ${primary.name}`, buildMiniPrompt(intent, primary)));
        // Parallel secondary skills
        for (const skill of selectedSkills.slice(1)) {
            steps.push(makeStep(steps.length + 1, 'run_skill', { skill: skill.name, context: intent }, [], `Run skill: ${skill.name}`));
        }
    }
    if (analysis.requiresSpec) {
        steps.push(makeStep(steps.length + 1, 'spec_init', { name: slugify(intent) }, steps.map(s => s.id), 'Initialize spec workflow'));
        steps.push(makeStep(steps.length + 1, 'spec_generate_requirements', { description: intent }, [steps.at(-1).id], 'Generate requirements'));
        steps.push(makeStep(steps.length + 1, 'spec_generate_design', {}, [steps.at(-1).id], 'Generate design'));
        steps.push(makeStep(steps.length + 1, 'spec_generate_tasks', {}, [steps.at(-1).id], 'Generate tasks with mini-prompts'));
    }
    const strategy = analysis.requiresSpec
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
function makeStep(order, tool, args, dependsOn, description, miniPrompt) {
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
function buildMiniPrompt(intent, skill) {
    return `## ${skill.name}\n\n**Goal:** ${intent}\n\n**Skill:** ${skill.description}\n\n**Instructions:**\n${skill.instructions.slice(0, 500)}`;
}
function slugify(text) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40).replace(/-+$/, '');
}
//# sourceMappingURL=task-router.js.map