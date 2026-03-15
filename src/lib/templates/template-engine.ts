import * as fs from 'fs';

export type TemplateContext = {
  [key: string]: string | number | boolean | string[] | Record<string, unknown> | TemplateContext | Array<unknown>;
};

type HelperFn = (value: unknown) => string;
const helpers: Record<string, HelperFn> = {
  upper: (v) => String(v).toUpperCase(),
  lower: (v) => String(v).toLowerCase(),
  truncate: (v) => String(v).slice(0, 100),
  date: () => new Date().toISOString().slice(0, 10),
  len: (v) => String(Array.isArray(v) ? v.length : String(v).length),
};

export function registerHelper(name: string, fn: HelperFn): void {
  helpers[name] = fn;
}

export function render(template: string, ctx: TemplateContext): string {
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
    if (!Array.isArray(arr)) return '';
    return arr.map((item, idx) => {
      let out = body.replace(/\{\{@index\}\}/g, String(idx));
      if (typeof item === 'object' && item !== null) {
        for (const [k, v] of Object.entries(item as Record<string, unknown>)) {
          out = out.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v ?? ''));
        }
      } else {
        out = out.replace(/\{\{this\}\}/g, String(item ?? ''));
      }
      return out;
    }).join('');
  });

  // {{helper value}}
  result = result.replace(/\{\{(\w+)\s+(\w+)\}\}/g, (_, helperName, key) => {
    const fn = helpers[helperName];
    if (!fn) return `{{${helperName} ${key}}}`;
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

export function renderFile(filePath: string, ctx: TemplateContext): string {
  const template = fs.readFileSync(filePath, 'utf-8');
  return render(template, ctx);
}

function resolvePath(ctx: TemplateContext, path: string): unknown {
  const parts = path.split('.');
  let cur: unknown = ctx;
  for (const part of parts) {
    if (cur === null || cur === undefined) return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}
