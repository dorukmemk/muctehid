---
name: test-generator
version: 1.0.0
description: Generates unit test scaffolding for functions and classes
author: code-audit-mcp
category: testing
type: prompt
triggers:
  - "test"
  - "unit test"
  - "spec"
  - "test generation"
tools:
  - search_code
  - get_context
parameters:
  framework:
    type: enum
    values: [jest, vitest, mocha, pytest]
    default: jest
  coverage_target:
    type: number
    default: 80
output:
  format: markdown
---

## Test Generator Skill

Generates unit test scaffolding:

- Detects exported functions and classes
- Creates test file structure
- Generates test cases for edge cases
- Supports Jest, Vitest, Mocha (JS/TS) and pytest (Python)

### Usage:
```
run_skill("test-generator", { filepath: "src/auth.ts", framework: "jest" })
```
