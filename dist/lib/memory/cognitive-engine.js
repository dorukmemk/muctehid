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
exports.CognitiveEngine = void 0;
const path = __importStar(require("path"));
class CognitiveEngine {
    working;
    timeline;
    fileNotes;
    facts;
    graphStore;
    repoRoot;
    constructor(working, timeline, fileNotes, facts, graphStore, repoRoot) {
        this.working = working;
        this.timeline = timeline;
        this.fileNotes = fileNotes;
        this.facts = facts;
        this.graphStore = graphStore;
        this.repoRoot = repoRoot;
    }
    async recallForFile(fp) {
        const warns = [];
        const sugs = [];
        const mems = [];
        const parts = [];
        const notes = this.fileNotes.get(fp);
        if (notes.length > 0) {
            parts.push('## Dosya Notlari');
            for (const n of notes) {
                const e = n.category === 'warning' ? 'WARN' : n.category === 'todo' ? 'TODO' : n.category === 'learned' ? 'LEARNED' : 'INFO';
                parts.push(`[${e}] ${n.note}`);
                if (n.category === 'warning')
                    warns.push(n.note);
            }
        }
        const evts = await this.timeline.getByFile(fp, 5);
        if (evts.length > 0) {
            parts.push('\n## Son Islemler');
            for (const ev of evts) {
                const t = this.ago(ev.timestamp);
                parts.push(`[${ev.outcome}] ${t}: ${ev.action}`);
                mems.push(`${t}: ${ev.action} (${ev.outcome})`);
            }
        }
        if (this.graphStore) {
            try {
                const syms = await this.graphStore.query('SELECT name, kind FROM symbols WHERE filepath = ? OR filepath LIKE ?', [fp, '%' + path.basename(fp)]);
                if (syms.length > 0) {
                    parts.push('\n## Semboller (' + syms.length + ')');
                    for (const s of syms.slice(0, 10))
                        parts.push('- ' + s.kind + ': ' + s.name);
                }
            }
            catch { /* graph not built */ }
        }
        try {
            const rf = await this.facts.search(fp, { limit: 3 });
            if (rf.length > 0) {
                parts.push('\n## Ilgili Bilgiler');
                for (const f of rf)
                    parts.push('[' + f.importance + '] ' + f.fact);
            }
        }
        catch { /* no embeddings */ }
        const drift = this.working.checkDrift();
        if (drift)
            warns.push(drift);
        this.working.touchFile(fp);
        return { context: parts.join('\n'), warnings: warns, suggestions: sugs, relatedMemories: mems };
    }
    async predictChange(fp, desc) {
        const af = [];
        const as2 = [];
        const w = [];
        const sg = [];
        let risk = 'low';
        if (this.graphStore) {
            try {
                const syms = await this.graphStore.query('SELECT uid, name FROM symbols WHERE filepath = ? OR filepath LIKE ?', [fp, '%' + path.basename(fp)]);
                for (const sym of syms) {
                    const callers = await this.graphStore.query('SELECT DISTINCT s.filepath, s.name FROM relations r JOIN symbols s ON r.fromUid = s.uid WHERE r.toUid = ?', [sym.uid]);
                    for (const c of callers) {
                        if (!af.includes(c.filepath))
                            af.push(c.filepath);
                        as2.push(c.name + ' (calls ' + sym.name + ')');
                    }
                }
                if (af.length >= 10)
                    risk = 'critical';
                else if (af.length >= 5)
                    risk = 'high';
                else if (af.length >= 2)
                    risk = 'medium';
            }
            catch { /* */ }
        }
        const notes = this.fileNotes.get(fp);
        for (const n of notes) {
            if (n.category === 'warning')
                w.push(n.note);
        }
        const failed = await this.timeline.search({ query: fp, outcome: 'failure', limit: 3 });
        if (failed.length > 0)
            w.push('Bu dosyada ' + failed.length + ' basarisiz islem gecmisi var.');
        const similar = await this.timeline.search({ query: desc, limit: 3 });
        if (similar.length > 0) {
            sg.push('Benzer gecmis:');
            for (const e of similar)
                sg.push('  [' + e.outcome + '] ' + e.action);
        }
        if (af.length > 0)
            sg.push(af.length + ' dosya etkilenecek');
        return { file: fp, affectedFiles: af, affectedSymbols: as2, riskLevel: risk, warnings: w, suggestions: sg };
    }
    async recallExperience(task) {
        const lines = [];
        const similar = await this.timeline.search({ query: task, limit: 5 });
        if (similar.length > 0) {
            lines.push('## Benzer Gecmis');
            for (const e of similar) {
                lines.push('[' + e.outcome + '] ' + this.ago(e.timestamp) + ': ' + e.action);
                if (e.context)
                    lines.push('   Baglam: ' + e.context);
                if (e.files && e.files.length > 0)
                    lines.push('   Dosyalar: ' + e.files.join(', '));
            }
        }
        try {
            const rf = await this.facts.search(task, { limit: 3 });
            if (rf.length > 0) {
                lines.push('\n## Ilgili Bilgiler');
                for (const f of rf)
                    lines.push('[' + f.importance + '] ' + f.fact);
            }
        }
        catch { /* */ }
        try {
            const rn = await this.fileNotes.search(task, 3);
            if (rn.length > 0) {
                lines.push('\n## Ilgili Notlar');
                for (const n of rn)
                    lines.push(n.filepath + ': ' + n.note);
            }
        }
        catch { /* */ }
        return lines.length > 0 ? lines.join('\n') : 'Bu konuda gecmis deneyim bulunamadi.';
    }
    suggestNextAction() {
        const ctx = this.working.getContext();
        if (!ctx.activeGoal && !ctx.currentTask)
            return 'Aktif gorev yok. task_next ile sonraki gorevi al.';
        const lines = [];
        if (ctx.currentTask)
            lines.push('Aktif gorev: ' + ctx.currentTask);
        if (ctx.activeGoal)
            lines.push('Hedef: ' + ctx.activeGoal);
        const drift = this.working.checkDrift();
        if (drift)
            lines.push(drift);
        return lines.join('\n');
    }
    async getSessionBriefing() {
        const lines = [];
        const topFacts = this.facts.getTopFacts(5);
        if (topFacts.length > 0) {
            lines.push('## Onemli Bilgiler');
            for (const f of topFacts)
                lines.push('[' + f.importance + '/' + f.category + '] ' + f.fact);
            lines.push('');
        }
        const recent = await this.timeline.recent(10);
        if (recent.length > 0) {
            lines.push('## Son Aktivite');
            for (const ev of recent)
                lines.push('[' + ev.outcome + '] ' + this.ago(ev.timestamp) + ': ' + ev.action);
            lines.push('');
        }
        const todos = this.fileNotes.getByCategory('todo');
        if (todos.length > 0) {
            lines.push('## Acik TODOlar (' + todos.length + ')');
            for (const t of todos.slice(0, 5))
                lines.push('- ' + t.filepath + ': ' + t.note);
            lines.push('');
        }
        const warns = this.fileNotes.getByCategory('warning');
        if (warns.length > 0) {
            lines.push('## Uyarilar (' + warns.length + ')');
            for (const ww of warns.slice(0, 5))
                lines.push('- ' + ww.filepath + ': ' + ww.note);
        }
        const ts = this.timeline.stats();
        const fns = this.fileNotes.stats();
        const fcs = this.facts.stats();
        lines.push('\n## Bellek Durumu');
        lines.push('Timeline: ' + ts.totalEvents + ' olay (son 24s: ' + ts.last24h + ')');
        lines.push('Dosya Notlari: ' + fns.totalNotes);
        lines.push('Bilgi Bankasi: ' + fcs.totalFacts);
        return lines.join('\n');
    }
    ago(ts) {
        const d = Date.now() - ts;
        const m = Math.floor(d / 60000);
        if (m < 1)
            return 'az once';
        if (m < 60)
            return m + 'dk once';
        const h = Math.floor(m / 60);
        if (h < 24)
            return h + 'sa once';
        return Math.floor(h / 24) + 'g once';
    }
}
exports.CognitiveEngine = CognitiveEngine;
//# sourceMappingURL=cognitive-engine.js.map