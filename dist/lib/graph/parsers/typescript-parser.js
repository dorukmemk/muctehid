"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TypeScriptParser = void 0;
const tree_sitter_1 = __importDefault(require("tree-sitter"));
const tree_sitter_typescript_1 = __importDefault(require("tree-sitter-typescript"));
class TypeScriptParser {
    parser;
    constructor() {
        this.parser = new tree_sitter_1.default();
        this.parser.setLanguage(tree_sitter_typescript_1.default.typescript);
    }
    parse(filepath, content) {
        const tree = this.parser.parse(content);
        const symbols = [];
        const relations = [];
        const imports = new Map(); // local name -> imported symbol uid
        const visit = (node) => {
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
                    // Named imports
                    if (clauseNode.type === 'named_imports') {
                        for (const child of clauseNode.children) {
                            if (child.type === 'import_specifier') {
                                const nameNode = child.childForFieldName('name');
                                const aliasNode = child.childForFieldName('alias');
                                const importedName = nameNode?.text ?? '';
                                const localName = aliasNode?.text ?? importedName;
                                // Store import mapping
                                const importedUid = `${sourcePath}:${importedName}:0`;
                                imports.set(localName, importedUid);
                            }
                        }
                    }
                    // Default import
                    else if (clauseNode.type === 'identifier') {
                        const localName = clauseNode.text;
                        const importedUid = `${sourcePath}:default:0`;
                        imports.set(localName, importedUid);
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
    extractCalls(node, callerUid, relations, imports, filepath) {
        const visit = (n) => {
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
            for (const child of n.children) {
                visit(child);
            }
        };
        visit(node);
    }
}
exports.TypeScriptParser = TypeScriptParser;
//# sourceMappingURL=typescript-parser.js.map