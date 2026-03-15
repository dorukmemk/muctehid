// ─── Task System ──────────────────────────────────────────────────────────────

export type TaskStatus = 'pending' | 'in-progress' | 'done' | 'blocked' | 'cancelled';
export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';
export type TaskCategory = 'feature' | 'bug' | 'refactor' | 'docs' | 'test' | 'research' | 'chore';

export interface Task {
  id: string;
  title: string;
  description: string;
  miniPrompt?: string;
  status: TaskStatus;
  priority: TaskPriority;
  category: TaskCategory;
  specId?: string;
  specTaskRef?: string;
  filepath?: string;
  startLine?: number;
  endLine?: number;
  symbol?: string;
  dependsOn: string[];
  tags: string[];
  estimateHours?: number;
  actualHours?: number;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  createdBy: 'agent' | 'user' | 'spec';
  references: TaskReference[];
  notes?: string;
}

export interface TaskReference {
  id: string;
  taskId: string;
  type: 'code' | 'doc' | 'issue' | 'pr' | 'url';
  label?: string;
  target: string;
  line?: number;
}

export interface TaskTimelineEntry {
  id: string;
  taskId: string;
  event: 'created' | 'started' | 'completed' | 'blocked' | 'note' | 'updated';
  detail?: string;
  timestamp: number;
}

export interface TaskProgress {
  total: number;
  done: number;
  inProgress: number;
  blocked: number;
  pending: number;
  percentComplete: number;
  estimatedRemainingHours: number;
  criticalPath: string[];
}

// ─── Spec System ──────────────────────────────────────────────────────────────

export type SpecStatus = 'requirements' | 'design' | 'tasks' | 'executing' | 'done';

export interface SpecWorkflow {
  id: string;
  name: string;
  status: SpecStatus;
  repoRoot: string;
  createdAt: number;
  updatedAt: number;
  requirementsPath: string;
  designPath: string;
  tasksPath: string;
  taskIds: string[];
  description: string;
}

export interface UserStory {
  id: string;
  asA: string;
  iWant: string;
  soThat: string;
  priority: 'must' | 'should' | 'could' | 'wont';
}

export interface AcceptanceCriteria {
  storyId: string;
  given: string;
  when: string;
  then: string;
}

export interface ParsedRequirements {
  overview: string;
  userStories: UserStory[];
  acceptanceCriteria: AcceptanceCriteria[];
  outOfScope: string[];
  assumptions: string[];
  openQuestions: string[];
}

export interface DesignComponent {
  name: string;
  filePath: string;
  responsibility: string;
  interfaces: string[];
  dependencies: string[];
}

export interface ParsedDesign {
  summary: string;
  architecture: string;
  components: DesignComponent[];
  dataModels: string[];
  apiContracts: string[];
  openQuestions: string[];
}

export interface ParsedTask {
  id: string;
  title: string;
  description: string;
  storyRef: string;
  estimateHours: number;
  miniPrompt: string;
  acceptanceCriteria: string[];
  filePaths: string[];
  dependsOn: string[];
  status: TaskStatus;
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

export type ComplexityLevel = 'trivial' | 'simple' | 'moderate' | 'complex' | 'epic';
export type RoutingStrategy = 'direct' | 'skill' | 'spec' | 'research-first' | 'parallel';

export interface ComplexityAnalysis {
  level: ComplexityLevel;
  requiresMemory: boolean;
  requiresResearch: boolean;
  requiresSpec: boolean;
  requiresMultiStep: boolean;
  estimatedSteps: number;
  suggestedSkills: string[];
  confidence: number;
  reasoning: string;
}

export interface AgentStep {
  id: string;
  order: number;
  tool: string;
  args: Record<string, unknown>;
  dependsOn: string[];
  description: string;
  miniPrompt?: string;
}

export interface RoutingDecision {
  strategy: RoutingStrategy;
  primarySkill?: string;
  tools: string[];
  steps: AgentStep[];
  requiresApproval: boolean;
  rationale: string;
}

export interface AgentLoopResult {
  success: boolean;
  steps: Array<{ step: AgentStep; result: string; duration: number; error?: string }>;
  totalDuration: number;
  finalOutput: string;
  taskId?: string;
}

// ─── Research ─────────────────────────────────────────────────────────────────

export interface ResearchSource {
  id: string;
  type: 'codebase' | 'docs' | 'pattern';
  label: string;
  filepath?: string;
  excerpt: string;
  credibilityScore: number;
}

export interface ResearchFinding {
  id: string;
  claim: string;
  evidence: string;
  source: ResearchSource;
  confidence: number;
  corroborated: boolean;
}

export interface Contradiction {
  finding1: ResearchFinding;
  finding2: ResearchFinding;
  description: string;
}

export interface HallucinationReport {
  trustScore: number;
  verifiedClaims: string[];
  unverifiedClaims: string[];
  flaggedText: string;
  recommendation: 'accept' | 'review' | 'reject';
}

export interface ResearchResult {
  id: string;
  topic: string;
  findings: ResearchFinding[];
  synthesis: string;
  confidence: number;
  sourcesUsed: ResearchSource[];
  contradictions: Contradiction[];
  caveats: string[];
  hallucinationReport: HallucinationReport;
  timestamp: number;
}

// ─── Memory Extensions ────────────────────────────────────────────────────────

export interface ChunkTimelineEntry {
  id: string;
  chunkId: string;
  event: 'indexed' | 'updated' | 'deleted' | 'accessed';
  timestamp: number;
  metadata?: { gitCommit?: string; author?: string; reason?: string };
}

export interface Document {
  id: string;
  filepath: string;
  title?: string;
  docType: 'readme' | 'spec' | 'changelog' | 'design' | 'requirements' | 'tasks' | 'other';
  content: string;
  summary?: string;
  wordCount: number;
  indexedAt: number;
  lastModified: number;
  tags: string[];
}

export interface KGNode {
  id: string;
  type: 'file' | 'function' | 'class' | 'interface' | 'module' | 'concept';
  label: string;
  filepath?: string;
  line?: number;
  metadata: Record<string, unknown>;
}

export interface KGEdge {
  id: string;
  source: string;
  target: string;
  type: 'imports' | 'calls' | 'implements' | 'extends' | 'references' | 'defines' | 'related-to';
  weight: number;
  metadata?: Record<string, unknown>;
}

export interface OptimizedContext {
  chunkIds: string[];
  documentIds: string[];
  totalTokensEstimated: number;
  dropped: number;
  summary?: string;
}

// ─── Template System ──────────────────────────────────────────────────────────

export interface TemplateDefinition {
  name: string;
  path: string;
  description: string;
  version: string;
  variables: string[];
}

export interface TemplateContext {
  [key: string]: string | number | boolean | string[] | Record<string, unknown> | TemplateContext | Array<unknown>;
}
