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
exports.parseRequirements = parseRequirements;
exports.parseRequirementsContent = parseRequirementsContent;
exports.parseDesign = parseDesign;
exports.parseDesignContent = parseDesignContent;
exports.parseTasks = parseTasks;
exports.parseTasksContent = parseTasksContent;
const fs = __importStar(require("fs"));
// Parse requirements.md into structured data
function parseRequirements(filepath) {
    const content = fs.existsSync(filepath) ? fs.readFileSync(filepath, 'utf-8') : '';
    return parseRequirementsContent(content);
}
function parseRequirementsContent(content) {
    const overview = extractSection(content, 'Overview', 'User Stories') || extractSection(content, 'Genel Bakış') || '';
    const storiesSection = extractSection(content, 'User Stories', 'Acceptance Criteria') || extractSection(content, 'Kullanıcı Hikayeleri') || '';
    const acSection = extractSection(content, 'Acceptance Criteria', 'Out of Scope') || extractSection(content, 'Kabul Kriterleri') || '';
    const outSection = extractSection(content, 'Out of Scope', 'Assumptions') || extractSection(content, 'Kapsam Dışı') || '';
    const assumeSection = extractSection(content, 'Assumptions', 'Open Questions') || extractSection(content, 'Varsayımlar') || '';
    const questionsSection = extractSection(content, 'Open Questions') || extractSection(content, 'Açık Sorular') || '';
    const userStories = parseUserStories(storiesSection);
    const acceptanceCriteria = parseAcceptanceCriteria(acSection);
    const outOfScope = extractBullets(outSection);
    const assumptions = extractBullets(assumeSection);
    const openQuestions = extractBullets(questionsSection);
    return { overview: overview.trim(), userStories, acceptanceCriteria, outOfScope, assumptions, openQuestions };
}
function parseUserStories(section) {
    const stories = [];
    const storyBlocks = section.split(/\n(?=\*\*US-\d+|### US-\d+|- US-\d+)/);
    let counter = 1;
    for (const block of storyBlocks) {
        // As a ... I want ... so that ...
        const asA = block.match(/[Aa]s a[n]?\s+([^,\n]+)/)?.[1]?.trim() || '';
        const iWant = block.match(/[Ii] want[s]?\s+([^,\n.]+)/)?.[1]?.trim() || '';
        const soThat = block.match(/[Ss]o that\s+([^\n.]+)/)?.[1]?.trim() || '';
        const priority = block.match(/priority[:\s]+(\w+)/i)?.[1]?.toLowerCase() || 'should';
        if (asA || iWant) {
            stories.push({
                id: `US-${String(counter).padStart(3, '0')}`,
                asA,
                iWant,
                soThat,
                priority: ['must', 'should', 'could', 'wont'].includes(priority) ? priority : 'should',
            });
            counter++;
        }
    }
    return stories;
}
function parseAcceptanceCriteria(section) {
    const criteria = [];
    const storyId = section.match(/US-(\d+)/)?.[0] || 'US-001';
    const givenBlocks = section.split(/\n(?=[Gg]iven\s)/);
    for (const block of givenBlocks) {
        const given = block.match(/[Gg]iven\s+([^\n]+)/)?.[1]?.trim() || '';
        const when = block.match(/[Ww]hen\s+([^\n]+)/)?.[1]?.trim() || '';
        const then = block.match(/[Tt]hen\s+([^\n]+)/)?.[1]?.trim() || '';
        if (given)
            criteria.push({ storyId, given, when, then });
    }
    return criteria;
}
// Parse design.md into structured data
function parseDesign(filepath) {
    const content = fs.existsSync(filepath) ? fs.readFileSync(filepath, 'utf-8') : '';
    return parseDesignContent(content);
}
function parseDesignContent(content) {
    const summary = extractSection(content, 'Summary', 'Architecture') || extractSection(content, 'Özet') || '';
    const architecture = extractSection(content, 'Architecture', 'Components') || extractSection(content, 'Mimari') || '';
    const componentSection = extractSection(content, 'Components', 'Data Models') || extractSection(content, 'Bileşenler') || '';
    const dataSection = extractSection(content, 'Data Models', 'API Contracts') || extractSection(content, 'Veri Modelleri') || '';
    const apiSection = extractSection(content, 'API Contracts', 'Open Questions') || extractSection(content, 'API Sözleşmeleri') || '';
    const questionsSection = extractSection(content, 'Open Questions') || extractSection(content, 'Açık Sorular') || '';
    const components = parseComponents(componentSection);
    const dataModels = extractBullets(dataSection);
    const apiContracts = extractBullets(apiSection);
    const openQuestions = extractBullets(questionsSection);
    return { summary: summary.trim(), architecture: architecture.trim(), components, dataModels, apiContracts, openQuestions };
}
function parseComponents(section) {
    const components = [];
    const blocks = section.split(/\n(?=#{2,3}\s+\w)/);
    for (const block of blocks) {
        const name = block.match(/#{2,3}\s+(.+)/)?.[1]?.trim() || '';
        const filePath = block.match(/[Ff]ile[:\s]+`?([^\s`\n]+)`?/)?.[1] || '';
        const responsibility = block.match(/[Rr]esponsib[a-z]+[:\s]+([^\n]+)/)?.[1]?.trim() || '';
        const interfaces = block.match(/[Ii]nterface[s]?[:\s]+([^\n]+)/)?.[1]?.split(',').map(s => s.trim()) || [];
        const deps = block.match(/[Dd]ependenc[a-z]+[:\s]+([^\n]+)/)?.[1]?.split(',').map(s => s.trim()) || [];
        if (name)
            components.push({ name, filePath, responsibility, interfaces, dependencies: deps });
    }
    return components;
}
// Parse tasks.md into structured ParsedTask[]
function parseTasks(filepath) {
    const content = fs.existsSync(filepath) ? fs.readFileSync(filepath, 'utf-8') : '';
    return parseTasksContent(content);
}
function parseTasksContent(content) {
    const tasks = [];
    // Split on task headings like "## T-001" or "### T-001"
    const taskBlocks = content.split(/\n(?=#{2,3}\s+T-\d+)/);
    for (const block of taskBlocks) {
        const idMatch = block.match(/T-(\d+)/);
        if (!idMatch)
            continue;
        const id = `T-${idMatch[1].padStart(3, '0')}`;
        const title = block.match(/T-\d+[:\s]+([^\n]+)/)?.[1]?.trim() || '';
        const description = extractSection(block, 'Description') || extractSection(block, 'Açıklama') || extractFirstParagraph(block);
        const storyRef = block.match(/US-\d+/)?.[0] || '';
        const estimateHours = parseFloat(block.match(/[Ee]stimate[d]?[:\s]+(\d+(?:\.\d+)?)\s*h/)?.[1] || '1');
        const miniPrompt = extractSection(block, 'Mini Prompt') || extractSection(block, 'Prompt') || '';
        const acSection = extractSection(block, 'Acceptance Criteria') || extractSection(block, 'Kabul Kriterleri') || '';
        const acceptanceCriteria = extractBullets(acSection);
        const filesSection = block.match(/[Ff]ile[s]?[:\s]+([^\n]+)/)?.[1] || '';
        const filePaths = filesSection.split(',').map(s => s.trim().replace(/`/g, '')).filter(Boolean);
        const depsSection = block.match(/[Dd]epends [Oo]n[:\s]+([^\n]+)/)?.[1] || '';
        const dependsOn = depsSection.split(',').map(s => s.trim()).filter(Boolean);
        const statusMatch = block.match(/[Ss]tatus[:\s]+(\w[\w-]*)/)?.[1]?.toLowerCase();
        const status = ['pending', 'in-progress', 'done', 'blocked', 'cancelled'].includes(statusMatch || '')
            ? statusMatch
            : 'pending';
        tasks.push({ id, title, description: description.trim(), storyRef, estimateHours, miniPrompt, acceptanceCriteria, filePaths, dependsOn, status });
    }
    return tasks;
}
// ─── Helpers ──────────────────────────────────────────────────────────────────
function extractSection(content, heading, nextHeading) {
    const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const start = content.search(new RegExp(`#{1,3}\\s+${escapedHeading}`, 'i'));
    if (start === -1)
        return '';
    const afterHeading = content.slice(start).replace(/^[^\n]*\n/, '');
    if (nextHeading) {
        const escapedNext = nextHeading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const end = afterHeading.search(new RegExp(`#{1,3}\\s+${escapedNext}`, 'i'));
        return end === -1 ? afterHeading : afterHeading.slice(0, end);
    }
    return afterHeading;
}
function extractBullets(section) {
    return section.split('\n')
        .map(l => l.trim())
        .filter(l => l.startsWith('- ') || l.startsWith('* ') || l.match(/^\d+\./))
        .map(l => l.replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, '').trim())
        .filter(Boolean);
}
function extractFirstParagraph(text) {
    const lines = text.split('\n').filter(l => !l.startsWith('#')).join('\n');
    const paras = lines.split(/\n\n/);
    return (paras.find(p => p.trim().length > 20) || '').trim();
}
//# sourceMappingURL=spec-parser.js.map