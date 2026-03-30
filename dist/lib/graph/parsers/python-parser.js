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
exports.PythonParser = void 0;
const tree_sitter_1 = __importDefault(require("tree-sitter"));
let pythonLanguage = null;
async function getPythonLanguage() {
    if (!pythonLanguage) {
        try {
            // @ts-ignore - dynamic optional dependency
            const mod = await Promise.resolve().then(() => __importStar(require('tree-sitter-python')));
            pythonLanguage = mod.default ?? mod;
        }
        catch {
            throw new Error('tree-sitter-python not installed. Run: npm install tree-sitter-python');
        }
    }
    return pythonLanguage;
}
class PythonParser {
    parser;
    ready = false;
    constructor() {
        this.parser = new tree_sitter_1.default();
    }
    async init() {
        if (this.ready)
            return;
        const lang = await getPythonLanguage();
        this.parser.setLanguage(lang);
        this.ready = true;
    }
    async parse(filepath, content) {
        await this.init();
        const tree = this.parser.parse(content);
        const symbols = [];
        const rawRelations = [];
        const imports = new Map();
        const visit = (node) => {
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
                const moduleNode = node.children.find((c) => c.type === 'dotted_name');
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
            for (const child of node.children) {
                visit(child);
            }
        };
        visit(tree.rootNode);
        return { symbols, rawRelations };
    }
    extractCalls(node, callerUid, rawRelations, imports) {
        const visit = (n) => {
            if (n.type === 'call') {
                const fn = n.childForFieldName('function');
                if (fn) {
                    if (fn.type === 'identifier') {
                        rawRelations.push({
                            fromUid: callerUid, toName: fn.text,
                            toFile: imports.get(fn.text),
                            type: 'CALLS', confidence: 0.8,
                        });
                    }
                    else if (fn.type === 'attribute') {
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
            for (const child of n.children) {
                visit(child);
            }
        };
        visit(node);
    }
}
exports.PythonParser = PythonParser;
//# sourceMappingURL=python-parser.js.map