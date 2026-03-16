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
exports.SkillInstaller = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const parser_js_1 = require("./parser.js");
class SkillInstaller {
    installedDir;
    registry;
    constructor(installedDir, registry) {
        this.installedDir = installedDir;
        this.registry = registry;
        fs.mkdirSync(installedDir, { recursive: true });
    }
    install(skillSourceDir) {
        const skill = (0, parser_js_1.parseSkill)(skillSourceDir);
        if (!skill) {
            return { success: false, message: `No valid SKILL.md found in ${skillSourceDir}` };
        }
        const destDir = path.join(this.installedDir, skill.name);
        if (fs.existsSync(destDir)) {
            return { success: false, message: `Skill "${skill.name}" is already installed. Use remove first.` };
        }
        try {
            this.copyDir(skillSourceDir, destDir);
            this.registry.register(skill);
            return { success: true, message: `Skill "${skill.name}" v${skill.version} installed successfully.` };
        }
        catch (e) {
            return { success: false, message: `Installation failed: ${e}` };
        }
    }
    uninstall(name) {
        const destDir = path.join(this.installedDir, name);
        if (!fs.existsSync(destDir)) {
            return { success: false, message: `Skill "${name}" is not installed.` };
        }
        try {
            fs.rmSync(destDir, { recursive: true });
            this.registry.unregister(name);
            return { success: true, message: `Skill "${name}" removed.` };
        }
        catch (e) {
            return { success: false, message: `Removal failed: ${e}` };
        }
    }
    copyDir(src, dest) {
        fs.mkdirSync(dest, { recursive: true });
        const entries = fs.readdirSync(src, { withFileTypes: true });
        for (const entry of entries) {
            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);
            if (entry.isDirectory())
                this.copyDir(srcPath, destPath);
            else
                fs.copyFileSync(srcPath, destPath);
        }
    }
}
exports.SkillInstaller = SkillInstaller;
//# sourceMappingURL=installer.js.map