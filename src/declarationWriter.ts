/*! *****************************************************************************
 Copyright (c) Artifact Health, LLC. All rights reserved.
 Licensed under the Apache License, Version 2.0 (the "License"); you may not use
 this file except in compliance with the License. You may obtain a copy of the
 License at http://www.apache.org/licenses/LICENSE-2.0

 THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
 WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
 MERCHANTABLITY OR NON-INFRINGEMENT.

 See the Apache Version 2.0 License for specific language governing permissions
 and limitations under the License.
 ***************************************************************************** */

/// <reference path="textFileWriter.ts"/>

module ts {

    export interface IDeclarationWriter {

        writeBeginModuleElement(kind: DeclarationKind): void;
        writeBeginRemovableModuleElement(kind: DeclarationKind): IRemovableModuleElement;
        writeBeginClassMember(kind: DeclarationKind): void;
        writeBeginSignature(kind: DeclarationKind): void;
        writeBeginType(kind: DeclarationKind): void;

        writeBeginEnumMember(): void;

        writeBeginParameterList(): void;
        writeBeginTypeParameterList(): void;
        writeBeginTypeArgumentList(): void;
        writeBeginTypeParameter(): void;
        writeBeginParameter(): void;
        writeBeginExtends(): void;
        writeBeginImplements(): void;

        writeEnd(): void;

        writeReference(path: string): void;
        writeName(name: string): void;
        writeDescription(description: string): void;
        writeAnnotation(name: string, value: any): void;
        writeFlags(flags: DeclarationFlag): void;
        writeRequire(path: string): void;
        writeValue(identifier: string): void;
        writeTypeReference(identifier: string): void;
        writeExportAssignment(identifier: string): void;

        close(): Diagnostic[];
    }

    export interface IRemovableModuleElement {

        remove(): void;
    }

    export enum DeclarationFlag {

        None             = 0,
        Exported         = 0x00000001,
        Private          = 0x00000002,
        Public           = 0x00000004,
        Protected        = 0x00000008,
        Ambient          = 0x00000010,
        Static           = 0x00000020,
        Optional         = 0x00000040,
        RestParameter    = 0x00000080,
        ExternalModule   = 0x00000100,
        HasNoDefaultLib  = 0x00000200,
        DeclarationFile  = 0x00000400,
        RootFile         = 0x00000800
    }

    export enum DeclarationKind {

        None,

        Script,

        Interface,
        Class,
        Enum,
        Module,
        Function,
        Variable,
        Constant,
        Let,
        Import,
        TypeAlias,

        EnumMember,

        Index,
        Field,
        Method,
        Constructor,
        GetAccessor,
        SetAccessor,

        PropertySignature,
        ConstructSignature,
        MethodSignature,
        IndexSignature,
        CallSignature,

        FunctionType,
        ArrayType,
        ConstructorType,
        ObjectType,
        TypeReference,
        StringLiteralType,
        TupleType,
        UnionType,

        Extends,
        Implements,
        Constraint,

        ParameterList,
        Parameter,

        TypeParameterList,
        TypeParameter,

        TypeArgumentList
    }

    export class DeclarationWriter implements IDeclarationWriter {

        private _currentState: IState;
        private _rootNode: any;
        private _writer: ITextFileWriter;

        constructor(writer: ITextFileWriter) {

            this._currentState = {
                kind: DeclarationKind.Script,
                node: this._rootNode = {}
            }

            this._writer = writer;
        }

        writeBeginModuleElement(kind: DeclarationKind): void {

            var node = {
                kind: kindToString(kind)
            }

            this._addToArray("declares", node);
            this._pushState(kind, node);
        }

        writeBeginRemovableModuleElement(kind: DeclarationKind): IRemovableModuleElement {

            var parentNode = this._currentState.node;

            this.writeBeginModuleElement(kind);

            var importNode = this._currentState.node;

            return {
                remove: function () {

                    var declarations: any[] = parentNode["declares"];
                    var index = declarations.indexOf(importNode, 0);
                    if(index != -1) {
                        declarations.splice(index, 1);
                        if(declarations.length == 0) {
                            delete parentNode["declares"];
                        }
                    }
                }
            }
        }

        writeBeginClassMember(kind: DeclarationKind): void {

            var node = {
                kind: kindToString(kind)
            }

            this._addToArray("members", node);
            this._pushState(kind, node);
        }

        writeBeginSignature(kind: DeclarationKind): void {

            var node = {
                kind: kindToString(kind)
            }

            this._addToArray("signatures", node);
            this._pushState(kind, node);
        }

        writeBeginType(kind: DeclarationKind): void {

            this._pushState(kind, this._setTypeOnCurrentNode({
                kind: kindToString(kind)
            }));
        }

        writeBeginEnumMember(): void {

            var node = {
            }

            this._addToArray("members", node);
            this._pushState(DeclarationKind.EnumMember, node);
        }

        writeBeginParameterList(): void {

            this._pushArray(DeclarationKind.ParameterList, "parameters");
        }

        writeBeginTypeParameterList(): void {

            this._pushArray(DeclarationKind.TypeParameterList, "typeParameters");
        }

        writeBeginTypeArgumentList(): void {

            this._pushArray(DeclarationKind.TypeArgumentList, "arguments");
        }

        writeBeginTypeParameter(): void {

            var node: any = {}
            this._currentState.node.push(node);
            this._pushState(DeclarationKind.TypeParameter, node);
        }

        writeBeginParameter(): void {

            var node: any = {}

            switch(this._currentState.kind) {
                case DeclarationKind.ParameterList:
                    this._currentState.node.push(node);
                    break;
                case DeclarationKind.SetAccessor:
                case DeclarationKind.Index:
                case DeclarationKind.IndexSignature:
                    this._setProperty("parameter", node);
                    break;
                default:
                    throw new Error("Expected ParameterList,  Index, IndexSignature, or SetAccessor");
            }

            this._pushState(DeclarationKind.Parameter, node);
        }

        writeBeginExtends(): void {

            switch(this._currentState.kind) {
                case DeclarationKind.Class:
                    this._pushState(DeclarationKind.Extends);
                    break;
                case DeclarationKind.Interface:
                    this._pushArray(DeclarationKind.Extends, "extends");
                    break;
                default:
                    throw new Error("Expected Class or Interface");
            }
        }

        writeBeginImplements(): void {

            this._pushArray(DeclarationKind.Extends, "implements");
        }

        writeBeginReference(path: string): void {

            this._addToArray("references", path);
        }

        writeEnd(): void {

            this._currentState = this._currentState.parent;

            Debug.assert(this._currentState !== undefined, "Unmatched call to writeEnd");
        }

        writeReference(path: string): void {

            this._addToArray("references", path);
        }

        writeName(name: string): void {

            this._setProperty("name", name);
        }

        writeDescription(description: string): void {

            this._setProperty("description", description);
        }

        writeAnnotation(name: string, value: any): void {

            //this._ensureProperty("annotations", {})[name] = value;

            this._addToArray("annotations", {
                name: name,
                value: value
            });
        }

        writeFlags(flags: DeclarationFlag): void {

            // Export flag is ignored on anything but an import declaration.
            if(this._currentState.kind == DeclarationKind.Import && (flags & DeclarationFlag.Exported) !== 0) {
                this._setProperty("export", true);
            }
            if((flags & DeclarationFlag.Private) !== 0) {
                this._setProperty("private", true);
            }
            if((flags & DeclarationFlag.Protected) !== 0) {
                this._setProperty("protected", true);
            }
            if((flags & DeclarationFlag.Static) !== 0) {
                this._setProperty("static", true);
            }
            if((flags & DeclarationFlag.Optional) !== 0) {
                this._setProperty("optional", true);
            }
            if((flags & DeclarationFlag.RestParameter) !== 0) {
                this._setProperty("rest", true);
            }
            if((flags & DeclarationFlag.ExternalModule) !== 0) {
                this._setProperty("external", true);
            }
            if((flags & DeclarationFlag.HasNoDefaultLib) !== 0) {
                this._setProperty("noDefaultLib", true);
            }
        }

        writeValue(identifier: string): void {

            this._setProperty("value", identifier);
        }

        writeRequire(path: string): void {

            this._setProperty("require", path);
        }

        writeTypeReference(identifier: string): void {

            this._setTypeOnCurrentNode(identifier);
        }

        writeExportAssignment(identifier: string): void {

            this._setProperty("exportName", identifier);
        }

        close(): Diagnostic[] {

            var diagnostics: Diagnostic[];

            this._writer.write(JSON.stringify(this._rootNode, null, "\t"), hostErrorMessage => {
                // This callback is sync
                diagnostics = [];
                diagnostics.push(createCompilerDiagnostic(
                    Diagnostics.Could_not_write_file_0_Colon_1, this._writer.filePath, hostErrorMessage));
            });

            return diagnostics;
        }

        private _setTypeOnCurrentNode(type: any): any {

            switch(this._currentState.kind) {

                case DeclarationKind.Import:
                    // TypeScript 1.4 is using the same code to write the name of a type and to write the referenced
                    // name of an import even though it may not be a type.
                    this._setProperty("value", type);
                    break;
                case DeclarationKind.TupleType:
                case DeclarationKind.UnionType:
                    this._addToArray("types", type);
                    break;
                case DeclarationKind.TypeParameter:
                    this._setProperty("constraint", type);
                    break;
                case DeclarationKind.TypeArgumentList:
                case DeclarationKind.TypeParameterList:
                case DeclarationKind.Implements:
                    this._currentState.node.push(type);
                    break;
                case DeclarationKind.Extends:
                    if(Array.isArray(this._currentState.node)) {
                        // interfaces can extend multiple interfaces
                        this._currentState.node.push(type);
                    }
                    else {
                        // classes can only extend a single base class
                        this._setProperty("extends", type);
                    }
                    break;
                case DeclarationKind.TypeReference:
                    this._setProperty("type", type);
                    break;
                default:
                    if(this._isReturnType()) {
                        this._setProperty("returns", type);
                        break;
                    }
                    this._setProperty("type", type);
                    break;
            }

            return type;
        }

        private _isReturnType(): boolean {

            switch(this._currentState.kind) {
                case DeclarationKind.Method:
                case DeclarationKind.MethodSignature:
                case DeclarationKind.Constructor:
                case DeclarationKind.ConstructSignature:
                case DeclarationKind.ConstructorType:
                case DeclarationKind.GetAccessor:
                case DeclarationKind.Function:
                case DeclarationKind.FunctionType:
                case DeclarationKind.CallSignature:
                case DeclarationKind.Index:
                case DeclarationKind.IndexSignature:
                    return true;
            }

            return false;
        }

        private _pushArray(kind: DeclarationKind, name: string): void {

            this._pushState(kind, this._ensureArray(name));
        }

        private _addToArray(name: string, value: any): void {

            this._ensureArray(name).push(value);
        }

        private _ensureArray(name: string): any[] {

            return this._ensureProperty(name, []);
        }

        private _ensureProperty(name: string, value: any): any {

            var ret = this._currentState.node[name];
            if(ret === undefined) {
                ret = this._currentState.node[name] = value;
            }
            return ret;
        }

        private _setProperty(name: string, value: any): void {

            this._currentState.node[name] = value;
        }

        private _pushState(kind: DeclarationKind, node?: any): void {

            this._currentState = {
                parent: this._currentState,
                kind: kind,
                node: node || this._currentState.node
            }
        }
    }

    interface IState {

        parent?: IState;
        kind: DeclarationKind;
        node: any;
        writers?: DeclarationWriter;
    }

    function kindToString(kind: DeclarationKind): string {

        var ret = kindMap[kind];
        if(ret) {
            return ret;
        }

        if(DeclarationKind[kind]) {
            throw new Error("String mapping does not exist for '" + DeclarationKind[kind] + "'");
        }

        throw new Error("Unknown kind '" + kind + "'");
    }

    var kindMap: ts.Map<string> = {};

    kindMap[DeclarationKind.Interface] = "interface";
    kindMap[DeclarationKind.Class] = "class";
    kindMap[DeclarationKind.Enum] = "enum";
    kindMap[DeclarationKind.Module] = "module";
    kindMap[DeclarationKind.Function] = "function";
    kindMap[DeclarationKind.Variable] = "variable";
    kindMap[DeclarationKind.Import] = "import";
    kindMap[DeclarationKind.Index] = "index";
    kindMap[DeclarationKind.Field] = "field";
    kindMap[DeclarationKind.Method] = "method";
    kindMap[DeclarationKind.Constructor] = "constructor";
    kindMap[DeclarationKind.GetAccessor] = "get";
    kindMap[DeclarationKind.SetAccessor] = "set";
    kindMap[DeclarationKind.PropertySignature] = "property";
    kindMap[DeclarationKind.ConstructSignature] = "constructor";
    kindMap[DeclarationKind.MethodSignature] = "method";
    kindMap[DeclarationKind.IndexSignature] = "index";
    kindMap[DeclarationKind.CallSignature] = "call";
    kindMap[DeclarationKind.FunctionType] = "function";
    kindMap[DeclarationKind.ArrayType] = "array";
    kindMap[DeclarationKind.ConstructorType] = "constructor";
    kindMap[DeclarationKind.TupleType] = "tuple";
    kindMap[DeclarationKind.TypeReference] = "reference";
    kindMap[DeclarationKind.ObjectType] = "object";
    kindMap[DeclarationKind.UnionType] = "union";
    kindMap[DeclarationKind.TypeAlias] = "alias";
}