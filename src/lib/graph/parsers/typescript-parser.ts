import Parser from 'tree-sitter';
import TypeScript from 'tree-sitter-typescript';
import * as path from 'path';
import { SymbolNode, Relation } from '../graph-store.js';

export interface ParseResult {
  symbols: SymbolNode[];
  relations: Relation[];
}

export class TypeScriptParser {
  private parser: Parser;

  constructor() {
    this.parser = new Parser();
    this.parser.setLanguage(TypeScript.typescript);
  }

  private resolveImportPath(currentFile: string, importPath: string): string {
    // Handle relative imports
    if (importPath.startsWith('.')) {
      const currentDir = path.dirname(currentFile);
      const resolved = path.resolve(currentDir, importPath);
      // Try common extensions
      for (const ext of ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx']) {
        const withExt = resolved + ext;
        if (withExt) return withExt;
      }
      return resolved + '.ts'; // Default
    }
    // Node modules or absolute imports
    return importPath;
  }

  parse(filepath: string, content: string): ParseResult {
    const tree = this.parser.parse(content);
    const symbols: SymbolNode[] = [];
    const relations: Relation[] = [];
    const imports = new Map<string, string>(); // local name -> imported symbol uid

    const visit = (node: Parser.SyntaxNode) => {
      // Function declarations
      if (node.type === 'function_declaration') {
        const nameNode = node.childForFieldName('name');
        if (nameNode) {
          const uid = `${filepath}:${nameNode.text}:${node.startPosition.row}`;
          symbols.push({
            uid,
            name: nameNode.text,
            kind: 'Function',
            filepath,
            startLine: node.startPosition.row + 1,
            endLine: node.endPosition.row + 1,
          });

          // Find function calls inside
          this.extractCalls(node, uid, relations, imports, filepath);
        }
      }

      // Arrow functions assigned to variables/constants
      else if (node.type === 'lexical_declaration' || node.type === 'variable_declaration') {
        for (const child of node.children) {
          if (child.type === 'variable_declarator') {
            const nameNode = child.childForFieldName('name');
            const valueNode = child.childForFieldName('value');
            
            if (nameNode && valueNode && (valueNode.type === 'arrow_function' || valueNode.type === 'function')) {
              const uid = `${filepath}:${nameNode.text}:${child.startPosition.row}`;
              symbols.push({
                uid,
                name: nameNode.text,
                kind: 'Function',
                filepath,
                startLine: child.startPosition.row + 1,
                endLine: child.endPosition.row + 1,
              });

              // Extract calls from arrow function body
              this.extractCalls(valueNode, uid, relations, imports, filepath);
            }
          }
        }
      }

      // Export assignments (React hooks pattern: export const useX = () => {})
      else if (node.type === 'export_statement') {
        const declarationNode = node.childForFieldName('declaration');
        if (declarationNode && (declarationNode.type === 'lexical_declaration' || declarationNode.type === 'variable_declaration')) {
          for (const child of declarationNode.children) {
            if (child.type === 'variable_declarator') {
              const nameNode = child.childForFieldName('name');
              const valueNode = child.childForFieldName('value');
              
              if (nameNode && valueNode && (valueNode.type === 'arrow_function' || valueNode.type === 'function')) {
                const uid = `${filepath}:${nameNode.text}:${child.startPosition.row}`;
                symbols.push({
                  uid,
                  name: nameNode.text,
                  kind: 'Function',
                  filepath,
                  startLine: child.startPosition.row + 1,
                  endLine: child.endPosition.row + 1,
                });

                this.extractCalls(valueNode, uid, relations, imports, filepath);
              }
            }
          }
        }
      }

      // Class declarations
      else if (node.type === 'class_declaration') {
        const nameNode = node.childForFieldName('name');
        if (nameNode) {
          const uid = `${filepath}:${nameNode.text}:${node.startPosition.row}`;
          symbols.push({
            uid,
            name: nameNode.text,
            kind: 'Class',
            filepath,
            startLine: node.startPosition.row + 1,
            endLine: node.endPosition.row + 1,
          });

          // Extract methods
          const bodyNode = node.childForFieldName('body');
          if (bodyNode) {
            for (const child of bodyNode.children) {
              if (child.type === 'method_definition') {
                const methodNameNode = child.childForFieldName('name');
                if (methodNameNode) {
                  const methodUid = `${filepath}:${nameNode.text}.${methodNameNode.text}:${child.startPosition.row}`;
                  symbols.push({
                    uid: methodUid,
                    name: `${nameNode.text}.${methodNameNode.text}`,
                    kind: 'Method',
                    filepath,
                    startLine: child.startPosition.row + 1,
                    endLine: child.endPosition.row + 1,
                  });

                  // Find calls inside method
                  this.extractCalls(child, methodUid, relations, imports, filepath);
                }
              }
            }
          }

          // Extract extends
          const heritageNode = node.childForFieldName('heritage');
          if (heritageNode) {
            for (const child of heritageNode.children) {
              if (child.type === 'extends_clause') {
                const typeNode = child.childForFieldName('value');
                if (typeNode) {
                  const parentName = typeNode.text;
                  const parentUid = imports.get(parentName) ?? `${filepath}:${parentName}:0`;
                  relations.push({
                    from: uid,
                    to: parentUid,
                    type: 'EXTENDS',
                    confidence: 0.9,
                  });
                }
              }
            }
          }
        }
      }

      // Interface declarations
      else if (node.type === 'interface_declaration') {
        const nameNode = node.childForFieldName('name');
        if (nameNode) {
          const uid = `${filepath}:${nameNode.text}:${node.startPosition.row}`;
          symbols.push({
            uid,
            name: nameNode.text,
            kind: 'Interface',
            filepath,
            startLine: node.startPosition.row + 1,
            endLine: node.endPosition.row + 1,
          });

          // Extract extends
          const heritageNode = node.childForFieldName('heritage');
          if (heritageNode) {
            for (const child of heritageNode.children) {
              if (child.type === 'extends_clause') {
                const typeNode = child.childForFieldName('value');
                if (typeNode) {
                  const parentName = typeNode.text;
                  const parentUid = imports.get(parentName) ?? `${filepath}:${parentName}:0`;
                  relations.push({
                    from: uid,
                    to: parentUid,
                    type: 'IMPLEMENTS',
                    confidence: 0.9,
                  });
                }
              }
            }
          }
        }
      }

      // Import statements
      else if (node.type === 'import_statement') {
        const clauseNode = node.childForFieldName('clause');
        const sourceNode = node.childForFieldName('source');
        
        if (clauseNode && sourceNode) {
          const sourcePath = sourceNode.text.replace(/['"]/g, '');
          
          // Named imports: import { X, Y as Z } from './module'
          if (clauseNode.type === 'named_imports') {
            for (const child of clauseNode.children) {
              if (child.type === 'import_specifier') {
                const nameNode = child.childForFieldName('name');
                const aliasNode = child.childForFieldName('alias');
                const importedName = nameNode?.text ?? '';
                const localName = aliasNode?.text ?? importedName;
                
                // Resolve relative paths
                const resolvedPath = this.resolveImportPath(filepath, sourcePath);
                const importedUid = `${resolvedPath}:${importedName}:0`;
                imports.set(localName, importedUid);
              }
            }
          }
          // Default import: import X from './module'
          else if (clauseNode.type === 'identifier') {
            const localName = clauseNode.text;
            const resolvedPath = this.resolveImportPath(filepath, sourcePath);
            const importedUid = `${resolvedPath}:default:0`;
            imports.set(localName, importedUid);
          }
          // Namespace import: import * as X from './module'
          else if (clauseNode.type === 'namespace_import') {
            const nameNode = clauseNode.childForFieldName('name');
            if (nameNode) {
              const localName = nameNode.text;
              const resolvedPath = this.resolveImportPath(filepath, sourcePath);
              const importedUid = `${resolvedPath}:*:0`;
              imports.set(localName, importedUid);
            }
          }
        }
      }

      // Recurse
      for (const child of node.children) {
        visit(child);
      }
    };

    visit(tree.rootNode);

    return { symbols, relations };
  }

  private extractCalls(
    node: Parser.SyntaxNode,
    callerUid: string,
    relations: Relation[],
    imports: Map<string, string>,
    filepath: string
  ): void {
    const visit = (n: Parser.SyntaxNode) => {
      // Regular function calls: foo()
      if (n.type === 'call_expression') {
        const functionNode = n.childForFieldName('function');
        if (functionNode) {
          let calleeName = '';
          let confidence = 0.8;

          // Simple identifier: foo()
          if (functionNode.type === 'identifier') {
            calleeName = functionNode.text;
          }
          // Member expression: obj.method()
          else if (functionNode.type === 'member_expression') {
            const propertyNode = functionNode.childForFieldName('property');
            if (propertyNode) {
              calleeName = propertyNode.text;
              confidence = 0.7; // Lower confidence for method calls
            }
          }

          if (calleeName) {
            // Check if it's an imported symbol
            const calleeUid = imports.get(calleeName) ?? `${filepath}:${calleeName}:0`;
            relations.push({
              from: callerUid,
              to: calleeUid,
              type: 'CALLS',
              confidence,
            });
          }
        }
      }

      // JSX elements: <Component />
      else if (n.type === 'jsx_element' || n.type === 'jsx_self_closing_element') {
        const nameNode = n.type === 'jsx_element' 
          ? n.childForFieldName('open_tag')?.childForFieldName('name')
          : n.childForFieldName('name');
        
        if (nameNode) {
          const componentName = nameNode.text;
          // Only track custom components (PascalCase)
          if (componentName && /^[A-Z]/.test(componentName)) {
            const calleeUid = imports.get(componentName) ?? `${filepath}:${componentName}:0`;
            relations.push({
              from: callerUid,
              to: calleeUid,
              type: 'CALLS',
              confidence: 0.85, // JSX usage is pretty reliable
            });
          }
        }
      }

      // Hook calls: const [state, setState] = useState()
      else if (n.type === 'variable_declarator') {
        const valueNode = n.childForFieldName('value');
        if (valueNode && valueNode.type === 'call_expression') {
          const functionNode = valueNode.childForFieldName('function');
          if (functionNode && functionNode.type === 'identifier') {
            const hookName = functionNode.text;
            // React hooks pattern
            if (hookName.startsWith('use')) {
              const calleeUid = imports.get(hookName) ?? `${filepath}:${hookName}:0`;
              relations.push({
                from: callerUid,
                to: calleeUid,
                type: 'CALLS',
                confidence: 0.9,
              });
            }
          }
        }
      }

      for (const child of n.children) {
        visit(child);
      }
    };

    visit(node);
  }
}
