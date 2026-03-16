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
exports.SpecEngine = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class SpecEngine {
    specsDir;
    indexPath;
    workflows = new Map();
    constructor(dataDir) {
        this.specsDir = path.join(dataDir, 'specs');
        this.indexPath = path.join(this.specsDir, 'index.json');
        fs.mkdirSync(this.specsDir, { recursive: true });
        this.load();
    }
    load() {
        if (!fs.existsSync(this.indexPath))
            return;
        try {
            const arr = JSON.parse(fs.readFileSync(this.indexPath, 'utf-8'));
            for (const w of arr)
                this.workflows.set(w.id, w);
        }
        catch { /* start fresh */ }
    }
    save() {
        fs.writeFileSync(this.indexPath, JSON.stringify(Array.from(this.workflows.values()), null, 2));
    }
    create(name, description, repoRoot) {
        const id = `SPEC-${String(this.workflows.size + 1).padStart(3, '0')}_${name.replace(/[^a-z0-9]/gi, '-').slice(0, 30)}`;
        const specDir = path.join(this.specsDir, id);
        fs.mkdirSync(specDir, { recursive: true });
        const workflow = {
            id,
            name,
            description,
            status: 'requirements',
            repoRoot,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            requirementsPath: path.join(specDir, 'requirements.md'),
            designPath: path.join(specDir, 'design.md'),
            tasksPath: path.join(specDir, 'tasks.md'),
            taskIds: [],
        };
        this.workflows.set(id, workflow);
        this.save();
        return workflow;
    }
    writeRequirements(specId, content) {
        const workflow = this.getOrThrow(specId);
        fs.writeFileSync(workflow.requirementsPath, content, 'utf-8');
        this.updateStatus(specId, 'requirements');
    }
    writeDesign(specId, content) {
        const workflow = this.getOrThrow(specId);
        fs.writeFileSync(workflow.designPath, content, 'utf-8');
        this.updateStatus(specId, 'design');
    }
    writeTasks(specId, content) {
        const workflow = this.getOrThrow(specId);
        fs.writeFileSync(workflow.tasksPath, content, 'utf-8');
        this.updateStatus(specId, 'tasks');
    }
    generateRequirementsContent(name, description, codebaseContext) {
        const date = new Date().toISOString().slice(0, 10);
        // ── Derive user stories from description ──────────────────────────────────
        const stories = deriveUserStories(description);
        const storiesTable = stories.map((s, i) => `| US-${String(i + 1).padStart(3, '0')} | ${s.role} | ${s.want} | ${s.soThat} | ${s.priority} |`).join('\n');
        const acceptanceCriteria = stories.map((s, i) => {
            const id = `US-${String(i + 1).padStart(3, '0')}`;
            return `### ${id}\n- Given: ${s.given}\n- When: ${s.when}\n- Then: ${s.then}`;
        }).join('\n\n');
        // ── Extract out-of-scope and assumptions ─────────────────────────────────
        const outOfScope = deriveOutOfScope(description);
        const assumptions = deriveAssumptions(description, codebaseContext);
        const openQuestions = deriveOpenQuestions(description);
        return `# Requirements: ${name}

> Spec ID: geliştirme | Tarih: ${date}

## Genel Bakış

${description}

---

## Kullanıcı Hikayeleri

| ID | Rol | İstek | Amaç | Öncelik |
|----|-----|-------|------|---------|
${storiesTable}

---

## Kabul Kriterleri

${acceptanceCriteria}

---

## Kapsam Dışı

${outOfScope.map(s => `- ${s}`).join('\n')}

## Varsayımlar

${assumptions.map(s => `- ${s}`).join('\n')}

## Açık Sorular

${openQuestions.map(s => `- ${s}`).join('\n')}

---

## Mevcut Codebase Bağlamı

\`\`\`
${codebaseContext.slice(0, 800)}
\`\`\`

---

*muctehid-mcp Spec Engine — ${date}*
`;
    }
    generateDesignContent(specId, requirementsContent) {
        const workflow = this.getOrThrow(specId);
        const date = new Date().toISOString().slice(0, 10);
        // ── Derive architecture from requirements ─────────────────────────────────
        const arch = deriveArchitecture(workflow.name, requirementsContent);
        const components = deriveComponents(workflow.name, requirementsContent);
        const dataModels = deriveDataModels(workflow.name, requirementsContent);
        const apiContracts = deriveApiContracts(workflow.name, requirementsContent);
        const componentRows = components.map(c => `| \`${c.file}\` | ${c.name} | ${c.responsibility} |`).join('\n');
        const dataModelBlocks = dataModels.map(m => `### ${m.name}\n\`\`\`typescript\n${m.schema}\n\`\`\``).join('\n\n');
        const apiBlock = apiContracts.map(a => `- **${a.method} ${a.path}** — ${a.description}`).join('\n');
        return `# Teknik Tasarım: ${workflow.name}

> Spec ID: ${specId} | Tarih: ${date}

## Mimari Özet

${arch.summary}

**Pattern:** ${arch.pattern}
**Katmanlar:** ${arch.layers.join(' → ')}

---

## Bileşenler

| Dosya | Bileşen | Sorumluluk |
|-------|---------|------------|
${componentRows}

---

## Veri Modelleri

${dataModelBlocks}

---

## API Kontratları

${apiBlock}

---

## Teknik Kararlar

${arch.decisions.map(d => `- **${d.decision}** — ${d.rationale}`).join('\n')}

---

## Açık Sorular

${arch.openQuestions.map(q => `- ${q}`).join('\n')}

---

*muctehid-mcp Spec Engine — ${date}*
`;
    }
    generateTasksContent(specId, phaseName, phases) {
        const workflow = this.getOrThrow(specId);
        const date = new Date().toISOString().slice(0, 10);
        let content = `# Görev Listesi: ${workflow.name}

**Tarih:** ${date}
**Spec:** ${specId}

---

## Görevler

`;
        phases.forEach((phase, i) => {
            const tid = `T-${String(i + 1).padStart(3, '0')}`;
            content += `### ${tid} | ${phase}

**Durum:** ⏳ Bekliyor
**Öncelik:** Yüksek
**Spec:** ${specId}

**Mini Prompt:**
\`\`\`
${phase} görevini tamamla.
Önce oku: ${workflow.requirementsPath}
Sonra: ${workflow.designPath}
Hedef: Bölüm ${i + 1}/${phases.length} tamamlandı, breaking change yok.
\`\`\`

---

`;
        });
        return content + `*muctehid-mcp Spec Engine — ${date}*\n`;
    }
    get(id) {
        return this.workflows.get(id);
    }
    list() {
        return Array.from(this.workflows.values());
    }
    updateStatus(id, status) {
        const w = this.workflows.get(id);
        if (!w)
            return;
        w.status = status;
        w.updatedAt = Date.now();
        this.save();
    }
    getOrThrow(id) {
        const w = this.workflows.get(id);
        if (!w)
            throw new Error(`Spec "${id}" not found`);
        return w;
    }
}
exports.SpecEngine = SpecEngine;
function deriveUserStories(description) {
    const lower = description.toLowerCase();
    const stories = [];
    // Detect CRUD-like verbs
    const crudMap = {
        'oluştur': ['geliştirici', 'yeni kayıt oluşturabileyim', 'veri ekleyebileyim'],
        'ekle': ['geliştirici', 'yeni öğe ekleyebileyim', 'koleksiyonu büyütebileyim'],
        'create': ['developer', 'create a new record', 'manage data effectively'],
        'sil': ['geliştirici', 'kayıtları silebilim', 'eski verileri temizleyebileyim'],
        'delete': ['developer', 'delete records', 'clean up stale data'],
        'düzenle': ['geliştirici', 'mevcut kayıtları düzenleyebileyim', 'bilgileri güncel tutabileyim'],
        'güncelle': ['geliştirici', 'kayıtları güncelleyebileyim', 'değişiklikleri yansıtabileyim'],
        'update': ['developer', 'update existing records', 'keep information current'],
        'listele': ['geliştirici', 'tüm kayıtları listeleyebileyim', 'genel bakış elde edebileyim'],
        'list': ['developer', 'list all records', 'get an overview'],
        'ara': ['geliştirici', 'kayıtlar içinde arayabileyim', 'hızlıca bulabileyim'],
        'search': ['developer', 'search through records', 'find items quickly'],
        'filtrele': ['geliştirici', 'sonuçları filtreleyebileyim', 'ilgili kayıtlara odaklanabileyim'],
        'filter': ['developer', 'filter results', 'focus on relevant records'],
        'görüntüle': ['kullanıcı', 'detayları görüntüleyebileyim', 'içeriği okuyabileyim'],
        'view': ['user', 'view detail pages', 'read the content'],
        'giriş': ['kullanıcı', 'sisteme giriş yapabileyim', 'güvenli erişim sağlayabileyim'],
        'login': ['user', 'log in to the system', 'access secured features'],
        'çıkış': ['kullanıcı', 'sistemden çıkış yapabileyim', 'oturumumu güvenle kapatabilirim'],
        'logout': ['user', 'log out', 'end my session securely'],
        'yükle': ['geliştirici', 'dosya yükleyebileyim', 'içerik ekleyebileyim'],
        'upload': ['developer', 'upload files', 'attach content'],
        'dışa aktar': ['geliştirici', 'verileri dışa aktarabileyim', 'raporlama yapabileyim'],
        'export': ['developer', 'export data', 'generate reports'],
    };
    const priorityWords = ['kritik', 'önemli', 'critical', 'important', 'must', 'acil', 'urgent'];
    const basePriority = priorityWords.some(w => lower.includes(w)) ? 'must' : 'should';
    let found = false;
    for (const [verb, [role, want, soThat]] of Object.entries(crudMap)) {
        if (lower.includes(verb)) {
            const feature = extractFeatureName(description);
            stories.push({
                role,
                want: `${feature} ${want}`,
                soThat,
                priority: basePriority,
                given: `${feature} sistemi kurulu ve çalışır durumda`,
                when: `${verb} işlemini gerçekleştirirsem`,
                then: `işlem başarıyla tamamlanmalı ve sonuç doğrulanabilmeli`,
            });
            found = true;
            if (stories.length >= 5)
                break;
        }
    }
    if (!found) {
        // Fallback: extract noun phrases from description
        const feature = extractFeatureName(description);
        stories.push({
            role: 'geliştirici',
            want: `${feature} özelliğini kullanabileyim`,
            soThat: 'iş süreçlerimi otomatize edebileyim',
            priority: 'must',
            given: 'sistem doğru şekilde kurulmuş',
            when: 'özelliği kullandığımda',
            then: 'beklenen sonucu almalıyım',
        });
        stories.push({
            role: 'geliştirici',
            want: `${feature} için hata mesajı alabileyim`,
            soThat: 'sorunları hızlıca tespit edebileyim',
            priority: 'should',
            given: 'geçersiz girdi veya hata durumu oluştuğunda',
            when: 'işlem başarısız olduğunda',
            then: 'anlamlı hata mesajı görmeli ve ne yapacağımı bilmeliyim',
        });
    }
    return stories;
}
function extractFeatureName(description) {
    // Take first 3-5 significant words
    const words = description.split(/[\s,.:;]+/).filter(w => w.length > 3).slice(0, 4);
    return words.join(' ').toLowerCase() || 'özellik';
}
function deriveOutOfScope(description) {
    const lower = description.toLowerCase();
    const items = [];
    if (!lower.includes('ödeme') && !lower.includes('payment'))
        items.push('Ödeme ve faturalandırma işlemleri');
    if (!lower.includes('bildirim') && !lower.includes('notification'))
        items.push('E-posta / push bildirim sistemi');
    if (!lower.includes('rapor') && !lower.includes('report'))
        items.push('Gelişmiş analitik ve raporlama');
    if (!lower.includes('mobil') && !lower.includes('mobile'))
        items.push('Mobil uygulama desteği');
    if (!lower.includes('lokalizasyon') && !lower.includes('i18n'))
        items.push('Çoklu dil desteği (i18n)');
    return items.slice(0, 4);
}
function deriveAssumptions(description, context) {
    const lower = description.toLowerCase();
    const assumptions = [
        'Kullanıcıların kimlik doğrulaması sisteme dahil edilmeden yapılmaktadır',
        'TypeScript strict mode etkin, tip güvenliği gereklidir',
    ];
    if (lower.includes('db') || lower.includes('database') || lower.includes('veri')) {
        assumptions.push('Mevcut veritabanı şeması bu özelliği desteklemektedir');
    }
    if (context.includes('next') || context.includes('react')) {
        assumptions.push('Next.js / React framework ile geliştirilecektir');
    }
    if (context.includes('api') || lower.includes('api')) {
        assumptions.push('RESTful API tasarım prensiplerine uyulacaktır');
    }
    return assumptions;
}
function deriveOpenQuestions(description) {
    const lower = description.toLowerCase();
    const questions = [];
    if (lower.includes('yetki') || lower.includes('rol') || lower.includes('permission') || lower.includes('role')) {
        questions.push('Yetkilendirme için hangi rol hiyerarşisi kullanılacak?');
    }
    if (lower.includes('performans') || lower.includes('hız') || lower.includes('performance')) {
        questions.push('Kabul edilebilir response time SLA nedir?');
    }
    questions.push('Bu özelliğin mevcut test coverage hedefi nedir?');
    questions.push('Uçtan uca test senaryoları kimin sorumluluğunda olacak?');
    if (lower.includes('kullanıcı') || lower.includes('user')) {
        questions.push('Kullanıcı sayısı ve eşzamanlı bağlantı beklentisi nedir?');
    }
    return questions.slice(0, 4);
}
function deriveArchitecture(name, requirements) {
    const lower = requirements.toLowerCase();
    const isCrud = /oluştur|ekle|sil|düzenle|güncelle|create|delete|update|list/.test(lower);
    const isApi = /api|endpoint|rest|route/.test(lower);
    const isFrontend = /bileşen|component|ui|form|sayfa|page|görüntüle|view/.test(lower);
    const isAuth = /giriş|çıkış|login|logout|auth|token|session/.test(lower);
    let pattern = 'Modular Feature';
    let layers = ['Types', 'Service', 'Handler'];
    let summary = `${name} özelliği için modüler mimari tasarımı.`;
    if (isCrud && isApi) {
        pattern = 'Repository + Service + Controller';
        layers = ['Types/Schema', 'Repository (DB)', 'Service (Logic)', 'Controller (HTTP)', 'Routes'];
        summary = `${name} için tipik CRUD mimarisi: repository katmanı veri erişimini soyutlar, service katmanı iş mantığını içerir, controller HTTP request/response'u yönetir.`;
    }
    else if (isFrontend) {
        pattern = 'Component + Hook + Service';
        layers = ['Types', 'API Client', 'Custom Hook (State)', 'Component (UI)', 'Page'];
        summary = `${name} için React/Next.js bileşen mimarisi: custom hook'lar state yönetimini, server action'lar/API client'lar veri akışını yönetir.`;
    }
    else if (isAuth) {
        pattern = 'Auth Middleware + Session Store';
        layers = ['Types', 'Auth Provider', 'Session Store', 'Middleware', 'Protected Routes'];
        summary = `${name} için kimlik doğrulama mimarisi: middleware katmanı tüm istekleri filtreler, session store oturum durumunu yönetir.`;
    }
    const decisions = [
        { decision: 'TypeScript strict mode', rationale: 'Tip güvenliği ve hata yakalamayı artırır' },
        { decision: 'Mevcut veritabanı/ORM kullanımı', rationale: 'Yeni bağımlılık eklemekten kaçınmak için' },
    ];
    if (isCrud)
        decisions.push({ decision: 'Soft delete yerine hard delete', rationale: 'Başlangıç için basitliği tercih et, gerekirse migrate edilir' });
    if (isApi)
        decisions.push({ decision: 'Zod ile input validation', rationale: 'Runtime tip doğrulaması ve hata mesajları için' });
    return {
        summary,
        pattern,
        layers,
        decisions,
        openQuestions: [
            'Pagination stratejisi: cursor-based mı, offset mı?',
            'Error response formatı mevcut API ile uyumlu mu?',
            'Rate limiting bu endpoint için gerekli mi?',
        ],
    };
}
function deriveComponents(name, requirements) {
    const lower = requirements.toLowerCase();
    const slug = name.replace(/[^a-z0-9]/gi, '-').toLowerCase().slice(0, 20);
    const components = [];
    const isCrud = /oluştur|ekle|sil|düzenle|güncelle|create|delete|update|list/.test(lower);
    const isApi = /api|endpoint|rest|route/.test(lower);
    const isFrontend = /bileşen|component|ui|form|sayfa|page/.test(lower);
    // Always add types
    components.push({ name: `${name} Types`, file: `src/types/${slug}.ts`, responsibility: 'Tüm TypeScript arayüzleri ve tip tanımlamaları' });
    if (isCrud && isApi) {
        components.push({ name: `${name} Repository`, file: `src/lib/${slug}/repository.ts`, responsibility: 'Veritabanı CRUD operasyonları' }, { name: `${name} Service`, file: `src/lib/${slug}/service.ts`, responsibility: 'İş mantığı ve validasyon' }, { name: `${name} Controller`, file: `src/app/api/${slug}/route.ts`, responsibility: 'HTTP request/response yönetimi' });
    }
    else if (isFrontend) {
        components.push({ name: `${name} Hook`, file: `src/hooks/use-${slug}.ts`, responsibility: 'State yönetimi ve API çağrıları' }, { name: `${name} Form`, file: `src/components/${slug}/${slug}-form.tsx`, responsibility: 'Kullanıcı girişi ve validasyon' }, { name: `${name} List`, file: `src/components/${slug}/${slug}-list.tsx`, responsibility: 'Kayıtları listeleme ve filtreleme' }, { name: `${name} Page`, file: `src/app/(protected)/${slug}/page.tsx`, responsibility: 'Next.js route ve veri fetching' });
    }
    else {
        components.push({ name: `${name} Service`, file: `src/lib/${slug}/service.ts`, responsibility: 'Temel iş mantığı' }, { name: `${name} Handler`, file: `src/lib/${slug}/handler.ts`, responsibility: 'İstek işleme ve yanıt hazırlama' });
    }
    return components;
}
function deriveDataModels(name, requirements) {
    const lower = requirements.toLowerCase();
    const typeName = name.replace(/[^a-z0-9]/gi, '').replace(/^\w/, c => c.toUpperCase());
    const models = [];
    const hasStatus = /durum|status|aktif|active/.test(lower);
    const hasTimestamps = true; // almost always needed
    const hasMeta = /meta|etiket|tag|kategori|category/.test(lower);
    let schema = `interface ${typeName} {\n  id: string;\n`;
    schema += `  name: string;\n`;
    if (hasStatus)
        schema += `  status: 'active' | 'inactive' | 'archived';\n`;
    if (hasMeta)
        schema += `  tags: string[];\n`;
    if (hasTimestamps)
        schema += `  createdAt: Date;\n  updatedAt: Date;\n`;
    schema += `}`;
    models.push({ name: typeName, schema });
    // If CRUD, also add Create/Update DTOs
    if (/oluştur|ekle|create|add/.test(lower)) {
        models.push({
            name: `Create${typeName}Dto`,
            schema: `type Create${typeName}Dto = Omit<${typeName}, 'id' | 'createdAt' | 'updatedAt'>;`,
        });
    }
    return models;
}
function deriveApiContracts(name, requirements) {
    const lower = requirements.toLowerCase();
    const slug = name.replace(/[^a-z0-9]/gi, '-').toLowerCase().slice(0, 20);
    const contracts = [];
    if (/listele|list|getir|get/.test(lower))
        contracts.push({ method: 'GET', path: `/api/${slug}`, description: 'Tüm kayıtları filtreli/sayfalı listele' });
    if (/tekil|detail|id ile/.test(lower))
        contracts.push({ method: 'GET', path: `/api/${slug}/:id`, description: 'Belirli kaydı getir' });
    if (/oluştur|ekle|create|add/.test(lower))
        contracts.push({ method: 'POST', path: `/api/${slug}`, description: 'Yeni kayıt oluştur (body: CreateDto)' });
    if (/düzenle|güncelle|update|edit/.test(lower))
        contracts.push({ method: 'PATCH', path: `/api/${slug}/:id`, description: 'Kısmi güncelleme (body: Partial<UpdateDto>)' });
    if (/sil|delete|remove/.test(lower))
        contracts.push({ method: 'DELETE', path: `/api/${slug}/:id`, description: 'Kaydı sil (idempotent)' });
    if (contracts.length === 0) {
        contracts.push({ method: 'POST', path: `/api/${slug}/execute`, description: 'Ana işlem endpoint\'i' });
    }
    return contracts;
}
//# sourceMappingURL=spec-engine.js.map