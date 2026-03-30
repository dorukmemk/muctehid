import Parser from 'tree-sitter';
import TypeScript from 'tree-sitter-typescript';
import * as path from 'path';
import { SymbolNode } from '../graph-store.js';

export interface ParseResult {
  symbols: SymbolNode[];
  rawRelations: RawRelation[];
}

export interface RawRelation {
  fromUid: string;
  toName: string;
  toFile?: string;
  type: 'CALLS' | 'IMPORTS' | 'EXTENDS' | 'IMPLEMENTS' | 'MEMBER_OF';
  confidence: number;
}

export class TypeScriptParser {
  private parser: Parser;

  constructor() {
    this.parser = new Parser();
    this.parser.setLanguage(TypeScript.typescript);
  }

  private resolveImportPath(currentFile: string, importPath: string): string {
    if (importPath.startsWith('.')) {
      const currentDir = path.dirname(currentFile);
      return path.resolve(currentDir, importPath);
    }
    return importPath;
  }

  parse(filepath: string, content: string): ParseResult {
    const tree = this.parser.parse(content);
    const symbols: SymbolNode[] = [];
    const rawRelations: RawRelation[] = [];
    const importedFrom = new Map<string, string>();

    const visit = (node: Parser.SyntaxNode) => {
      // ── Imports ────────────────────────────────────────────────────────────
      if (node.type === 'import_statement') {
        this.parseImport(node, filepath, importedFrom);
        return;
      }

      // ── Function declarations ──────────────────────────────────────────────
      if (node.type === 'function_declaration') {
        const nameNode = node.childForFieldName('name');
        if (nameNode) {
          const uid = `${filepath}:${nameNode.text}:${node.startPosition.row}`;
          symbols.push({
            uid, name: nameNode.text, kind: 'Function', filepath,
            startLine: node.startPosition.row + 1,
            endLine: node.endPosition.row + 1,
          });
          this.extractCalls(node, uid, rawRelations, importedFrom);
        }
        return;
      }

      // ── Variable declarations (const/let/var) ─────────────────────────────
      // Handles: const foo = () => {}, const foo = wrapper(...), const foo = value
      if (node.type === 'lexical_declaration' || node.type === 'variable_declaration') {
        this.parseVarDeclaration(node, filepath, symbols, rawRelations, importedFrom);
        return;
      }

      // ── Export statements ──────────────────────────────────────────────────
      if (node.type === 'export_statement') {
        const decl = node.childForFieldName('declaration');
        if (!decl) {
          // Recurse for other children
          for (const child of node.children) { visit(child); }
          return;
        }

        if (decl.type === 'lexical_declaration' || decl.type === 'variable_declaration') {
          this.parseVarDeclaration(decl, filepath, symbols, rawRelations, importedFrom);
        } else if (decl.type === 'function_declaration') {
          const nameNode = decl.childForFieldName('name');
          if (nameNode) {
            const uid = `${filepath}:${nameNode.text}:${decl.startPosition.row}`;
            symbols.push({
              uid, name: nameNode.text, kind: 'Function', filepath,
              startLine: decl.startPosition.row + 1,
              endLine: decl.endPosition.row + 1,
            });
            this.extractCalls(decl, uid, rawRelations, importedFrom);
          }
        } else if (decl.type === 'class_declaration') {
          this.parseClass(decl, filepath, symbols, rawRelations, importedFrom);
        } else if (decl.type === 'interface_declaration') {
          this.parseInterface(decl, filepath, symbols, rawRelations, importedFrom);
        }
        return;
      }

      // ── Class declarations ─────────────────────────────────────────────────
      if (node.type === 'class_declaration') {
        this.parseClass(node, filepath, symbols, rawRelations, importedFrom);
        return;
      }

      // ── Interface declarations ─────────────────────────────────────────────
      if (node.type === 'interface_declaration') {
        this.parseInterface(node, filepath, symbols, rawRelations, importedFrom);
        return;
      }

      // ── Type alias declarations ────────────────────────────────────────────
      if (node.type === 'type_alias_declaration') {
        const nameNode = node.childForFieldName('name');
        if (nameNode) {
          symbols.push({
            uid: `${filepath}:${nameNode.text}:${node.startPosition.row}`,
            name: nameNode.text, kind: 'Interface', filepath,
            startLine: node.startPosition.row + 1,
            endLine: node.endPosition.row + 1,
          });
        }
        return;
      }

      // ── Enum declarations ──────────────────────────────────────────────────
      if (node.type === 'enum_declaration') {
        const nameNode = node.childForFieldName('name');
        if (nameNode) {
          symbols.push({
            uid: `${filepath}:${nameNode.text}:${node.startPosition.row}`,
            name: nameNode.text, kind: 'Variable', filepath,
            startLine: node.startPosition.row + 1,
            endLine: node.endPosition.row + 1,
          });
        }
        return;
      }

      for (const child of node.children) { visit(child); }
    };

    visit(tree.rootNode);
    return { symbols, rawRelations };
  }

  // ── Parse variable declarations ──────────────────────────────────────────
  private parseVarDeclaration(
    node: Parser.SyntaxNode,
    filepath: string,
    symbols: SymbolNode[],
    rawRelations: RawRelation[],
    importedFrom: Map<string, string>,
  ): void {
    for (const child of node.children) {
      if (child.type !== 'variable_declarator') continue;

      const nameNode = child.childForFieldName('name');
      const valueNode = child.childForFieldName('value');
      if (!nameNode || !valueNode) continue;

      const name = nameNode.text;
      const uid = `${filepath}:${name}:${child.startPosition.row}`;

      // Determine kind based on value type
      const isFunction = valueNode.type === 'arrow_function' || valueNode.type === 'function';
      const isCallExpression = valueNode.type === 'call_expression';

      // Always create a symbol for named exports / top-level declarations
      symbols.push({
        uid,
        name,
        kind: isFunction ? 'Function' : 'Variable',
        filepath,
        startLine: child.startPosition.row + 1,
        endLine: child.endPosition.row + 1,
      });

      // Extract calls from the value
      if (isFunction) {
        // const foo = () => { ... } — extract calls from body
        this.extractCalls(valueNode, uid, rawRelations, importedFrom);
      } else if (isCallExpression) {
        // const foo = wrapper(async () => { ... }) — extract calls from entire expression
        this.extractCalls(valueNode, uid, rawRelations, importedFrom);
      }
    }
  }

  // ── Parse class declarations ─────────────────────────────────────────────
  private parseClass(
    node: Parser.SyntaxNode,
    filepath: string,
    symbols: SymbolNode[],
    rawRelations: RawRelation[],
    importedFrom: Map<string, string>,
  ): void {
    const nameNode = node.childForFieldName('name');
    if (!nameNode) return;

    const className = nameNode.text;
    const uid = `${filepath}:${className}:${node.startPosition.row}`;
    symbols.push({
      uid, name: className, kind: 'Class', filepath,
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1,
    });

    // Methods
    const bodyNode = node.childForFieldName('body');
    if (bodyNode) {
      for (const child of bodyNode.children) {
        if (child.type === 'method_definition') {
          const methodNameNode = child.childForFieldName('name');
          if (methodNameNode) {
            const methodUid = `${filepath}:${className}.${methodNameNode.text}:${child.startPosition.row}`;
            symbols.push({
              uid: methodUid,
              name: `${className}.${methodNameNode.text}`,
              kind: 'Method', filepath,
              startLine: child.startPosition.row + 1,
              endLine: child.endPosition.row + 1,
            });
            this.extractCalls(child, methodUid, rawRelations, importedFrom);
          }
        }
        // Class property arrow functions: filter = (x) => x
        if (child.type === 'public_field_definition') {
          const propName = child.childForFieldName('name');
          const propValue = child.childForFieldName('value');
          if (propName && propValue && (propValue.type === 'arrow_function' || propValue.type === 'function')) {
            const propUid = `${filepath}:${className}.${propName.text}:${child.startPosition.row}`;
            symbols.push({
              uid: propUid,
              name: `${className}.${propName.text}`,
              kind: 'Method', filepath,
              startLine: child.startPosition.row + 1,
              endLine: child.endPosition.row + 1,
            });
            this.extractCalls(propValue, propUid, rawRelations, importedFrom);
          }
        }
      }
    }

    // Extends / Implements
    for (const child of node.children) {
      if (child.type === 'extends_clause') {
        // extends_clause can contain the type directly
        for (const typeChild of child.children) {
          if (typeChild.type === 'identifier' || typeChild.type === 'member_expression') {
            const parentName = typeChild.text;
            rawRelations.push({
              fromUid: uid, toName: parentName,
              toFile: importedFrom.get(parentName),
              type: 'EXTENDS', confidence: 0.95,
            });
          }
        }
      }
      if (child.type === 'implements_clause') {
        for (const typeChild of child.children) {
          if (typeChild.type === 'type_identifier' || typeChild.type === 'identifier') {
            rawRelations.push({
              fromUid: uid, toName: typeChild.text,
              toFile: importedFrom.get(typeChild.text),
              type: 'IMPLEMENTS', confidence: 0.95,
            });
          }
        }
      }
    }
  }

  // ── Parse interface declarations ─────────────────────────────────────────
  private parseInterface(
    node: Parser.SyntaxNode,
    filepath: string,
    symbols: SymbolNode[],
    rawRelations: RawRelation[],
    importedFrom: Map<string, string>,
  ): void {
    const nameNode = node.childForFieldName('name');
    if (!nameNode) return;

    const uid = `${filepath}:${nameNode.text}:${node.startPosition.row}`;
    symbols.push({
      uid, name: nameNode.text, kind: 'Interface', filepath,
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1,
    });

    // Extends
    for (const child of node.children) {
      if (child.type === 'extends_type_clause' || child.type === 'extends_clause') {
        for (const typeChild of child.children) {
          if (typeChild.type === 'type_identifier' || typeChild.type === 'identifier') {
            rawRelations.push({
              fromUid: uid, toName: typeChild.text,
              toFile: importedFrom.get(typeChild.text),
              type: 'EXTENDS', confidence: 0.9,
            });
          }
        }
      }
    }
  }

  // ── Parse import statements ──────────────────────────────────────────────
  private parseImport(
    node: Parser.SyntaxNode,
    filepath: string,
    importedFrom: Map<string, string>,
  ): void {
    const sourceNode = node.childForFieldName('source');
    if (!sourceNode) return;

    const sourcePath = sourceNode.text.replace(/['"]/g, '');
    const resolvedPath = this.resolveImportPath(filepath, sourcePath);

    const register = (localName: string) => {
      importedFrom.set(localName, resolvedPath);
    };

    // Walk all children to find import specifiers
    const walkImport = (n: Parser.SyntaxNode) => {
      if (n.type === 'import_specifier') {
        const nameNode = n.childForFieldName('name');
        const aliasNode = n.childForFieldName('alias');
        const localName = aliasNode?.text ?? nameNode?.text ?? '';
        if (localName) register(localName);
        return;
      }
      if (n.type === 'namespace_import') {
        const nameNode = n.childForFieldName('name');
        if (nameNode) register(nameNode.text);
        return;
      }
      // Default import: just an identifier directly under import_clause
      if (n.type === 'identifier' && n.parent?.type === 'import_clause') {
        register(n.text);
        return;
      }
      for (const child of n.children) { walkImport(child); }
    };

    walkImport(node);
  }

  // ── Extract function calls from AST subtree ──────────────────────────────
  private extractCalls(
    node: Parser.SyntaxNode,
    callerUid: string,
    rawRelations: RawRelation[],
    importedFrom: Map<string, string>,
  ): void {
    const visit = (n: Parser.SyntaxNode) => {
      if (n.type === 'call_expression') {
        const functionNode = n.childForFieldName('function');
        if (functionNode) {
          if (functionNode.type === 'identifier') {
            rawRelations.push({
              fromUid: callerUid,
              toName: functionNode.text,
              toFile: importedFrom.get(functionNode.text),
              type: 'CALLS',
              confidence: 0.8,
            });
          } else if (functionNode.type === 'member_expression') {
            const objNode = functionNode.childForFieldName('object');
            const propNode = functionNode.childForFieldName('property');
            if (propNode) {
              // Try ClassName.method format first
              const objName = objNode?.type === 'identifier' ? objNode.text : undefined;
              const dottedName = objName ? `${objName}.${propNode.text}` : undefined;

              rawRelations.push({
                fromUid: callerUid,
                toName: dottedName ?? propNode.text,
                toFile: objName ? importedFrom.get(objName) : undefined,
                type: 'CALLS',
                confidence: dottedName ? 0.7 : 0.5,
              });
            }
          }
        }
      }

      // JSX: <Component />
      else if (n.type === 'jsx_element' || n.type === 'jsx_self_closing_element') {
        const nameNode = n.type === 'jsx_element'
          ? n.childForFieldName('open_tag')?.childForFieldName('name')
          : n.childForFieldName('name');
        if (nameNode && /^[A-Z]/.test(nameNode.text)) {
          rawRelations.push({
            fromUid: callerUid,
            toName: nameNode.text,
            toFile: importedFrom.get(nameNode.text),
            type: 'CALLS',
            confidence: 0.85,
          });
        }
      }

      for (const child of n.children) { visit(child); }
    };

    visit(node);
  }
}
