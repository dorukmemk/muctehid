"use strict";
/**
 * Working Memory — Anlık bellek
 *
 * İnsanın "şu an ne yapıyorum" bilinci gibi çalışır.
 * Session boyunca RAM'de tutulur, session bitince temizlenir.
 * Aktif görev, açık dosyalar, son kararlar, mevcut bağlam.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkingMemory = void 0;
class WorkingMemory {
    context;
    maxBreadcrumbs = 50;
    maxDecisions = 20;
    constructor() {
        this.context = {
            openFiles: [],
            recentDecisions: [],
            breadcrumbs: [],
        };
    }
    // ── Görev yönetimi ──────────────────────────────────────────────────────
    setActiveTask(task, taskId, specId) {
        this.context.currentTask = task;
        this.context.currentTaskId = taskId;
        this.context.currentSpecId = specId;
        this.addBreadcrumb(`Started task: ${task}`);
    }
    setGoal(goal) {
        this.context.activeGoal = goal;
        this.addBreadcrumb(`Goal set: ${goal}`);
    }
    clearTask() {
        if (this.context.currentTask) {
            this.addBreadcrumb(`Completed task: ${this.context.currentTask}`);
        }
        this.context.currentTask = undefined;
        this.context.currentTaskId = undefined;
    }
    // ── Dosya takibi ────────────────────────────────────────────────────────
    touchFile(filepath) {
        // En son dokunulan dosyayı başa al
        this.context.openFiles = [
            filepath,
            ...this.context.openFiles.filter(f => f !== filepath),
        ].slice(0, 20);
    }
    getRecentFiles() {
        return this.context.openFiles;
    }
    // ── Karar kayıt ─────────────────────────────────────────────────────────
    recordDecision(what, why, alternatives) {
        this.context.recentDecisions.unshift({
            timestamp: Date.now(),
            what,
            why,
            alternatives,
        });
        if (this.context.recentDecisions.length > this.maxDecisions) {
            this.context.recentDecisions.pop();
        }
        this.addBreadcrumb(`Decision: ${what}`);
    }
    // ── Breadcrumb (iz bırakma) ─────────────────────────────────────────────
    addBreadcrumb(action, file, result) {
        this.context.breadcrumbs.unshift({
            timestamp: Date.now(),
            action,
            file,
            result,
        });
        if (this.context.breadcrumbs.length > this.maxBreadcrumbs) {
            this.context.breadcrumbs.pop();
        }
    }
    // ── Bağlam özeti ────────────────────────────────────────────────────────
    getSummary() {
        const lines = [];
        if (this.context.activeGoal) {
            lines.push(`🎯 Goal: ${this.context.activeGoal}`);
        }
        if (this.context.currentTask) {
            lines.push(`📋 Active Task: ${this.context.currentTask}`);
        }
        if (this.context.openFiles.length > 0) {
            lines.push(`📂 Recent Files: ${this.context.openFiles.slice(0, 5).join(', ')}`);
        }
        if (this.context.recentDecisions.length > 0) {
            lines.push(`🧠 Last Decision: ${this.context.recentDecisions[0].what}`);
        }
        if (this.context.breadcrumbs.length > 0) {
            const recent = this.context.breadcrumbs.slice(0, 5);
            lines.push(`👣 Trail: ${recent.map(b => b.action).join(' → ')}`);
        }
        return lines.join('\n');
    }
    getContext() {
        return { ...this.context };
    }
    // ── Drift detection (hedeften sapma) ────────────────────────────────────
    checkDrift() {
        if (!this.context.activeGoal)
            return null;
        if (this.context.breadcrumbs.length < 5)
            return null;
        // Son 5 breadcrumb'ı kontrol et — hepsi farklı dosyalardaysa drift var
        const recentFiles = new Set(this.context.breadcrumbs.slice(0, 5)
            .map(b => b.file)
            .filter(Boolean));
        if (recentFiles.size >= 4) {
            return `⚠️ Possible goal drift detected. Goal: "${this.context.activeGoal}" but touching ${recentFiles.size} different files in last 5 actions.`;
        }
        return null;
    }
    reset() {
        this.context = {
            openFiles: [],
            recentDecisions: [],
            breadcrumbs: [],
        };
    }
}
exports.WorkingMemory = WorkingMemory;
//# sourceMappingURL=working-memory.js.map