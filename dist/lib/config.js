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
exports.loadConfig = loadConfig;
exports.getConfig = getConfig;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const DEFAULT_CONFIG = {
    version: '2.0',
    memory: {
        mode: 'hybrid',
        embeddingModel: 'Xenova/all-MiniLM-L6-v2',
        chunkSize: 150,
        chunkOverlap: 20,
        exclude: ['node_modules', 'dist', '.git', '*.min.js', '*.lock', '*.map', '.audit-data'],
    },
    audit: {
        severity: ['critical', 'high', 'medium', 'low'],
        categories: ['security', 'quality', 'performance', 'docs'],
        owasp: true,
        secrets: true,
    },
    skills: {
        autoTrigger: true,
        installed: ['security-audit', 'code-review', 'dependency-risk'],
    },
    plugins: [],
    hooks: {
        preCommit: true,
        prePush: false,
        onSave: false,
    },
    report: {
        format: 'markdown',
        outputDir: '.audit-data/reports',
        autoGenerate: false,
    },
};
let cachedConfig = null;
let configPath = '';
function loadConfig(repoRoot) {
    const filePath = path.join(repoRoot, '.audit-config.json');
    configPath = filePath;
    if (cachedConfig && configPath === filePath)
        return cachedConfig;
    if (!fs.existsSync(filePath)) {
        cachedConfig = DEFAULT_CONFIG;
        return cachedConfig;
    }
    try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        cachedConfig = deepMerge(DEFAULT_CONFIG, parsed);
        return cachedConfig;
    }
    catch {
        return DEFAULT_CONFIG;
    }
}
function getConfig() {
    return cachedConfig ?? DEFAULT_CONFIG;
}
function deepMerge(target, source) {
    const result = { ...target };
    for (const key of Object.keys(source)) {
        if (source[key] !== null &&
            typeof source[key] === 'object' &&
            !Array.isArray(source[key]) &&
            typeof target[key] === 'object' &&
            !Array.isArray(target[key])) {
            result[key] = deepMerge(target[key], source[key]);
        }
        else {
            result[key] = source[key];
        }
    }
    return result;
}
//# sourceMappingURL=config.js.map