"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerSpecTools = registerSpecTools;
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const spec_engine_js_1 = require("../lib/spec/spec-engine.js");
const SPEC_TOOLS = ['spec_init', 'spec_update', 'spec_list', 'spec_get', 'spec_delete'];
function registerSpecTools(server, deps) {
    const engine = new spec_engine_js_1.SpecEngine(deps.dataDir);
    server.setRequestHandler(types_js_1.CallToolRequestSchema, async (req) => {
        const { name, arguments: args = {} } = req.params;
        if (!SPEC_TOOLS.includes(name)) {
            throw new Error(`Unknown spec tool: ${name}`);
        }
        try {
            if (name === 'spec_init') {
                const specName = args.name;
                const description = args.description;
                if (!specName)
                    throw new Error('name is required');
                if (!description)
                    throw new Error('description is required');
                const spec = engine.create(specName, description, deps.repoRoot);
                return {
                    content: [{
                            type: 'text',
                            text: `Spec oluşturuldu: ${spec.id}\n\n` +
                                `Requirements: ${spec.requirementsPath}\n` +
                                `Design: ${spec.designPath}\n` +
                                `Tasks: ${spec.tasksPath}\n\n` +
                                `Sonraki adım: requirements içeriğini writeRequirements ile doldurun.`,
                        }],
                };
            }
            if (name === 'spec_update') {
                const specId = args.specId;
                const status = args.status;
                if (!specId)
                    throw new Error('specId is required');
                if (!status)
                    throw new Error('status is required');
                const spec = engine.get(specId);
                if (!spec) {
                    return {
                        content: [{ type: 'text', text: `Spec bulunamadı: ${specId}` }],
                        isError: true,
                    };
                }
                engine.updateStatus(specId, status);
                return {
                    content: [{
                            type: 'text',
                            text: `Spec güncellendi: ${spec.name} → ${status}`,
                        }],
                };
            }
            if (name === 'spec_list') {
                const specs = engine.list();
                if (specs.length === 0) {
                    return { content: [{ type: 'text', text: 'Hiç spec yok. spec_init ile oluşturun.' }] };
                }
                const text = specs.map(s => `**${s.id}** — ${s.name}\n  Status: ${s.status} | Tasks: ${s.taskIds.length}\n  Created: ${new Date(s.createdAt).toISOString().slice(0, 10)}`).join('\n\n');
                return { content: [{ type: 'text', text }] };
            }
            if (name === 'spec_get') {
                const specId = args.specId;
                if (!specId)
                    throw new Error('specId is required');
                const spec = engine.get(specId);
                if (!spec) {
                    return {
                        content: [{ type: 'text', text: `Spec bulunamadı: ${specId}` }],
                        isError: true,
                    };
                }
                return {
                    content: [{ type: 'text', text: JSON.stringify(spec, null, 2) }],
                };
            }
            if (name === 'spec_delete') {
                const specId = args.specId;
                if (!specId)
                    throw new Error('specId is required');
                const spec = engine.get(specId);
                if (!spec) {
                    return {
                        content: [{ type: 'text', text: `Spec bulunamadı: ${specId}` }],
                    };
                }
                // Mark as done to signify deletion intent — SpecEngine has no delete method
                engine.updateStatus(specId, 'done');
                return {
                    content: [{ type: 'text', text: `Spec tamamlandı olarak işaretlendi: ${specId}` }],
                };
            }
            throw new Error(`Unhandled spec tool: ${name}`);
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            return { content: [{ type: 'text', text: `Hata: ${msg}` }], isError: true };
        }
    });
}
//# sourceMappingURL=spec.js.map