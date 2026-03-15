import * as fs from 'fs';
import * as path from 'path';
import { render } from '../templates/template-engine.js';
import { ParsedRequirements, ParsedDesign, ParsedTask, SpecWorkflow } from '../../types/v2.js';

export function writeRequirements(spec: SpecWorkflow, req: ParsedRequirements): void {
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
  fs.writeFileSync(spec.requirementsPath, render(template, ctx as Parameters<typeof render>[1]), 'utf-8');
}

export function writeDesign(spec: SpecWorkflow, design: ParsedDesign): void {
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
  fs.writeFileSync(spec.designPath, render(template, ctx as Parameters<typeof render>[1]), 'utf-8');
}

export function writeTasks(spec: SpecWorkflow, tasks: ParsedTask[]): void {
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
  fs.writeFileSync(spec.tasksPath, render(template, ctx as Parameters<typeof render>[1]), 'utf-8');
}

// ─── Inline templates (fallback if built-in template files missing) ───────────

function getRequirementsTemplate(): string {
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

function getDesignTemplate(): string {
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

function getTasksTemplate(): string {
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
