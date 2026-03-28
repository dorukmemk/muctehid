"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryManager = void 0;
const timeline_memory_js_1 = require("./timeline-memory.js");
const file_notes_js_1 = require("./file-notes.js");
const important_facts_js_1 = require("./important-facts.js");
class MemoryManager {
    timeline;
    fileNotes;
    facts;
    constructor(dataDir) {
        this.timeline = new timeline_memory_js_1.TimelineMemory(dataDir);
        this.fileNotes = new file_notes_js_1.FileNotes(dataDir);
        this.facts = new important_facts_js_1.ImportantFacts(dataDir);
    }
    async getSessionContext() {
        // Get top facts for session start
        const topFacts = this.facts.getTopFacts(5);
        const recentEvents = await this.timeline.recent(5);
        const lines = [];
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
    close() {
        this.timeline.close();
        this.fileNotes.close();
        this.facts.close();
    }
}
exports.MemoryManager = MemoryManager;
//# sourceMappingURL=memory-manager.js.map