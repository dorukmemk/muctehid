import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { render, renderFile } from '../lib/templates/template-engine.js';
import { TemplateRegistry } from '../lib/templates/template-registry.js';
import { TemplateContext } from '../types/v2.js';
import * as path from 'path';
import * as fs from 'fs';

const TEMPLATE_TOOLS = ['template_list', 'template_render', 'template_save'];

export function registerTemplateTools(
  server: Server,
  deps: { repoRoot: string }
): void {
  const builtInDir = path.join(__dirname, '../lib/templates/built-in');
  const userDir = path.join(deps.repoRoot, '.templates');

  const registry = new TemplateRegistry([builtInDir, userDir]);

  server.setRequestHandler(
    CallToolRequestSchema,
    async (req) => {
      const { name, arguments: args = {} } = req.params;

      if (!TEMPLATE_TOOLS.includes(name)) {
        throw new Error(`Unknown template tool: ${name}`);
      }

      try {
        if (name === 'template_list') {
          const templates = registry.list();
          if (templates.length === 0) {
            return { content: [{ type: 'text' as const, text: 'Şablon bulunamadı.' }] };
          }
          const lines = templates.map(t =>
            `**${t.name}** (v${t.version})\n  ${t.description}\n  Değişkenler: ${t.variables.join(', ') || '(yok)'}`
          );
          return { content: [{ type: 'text' as const, text: lines.join('\n\n') }] };
        }

        if (name === 'template_render') {
          const templateName = args.templateName as string;
          if (!templateName) throw new Error('templateName is required');
          const variables = (args.variables ?? {}) as Record<string, unknown>;

          const tmpl = registry.get(templateName);
          if (!tmpl) {
            return {
              content: [{ type: 'text' as const, text: `Şablon bulunamadı: ${templateName}` }],
              isError: true,
            };
          }
          const rendered = renderFile(tmpl.path, variables as TemplateContext);
          return { content: [{ type: 'text' as const, text: rendered }] };
        }

        if (name === 'template_save') {
          const templateName = args.name as string;
          const content = args.content as string;
          const description = (args.description as string) ?? templateName;
          if (!templateName) throw new Error('name is required');
          if (!content) throw new Error('content is required');

          fs.mkdirSync(userDir, { recursive: true });
          const filepath = path.join(userDir, `${templateName}.md`);
          const hasFrontmatter = content.startsWith('---');
          const finalContent = hasFrontmatter
            ? content
            : `---\nname: ${templateName}\nversion: 1.0.0\ndescription: ${description}\n---\n\n${content}`;
          fs.writeFileSync(filepath, finalContent, 'utf-8');
          registry.reload();
          return { content: [{ type: 'text' as const, text: `Şablon kaydedildi: ${filepath}` }] };
        }

        throw new Error(`Unhandled template tool: ${name}`);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return { content: [{ type: 'text' as const, text: `Hata: ${msg}` }], isError: true };
      }
    }
  );
}
