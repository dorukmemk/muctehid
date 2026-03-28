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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TypeScriptParser = void 0;
const tree_sitter_1 = __importDefault(require("tree-sitter"));
const tree_sitter_typescript_1 = __importDefault(require("tree-sitter-typescript"));
const path = __importStar(require("path"));
class TypeScriptParser {
    parser;
    constructor() {
        this.parser = new tree_sitter_1.default();
        this.parser.setLanguage(tree_sitter_typescript_1.default.typescript);
    }
    resolveImportPath(currentFile, importPath) {
        if (importPath.startsWith('.')) {
            const currentDir = path.dirname(currentFile);
            const resolved = path.resolve(currentDir, importPath);
            // Return without extension — graph-builder will try variants
            return resolved;
        }
        return importPath;
    }
    parse(filepath, content) {
        const tree = this.parser.parse(content);
        const symbols = [];
        const rawRelations = [];
        // Map: local name → resolved file path (from imports)
        const importedFrom = new Map(); // localName → resolvedFilePath
        const visit = (node) => {
            // ── Import statements ──────────────────────────────────────────────────
            if (node.type === 'import_statement') {
                const clauseNode = node.childForFieldName('clause');
                const sourceNode = node.childForFieldName('source');
                if (clauseNode && sourceNode) {
                    const sourcePath = sourceNode.text.replace(/['"]/g, '');
                    const resolvedPath = this.resolveImportPath(filepath, sourcePath);
                    const registerImport = (localName) => {
                        importedFrom.set(localName, resolvedPath);
                    };
                    if (clauseNode.type === 'named_imports') {
                        for (const child of clauseNode.children) {
                            if (child.type === 'import_specifier') {
                                const nameNode = child.childForFieldName('name');
                                const aliasNode = child.childForFieldName('alias');
                                const localName = aliasNode?.text ?? nameNode?.text ?? '';
                                if (localName)
                                    registerImport(localName);
                            }
                        }
                    }
                    else if (clauseNode.type === 'identifier') {
                        registerImport(clauseNode.text);
                    }
                    else if (clauseNode.type === 'namespace_import') {
                        const nameNode = clauseNode.childForFieldName('name');
                        if (nameNode)
                            registerImport(nameNode.text);
                    }
                    else if (clauseNode.type === 'import_clause') {
                        // import DefaultExport, { named } from '...'
                        for (const child of clauseNode.children) {
                            if (child.type === 'identifier') {
                                registerImport(child.text);
                            }
                            else if (child.type === 'named_imports') {
                                for (const spec of child.children) {
                                    if (spec.type === 'import_specifier') {
                                        const nameNode = spec.childForFieldName('name');
                                        const aliasNode = spec.childForFieldName('alias');
                                        const localName = aliasNode?.text ?? nameNode?.text ?? '';
                                        if (localName)
                                            registerImport(localName);
                                    }
                                }
                            }
                        }
                    }
                }
                return; // Don't recurse into imports
            }
            // ── Function declarations ──────────────────────────────────────────────
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
                    this.extractCalls(node, uid, rawRelations, importedFrom, filepath);
                }
                return;
            }
            // ── Arrow / function expressions assigned to variables ─────────────────
            if (node.type === 'lexical_declaration' || node.type === 'variable_declaration') {
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
                            this.extractCalls(valueNode, uid, rawRelations, importedFrom, filepath);
                        }
                    }
                }
                return;
            }
            // ── Export statements ──────────────────────────────────────────────────
            if (node.type === 'export_statement') {
                const decl = node.childForFieldName('declaration');
                if (decl && (decl.type === 'lexical_declaration' || decl.type === 'variable_declaration')) {
                    for (const child of decl.children) {
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
                                this.extractCalls(valueNode, uid, rawRelations, importedFrom, filepath);
                            }
                        }
                    }
                }
                else if (decl && decl.type === 'function_declaration') {
                    const nameNode = decl.childForFieldName('name');
                    if (nameNode) {
                        const uid = `${filepath}:${nameNode.text}:${decl.startPosition.row}`;
                        symbols.push({
                            uid,
                            name: nameNode.text,
                            kind: 'Function',
                            filepath,
                            startLine: decl.startPosition.row + 1,
                            endLine: decl.endPosition.row + 1,
                        });
                        this.extractCalls(decl, uid, rawRelations, importedFrom, filepath);
                    }
                }
                else if (decl && decl.type === 'class_declaration') {
                    // handled below via recursion
                    visit(decl);
                }
                return;
            }
            // ── Class declarations ─────────────────────────────────────────────────
            if (node.type === 'class_declaration') {
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
                    // Methods
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
                                    this.extractCalls(child, methodUid, rawRelations, importedFrom, filepath);
                                }
                            }
                        }
                    }
                    // Extends
                    const heritageNode = node.childForFieldName('heritage');
                    if (heritageNode) {
                        for (const child of heritageNode.children) {
                            if (child.type === 'extends_clause') {
                                const typeNode = child.childForFieldName('value');
                                if (typeNode) {
                                    rawRelations.push({
                                        fromUid: uid,
                                        toName: typeNode.text,
                                        toFile: importedFrom.get(typeNode.text),
                                        type: 'EXTENDS',
                                        confidence: 0.9,
                                    });
                                }
                            }
                        }
                    }
                }
                return;
            }
            // ── Interface declarations ─────────────────────────────────────────────
            if (node.type === 'interface_declaration') {
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
                    const heritageNode = node.childForFieldName('heritage');
                    if (heritageNode) {
                        for (const child of heritageNode.children) {
                            if (child.type === 'extends_clause') {
                                const typeNode = child.childForFieldName('value');
                                if (typeNode) {
                                    rawRelations.push({
                                        fromUid: uid,
                                        toName: typeNode.text,
                                        toFile: importedFrom.get(typeNode.text),
                                        type: 'IMPLEMENTS',
                                        confidence: 0.9,
                                    });
                                }
                            }
                        }
                    }
                }
                return;
            }
            // Recurse
            for (const child of node.children) {
                visit(child);
            }
        };
        visit(tree.rootNode);
        return { symbols, rawRelations };
    }
    extractCalls(node, callerUid, rawRelations, importedFrom, filepath) {
        const visit = (n) => {
            // Regular function calls: foo() or obj.method()
            if (n.type === 'call_expression') {
                const functionNode = n.childForFieldName('function');
                if (functionNode) {
                    if (functionNode.type === 'identifier') {
                        const name = functionNode.text;
                        rawRelations.push({
                            fromUid: callerUid,
                            toName: name,
                            toFile: importedFrom.get(name),
                            type: 'CALLS',
                            confidence: 0.8,
                        });
                    }
                    else if (functionNode.type === 'member_expression') {
                        const propertyNode = functionNode.childForFieldName('property');
                        if (propertyNode) {
                            rawRelations.push({
                                fromUid: callerUid,
                                toName: propertyNode.text,
                                toFile: undefined,
                                type: 'CALLS',
                                confidence: 0.6,
                            });
                        }
                    }
                }
            }
            // JSX elements: <Component />
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
            // Hook calls: const [x] = useState()
            else if (n.type === 'variable_declarator') {
                const valueNode = n.childForFieldName('value');
                if (valueNode?.type === 'call_expression') {
                    const fn = valueNode.childForFieldName('function');
                    if (fn?.type === 'identifier' && fn.text.startsWith('use')) {
                        rawRelations.push({
                            fromUid: callerUid,
                            toName: fn.text,
                            toFile: importedFrom.get(fn.text),
                            type: 'CALLS',
                            confidence: 0.9,
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