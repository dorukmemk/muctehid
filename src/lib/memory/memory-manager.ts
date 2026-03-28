import { TimelineMemory } from './timeline-memory.js';
import { FileNotes } from './file-notes.js';
import { ImportantFacts } from './important-facts.js';

export class MemoryManager {
  public timeline: TimelineMemory;
  public fileNotes: FileNotes;
  public facts: ImportantFacts;

  constructor(dataDir: string) {
    this.timeline = new TimelineMemory(dataDir);
    this.fileNotes = new FileNotes(dataDir);
    this.facts = new ImportantFacts(dataDir);
  }

  async getSessionContext(): Promise<string> {
    // Get top facts for session start
    const topFacts = this.facts.getTopFacts(5);
    const recentEvents = await this.timeline.recent(5);

    const lines: string[] = [];
    
    if (topFacts.length > 0) {
      lines.push('## 📌 Important Facts');
      for (const fact of topFacts) {
        const emoji = fact.importance === 'critical' ? '🔴' : fact.importance === 'high' ? '🟠' : '🟡';
        lines.push(`${emoji} [${fact.category}] ${fact.fact}`);
      }
      lines.push('');
    }

    if (recentEvents.length > 0) {
      lines.push('## 🕐 Recent Activity');
      for (const event of recentEvents) {
        const time = new Date(event.timestamp).toLocaleString();
        lines.push(`- ${time}: ${event.action}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  close(): void {
    this.timeline.close();
    this.fileNotes.close();
    this.facts.close();
  }
}
