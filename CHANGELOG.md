# Changelog

## [Unreleased]

### Fixed (v2.0.1 - 2026-03-28)

#### Graph Relation Detection Improvements

**Problem:** User reported that 4602 relations were created but stats showed only 2, and most functions (like `useLiveTranscript`, `LiveNotesService`) had no relations detected.

**Root Causes:**
1. Foreign key constraint failures - relations were silently failing when target symbols didn't exist yet
2. Duplicate relations being inserted multiple times
3. React hooks and arrow functions not being detected
4. JSX component usage not tracked
5. Import path resolution was naive (didn't handle relative paths)

**Fixes:**

1. **Two-Pass Graph Building** (`graph-builder.ts`)
   - Pass 1: Create all symbols first
   - Pass 2: Create relations (now all symbols exist)
   - Prevents foreign key failures

2. **Duplicate Detection** (`graph-store.ts`)
   - Check for existing relations before insert
   - Update confidence if higher
   - Proper error logging

3. **React Support** (`typescript-parser.ts`)
   - Arrow functions: `const useHook = () => {}`
   - Export assignments: `export const useHook = () => {}`
   - JSX elements: `<Component />`
   - Hook calls: `const [state] = useState()`

4. **Import Resolution** (`typescript-parser.ts`)
   - Relative path resolution: `./module` → `src/module.ts`
   - Named imports: `import { X, Y as Z }`
   - Default imports: `import X from './module'`
   - Namespace imports: `import * as X from './module'`

**Expected Improvements:**
- Relations count should match created count
- React hooks should have proper call chains
- JSX component usage tracked
- Better cross-file reference resolution

**Testing:**
```typescript
// Before: useLiveTranscript had 0 relations
// After: Should show calls to useState, useEffect, etc.

graph_build({ path: "src/" })
impact({ target: "useLiveTranscript", direction: "upstream" })
```

---

## [2.0.0] - 2026-03-28

### Added

#### GitNexus Integration - Knowledge Graph

- **5 New Tools:**
  - `graph_build` - Build AST-based knowledge graph
  - `impact` - Blast radius analysis (upstream/downstream)
  - `graph_context` - 360° symbol view
  - `graph_stats` - Graph statistics
  - `graph_query` - Raw SQL queries

- **Enhanced Tools:**
  - `index_codebase` - Added `buildGraph: boolean` parameter

- **Core Components:**
  - SQLite-based graph store
  - Tree-sitter TypeScript/JavaScript parser
  - Impact analyzer with risk scoring
  - Graph builder with AST → Graph conversion

- **Features:**
  - Function/Class/Interface/Method detection
  - CALLS/IMPORTS/EXTENDS/IMPLEMENTS relations
  - Upstream/downstream traversal
  - Risk scoring (LOW/MEDIUM/HIGH/CRITICAL)
  - Confidence scoring for relations

**Documentation:**
- `GITNEXUS_INTEGRATION.md` - User guide
- `IMPLEMENTATION_SUMMARY.md` - Technical summary
- `.plan/` - Detailed specs and task breakdown

---

## [1.x.x] - Previous Versions

See git history for previous releases.
