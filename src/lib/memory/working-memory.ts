/**
 * Working Memory — Anlık bellek
 * 
 * İnsanın "şu an ne yapıyorum" bilinci gibi çalışır.
 * Session boyunca RAM'de tutulur, session bitince temizlenir.
 * Aktif görev, açık dosyalar, son kararlar, mevcut bağlam.
 */

export interface ActiveContext {
  currentTask?: string;
  currentTaskId?: string;
  currentSpecId?: string;
  openFiles: string[];
  recentDecisions: Decision[];
  activeGoal?: string;
  breadcrumbs: Breadcrumb[];  // "neredeydim, nereye gidiyorum"
}

export interface Decision {
  timestamp: number;
  what: string;
  why: string;
  alternatives?: string[];
}

export interface Breadcrumb {
  timestamp: number;
  action: string;
  file?: string;
  result?: string;
}

export class WorkingMemory {
  private context: ActiveContext;
  private maxBreadcrumbs = 50;
  private maxDecisions = 20;

  constructor() {
    this.context = {
      openFiles: [],
      recentDecisions: [],
      breadcrumbs: [],
    };
  }

  // ── Görev yönetimi ──────────────────────────────────────────────────────
  setActiveTask(task: string, taskId?: string, specId?: string): void {
    this.context.currentTask = task;
    this.context.currentTaskId = taskId;
    this.context.currentSpecId = specId;
    this.addBreadcrumb(`Started task: ${task}`);
  }

  setGoal(goal: string): void {
    this.context.activeGoal = goal;
    this.addBreadcrumb(`Goal set: ${goal}`);
  }

  clearTask(): void {
    if (this.context.currentTask) {
      this.addBreadcrumb(`Completed task: ${this.context.currentTask}`);
    }
    this.context.currentTask = undefined;
    this.context.currentTaskId = undefined;
  }

  // ── Dosya takibi ────────────────────────────────────────────────────────
  touchFile(filepath: string): void {
    // En son dokunulan dosyayı başa al
    this.context.openFiles = [
      filepath,
      ...this.context.openFiles.filter(f => f !== filepath),
    ].slice(0, 20);
  }

  getRecentFiles(): string[] {
    return this.context.openFiles;
  }

  // ── Karar kayıt ─────────────────────────────────────────────────────────
  recordDecision(what: string, why: string, alternatives?: string[]): void {
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
  addBreadcrumb(action: string, file?: string, result?: string): void {
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
  getSummary(): string {
    const lines: string[] = [];

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

  getContext(): ActiveContext {
    return { ...this.context };
  }

  // ── Drift detection (hedeften sapma) ────────────────────────────────────
  checkDrift(): string | null {
    if (!this.context.activeGoal) return null;
    if (this.context.breadcrumbs.length < 5) return null;

    // Son 5 breadcrumb'ı kontrol et — hepsi farklı dosyalardaysa drift var
    const recentFiles = new Set(
      this.context.breadcrumbs.slice(0, 5)
        .map(b => b.file)
        .filter(Boolean)
    );
    if (recentFiles.size >= 4) {
      return `⚠️ Possible goal drift detected. Goal: "${this.context.activeGoal}" but touching ${recentFiles.size} different files in last 5 actions.`;
    }
    return null;
  }

  reset(): void {
    this.context = {
      openFiles: [],
      recentDecisions: [],
      breadcrumbs: [],
    };
  }
}
