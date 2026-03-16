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
exports.parseSkill = parseSkill;
exports.validateSkill = validateSkill;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const gray_matter_1 = __importDefault(require("gray-matter"));
function parseSkill(skillDir) {
    const skillMdPath = path.join(skillDir, 'SKILL.md');
    if (!fs.existsSync(skillMdPath))
        return null;
    try {
        const raw = fs.readFileSync(skillMdPath, 'utf-8');
        const { data, content } = (0, gray_matter_1.default)(raw);
        return {
            name: String(data.name ?? path.basename(skillDir)),
            version: String(data.version ?? '1.0.0'),
            description: String(data.description ?? ''),
            author: String(data.author ?? 'unknown'),
            category: String(data.category ?? 'general'),
            type: data.type ?? 'tool',
            triggers: Array.isArray(data.triggers) ? data.triggers.map(String) : [],
            tools: Array.isArray(data.tools) ? data.tools.map(String) : [],
            parameters: data.parameters ?? {},
            hooks: data.hooks,
            output: data.output,
            instructions: content.trim(),
            dir: skillDir,
        };
    }
    catch {
        return null;
    }
}
function validateSkill(skill) {
    const errors = [];
    if (!skill.name)
        errors.push('name is required');
    if (!skill.description)
        errors.push('description is required');
    return errors;
}
//# sourceMappingURL=parser.js.map