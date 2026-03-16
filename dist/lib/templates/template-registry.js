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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TemplateRegistry = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const gray_matter_1 = __importDefault(require("gray-matter"));
class TemplateRegistry {
    templates = new Map();
    dirs;
    constructor(dirs) {
        this.dirs = dirs;
        this.load();
    }
    load() {
        for (const dir of this.dirs) {
            if (!fs.existsSync(dir))
                continue;
            const entries = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
            for (const entry of entries) {
                const filePath = path.join(dir, entry);
                try {
                    const raw = fs.readFileSync(filePath, 'utf-8');
                    const { data, content } = (0, gray_matter_1.default)(raw);
                    if (!data.name)
                        continue;
                    const variables = [...content.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]);
                    this.templates.set(data.name, {
                        name: data.name,
                        path: filePath,
                        description: data.description ?? '',
                        version: data.version ?? '1.0.0',
                        variables: [...new Set(variables)],
                    });
                }
                catch { /* skip */ }
            }
        }
    }
    get(name) {
        return this.templates.get(name);
    }
    list() {
        return Array.from(this.templates.values());
    }
    register(def) {
        this.templates.set(def.name, def);
    }
    reload() {
        this.templates.clear();
        this.load();
    }
}
exports.TemplateRegistry = TemplateRegistry;
//# sourceMappingURL=template-registry.js.map