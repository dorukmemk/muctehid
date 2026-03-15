import { CodeMemory } from '../lib/memory/code-memory.js';
import { SearchOptions } from '../types/index.js';

export function registerMemoryTools(server: import('@modelcontextprotocol/sdk/server/index.js').Server, getMemory: () => CodeMemory, repoRoot: string) {
  server.setRequestHandler(
    { method: 'tools/call' } as never,
    async (req: { params: { name: string; arguments: Record<string, unknown> } }) => {
      const { name, arguments: args } = req.params;
      const mem = getMemory();

      switch (name) {
        case 'index_codebase': {
          const targetPath = (args.path as string) ?? repoRoot;
          const mode = (args.mode as 'bm25' | 'vector' | 'hybrid') ?? 'hybrid';
          const result = await mem.indexDirectory(targetPath, { mode });
          return {
            content: [{
              type: 'text',
              text: `✅ Indexing complete!\n- Indexed: ${result.indexed} files\n- Skipped: ${result.skipped} files\n- Errors: ${result.errors}`,
            }],
          };
        }

        case 'search_code': {
          const query = args.query as string;
          if (!query) throw new Error('query is required');
          const opts: SearchOptions = {
            k: (args.k as number) ?? 10,
            mode: (args.mode as 'bm25' | 'vector' | 'hybrid') ?? 'hybrid',
            filter: args.language ? { language: args.language as string } : undefined,
          };
          const results = await mem.search(query, opts);
          if (results.length === 0) {
            return { content: [{ type: 'text', text: 'No results found.' }] };
          }
          const text = results.map((r, i) =>
            `### ${i + 1}. ${r.chunk.filepath}:${r.chunk.startLine}-${r.chunk.endLine} (score: ${r.score.toFixed(4)})\n\`\`\`${r.chunk.language}\n${r.chunk.content.slice(0, 500)}\n\`\`\``
          ).join('\n\n');
          return { content: [{ type: 'text', text: `## Search Results for "${query}"\n\n${text}` }] };
        }

        case 'add_memory': {
          const id = await mem.addChunk({
            filepath: (args.filepath as string) ?? 'manual',
            content: args.content as string,
            startLine: (args.startLine as number) ?? 0,
            endLine: (args.endLine as number) ?? 0,
            language: (args.language as string) ?? 'text',
          });
          return { content: [{ type: 'text', text: `Memory added with id: ${id}` }] };
        }

        case 'get_context': {
          const filepath = args.filepath as string;
          if (!filepath) throw new Error('filepath is required');
          const results = await mem.search(filepath, { k: 5, mode: 'bm25', filter: { filepath } });
          const text = results.map(r =>
            `Lines ${r.chunk.startLine}-${r.chunk.endLine}:\n\`\`\`${r.chunk.language}\n${r.chunk.content}\n\`\`\``
          ).join('\n\n');
          return { content: [{ type: 'text', text: text || 'No indexed content for this file.' }] };
        }

        case 'memory_stats': {
          const stats = mem.stats();
          return {
            content: [{
              type: 'text',
              text: `## Memory Stats\n- Chunks: ${stats.chunks}\n- Files: ${stats.files}\n- Embeddings ready: ${stats.embeddingsReady}\n- DB size: ${stats.dbSize} bytes`,
            }],
          };
        }

        case 'clear_memory': {
          mem.clear();
          return { content: [{ type: 'text', text: '🗑️ Memory cleared.' }] };
        }

        default:
          throw new Error(`Unknown memory tool: ${name}`);
      }
    }
  );
}
