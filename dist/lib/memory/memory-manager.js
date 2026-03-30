"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryManager = void 0;
const timeline_memory_js_1 = require("./timeline-memory.js");
const file_notes_js_1 = require("./file-notes.js");
const important_facts_js_1 = require("./important-facts.js");
const working_memory_js_1 = require("./working-memory.js");
const cognitive_engine_js_1 = require("./cognitive-engine.js");
class MemoryManager {
    timeline;
    fileNotes;
    facts;
    working;
    cognitive;
    constructor(dataDir, graphStore, repoRoot) {
        this.timeline = new timeline_memory_js_1.TimelineMemory(dataDir);
        this.fileNotes = new file_notes_js_1.FileNotes(dataDir);
        this.facts = new important_facts_js_1.ImportantFacts(dataDir);
        this.working = new working_memory_js_1.WorkingMemory();
        this.cognitive = new cognitive_engine_js_1.CognitiveEngine(this.working, this.timeline, this.fileNotes, this.facts, graphStore ?? null, repoRoot ?? process.cwd());
    }
    async getSessionContext() {
        return this.cognitive.getSessionBriefing();
    }
    close() {
        this.timeline.close();
        this.fileNotes.close();
        this.facts.close();
    }
}
exports.MemoryManager = MemoryManager;
//# sourceMappingURL=memory-manager.js.map