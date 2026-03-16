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
exports.registerTemplateTools = registerTemplateTools;
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const template_engine_js_1 = require("../lib/templates/template-engine.js");
const template_registry_js_1 = require("../lib/templates/template-registry.js");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const TEMPLATE_TOOLS = ['template_list', 'template_render', 'template_save'];
function registerTemplateTools(server, deps) {
    const builtInDir = path.join(__dirname, '../lib/templates/built-in');
    const userDir = path.join(deps.repoRoot, '.templates');
    const registry = new template_registry_js_1.TemplateRegistry([builtInDir, userDir]);
    server.setRequestHandler(types_js_1.CallToolRequestSchema, async (req) => {
        const { name, arguments: args = {} } = req.params;
        if (!TEMPLATE_TOOLS.includes(name)) {
            throw new Error(`Unknown template tool: ${name}`);
        }
        try {
            if (name === 'template_list') {
                const templates = registry.list();
                if (templates.length === 0) {
                    return { content: [{ type: 'text', text: 'Şablon bulunamadı.' }] };
                }
                const lines = templates.map(t => `**${t.name}** (v${t.version})\n  ${t.description}\n  Değişkenler: ${t.variables.join(', ') || '(yok)'}`);
                return { content: [{ type: 'text', text: lines.join('\n\n') }] };
            }
            if (name === 'template_render') {
                const templateName = args.templateName;
                if (!templateName)
                    throw new Error('templateName is required');
                const variables = (args.variables ?? {});
                const tmpl = registry.get(templateName);
                if (!tmpl) {
                    return {
                        content: [{ type: 'text', text: `Şablon bulunamadı: ${templateName}` }],
                        isError: true,
                    };
                }
                const rendered = (0, template_engine_js_1.renderFile)(tmpl.path, variables);
                return { content: [{ type: 'text', text: rendered }] };
            }
            if (name === 'template_save') {
                const templateName = args.name;
                const content = args.content;
                const description = args.description ?? templateName;
                if (!templateName)
                    throw new Error('name is required');
                if (!content)
                    throw new Error('content is required');
                fs.mkdirSync(userDir, { recursive: true });
                const filepath = path.join(userDir, `${templateName}.md`);
                const hasFrontmatter = content.startsWith('---');
                const finalContent = hasFrontmatter
                    ? content
                    : `---\nname: ${templateName}\nversion: 1.0.0\ndescription: ${description}\n---\n\n${content}`;
                fs.writeFileSync(filepath, finalContent, 'utf-8');
                registry.reload();
                return { content: [{ type: 'text', text: `Şablon kaydedildi: ${filepath}` }] };
            }
            throw new Error(`Unhandled template tool: ${name}`);
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            return { content: [{ type: 'text', text: `Hata: ${msg}` }], isError: true };
        }
    });
}
//# sourceMappingURL=templates.js.map