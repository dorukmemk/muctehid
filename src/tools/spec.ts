import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { SpecEngine } from '../lib/spec/spec-engine.js';
import { SpecStatus } from '../types/v2.js';

const SPEC_TOOLS = ['spec_init', 'spec_update', 'spec_list', 'spec_get', 'spec_delete'];

export function registerSpecTools(
  server: Server,
  deps: { dataDir: string; repoRoot: string }
): void {
  const engine = new SpecEngine(deps.dataDir);

  server.setRequestHandler(
    CallToolRequestSchema,
    async (req) => {
      const { name, arguments: args = {} } = req.params;

      if (!SPEC_TOOLS.includes(name)) {
        throw new Error(`Unknown spec tool: ${name}`);
      }

      try {
        if (name === 'spec_init') {
          const specName = args.name as string;
          const description = args.description as string;
          if (!specName) throw new Error('name is required');
          if (!description) throw new Error('description is required');
          const spec = engine.create(specName, description, deps.repoRoot);
          return {
            content: [{
              type: 'text' as const,
              text: `Spec oluşturuldu: ${spec.id}\n\n` +
                `Requirements: ${spec.requirementsPath}\n` +
                `Design: ${spec.designPath}\n` +
                `Tasks: ${spec.tasksPath}\n\n` +
                `Sonraki adım: requirements içeriğini writeRequirements ile doldurun.`,
            }],
          };
        }

        if (name === 'spec_update') {
          const specId = args.specId as string;
          const status = args.status as SpecStatus;
          if (!specId) throw new Error('specId is required');
          if (!status) throw new Error('status is required');
          const spec = engine.get(specId);
          if (!spec) {
            return {
              content: [{ type: 'text' as const, text: `Spec bulunamadı: ${specId}` }],
              isError: true,
            };
          }
          engine.updateStatus(specId, status);
          return {
            content: [{
              type: 'text' as const,
              text: `Spec güncellendi: ${spec.name} → ${status}`,
            }],
          };
        }

        if (name === 'spec_list') {
          const specs = engine.list();
          if (specs.length === 0) {
            return { content: [{ type: 'text' as const, text: 'Hiç spec yok. spec_init ile oluşturun.' }] };
          }
          const text = specs.map(s =>
            `**${s.id}** — ${s.name}\n  Status: ${s.status} | Tasks: ${s.taskIds.length}\n  Created: ${new Date(s.createdAt).toISOString().slice(0, 10)}`
          ).join('\n\n');
          return { content: [{ type: 'text' as const, text }] };
        }

        if (name === 'spec_get') {
          const specId = args.specId as string;
          if (!specId) throw new Error('specId is required');
          const spec = engine.get(specId);
          if (!spec) {
            return {
              content: [{ type: 'text' as const, text: `Spec bulunamadı: ${specId}` }],
              isError: true,
            };
          }
          return {
            content: [{ type: 'text' as const, text: JSON.stringify(spec, null, 2) }],
          };
        }

        if (name === 'spec_delete') {
          const specId = args.specId as string;
          if (!specId) throw new Error('specId is required');
          const spec = engine.get(specId);
          if (!spec) {
            return {
              content: [{ type: 'text' as const, text: `Spec bulunamadı: ${specId}` }],
            };
          }
          // Mark as done to signify deletion intent — SpecEngine has no delete method
          engine.updateStatus(specId, 'done');
          return {
            content: [{ type: 'text' as const, text: `Spec tamamlandı olarak işaretlendi: ${specId}` }],
          };
        }

        throw new Error(`Unhandled spec tool: ${name}`);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return { content: [{ type: 'text' as const, text: `Hata: ${msg}` }], isError: true };
      }
    }
  );
}
