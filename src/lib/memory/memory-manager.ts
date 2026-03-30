import { TimelineMemory } from './timeline-memory.js';
import { FileNotes } from './file-notes.js';
import { ImportantFacts } from './important-facts.js';
import { WorkingMemory } from './working-memory.js';
import { CognitiveEngine } from './cognitive-engine.js';
import { GraphStore } from '../graph/graph-store.js';

export class MemoryManager {
  public timeline: TimelineMemory;
  public fileNotes: FileNotes;
  public facts: ImportantFacts;
  public working: WorkingMemory;
  public cognitive: CognitiveEngine;

  constructor(dataDir: string, graphStore?: GraphStore | null, repoRoot?: string) {
    this.timeline = new TimelineMemory(dataDir);
    this.fileNotes = new FileNotes(dataDir);
    this.facts = new ImportantFacts(dataDir);
    this.working = new WorkingMemory();
    this.cognitive = new CognitiveEngine(
      this.working,
      this.timeline,
      this.fileNotes,
      this.facts,
      graphStore ?? null,
      repoRoot ?? process.cwd(),
    );
  }

  async getSessionContext(): Promise<string> {
    return this.cognitive.getSessionBriefing();
  }

  close(): void {
    this.timeline.close();
    this.fileNotes.close();
    this.facts.close();
  }
}
