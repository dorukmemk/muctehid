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
exports.writeRequirements = writeRequirements;
exports.writeDesign = writeDesign;
exports.writeTasks = writeTasks;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const template_engine_js_1 = require("../templates/template-engine.js");
function writeRequirements(spec, req) {
    fs.mkdirSync(path.dirname(spec.requirementsPath), { recursive: true });
    const ctx = {
        specName: spec.name,
        specId: spec.id,
        date: new Date().toISOString().slice(0, 10),
        overview: req.overview || '_Describe the feature or problem here._',
        userStories: req.userStories.map(s => ({
            id: s.id,
            asA: s.asA,
            iWant: s.iWant,
            soThat: s.soThat,
            priority: s.priority.toUpperCase(),
        })),
        acceptanceCriteria: req.acceptanceCriteria.map(ac => ({
            storyId: ac.storyId,
            given: ac.given,
            when: ac.when,
            then: ac.then,
        })),
        outOfScope: req.outOfScope,
        assumptions: req.assumptions,
        openQuestions: req.openQuestions,
    };
    const template = getRequirementsTemplate();
    fs.writeFileSync(spec.requirementsPath, (0, template_engine_js_1.render)(template, ctx), 'utf-8');
}
function writeDesign(spec, design) {
    fs.mkdirSync(path.dirname(spec.designPath), { recursive: true });
    const ctx = {
        specName: spec.name,
        specId: spec.id,
        date: new Date().toISOString().slice(0, 10),
        summary: design.summary || '_Architecture summary here._',
        architecture: design.architecture || '_Describe the architecture._',
        components: design.components.map(c => ({
            name: c.name,
            filePath: c.filePath,
            responsibility: c.responsibility,
            interfaces: c.interfaces.join(', '),
            dependencies: c.dependencies.join(', '),
        })),
        dataModels: design.dataModels,
        apiContracts: design.apiContracts,
        openQuestions: design.openQuestions,
    };
    const template = getDesignTemplate();
    fs.writeFileSync(spec.designPath, (0, template_engine_js_1.render)(template, ctx), 'utf-8');
}
function writeTasks(spec, tasks) {
    fs.mkdirSync(path.dirname(spec.tasksPath), { recursive: true });
    const ctx = {
        specName: spec.name,
        specId: spec.id,
        date: new Date().toISOString().slice(0, 10),
        tasks: tasks.map(t => ({
            id: t.id,
            title: t.title,
            description: t.description,
            storyRef: t.storyRef,
            estimateHours: t.estimateHours,
            miniPrompt: t.miniPrompt,
            acceptanceCriteria: t.acceptanceCriteria,
            filePaths: t.filePaths.join(', '),
            dependsOn: t.dependsOn.join(', '),
            status: t.status,
        })),
    };
    const template = getTasksTemplate();
    fs.writeFileSync(spec.tasksPath, (0, template_engine_js_1.render)(template, ctx), 'utf-8');
}
// ─── Inline templates (fallback if built-in template files missing) ───────────
function getRequirementsTemplate() {
    return `# Requirements: {{specName}}

> Spec ID: {{specId}} | Date: {{date}}

## Overview

{{overview}}

## User Stories

{{#each userStories}}
### {{id}}: As a {{asA}}, I want {{iWant}}

- **So that:** {{soThat}}
- **Priority:** {{priority}}

{{/each}}

## Acceptance Criteria

{{#each acceptanceCriteria}}
**{{storyId}}:**
- Given {{given}}
- When {{when}}
- Then {{then}}

{{/each}}

## Out of Scope

{{#each outOfScope}}
- {{.}}
{{/each}}

## Assumptions

{{#each assumptions}}
- {{.}}
{{/each}}

## Open Questions

{{#each openQuestions}}
- {{.}}
{{/each}}
`;
}
function getDesignTemplate() {
    return `# Design: {{specName}}

> Spec ID: {{specId}} | Date: {{date}}

## Summary

{{summary}}

## Architecture

{{architecture}}

## Components

{{#each components}}
### {{name}}

- **File:** \`{{filePath}}\`
- **Responsibility:** {{responsibility}}
- **Interfaces:** {{interfaces}}
- **Dependencies:** {{dependencies}}

{{/each}}

## Data Models

{{#each dataModels}}
- {{.}}
{{/each}}

## API Contracts

{{#each apiContracts}}
- {{.}}
{{/each}}

## Open Questions

{{#each openQuestions}}
- {{.}}
{{/each}}
`;
}
function getTasksTemplate() {
    return `# Tasks: {{specName}}

> Spec ID: {{specId}} | Date: {{date}}

{{#each tasks}}
## {{id}}: {{title}}

- **Story:** {{storyRef}}
- **Estimate:** {{estimateHours}}h
- **Status:** {{status}}
- **Depends on:** {{dependsOn}}
- **Files:** {{filePaths}}

**Description:** {{description}}

**Mini Prompt:**
{{miniPrompt}}

**Acceptance Criteria:**
{{#each acceptanceCriteria}}
- {{.}}
{{/each}}

---

{{/each}}
`;
}
//# sourceMappingURL=spec-writer.js.map