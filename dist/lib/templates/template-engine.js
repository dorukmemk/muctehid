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
exports.registerHelper = registerHelper;
exports.render = render;
exports.renderFile = renderFile;
const fs = __importStar(require("fs"));
const helpers = {
    upper: (v) => String(v).toUpperCase(),
    lower: (v) => String(v).toLowerCase(),
    truncate: (v) => String(v).slice(0, 100),
    date: () => new Date().toISOString().slice(0, 10),
    len: (v) => String(Array.isArray(v) ? v.length : String(v).length),
};
function registerHelper(name, fn) {
    helpers[name] = fn;
}
function render(template, ctx) {
    let result = template;
    // Strip YAML front-matter
    result = result.replace(/^---[\s\S]*?---\n/, '');
    // {{#if key}}...{{/if}}
    result = result.replace(/\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, key, body) => {
        const val = resolvePath(ctx, key);
        return val ? body : '';
    });
    // {{#each items}}...{{/each}}
    result = result.replace(/\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (_, key, body) => {
        const arr = resolvePath(ctx, key);
        if (!Array.isArray(arr))
            return '';
        return arr.map((item, idx) => {
            let out = body.replace(/\{\{@index\}\}/g, String(idx));
            if (typeof item === 'object' && item !== null) {
                for (const [k, v] of Object.entries(item)) {
                    out = out.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v ?? ''));
                }
            }
            else {
                out = out.replace(/\{\{this\}\}/g, String(item ?? ''));
            }
            return out;
        }).join('');
    });
    // {{helper value}}
    result = result.replace(/\{\{(\w+)\s+(\w+)\}\}/g, (_, helperName, key) => {
        const fn = helpers[helperName];
        if (!fn)
            return `{{${helperName} ${key}}}`;
        const val = resolvePath(ctx, key);
        return fn(val);
    });
    // {{date}} shorthand
    result = result.replace(/\{\{date\}\}/g, new Date().toISOString().slice(0, 10));
    // {{variable}}
    result = result.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_, path) => {
        const val = resolvePath(ctx, path);
        return val !== undefined && val !== null ? String(val) : '';
    });
    return result;
}
function renderFile(filePath, ctx) {
    const template = fs.readFileSync(filePath, 'utf-8');
    return render(template, ctx);
}
function resolvePath(ctx, path) {
    const parts = path.split('.');
    let cur = ctx;
    for (const part of parts) {
        if (cur === null || cur === undefined)
            return undefined;
        cur = cur[part];
    }
    return cur;
}
//# sourceMappingURL=template-engine.js.map