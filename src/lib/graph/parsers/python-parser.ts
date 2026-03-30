import Parser from 'tree-sitter';
import * as path from 'path';
import { SymbolNode } from '../graph-store.js';
import { RawRelation } from './typescript-parser.js';

export interface ParseResult {
  symbols: SymbolNode[];
  rawRelations: RawRelation[];
}

let pythonLanguage: any = null;

async function getPythonLanguage(): Promise<any> {
  if (!pythonLanguage) {
    try {
      // @ts-ignore - dynamic optional dependency
      const mod = await import('tree-sitter-python');
      pythonLanguage = (mod as any).default ?? mod;
    } catch {
      throw new Error('tree-sitter-python not installed. Run: npm install tree-sitter-python');
    }
  }
  return pythonLanguage;
}

export class PythonParser {
  private parser: Parser;
  private ready = false;

  constructor() {
    this.parser = new Parser();
  }

  async init(): Promise<void> {
    if (this.ready) return;
    const lang = await getPythonLanguage();
    this.parser.setLanguage(lang);
    this.ready = true;
  }

  async parse(filepath: string, content: string): Promise<ParseResult> {
    await this.init();
    const tree = this.parser.parse(content);
    const symbols: SymbolNode[] = [];
    const rawRelations: RawRelation[] = [];
    const imports = new Map<string, string>();

    const visit = (node: Parser.SyntaxNode) => {
      // Import statements
      if (node.type === 'import_statement') {
        for (const child of node.children) {
          if (child.type === 'dotted_name') {
            const name = child.text.split('.').pop() ?? child.text;
            imports.set(name, child.text);
          }
        }
        return;
      }
      if (node.type === 'import_from_statement') {
        const moduleNode = node.children.find((c: any) => c.type === 'dotted_name');
        const modulePath = moduleNode?.text ?? '';
        for (const child of node.children) {
          if (child.type === 'import_list' || child.type === 'aliased_import') {
            for (const spec of child.children) {
              if (spec.type === 'dotted_name' || spec.type === 'identifier') {
                imports.set(spec.text, modulePath + '.' + spec.text);
              }
            }
          }
          if (child.type === 'dotted_name' && child !== moduleNode) {
            imports.set(child.text, modulePath + '.' + child.text);
          }
        }
        return;
      }

      // Function definitions
      if (node.type === 'function_definition') {
        const nameNode = node.childForFieldName('name');
        if (nameNode) {
          const uid = filepath + ':' + nameNode.text + ':' + node.startPosition.row;
          symbols.push({
            uid, name: nameNode.text, kind: 'Function', filepath,
            startLine: node.startPosition.row + 1,
            endLine: node.endPosition.row + 1,
          });
          this.extractCalls(node, uid, rawRelations, imports);
        }
        return;
      }

      // Class definitions
      if (node.type === 'class_definition') {
        const nameNode = node.childForFieldName('name');
        if (nameNode) {
          const className = nameNode.text;
          const uid = filepath + ':' + className + ':' + node.startPosition.row;
          symbols.push({
            uid, name: className, kind: 'Class', filepath,
            startLine: node.startPosition.row + 1,
            endLine: node.endPosition.row + 1,
          });

          // Superclasses
          const argList = node.childForFieldName('superclasses');
          if (argList) {
            for (const child of argList.children) {
              if (child.type === 'identifier') {
                rawRelations.push({
                  fromUid: uid, toName: child.text,
                  toFile: imports.get(child.text),
                  type: 'EXTENDS', confidence: 0.9,
                });
              }
            }
          }

          // Methods
          const body = node.childForFieldName('body');
          if (body) {
            for (const child of body.children) {
              if (child.type === 'function_definition') {
                const methodName = child.childForFieldName('name');
                if (methodName) {
                  const methodUid = filepath + ':' + className + '.' + methodName.text + ':' + child.startPosition.row;
                  symbols.push({
                    uid: methodUid,
                    name: className + '.' + methodName.text,
                    kind: 'Method', filepath,
                    startLine: child.startPosition.row + 1,
                    endLine: child.endPosition.row + 1,
                  });
                  this.extractCalls(child, methodUid, rawRelations, imports);
                }
              }
            }
          }
        }
        return;
      }

      // Decorated definitions (async def, @decorator)
      if (node.type === 'decorated_definition') {
        for (const child of node.children) {
          visit(child);
        }
        return;
      }

      for (const child of node.children) { visit(child); }
    };

    visit(tree.rootNode);
    return { symbols, rawRelations };
  }

  private extractCalls(
    node: Parser.SyntaxNode,
    callerUid: string,
    rawRelations: RawRelation[],
    imports: Map<string, string>,
  ): void {
    const visit = (n: Parser.SyntaxNode) => {
      if (n.type === 'call') {
        const fn = n.childForFieldName('function');
        if (fn) {
          if (fn.type === 'identifier') {
            rawRelations.push({
              fromUid: callerUid, toName: fn.text,
              toFile: imports.get(fn.text),
              type: 'CALLS', confidence: 0.8,
            });
          } else if (fn.type === 'attribute') {
            const attr = fn.childForFieldName('attribute');
            if (attr) {
              rawRelations.push({
                fromUid: callerUid, toName: attr.text,
                type: 'CALLS', confidence: 0.6,
              });
            }
          }
        }
      }
      for (const child of n.children) { visit(child); }
    };
    visit(node);
  }
}