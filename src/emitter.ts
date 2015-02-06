/*! *****************************************************************************
 The source code contained in this file was originally from TypeScript by
 Microsoft. It has been modified by Artifact Health, LLC. The original copyright notice
 is provide below for informational purposes only.

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


 Original Microsoft Copyright Notice:

 Copyright (c) Microsoft Corporation. All rights reserved.
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

/// <reference path="../typings/doctrine.d.ts"/>
/// <reference path="declarationWriter.ts"/>
/// <reference path="annotationValueParser.ts"/>

/// <reference path="types.ts"/>
/// <reference path="core.ts"/>
/// <reference path="scanner.ts"/>
/// <reference path="parser.ts"/>
/// <reference path="binder.ts"/>

var doctrine = require("doctrine");

module ts {

    interface JsDocComment {
        node: Node;
        parseResults: IDoctrineParseResults;
    }

    interface SymbolAccessibilityDiagnostic {
        errorNode: Node;
        diagnosticMessage: DiagnosticMessage;
        typeName?: DeclarationName;
    }
    type GetSymbolAccessibilityDiagnostic = (symbolAccesibilityResult: SymbolAccessiblityResult) => SymbolAccessibilityDiagnostic;

    interface IDeclarationWriterWithDiagnostic extends IDeclarationWriter {
        getSymbolAccessibilityDiagnostic: GetSymbolAccessibilityDiagnostic;
    }

    export function shouldEmitToOwnFile(sourceFile: SourceFile, compilerOptions: CompilerOptions): boolean {
        if (isDeclarationFile(sourceFile)) {
            return (sourceFile.flags & NodeFlags.RootFile) !== 0;
        }

        return (isExternalModule(sourceFile) || !compilerOptions.out) && !fileExtensionIs(sourceFile.filename, ".js");
    }

    export function isExternalModuleOrDeclarationFile(sourceFile: SourceFile) {
        return isExternalModule(sourceFile) || isDeclarationFile(sourceFile);
    }

    function getCommentText(currentSourceFile: SourceFile, node: CommentRange): string {
        return currentSourceFile.text.substring(node.pos, node.end);
    }

    function getFirstConstructorWithBody(node: ClassDeclaration): ConstructorDeclaration {
        return forEach(node.members, member => {
            if (member.kind === SyntaxKind.Constructor && (<ConstructorDeclaration>member).body) {
                return <ConstructorDeclaration>member;
            }
        });
    }

    function getAllAccessorDeclarations(node: ClassDeclaration, accessor: AccessorDeclaration) {
        var firstAccessor: AccessorDeclaration;
        var getAccessor: AccessorDeclaration;
        var setAccessor: AccessorDeclaration;
        if (accessor.name.kind === SyntaxKind.ComputedPropertyName) {
            firstAccessor = accessor;
            if (accessor.kind === SyntaxKind.GetAccessor) {
                getAccessor = accessor;
            }
            else if (accessor.kind === SyntaxKind.SetAccessor) {
                setAccessor = accessor;
            }
            else {
                Debug.fail("Accessor has wrong kind");
            }
        }
        else {
            forEach(node.members,(member: Declaration) => {
                if ((member.kind === SyntaxKind.GetAccessor || member.kind === SyntaxKind.SetAccessor) &&
                    (<Identifier>member.name).text === (<Identifier>accessor.name).text &&
                    (member.flags & NodeFlags.Static) === (accessor.flags & NodeFlags.Static)) {
                    if (!firstAccessor) {
                        firstAccessor = <AccessorDeclaration>member;
                    }

                    if (member.kind === SyntaxKind.GetAccessor && !getAccessor) {
                        getAccessor = <AccessorDeclaration>member;
                    }

                    if (member.kind === SyntaxKind.SetAccessor && !setAccessor) {
                        setAccessor = <AccessorDeclaration>member;
                    }
                }
            });
        }
        return {
            firstAccessor,
            getAccessor,
            setAccessor
        };
    }

    function getSourceFilePathInNewDir(sourceFile: SourceFile, program: Program, newDirPath: string) {
        var compilerHost = program.getCompilerHost();
        var sourceFilePath = getNormalizedAbsolutePath(sourceFile.filename, compilerHost.getCurrentDirectory());
        sourceFilePath = sourceFilePath.replace(program.getCommonSourceDirectory(), "");
        return combinePaths(newDirPath, sourceFilePath);
    }

    function getOwnEmitOutputFilePath(sourceFile: SourceFile, program: Program, extension: string){
        var compilerOptions = program.getCompilerOptions();
        if (compilerOptions.outDir) {
            var emitOutputFilePathWithoutExtension = removeFileExtension(getSourceFilePathInNewDir(sourceFile, program, compilerOptions.outDir));
        }
        else {
            var emitOutputFilePathWithoutExtension = removeFileExtension(sourceFile.filename);
        }

        return emitOutputFilePathWithoutExtension + extension;
    }

    function writeFile(compilerHost: InternalCompilerHost, diagnostics: Diagnostic[], filename: string, data: string, writeByteOrderMark: boolean) {
        compilerHost.writeFile(filename, data, writeByteOrderMark, hostErrorMessage => {
            diagnostics.push(createCompilerDiagnostic(Diagnostics.Could_not_write_file_0_Colon_1, filename, hostErrorMessage));
        });
    }

    function emitDeclarations(program: Program, resolver: EmitResolver, diagnostics: Diagnostic[], jsFilePath: string, root?: SourceFile) {


        var compilerOptions = program.getCompilerOptions();
        var compilerHost = program.getCompilerHost();
        var writer = <IDeclarationWriterWithDiagnostic>resolver.createDeclarationWriter(jsFilePath);

        var enclosingDeclaration: Node;
        var currentSourceFile: SourceFile;
        var reportedDeclarationError = false;

        var emitJsDocComments = compilerOptions.removeComments && compilerOptions.removeAnnotations ?
            function (node: Node) { } : writeJsDocComments;

        var importDeclarationsToRemove: {
            declaration: ImportDeclaration;
            handle: IRemovableModuleElement;
        }[] = [];

        function makeImportsVisible(importDeclarations: ImportDeclaration[]) {
            forEach(importDeclarations, aliasToWrite => {

                for(var i = 0, l = importDeclarationsToRemove.length; i < l; i++) {

                    if(importDeclarationsToRemove[i].declaration == aliasToWrite) {

                        // Alias is now visible so take it off the remove list
                        importDeclarationsToRemove.splice(i, 1);
                        break;
                    }
                }
            });
        }

        function handleSymbolAccessibilityError(symbolAccesibilityResult: SymbolAccessiblityResult) {
            if (symbolAccesibilityResult.accessibility === SymbolAccessibility.Accessible) {

                if (symbolAccesibilityResult && symbolAccesibilityResult.aliasesToMakeVisible) {
                    makeImportsVisible(symbolAccesibilityResult.aliasesToMakeVisible);
                }
            }
            else {
                // Report error
                reportedDeclarationError = true;
                var errorInfo = writer.getSymbolAccessibilityDiagnostic(symbolAccesibilityResult);
                if (errorInfo) {
                    if (errorInfo.typeName) {
                        diagnostics.push(createDiagnosticForNode(symbolAccesibilityResult.errorNode || errorInfo.errorNode,
                            errorInfo.diagnosticMessage,
                            getSourceTextOfNodeFromSourceFile(currentSourceFile, errorInfo.typeName),
                            symbolAccesibilityResult.errorSymbolName,
                            symbolAccesibilityResult.errorModuleName));
                    }
                    else {
                        diagnostics.push(createDiagnosticForNode(symbolAccesibilityResult.errorNode || errorInfo.errorNode,
                            errorInfo.diagnosticMessage,
                            symbolAccesibilityResult.errorSymbolName,
                            symbolAccesibilityResult.errorModuleName));
                    }
                }
            }
        }

        function writeSymbol(symbol: Symbol, enclosingDeclaration?: Node, meaning?: SymbolFlags) {
            var symbolAccesibilityResult = resolver.isSymbolAccessible(symbol, enclosingDeclaration, meaning);
            handleSymbolAccessibilityError(symbolAccesibilityResult);
            if (symbolAccesibilityResult.accessibility === SymbolAccessibility.Accessible) {
                writer.writeTypeReference(resolver.symbolToString(symbol, enclosingDeclaration, meaning));
            }
        }

        function writeTypeOfDeclaration(declaration: AccessorDeclaration | VariableOrParameterDeclaration, type: TypeNode | StringLiteralExpression, getSymbolAccessibilityDiagnostic: GetSymbolAccessibilityDiagnostic) {
            writer.getSymbolAccessibilityDiagnostic = getSymbolAccessibilityDiagnostic;
            if (type) {
                // Write the type
                emitType(type);
            }
            else {
                // Note, this happens when there is not a type specified in the declaration and the type needs to be inferred
                emitTypeOfDeclaration(declaration, enclosingDeclaration, TypeFormatFlags.UseTypeOfFunction, writer);
            }
        }

        function writeReturnTypeAtSignature(signature: SignatureDeclaration, getSymbolAccessibilityDiagnostic: GetSymbolAccessibilityDiagnostic) {
            writer.getSymbolAccessibilityDiagnostic = getSymbolAccessibilityDiagnostic;
            if (signature.type) {
                // Write the type
                emitType(signature.type);
            }
            else {
                // Note, this happens when there is not a return type specified in the declaration and the type needs to be inferred
                emitReturnTypeOfSignatureDeclaration(signature, enclosingDeclaration, TypeFormatFlags.UseTypeOfFunction, writer);
            }
        }

        function emitLines(nodes: Node[]) {
            for (var i = 0, n = nodes.length; i < n; i++) {
                emitNode(nodes[i]);
            }
        }

        function emitSeparatedList(nodes: Node[], separator: string, eachNodeEmitFn: (node: Node) => void) {
            for (var i = 0, n = nodes.length; i < n; i++) {
                eachNodeEmitFn(nodes[i]);
            }
        }

        function emitCommaList(nodes: Node[], eachNodeEmitFn: (node: Node) => void) {
            emitSeparatedList(nodes, ", ", eachNodeEmitFn);
        }

        var paramDescriptions: Map<string> = {};

        function writeJsDocComments(node: Node): void {

            var comment = getJsDocComment(node);
            if (comment) {

                if(!compilerOptions.removeComments) {

                    var description = getJsDocDescription(comment);
                    if (description) {
                        writer.writeDescription(description);
                    }

                    // cache the parameter descriptions for use later by visitParameter
                    paramDescriptions = getJsDocParamDescriptions(comment);
                }

                if(!compilerOptions.removeAnnotations) {
                    var annotations = getJsDocAnnotations(comment);
                    if (annotations) {
                        for (var i = 0, l = annotations.length; i < l; i++) {
                            var annotation = annotations[i];
                            writer.writeAnnotation(annotation.name, annotation.value);
                        }
                    }
                }
            } else {
                // clear the cache
                paramDescriptions = {};
            }
        }

        function hasJsDocComment(declaration: Declaration): boolean {

            if (declaration) {
                var jsDocComments = getJsDocComments(declaration, currentSourceFile);
                if (jsDocComments && jsDocComments.length > 0) {
                    return true;
                }
            }

            return false;
        }

        function getJsDocComment(node: Node): JsDocComment {

            if (node) {
                var jsDocComments = getJsDocComments(node, currentSourceFile);
                if(jsDocComments && jsDocComments.length > 0) {
                    // concat jsdoc comments if there is more than one

                    var comments: string[] = [];
                    for(var i = 0, l = jsDocComments.length; i < l; i++) {
                        comments.push(doctrine.unwrapComment(getCommentText(currentSourceFile, jsDocComments[i])).trim());
                    }

                    var text = comments.join("\n");
                    try {
                        var parseResults = doctrine.parse(text, {unwrap: false});
                    }
                    catch(e) {
                        diagnostics.push(createDiagnosticForNode(node,
                            CustomDiagnostics.Error_parsing_JsDoc_comment_0_1, e.message, text));
                        return;
                    }

                    return {
                        node,
                        parseResults
                    }
                }
            }

            return null;
        }

        function getJsDocDescription(jsDocComment: JsDocComment): string {

            // give priority to the @description tag
            for(var i = 0, l = jsDocComment.parseResults.tags.length; i < l; i++) {

                var tag = jsDocComment.parseResults.tags[i];

                if(tag.title == "description") {
                    return tag.description;
                }
            }

            if(jsDocComment.parseResults.description) {
                return jsDocComment.parseResults.description;
            }

            return null;
        }

        function getJsDocAnnotations(jsDocComment: JsDocComment): any[] {

            var ret: any[] = [];
            var ignoreAnnotation = compilerOptions.ignoreAnnotation || {};

            for(var i = 0, l = jsDocComment.parseResults.tags.length; i < l; i++) {

                var tag = jsDocComment.parseResults.tags[i],
                    name = tag.title;

                if(!hasProperty(ignoreAnnotation, name)) {

                    var value: any = tag.description;
                    if (value === null || value === undefined) {
                        value = true;
                    }
                    else {
                        try {
                            value = parseAnnotationValue(value);
                        }
                        catch (e) {
                            diagnostics.push(createDiagnosticForNode(jsDocComment.node,
                                CustomDiagnostics.Invalid_annotation_value_0, e.message));
                        }
                    }

                    ret.push({ name: name, value: value });
                }
            }

            return ret;
        }

        function getJsDocParamDescriptions(jsDocComment: JsDocComment): Map<string> {

            var map: Map<string> = {};

            // give priority to the @description tag

            for (var i = 0, l = jsDocComment.parseResults.tags.length; i < l; i++) {

                var tag = jsDocComment.parseResults.tags[i];
                if (tag.title == "param") {

                    map[tag.name] = tag.description;
                }
            }

            return map;
        }

        function emitTypeWithNewGetSymbolAccessibilityDiagnostic(type: TypeNode | EntityName, getSymbolAccessibilityDiagnostic: GetSymbolAccessibilityDiagnostic) {
            writer.getSymbolAccessibilityDiagnostic = getSymbolAccessibilityDiagnostic;
            emitType(type);
        }

        function emitType(type: TypeNode | StringLiteralExpression | Identifier | QualifiedName) {
            switch (type.kind) {
                case SyntaxKind.AnyKeyword:
                case SyntaxKind.StringKeyword:
                case SyntaxKind.NumberKeyword:
                case SyntaxKind.BooleanKeyword:
                case SyntaxKind.VoidKeyword:
                case SyntaxKind.StringLiteral:
                    return writer.writeTypeReference(getSourceTextOfNodeFromSourceFile(currentSourceFile, type));
                case SyntaxKind.TypeReference:
                    return emitTypeReference(<TypeReferenceNode>type);
                case SyntaxKind.TypeQuery:
                    return emitTypeQuery(<TypeQueryNode>type);
                case SyntaxKind.ArrayType:
                    return emitArrayType(<ArrayTypeNode>type);
                case SyntaxKind.TupleType:
                    return emitTupleType(<TupleTypeNode>type);
                case SyntaxKind.UnionType:
                    return emitUnionType(<UnionTypeNode>type);
                case SyntaxKind.ParenthesizedType:
                    return emitParenType(<ParenthesizedTypeNode>type);
                case SyntaxKind.FunctionType:
                    return emitFunctionType(<FunctionOrConstructorTypeNode>type);
                case SyntaxKind.ConstructorType:
                    return emitConstructorType(<FunctionOrConstructorTypeNode>type);
                case SyntaxKind.TypeLiteral:
                    return emitTypeLiteral(<TypeLiteralNode>type);
                case SyntaxKind.Identifier:
                    return emitEntityName(<Identifier>type);
                case SyntaxKind.QualifiedName:
                    return emitEntityName(<QualifiedName>type);
                default:
                    Debug.fail("Unknown type annotation: " + type.kind);
            }

            function emitEntityName(entityName: EntityName) {

                var visibilityResult = resolver.isEntityNameVisible(entityName,
                    // Aliases can be written asynchronously so use correct enclosing declaration
                    entityName.parent.kind === SyntaxKind.ImportDeclaration ? entityName.parent : enclosingDeclaration);

                handleSymbolAccessibilityError(visibilityResult);

                var names: string[] = [];
                writeEntityName(names, entityName);
                writer.writeTypeReference(names.join("."));

                function writeEntityName(names: string[], entityName: EntityName) {
                    if (entityName.kind === SyntaxKind.Identifier) {
                        names.push(getSourceTextOfNodeFromSourceFile(currentSourceFile, entityName));
                    }
                    else {
                        var qualifiedName = <QualifiedName>entityName;
                        writeEntityName(names, qualifiedName.left);
                        names.push(getSourceTextOfNodeFromSourceFile(currentSourceFile, qualifiedName.right));
                    }
                }
            }

            function emitTypeReference(type: TypeReferenceNode) {
                if(type.typeArguments) {
                    writer.writeBeginType(DeclarationKind.TypeReference);
                    emitEntityName(type.typeName);
                    if (type.typeArguments) {
                        writer.writeBeginTypeArgumentList();
                        emitCommaList(type.typeArguments, emitType);
                        writer.writeEnd();
                    }
                    writer.writeEnd();
                }
                else {
                    emitEntityName(type.typeName);
                }
            }

            function emitTypeQuery(type: TypeQueryNode) {
                throw new Error("Type query not supported");
            }

            function emitArrayType(type: ArrayTypeNode) {
                writer.writeBeginType(DeclarationKind.ArrayType);
                emitType(type.elementType);
                writer.writeEnd();
            }

            function emitTupleType(type: TupleTypeNode) {
                writer.writeBeginType(DeclarationKind.TupleType);
                emitCommaList(type.elementTypes, emitType);
                writer.writeEnd();
            }

            function emitUnionType(type: UnionTypeNode) {
                writer.writeBeginType(DeclarationKind.UnionType);
                emitSeparatedList(type.types, " | ", emitType);
                writer.writeEnd();
            }

            function emitParenType(type: ParenthesizedTypeNode) {
                emitType(type.type);
            }

            function emitTypeLiteral(type: TypeLiteralNode) {
                writer.writeBeginType(DeclarationKind.ObjectType);
                if (type.members.length) {
                    // write members
                    emitLines(type.members);
                }
                writer.writeEnd();
            }

            function emitFunctionType(node: SignatureDeclaration) {
                writer.writeBeginType(DeclarationKind.FunctionType);
                emitSignatureDeclaration(node);
                writer.writeEnd();
            }

            function emitConstructorType(node: FunctionOrConstructorTypeNode) {
                writer.writeBeginType(DeclarationKind.ConstructorType);
                emitSignatureDeclaration(node);
                writer.writeEnd();
            }
        }

        function emitSourceFile(node: SourceFile) {
            currentSourceFile = node;
            enclosingDeclaration = node;

            emitLines(node.statements);
        }

        function emitExportAssignment(node: ExportAssignment) {

            writer.writeExportAssignment(getSourceTextOfNodeFromSourceFile(currentSourceFile, node.exportName));
        }

        function emitModuleElementDeclarationFlags(node: Node) {
            // If the node is parented in the current source file we need to emit export declare or just export
            if (node.parent === currentSourceFile) {
                // If the node is exported
                if (node.flags & NodeFlags.Export) {
                    writer.writeFlags(DeclarationFlag.Exported);
                }

                if (node.kind !== SyntaxKind.InterfaceDeclaration) {
                    writer.writeFlags(DeclarationFlag.Ambient);
                }
            }
        }

        function emitClassMemberDeclarationFlags(node: Declaration) {
            if (node.flags & NodeFlags.Private) {
                writer.writeFlags(DeclarationFlag.Private);
            }
            else if (node.flags & NodeFlags.Protected) {
                writer.writeFlags(DeclarationFlag.Protected);
            }

            if (node.flags & NodeFlags.Static) {
                writer.writeFlags(DeclarationFlag.Static);
            }
        }

        function emitImportDeclaration(node: ImportDeclaration) {

            // The call to isValidImportDeclaration to ensure that the import points to a valid target. In the
            // TypeScript compiler this is not done because the js emitter would fail before the declaration
            // emitter was ever called. But since we are not calling the js emitter, we need to check here. This
            // is for situations what the target of the import is not a module.
            if (resolver.isValidImportDeclaration(node)) {

                var handle = writeImportDeclaration(node);

                if (!resolver.isDeclarationVisible(node)) {

                    // If the declaration is not visible, write it anyways but then queue it up to be removed
                    // later. If it becomes visible during processing, it will be removed from this list.
                    importDeclarationsToRemove.push({
                        declaration: node,
                        handle: handle
                    });
                }
            }
        }

        function writeImportDeclaration(node: ImportDeclaration): IRemovableModuleElement {
            var handle = writer.writeBeginRemovableModuleElement(DeclarationKind.Import);

            emitName(node);
            if (node.flags & NodeFlags.Export) {
                writer.writeFlags(DeclarationFlag.Exported);
            }

            if (isInternalModuleImportDeclaration(node)) {
                // TODO: FIX!! This should not output a type but the symbol name
                emitTypeWithNewGetSymbolAccessibilityDiagnostic(<EntityName>node.moduleReference, getImportEntityNameVisibilityError);
            }
            else {
                // remove quotes at beginning and ending of module name
                writer.writeRequire(unquoteString(getSourceTextOfNodeFromSourceFile(currentSourceFile, getExternalModuleImportDeclarationExpression(node))));
            }

            writer.writeEnd();

            function getImportEntityNameVisibilityError(symbolAccesibilityResult: SymbolAccessiblityResult): SymbolAccessibilityDiagnostic {
                return {
                    diagnosticMessage: Diagnostics.Import_declaration_0_is_using_private_name_1,
                    errorNode: node,
                    typeName: node.name
                };
            }

            return handle;
        }

        function emitModuleDeclaration(node: ModuleDeclaration) {
            if (resolver.isDeclarationVisible(node)) {

                writer.writeBeginModuleElement(DeclarationKind.Module);

                if(isAmbientExternalModule(node)) {

                    writer.writeName(unquoteString(getSourceTextOfNodeFromSourceFile(currentSourceFile, node.name)))
                    writer.writeFlags(DeclarationFlag.ExternalModule);
                }
                else {

                    var name = getSourceTextOfNodeFromSourceFile(currentSourceFile, node.name);
                    while (node.body.kind !== SyntaxKind.ModuleBlock) {
                        node = <ModuleDeclaration>node.body;
                        name += "." + getSourceTextOfNodeFromSourceFile(currentSourceFile, node.name);
                    }

                    writer.writeName(name);
                }

                emitJsDocComments(node);
                emitModuleElementDeclarationFlags(node);

                var prevEnclosingDeclaration = enclosingDeclaration;
                enclosingDeclaration = node;

                emitLines((<Block>node.body).statements);

                writer.writeEnd();

                enclosingDeclaration = prevEnclosingDeclaration;
            }
        }

        function isAmbientExternalModule(node: ModuleDeclaration): boolean {

            // External module declarations must be ambient so don't both checking the name if it's not ambient
            if(node.flags & NodeFlags.Ambient) {

                // If the name of the module is a string literal then it's external
                return /^"[^"]+"$/.test(getSourceTextOfNodeFromSourceFile(currentSourceFile, node.name));
            }

            return false;
        }

        function unquoteString(str: string): string {
            if(!str) return str;
            return str.replace(/^"|"$/g,"");
        }

        function emitTypeAliasDeclaration(node: TypeAliasDeclaration) {
            if (resolver.isDeclarationVisible(node)) {
                writer.writeBeginModuleElement(DeclarationKind.TypeAlias);
                emitName(node);
                emitJsDocComments(node);
                emitModuleElementDeclarationFlags(node);
                emitTypeWithNewGetSymbolAccessibilityDiagnostic(node.type, getTypeAliasDeclarationVisibilityError);
                writer.writeEnd()
            }
            function getTypeAliasDeclarationVisibilityError(symbolAccesibilityResult: SymbolAccessiblityResult): SymbolAccessibilityDiagnostic {
                return {
                    diagnosticMessage: Diagnostics.Exported_type_alias_0_has_or_is_using_private_name_1,
                    errorNode: node.type,
                    typeName: node.name
                };
            }
        }

        function emitEnumDeclaration(node: EnumDeclaration) {
            if (resolver.isDeclarationVisible(node)) {

                writer.writeBeginModuleElement(DeclarationKind.Enum);

                emitName(node);
                emitModuleElementDeclarationFlags(node);
                emitJsDocComments(node);

                emitLines(node.members);

                writer.writeEnd();
            }
        }

        function emitName(node: Declaration) {

            writer.writeName(getSourceTextOfNodeFromSourceFile(currentSourceFile, node.name));
        }

        function emitEnumMemberDeclaration(node: EnumMember) {

            writer.writeBeginEnumMember();

            emitName(node);
            emitJsDocComments(node);

            var enumMemberValue = resolver.getEnumMemberValue(node);
            if (enumMemberValue !== undefined) {

                writer.writeEnumValue(enumMemberValue);
            }

            writer.writeEnd();
        }

        function emitTypeParameters(typeParameters: TypeParameterDeclaration[]) {
            function emitTypeParameter(node: TypeParameterDeclaration) {
                writer.writeBeginTypeParameter();

                emitName(node);
                emitJsDocComments(node);

                // If there is constraint present and this is not a type parameter of the private method emit the constraint
                if (node.constraint) {

                    if(node.parent.kind !== SyntaxKind.Method || !(node.parent.flags & NodeFlags.Private)) {

                        if (node.parent.kind === SyntaxKind.FunctionType ||
                            node.parent.kind === SyntaxKind.ConstructorType ||
                            (node.parent.parent && node.parent.parent.kind === SyntaxKind.TypeLiteral)) {
                            Debug.assert(node.parent.kind === SyntaxKind.Method ||
                            node.parent.kind === SyntaxKind.FunctionType ||
                            node.parent.kind === SyntaxKind.ConstructorType ||
                            node.parent.kind === SyntaxKind.CallSignature ||
                            node.parent.kind === SyntaxKind.ConstructSignature);
                            emitType(node.constraint);
                        }
                        else {
                            emitTypeWithNewGetSymbolAccessibilityDiagnostic(node.constraint, getTypeParameterConstraintVisibilityError);
                        }
                    }
                    else {
                        // TODO: understand why there is the check above for emitType vs emitTypeWithNewGetSymbolAccessibilityDiagnostic and understand
                        // how that affects typePrivates below
                        if(!compilerOptions.removeTypesOnPrivates) {
                            emitTypeOfDeclarationIfAccessible(node.constraint, enclosingDeclaration, TypeFormatFlags.UseTypeOfFunction, writer);
                        }
                    }
                }

                writer.writeEnd();

                function getTypeParameterConstraintVisibilityError(symbolAccesibilityResult: SymbolAccessiblityResult): SymbolAccessibilityDiagnostic {
                    // Type parameter constraints are named by user so we should always be able to name it
                    var diagnosticMessage: DiagnosticMessage;
                    switch (node.parent.kind) {
                        case SyntaxKind.ClassDeclaration:
                            diagnosticMessage = Diagnostics.Type_parameter_0_of_exported_class_has_or_is_using_private_name_1;
                            break;

                        case SyntaxKind.InterfaceDeclaration:
                            diagnosticMessage = Diagnostics.Type_parameter_0_of_exported_interface_has_or_is_using_private_name_1;
                            break;

                        case SyntaxKind.ConstructSignature:
                            diagnosticMessage = Diagnostics.Type_parameter_0_of_constructor_signature_from_exported_interface_has_or_is_using_private_name_1;
                            break;

                        case SyntaxKind.CallSignature:
                            diagnosticMessage = Diagnostics.Type_parameter_0_of_call_signature_from_exported_interface_has_or_is_using_private_name_1;
                            break;

                        case SyntaxKind.Method:
                            if (node.parent.flags & NodeFlags.Static) {
                                diagnosticMessage = Diagnostics.Type_parameter_0_of_public_static_method_from_exported_class_has_or_is_using_private_name_1;
                            }
                            else if (node.parent.parent.kind === SyntaxKind.ClassDeclaration) {
                                diagnosticMessage = Diagnostics.Type_parameter_0_of_public_method_from_exported_class_has_or_is_using_private_name_1;
                            }
                            else {
                                diagnosticMessage = Diagnostics.Type_parameter_0_of_method_from_exported_interface_has_or_is_using_private_name_1;
                            }
                            break;

                        case SyntaxKind.FunctionDeclaration:
                            diagnosticMessage = Diagnostics.Type_parameter_0_of_exported_function_has_or_is_using_private_name_1;
                            break;

                        default:
                            Debug.fail("This is unknown parent for type parameter: " + node.parent.kind);
                    }

                    return {
                        diagnosticMessage,
                        errorNode: node,
                        typeName: node.name
                    };
                }
            }

            if (typeParameters) {
                writer.writeBeginTypeParameterList();
                emitCommaList(typeParameters, emitTypeParameter);
                writer.writeEnd();
            }
        }

        function emitHeritageClause(typeReferences: TypeReferenceNode[], isImplementsList: boolean) {
            if (typeReferences) {
                if(isImplementsList) {
                    writer.writeBeginImplements();
                }
                else {
                    writer.writeBeginExtends();
                }
                emitCommaList(typeReferences, emitTypeOfTypeReference);
                writer.writeEnd();
            }

            function emitTypeOfTypeReference(node: TypeReferenceNode) {
                emitTypeWithNewGetSymbolAccessibilityDiagnostic(node, getHeritageClauseVisibilityError);

                function getHeritageClauseVisibilityError(symbolAccesibilityResult: SymbolAccessiblityResult): SymbolAccessibilityDiagnostic {
                    var diagnosticMessage: DiagnosticMessage;
                    // Heritage clause is written by user so it can always be named
                    if (node.parent.parent.kind === SyntaxKind.ClassDeclaration) {
                        // Class or Interface implemented/extended is inaccessible
                        diagnosticMessage = isImplementsList ?
                            Diagnostics.Implements_clause_of_exported_class_0_has_or_is_using_private_name_1 :
                            Diagnostics.Extends_clause_of_exported_class_0_has_or_is_using_private_name_1;
                    }
                    else {
                        // interface is inaccessible
                        diagnosticMessage = Diagnostics.Extends_clause_of_exported_interface_0_has_or_is_using_private_name_1;
                    }

                    return {
                        diagnosticMessage,
                        errorNode: node,
                        typeName: (<Declaration>node.parent.parent).name
                    };
                }
            }
        }

        function emitClassDeclaration(node: ClassDeclaration) {
            function emitParameterProperties(constructorDeclaration: ConstructorDeclaration) {
                if (constructorDeclaration) {

                    var jsDocComment = getJsDocComment(constructorDeclaration);

                    if(jsDocComment) {
                        var paramDescriptions = getJsDocParamDescriptions(jsDocComment);
                    }

                    forEach(constructorDeclaration.parameters, param => {
                        if (param.flags & NodeFlags.AccessibilityModifier) {

                            emitPropertyDeclaration(param, paramDescriptions ? paramDescriptions[getSourceTextOfNodeFromSourceFile(currentSourceFile, param.name)] : null);
                        }
                    });
                }
            }

            if (resolver.isDeclarationVisible(node)) {

                writer.writeBeginModuleElement(DeclarationKind.Class);

                emitName(node);
                emitJsDocComments(node);
                emitModuleElementDeclarationFlags(node);

                var prevEnclosingDeclaration = enclosingDeclaration;
                enclosingDeclaration = node;

                emitTypeParameters(node.typeParameters);
                var baseTypeNode = getClassBaseTypeNode(node);
                if (baseTypeNode) {
                    emitHeritageClause([baseTypeNode], /*isImplementsList*/ false);
                }

                emitHeritageClause(getClassImplementedTypeNodes(node), /*isImplementsList*/ true);
                emitParameterProperties(getFirstConstructorWithBody(node));
                emitLines(node.members);

                enclosingDeclaration = prevEnclosingDeclaration;

                writer.writeEnd();
            }
        }

        function emitInterfaceDeclaration(node: InterfaceDeclaration) {
            if (resolver.isDeclarationVisible(node)) {

                writer.writeBeginModuleElement(DeclarationKind.Interface);

                emitName(node);
                emitJsDocComments(node);
                emitModuleElementDeclarationFlags(node);

                var prevEnclosingDeclaration = enclosingDeclaration;
                enclosingDeclaration = node;

                emitTypeParameters(node.typeParameters);
                emitHeritageClause(getInterfaceBaseTypeNodes(node), /*isImplementsList*/ false);
                emitLines(node.members);

                enclosingDeclaration = prevEnclosingDeclaration;

                writer.writeEnd();
            }
        }

        function emitPropertyDeclaration(node: Declaration, description?: string) {


            if(node.parent.kind == SyntaxKind.ClassDeclaration || node.parent.kind == SyntaxKind.Constructor) {

                if((node.flags & NodeFlags.Private) && compilerOptions.removePrivates) {
                    return;
                }

                writer.writeBeginClassMember(DeclarationKind.Field);
            }
            else {

                writer.writeBeginSignature(DeclarationKind.PropertySignature);
            }

            emitVariableDeclaration(<VariableDeclaration>node);
            emitClassMemberDeclarationFlags(node);

            // Use the description if provided; otherwise, check the doc comments
            if(description) {
                writer.writeDescription(description);
            }
            else {
                emitJsDocComments(node);
            }

            writer.writeEnd();
        }

        // TODO(jfreeman): Factor out common part of property definition, but treat name differently
        function emitVariableDeclaration(node: VariableDeclaration) {
            // If we are emitting property it isn't moduleElement and hence we already know it needs to be emitted
            // so there is no check needed to see if declaration is visible
            if (node.kind !== SyntaxKind.VariableDeclaration || resolver.isDeclarationVisible(node)) {

                emitName(node);
                // If optional property emit ?
                if (node.kind === SyntaxKind.Property && hasQuestionToken(node)) {
                    writer.writeFlags(DeclarationFlag.Optional);
                }
                if (node.kind === SyntaxKind.Property && node.parent.kind === SyntaxKind.TypeLiteral) {
                    emitTypeOfVariableDeclarationFromTypeLiteral(node);
                }
                else if (!(node.flags & NodeFlags.Private)) {
                    writeTypeOfDeclaration(node, node.type, getVariableDeclarationTypeVisibilityError);
                }
                else {
                    if(!compilerOptions.removeTypesOnPrivates) {
                        emitTypeOfDeclarationIfAccessible(node, enclosingDeclaration, TypeFormatFlags.UseTypeOfFunction, writer);
                    }
                }
            }

            function getVariableDeclarationTypeVisibilityError(symbolAccesibilityResult: SymbolAccessiblityResult): SymbolAccessibilityDiagnostic {
                var diagnosticMessage: DiagnosticMessage;
                if (node.kind === SyntaxKind.VariableDeclaration) {
                    diagnosticMessage = symbolAccesibilityResult.errorModuleName ?
                        symbolAccesibilityResult.accessibility === SymbolAccessibility.CannotBeNamed ?
                            Diagnostics.Exported_variable_0_has_or_is_using_name_1_from_external_module_2_but_cannot_be_named :
                            Diagnostics.Exported_variable_0_has_or_is_using_name_1_from_private_module_2 :
                        Diagnostics.Exported_variable_0_has_or_is_using_private_name_1;
                }
                // This check is to ensure we don't report error on constructor parameter property as that error would be reported during parameter emit
                else if (node.kind === SyntaxKind.Property) {
                    // TODO(jfreeman): Deal with computed properties in error reporting.
                    if (node.flags & NodeFlags.Static) {
                        diagnosticMessage = symbolAccesibilityResult.errorModuleName ?
                            symbolAccesibilityResult.accessibility === SymbolAccessibility.CannotBeNamed ?
                                Diagnostics.Public_static_property_0_of_exported_class_has_or_is_using_name_1_from_external_module_2_but_cannot_be_named :
                                Diagnostics.Public_static_property_0_of_exported_class_has_or_is_using_name_1_from_private_module_2 :
                            Diagnostics.Public_static_property_0_of_exported_class_has_or_is_using_private_name_1;
                    }
                    else if (node.parent.kind === SyntaxKind.ClassDeclaration) {
                        diagnosticMessage = symbolAccesibilityResult.errorModuleName ?
                            symbolAccesibilityResult.accessibility === SymbolAccessibility.CannotBeNamed ?
                                Diagnostics.Public_property_0_of_exported_class_has_or_is_using_name_1_from_external_module_2_but_cannot_be_named :
                                Diagnostics.Public_property_0_of_exported_class_has_or_is_using_name_1_from_private_module_2 :
                            Diagnostics.Public_property_0_of_exported_class_has_or_is_using_private_name_1;
                    }
                    else {
                        // Interfaces cannot have types that cannot be named
                        diagnosticMessage = symbolAccesibilityResult.errorModuleName ?
                            Diagnostics.Property_0_of_exported_interface_has_or_is_using_name_1_from_private_module_2 :
                            Diagnostics.Property_0_of_exported_interface_has_or_is_using_private_name_1;
                    }
                }

                return diagnosticMessage !== undefined ? {
                    diagnosticMessage,
                    errorNode: node,
                    typeName: node.name
                } : undefined;
            }
        }

        function emitTypeOfVariableDeclarationFromTypeLiteral(node: VariableOrParameterDeclaration) {
            // if this is property of type literal,
            // or is parameter of method/call/construct/index signature of type literal
            // emit only if type is specified
            if (node.type) {
                emitType(node.type);
            }
        }

        function emitVariableStatement(node: VariableStatement) {
            var hasDeclarationWithEmit = forEach(node.declarations, varDeclaration => resolver.isDeclarationVisible(varDeclaration));
            if (hasDeclarationWithEmit) {

                var declarations = node.declarations;
                for (var i = 0, n = declarations.length; i < n; i++) {

                    var declaration = declarations[i];

                    if (isLet(node)) {
                        writer.writeBeginModuleElement(DeclarationKind.Let);
                    }
                    else if (isConst(node)) {
                        writer.writeBeginModuleElement(DeclarationKind.Constant);
                    }
                    else {
                        writer.writeBeginModuleElement(DeclarationKind.Variable);
                    }

                    // For the first variable in the statement, use the comment on the statement declaration
                    // if one is not found on the variable declaration
                    emitJsDocComments(i == 0 && !hasJsDocComment(declaration) ? node : declaration);
                    emitModuleElementDeclarationFlags(node);

                    emitVariableDeclaration(declaration);

                    writer.writeEnd();
                }
            }
        }

        function emitAccessorDeclaration(node: AccessorDeclaration) {

            if((node.flags & NodeFlags.Private) && compilerOptions.removePrivates) {
                return;
            }

            if(!compilerOptions.removeAccessors) {
                // TODO: verify this is correct
                writer.writeBeginClassMember(node.kind === SyntaxKind.GetAccessor ?
                    DeclarationKind.GetAccessor : DeclarationKind.SetAccessor);
                emitName(node);
                emitClassMemberDeclarationFlags(node);
                emitJsDocComments(node);
                emitSignatureDeclaration(node);
                writer.writeEnd();
            }
            else {
                var accessors = getAllAccessorDeclarations(<ClassDeclaration>node.parent, node);
                if (node === accessors.firstAccessor) {

                    writer.writeBeginClassMember(DeclarationKind.Field);
                    emitName(node);
                    emitClassMemberDeclarationFlags(node);
                    emitJsDocComments(accessors.firstAccessor);
                    var accessorWithTypeAnnotation: AccessorDeclaration = node;
                    var type = getTypeAnnotationFromAccessor(node);
                    if (!type) {
                        // couldn't get type for the first accessor, try the another one
                        var anotherAccessor = node.kind === SyntaxKind.GetAccessor ? accessors.setAccessor : accessors.getAccessor;
                        type = getTypeAnnotationFromAccessor(anotherAccessor);
                        if (type) {
                            accessorWithTypeAnnotation = anotherAccessor;
                        }
                    }
                    if (!(node.flags & NodeFlags.Private)) {
                        writeTypeOfDeclaration(node, type, getAccessorDeclarationTypeVisibilityError);
                    }
                    else {
                        if(!compilerOptions.removeTypesOnPrivates) {
                            emitTypeOfDeclarationIfAccessible(node, enclosingDeclaration, TypeFormatFlags.UseTypeOfFunction, writer);
                        }
                    }
                    writer.writeEnd();
                }
            }

            function getTypeAnnotationFromAccessor(accessor: AccessorDeclaration): TypeNode | StringLiteralExpression {
                if (accessor) {
                    return accessor.kind === SyntaxKind.GetAccessor
                        ? accessor.type // Getter - return type
                        : accessor.parameters[0].type; // Setter parameter type
                }
            }

            function getAccessorDeclarationTypeVisibilityError(symbolAccesibilityResult: SymbolAccessiblityResult): SymbolAccessibilityDiagnostic {
                var diagnosticMessage: DiagnosticMessage;
                if (accessorWithTypeAnnotation.kind === SyntaxKind.SetAccessor) {
                    // Setters have to have type named and cannot infer it so, the type should always be named
                    if (accessorWithTypeAnnotation.parent.flags & NodeFlags.Static) {
                        diagnosticMessage = symbolAccesibilityResult.errorModuleName ?
                            Diagnostics.Parameter_0_of_public_static_property_setter_from_exported_class_has_or_is_using_name_1_from_private_module_2 :
                            Diagnostics.Parameter_0_of_public_static_property_setter_from_exported_class_has_or_is_using_private_name_1;
                    }
                    else {
                        diagnosticMessage = symbolAccesibilityResult.errorModuleName ?
                            Diagnostics.Parameter_0_of_public_property_setter_from_exported_class_has_or_is_using_name_1_from_private_module_2 :
                            Diagnostics.Parameter_0_of_public_property_setter_from_exported_class_has_or_is_using_private_name_1;
                    }
                    return {
                        diagnosticMessage,
                        errorNode: <Node>accessorWithTypeAnnotation.parameters[0],
                        // TODO(jfreeman): Investigate why we are passing node.name instead of node.parameters[0].name
                        typeName: accessorWithTypeAnnotation.name
                    };
                }
                else {
                    if (accessorWithTypeAnnotation.flags & NodeFlags.Static) {
                        diagnosticMessage = symbolAccesibilityResult.errorModuleName ?
                            symbolAccesibilityResult.accessibility === SymbolAccessibility.CannotBeNamed ?
                                Diagnostics.Return_type_of_public_static_property_getter_from_exported_class_has_or_is_using_name_0_from_external_module_1_but_cannot_be_named :
                                Diagnostics.Return_type_of_public_static_property_getter_from_exported_class_has_or_is_using_name_0_from_private_module_1 :
                            Diagnostics.Return_type_of_public_static_property_getter_from_exported_class_has_or_is_using_private_name_0;
                    }
                    else {
                        diagnosticMessage = symbolAccesibilityResult.errorModuleName ?
                            symbolAccesibilityResult.accessibility === SymbolAccessibility.CannotBeNamed ?
                                Diagnostics.Return_type_of_public_property_getter_from_exported_class_has_or_is_using_name_0_from_external_module_1_but_cannot_be_named :
                                Diagnostics.Return_type_of_public_property_getter_from_exported_class_has_or_is_using_name_0_from_private_module_1 :
                            Diagnostics.Return_type_of_public_property_getter_from_exported_class_has_or_is_using_private_name_0;
                    }
                    return {
                        diagnosticMessage,
                        errorNode: <Node>accessorWithTypeAnnotation.name,
                        typeName: undefined
                    };
                }
            }
        }

        function emitFunctionDeclaration(node: FunctionLikeDeclaration) {
            // If we are emitting Method/Constructor it isn't moduleElement and hence already determined to be emitting
            // so no need to verify if the declaration is visible
            if ((node.kind !== SyntaxKind.FunctionDeclaration || resolver.isDeclarationVisible(node)) &&
                !resolver.isImplementationOfOverload(node)) {

                // only emit declaration for first private member
                if(node.flags & NodeFlags.Private) {

                    if(compilerOptions.removePrivates) {
                        return;
                    }

                    if(compilerOptions.removeTypesOnPrivates) {
                        var signatures = resolver.getSignaturesOfSymbol(resolver.getSymbolOfNode(node));
                        if (signatures[0].declaration !== node) {
                            return;
                        }
                    }
                }

                if (node.kind === SyntaxKind.FunctionDeclaration) {
                    writer.writeBeginModuleElement(DeclarationKind.Function);
                    emitName(node);
                }
                else if (node.kind === SyntaxKind.Constructor) {
                    writer.writeBeginClassMember(DeclarationKind.Constructor);
                }
                else {
                    if(node.parent.kind == SyntaxKind.ClassDeclaration) {

                        writer.writeBeginClassMember(DeclarationKind.Method);
                    }
                    else {

                        writer.writeBeginSignature(DeclarationKind.MethodSignature);
                    }

                    emitName(node);
                    if (hasQuestionToken(node)) {
                        writer.writeFlags(DeclarationFlag.Optional);
                    }
                }
                emitJsDocComments(node);
                if (node.kind === SyntaxKind.FunctionDeclaration) {
                    emitModuleElementDeclarationFlags(node);
                }
                else if (node.kind === SyntaxKind.Method) {
                    emitClassMemberDeclarationFlags(node);
                }
                emitSignatureDeclaration(node);

                writer.writeEnd();
            }
        }

        function emitConstructSignatureDeclaration(node: SignatureDeclaration) {

            writer.writeBeginSignature(DeclarationKind.ConstructSignature);
            emitJsDocComments(node);
            emitSignatureDeclaration(node);
            writer.writeEnd();
        }

        function emitCallSignatureDeclaration(node: SignatureDeclaration) {

            writer.writeBeginSignature(DeclarationKind.CallSignature);
            emitJsDocComments(node);
            emitSignatureDeclaration(node);
            writer.writeEnd();
        }

        function emitIndexSignatureDeclaration(node: SignatureDeclaration) {

            if(node.parent.kind == SyntaxKind.ClassDeclaration) {

                writer.writeBeginClassMember(DeclarationKind.Index);
            }
            else {
                writer.writeBeginSignature(DeclarationKind.IndexSignature);
            }

            emitJsDocComments(node);
            emitSignatureDeclaration(node);
            writer.writeEnd();
        }

        function emitSignatureDeclaration(node: SignatureDeclaration) {

            emitTypeParameters(node.typeParameters);

            var hasParamList = false;
            if(node.kind != SyntaxKind.IndexSignature && node.kind != SyntaxKind.SetAccessor && node.parameters.length > 0) {
                writer.writeBeginParameterList();
                hasParamList = true;
            }

            var prevEnclosingDeclaration = enclosingDeclaration;
            enclosingDeclaration = node;

            // Parameters
            emitCommaList(node.parameters, emitParameterDeclaration);

            if(hasParamList) {
                writer.writeEnd();
            }

            // If this is not a constructor and is not private, emit the return type
            var isFunctionTypeOrConstructorType = node.kind === SyntaxKind.FunctionType || node.kind === SyntaxKind.ConstructorType;
            if (isFunctionTypeOrConstructorType || node.parent.kind === SyntaxKind.TypeLiteral) {
                // Emit type literal signature return type only if specified
                if (node.type) {
                    emitType(node.type);
                }
            }
            else if (node.kind !== SyntaxKind.Constructor && node.kind !== SyntaxKind.SetAccessor) {
                if(!(node.flags & NodeFlags.Private)) {
                    writeReturnTypeAtSignature(node, getReturnTypeVisibilityError);
                }
                else {
                    if(!compilerOptions.removeTypesOnPrivates) {
                        emitReturnTypeOfSignatureDeclarationIfAccessible(node, enclosingDeclaration, TypeFormatFlags.UseTypeOfFunction, writer);
                    }
                }
            }

            enclosingDeclaration = prevEnclosingDeclaration;

            function getReturnTypeVisibilityError(symbolAccesibilityResult: SymbolAccessiblityResult): SymbolAccessibilityDiagnostic {
                var diagnosticMessage: DiagnosticMessage;
                switch (node.kind) {
                    case SyntaxKind.ConstructSignature:
                        // Interfaces cannot have return types that cannot be named
                        diagnosticMessage = symbolAccesibilityResult.errorModuleName ?
                            Diagnostics.Return_type_of_constructor_signature_from_exported_interface_has_or_is_using_name_0_from_private_module_1 :
                            Diagnostics.Return_type_of_constructor_signature_from_exported_interface_has_or_is_using_private_name_0;
                        break;

                    case SyntaxKind.CallSignature:
                        // Interfaces cannot have return types that cannot be named
                        diagnosticMessage = symbolAccesibilityResult.errorModuleName ?
                            Diagnostics.Return_type_of_call_signature_from_exported_interface_has_or_is_using_name_0_from_private_module_1 :
                            Diagnostics.Return_type_of_call_signature_from_exported_interface_has_or_is_using_private_name_0;
                        break;

                    case SyntaxKind.IndexSignature:
                        // Interfaces cannot have return types that cannot be named
                        diagnosticMessage = symbolAccesibilityResult.errorModuleName ?
                            Diagnostics.Return_type_of_index_signature_from_exported_interface_has_or_is_using_name_0_from_private_module_1 :
                            Diagnostics.Return_type_of_index_signature_from_exported_interface_has_or_is_using_private_name_0;
                        break;

                    case SyntaxKind.Method:
                        if (node.flags & NodeFlags.Static) {
                            diagnosticMessage = symbolAccesibilityResult.errorModuleName ?
                                symbolAccesibilityResult.accessibility === SymbolAccessibility.CannotBeNamed ?
                                    Diagnostics.Return_type_of_public_static_method_from_exported_class_has_or_is_using_name_0_from_external_module_1_but_cannot_be_named :
                                    Diagnostics.Return_type_of_public_static_method_from_exported_class_has_or_is_using_name_0_from_private_module_1 :
                                Diagnostics.Return_type_of_public_static_method_from_exported_class_has_or_is_using_private_name_0;
                        }
                        else if (node.parent.kind === SyntaxKind.ClassDeclaration) {
                            diagnosticMessage = symbolAccesibilityResult.errorModuleName ?
                                symbolAccesibilityResult.accessibility === SymbolAccessibility.CannotBeNamed ?
                                    Diagnostics.Return_type_of_public_method_from_exported_class_has_or_is_using_name_0_from_external_module_1_but_cannot_be_named :
                                    Diagnostics.Return_type_of_public_method_from_exported_class_has_or_is_using_name_0_from_private_module_1 :
                                Diagnostics.Return_type_of_public_method_from_exported_class_has_or_is_using_private_name_0;
                        }
                        else {
                            // Interfaces cannot have return types that cannot be named
                            diagnosticMessage = symbolAccesibilityResult.errorModuleName ?
                                Diagnostics.Return_type_of_method_from_exported_interface_has_or_is_using_name_0_from_private_module_1 :
                                Diagnostics.Return_type_of_method_from_exported_interface_has_or_is_using_private_name_0;
                        }
                        break;

                    case SyntaxKind.FunctionDeclaration:
                        diagnosticMessage = symbolAccesibilityResult.errorModuleName ?
                            symbolAccesibilityResult.accessibility === SymbolAccessibility.CannotBeNamed ?
                                Diagnostics.Return_type_of_exported_function_has_or_is_using_name_0_from_external_module_1_but_cannot_be_named :
                                Diagnostics.Return_type_of_exported_function_has_or_is_using_name_0_from_private_module_1 :
                            Diagnostics.Return_type_of_exported_function_has_or_is_using_private_name_0;
                        break;

                    default:
                        Debug.fail("This is unknown kind for signature: " + node.kind);
                }

                return {
                    diagnosticMessage,
                    errorNode: <Node>node.name || node,
                };
            }
        }

        function emitParameterDeclaration(node: ParameterDeclaration) {

            writer.writeBeginParameter();

            emitName(node);

            // See if the method jsdoc comments defined the description for the parameter
            var description = paramDescriptions[getSourceTextOfNodeFromSourceFile(currentSourceFile, node.name)];
            if(description) {
                writer.writeDescription(description);
            }
            else {
                emitJsDocComments(node);
            }

            if (node.dotDotDotToken) {
                writer.writeFlags(DeclarationFlag.RestParameter);
            }

            if (node.initializer || hasQuestionToken(node)) {
                writer.writeFlags(DeclarationFlag.Optional);
            }

            if (node.parent.kind === SyntaxKind.FunctionType ||
                node.parent.kind === SyntaxKind.ConstructorType ||
                node.parent.parent.kind === SyntaxKind.TypeLiteral) {
                emitTypeOfVariableDeclarationFromTypeLiteral(node);
            }
            else if (!(node.parent.flags & NodeFlags.Private)) {
                writeTypeOfDeclaration(node, node.type, getParameterDeclarationTypeVisibilityError);
            }
            else {
                if(!compilerOptions.removeTypesOnPrivates) {
                    emitTypeOfDeclarationIfAccessible(node, enclosingDeclaration, TypeFormatFlags.UseTypeOfFunction, writer);
                }
            }

            writer.writeEnd(); // Parameter

            function getParameterDeclarationTypeVisibilityError(symbolAccesibilityResult: SymbolAccessiblityResult): SymbolAccessibilityDiagnostic {
                var diagnosticMessage: DiagnosticMessage;
                switch (node.parent.kind) {
                    case SyntaxKind.Constructor:
                        diagnosticMessage = symbolAccesibilityResult.errorModuleName ?
                            symbolAccesibilityResult.accessibility === SymbolAccessibility.CannotBeNamed ?
                                Diagnostics.Parameter_0_of_constructor_from_exported_class_has_or_is_using_name_1_from_external_module_2_but_cannot_be_named :
                                Diagnostics.Parameter_0_of_constructor_from_exported_class_has_or_is_using_name_1_from_private_module_2 :
                            Diagnostics.Parameter_0_of_constructor_from_exported_class_has_or_is_using_private_name_1;
                        break;

                    case SyntaxKind.ConstructSignature:
                        // Interfaces cannot have parameter types that cannot be named
                        diagnosticMessage = symbolAccesibilityResult.errorModuleName ?
                            Diagnostics.Parameter_0_of_constructor_signature_from_exported_interface_has_or_is_using_name_1_from_private_module_2 :
                            Diagnostics.Parameter_0_of_constructor_signature_from_exported_interface_has_or_is_using_private_name_1;
                        break;

                    case SyntaxKind.CallSignature:
                        // Interfaces cannot have parameter types that cannot be named
                        diagnosticMessage = symbolAccesibilityResult.errorModuleName ?
                            Diagnostics.Parameter_0_of_call_signature_from_exported_interface_has_or_is_using_name_1_from_private_module_2 :
                            Diagnostics.Parameter_0_of_call_signature_from_exported_interface_has_or_is_using_private_name_1;
                        break;

                    case SyntaxKind.Method:
                        if (node.parent.flags & NodeFlags.Static) {
                            diagnosticMessage = symbolAccesibilityResult.errorModuleName ?
                                symbolAccesibilityResult.accessibility === SymbolAccessibility.CannotBeNamed ?
                                    Diagnostics.Parameter_0_of_public_static_method_from_exported_class_has_or_is_using_name_1_from_external_module_2_but_cannot_be_named :
                                    Diagnostics.Parameter_0_of_public_static_method_from_exported_class_has_or_is_using_name_1_from_private_module_2 :
                                Diagnostics.Parameter_0_of_public_static_method_from_exported_class_has_or_is_using_private_name_1;
                        }
                        else if (node.parent.parent.kind === SyntaxKind.ClassDeclaration) {
                            diagnosticMessage = symbolAccesibilityResult.errorModuleName ?
                                symbolAccesibilityResult.accessibility === SymbolAccessibility.CannotBeNamed ?
                                    Diagnostics.Parameter_0_of_public_method_from_exported_class_has_or_is_using_name_1_from_external_module_2_but_cannot_be_named :
                                    Diagnostics.Parameter_0_of_public_method_from_exported_class_has_or_is_using_name_1_from_private_module_2 :
                                Diagnostics.Parameter_0_of_public_method_from_exported_class_has_or_is_using_private_name_1;
                        }
                        else {
                            // Interfaces cannot have parameter types that cannot be named
                            diagnosticMessage = symbolAccesibilityResult.errorModuleName ?
                                Diagnostics.Parameter_0_of_method_from_exported_interface_has_or_is_using_name_1_from_private_module_2 :
                                Diagnostics.Parameter_0_of_method_from_exported_interface_has_or_is_using_private_name_1;
                        }
                        break;

                    case SyntaxKind.FunctionDeclaration:
                        diagnosticMessage = symbolAccesibilityResult.errorModuleName ?
                            symbolAccesibilityResult.accessibility === SymbolAccessibility.CannotBeNamed ?
                                Diagnostics.Parameter_0_of_exported_function_has_or_is_using_name_1_from_external_module_2_but_cannot_be_named :
                                Diagnostics.Parameter_0_of_exported_function_has_or_is_using_name_1_from_private_module_2 :
                            Diagnostics.Parameter_0_of_exported_function_has_or_is_using_private_name_1;
                        break;

                    default:
                        Debug.fail("This is unknown parent for parameter: " + node.parent.kind);
                }

                return {
                    diagnosticMessage: diagnosticMessage,
                    errorNode: node,
                    typeName: node.name
                };
            }
        }

        function emitNode(node: Node) {
            switch (node.kind) {
                case SyntaxKind.Constructor:
                case SyntaxKind.FunctionDeclaration:
                case SyntaxKind.Method:
                    return emitFunctionDeclaration(<FunctionLikeDeclaration>node);
                case SyntaxKind.ConstructSignature:
                    return emitConstructSignatureDeclaration(<SignatureDeclaration>node);
                case SyntaxKind.CallSignature:
                    return emitCallSignatureDeclaration(<SignatureDeclaration>node);
                case SyntaxKind.IndexSignature:
                    return emitIndexSignatureDeclaration(<SignatureDeclaration>node);
                case SyntaxKind.GetAccessor:
                case SyntaxKind.SetAccessor:
                    return emitAccessorDeclaration(<AccessorDeclaration>node);
                case SyntaxKind.VariableStatement:
                    return emitVariableStatement(<VariableStatement>node);
                case SyntaxKind.Property:
                    return emitPropertyDeclaration(<PropertyDeclaration>node);
                case SyntaxKind.InterfaceDeclaration:
                    return emitInterfaceDeclaration(<InterfaceDeclaration>node);
                case SyntaxKind.ClassDeclaration:
                    return emitClassDeclaration(<ClassDeclaration>node);
                case SyntaxKind.TypeAliasDeclaration:
                    return emitTypeAliasDeclaration(<TypeAliasDeclaration>node);
                case SyntaxKind.EnumMember:
                    return emitEnumMemberDeclaration(<EnumMember>node);
                case SyntaxKind.EnumDeclaration:
                    return emitEnumDeclaration(<EnumDeclaration>node);
                case SyntaxKind.ModuleDeclaration:
                    return emitModuleDeclaration(<ModuleDeclaration>node);
                case SyntaxKind.ImportDeclaration:
                    return emitImportDeclaration(<ImportDeclaration>node);
                case SyntaxKind.ExportAssignment:
                    return emitExportAssignment(<ExportAssignment>node);
                case SyntaxKind.SourceFile:
                    return emitSourceFile(<SourceFile>node);
            }
        }

        function writeReferencePath(referencedFile: SourceFile) {
            var declFileName: string;

            if(referencedFile.flags & NodeFlags.DeclarationFile) {
                // declaration file

                declFileName = getOwnEmitOutputFilePath(referencedFile, program, ".d.json");
            }
            else {
                declFileName = shouldEmitToOwnFile(referencedFile, compilerOptions)
                    ? getOwnEmitOutputFilePath(referencedFile, program, ".d.json") // Own output file so get the .d.ts file
                    : removeFileExtension(compilerOptions.out) + ".d.json";// Global out file
            }

            declFileName = getRelativePathToDirectoryOrUrl(
                getDirectoryPath(normalizeSlashes(jsFilePath)),
                declFileName,
                compilerHost.getCurrentDirectory(),
                compilerHost.getCanonicalFileName,
                /*isAbsolutePathAnUrl*/ false);

            writer.writeReference(declFileName);
        }

        if (root) {
            if(root.hasNoDefaultLib) {
                writer.writeFlags(DeclarationFlag.HasNoDefaultLib);
            }

            // Emitting just a single file, so emit references in this file only
            if (!compilerOptions.noResolve) {
                var addedGlobalFileReference = false;
                forEach(root.referencedFiles, fileReference => {
                    var referencedFile = tryResolveScriptReference(program, root, fileReference);

                    // All the references that are not going to be part of same file
                    if (referencedFile && ((referencedFile.flags & NodeFlags.DeclarationFile) || // This is a declare file reference
                        shouldEmitToOwnFile(referencedFile, compilerOptions) || // This is referenced file is emitting its own js file
                        !addedGlobalFileReference)) { // Or the global out file corresponding to this reference was not added

                        writeReferencePath(referencedFile);
                        if (!isExternalModuleOrDeclarationFile(referencedFile)) {
                            addedGlobalFileReference = true;
                        }
                    }
                });
            }

            // We need a flag to indicate this is an external module since we don't emit "export" flags for
            // anything but import declarations
            if(isExternalModule(root)) {
                writer.writeFlags(DeclarationFlag.ExternalModule);
            }

            emitNode(root);
        }
        else {
            // --out option specified
            if(forEach(program.getSourceFiles(), sourceFile => sourceFile.hasNoDefaultLib && !isExternalModuleOrDeclarationFile(sourceFile))) {
                writer.writeFlags(DeclarationFlag.HasNoDefaultLib);
            }

            // Emit references corresponding to this file
            var emittedReferencedFiles: SourceFile[] = [];
            forEach(program.getSourceFiles(), sourceFile => {
                if (!isExternalModuleOrDeclarationFile(sourceFile)) {
                    // Check what references need to be added
                    if (!compilerOptions.noResolve) {
                        forEach(sourceFile.referencedFiles, fileReference => {
                            var referencedFile = tryResolveScriptReference(program, sourceFile, fileReference);

                            // If the reference file is a declaration file or an external module, emit that reference
                            if (referencedFile && (isExternalModuleOrDeclarationFile(referencedFile) &&
                                !contains(emittedReferencedFiles, referencedFile))) { // If the file reference was not already emitted

                                writeReferencePath(referencedFile);
                                emittedReferencedFiles.push(referencedFile);
                            }
                        });
                    }

                    emitNode(sourceFile);
                }
            });
        }

        // cleanup any import declarations that need to be removed
        forEach(importDeclarationsToRemove, importInfo => {

            importInfo.handle.remove();
        });

        if (!reportedDeclarationError) {

            // TODO: Don't emit output if any file has an error
            var writerDiagnostics = writer.close();
            if(writerDiagnostics) {
                diagnostics = diagnostics.concat(writerDiagnostics);
            }
        }

        function emitTypeOfDeclarationIfAccessible(declaration: Node, enclosingDeclaration: Node, flags: TypeFormatFlags, writer: IDeclarationWriter) {

            var type = getTypeForDeclaration(declaration);
            if(isTypeAccessible(type, enclosingDeclaration)) {
                buildTypeDisplay(type, writer, enclosingDeclaration, flags);
            }
        }

        function emitReturnTypeOfSignatureDeclarationIfAccessible(signatureDeclaration: SignatureDeclaration, enclosingDeclaration: Node, flags: TypeFormatFlags, writer: IDeclarationWriter) {
            var signature = resolver.getSignatureFromDeclaration(signatureDeclaration);
            var type = resolver.getReturnTypeOfSignature(signature);
            if(isTypeAccessible(type, enclosingDeclaration)) {
                buildTypeDisplay(type, writer, enclosingDeclaration, flags);
            }
        }

        function isTypeAccessible(type: Type, enclosingDeclaration: Node): boolean {

            if(type && !(type.flags & TypeFlags.Anonymous)) {
                var symbolAccesibilityResult = resolver.isSymbolAccessible(type.symbol, enclosingDeclaration, SymbolFlags.Type);
                if (symbolAccesibilityResult.accessibility !== SymbolAccessibility.Accessible) {
                    return false;
                }
            }

            return true;
        }

        function getTypeForDeclaration(declaration: Node): Type {
            // Get type of the symbol if this is the valid symbol otherwise get type at location
            var symbol = resolver.getSymbolOfNode(declaration);
            return symbol && !(symbol.flags & (SymbolFlags.TypeLiteral | SymbolFlags.CallSignature | SymbolFlags.ConstructSignature))
                ? resolver.getTypeOfSymbol(symbol)
                : resolver.getTypeFromTypeNode(<TypeNode>declaration); // get unknowntype
        }

        function emitTypeOfDeclaration(declaration: Node, enclosingDeclaration: Node, flags: TypeFormatFlags, writer: IDeclarationWriter) {

            buildTypeDisplay(getTypeForDeclaration(declaration), writer, enclosingDeclaration, flags);
        }

        function emitReturnTypeOfSignatureDeclaration(signatureDeclaration: SignatureDeclaration, enclosingDeclaration: Node, flags: TypeFormatFlags, writer: IDeclarationWriter) {
            var signature = resolver.getSignatureFromDeclaration(signatureDeclaration);
            buildTypeDisplay(resolver.getReturnTypeOfSignature(signature), writer, enclosingDeclaration, flags);
        }

        function buildTypeDisplay(type: Type, writer: IDeclarationWriter, enclosingDeclaration?: Node, globalFlags?: TypeFormatFlags, typeStack?: Type[]) {
            var globalFlagsToPass = globalFlags & TypeFormatFlags.WriteOwnNameForAnyLike;
            return writeType(type, globalFlags);

            function writeType(type: Type, flags: TypeFormatFlags) {
                // Write undefined/null type as any
                if (type.flags & TypeFlags.Intrinsic) {
                    // Special handling for unknown / resolving types, they should show up as any and not unknown or __resolving
                    writer.writeTypeReference(!(flags & TypeFormatFlags.WriteOwnNameForAnyLike) &&
                    (type.flags & TypeFlags.Any) ? "any" : (<IntrinsicType>type).intrinsicName);
                }
                else if (type.flags & TypeFlags.Reference) {
                    writeTypeReference(<TypeReference>type, flags);
                }
                else if (type.flags & (TypeFlags.Class | TypeFlags.Interface | TypeFlags.Enum | TypeFlags.TypeParameter)) {
                    writeSymbol(type.symbol, enclosingDeclaration, SymbolFlags.Type);
                }
                else if (type.flags & TypeFlags.Tuple) {
                    writeTupleType(<TupleType>type);
                }
                else if (type.flags & TypeFlags.Union) {
                    writeUnionType(<UnionType>type, flags);
                }
                else if (type.flags & TypeFlags.Anonymous) {
                    writeAnonymousType(<ObjectType>type, flags);
                }
                else if (type.flags & TypeFlags.StringLiteral) {
                    writer.writeTypeReference((<StringLiteralType>type).text);
                }
                else {
                    // Should never get here
                    throw new Error("Unknown type")
                }
            }

            function writeTypeList(types: Type[], union: boolean) {
                for (var i = 0; i < types.length; i++) {
                    writeType(types[i], globalFlags | TypeFormatFlags.WriteArrowStyleSignature);
                }
            }

            function writeTypeReference(type: TypeReference, flags: TypeFormatFlags) {
                if (resolver.isArrayType(type) && !(flags & TypeFormatFlags.WriteArrayAsGenericType)) {
                    writer.writeBeginType(DeclarationKind.ArrayType);
                    writeType(type.typeArguments[0], TypeFormatFlags.InElementType);
                }
                else {
                    writer.writeBeginType(DeclarationKind.TypeReference);
                    writeSymbol(type.target.symbol, enclosingDeclaration, SymbolFlags.Type);
                    writer.writeBeginTypeArgumentList();
                    writeTypeList(type.typeArguments, /*union*/ false);
                    writer.writeEnd();
                }
                writer.writeEnd();
            }

            function writeTupleType(type: TupleType) {
                writer.writeBeginType(DeclarationKind.TupleType);
                writeTypeList(type.elementTypes, /*union*/ false);
                writer.writeEnd();
            }

            function writeUnionType(type: UnionType, flags: TypeFormatFlags) {
                writer.writeBeginType(DeclarationKind.UnionType);
                writeTypeList(type.types, /*union*/ true);
                writer.writeEnd();
            }

            function writeAnonymousType(type: ObjectType, flags: TypeFormatFlags) {
                // Always use 'typeof T' for type of class, enum, and module objects
                if (type.symbol && type.symbol.flags & (SymbolFlags.Class | SymbolFlags.Enum | SymbolFlags.ValueModule)) {
                    writeTypeofSymbol(type);
                }
                // Use 'typeof T' for types of functions and methods that circularly reference themselves
                else if (shouldWriteTypeOfFunctionSymbol()) {
                    writeTypeofSymbol(type);
                }
                else if (typeStack && contains(typeStack, type)) {
                    // If type is an anonymous type literal in a type alias declaration, use type alias name
                    var typeAlias = resolver.getTypeAliasForTypeLiteral(type);
                    if (typeAlias) {
                        writeSymbol(typeAlias, enclosingDeclaration, SymbolFlags.Type);
                    }
                    else {
                        // Recursive usage, use any
                        writer.writeTypeReference("any");
                    }
                }
                else {
                    if (!typeStack) {
                        typeStack = [];
                    }
                    typeStack.push(type);
                    writeLiteralType(type, flags);
                    typeStack.pop();
                }

                function shouldWriteTypeOfFunctionSymbol() {
                    if (type.symbol) {
                        var isStaticMethodSymbol = !!(type.symbol.flags & SymbolFlags.Method &&  // typeof static method
                        ts.forEach(type.symbol.declarations, declaration => declaration.flags & NodeFlags.Static));
                        var isNonLocalFunctionSymbol = !!(type.symbol.flags & SymbolFlags.Function) &&
                            (type.symbol.parent || // is exported function symbol
                            ts.forEach(type.symbol.declarations, declaration =>
                            declaration.parent.kind === SyntaxKind.SourceFile || declaration.parent.kind === SyntaxKind.ModuleBlock));

                        if (isStaticMethodSymbol || isNonLocalFunctionSymbol) {
                            // typeof is allowed only for static/non local functions
                            return !!(flags & TypeFormatFlags.UseTypeOfFunction) || // use typeof if format flags specify it
                                (typeStack && contains(typeStack, type)); // it is type of the symbol uses itself recursively
                        }
                    }
                }
            }

            function writeTypeofSymbol(type: ObjectType) {
                /*
                writeKeyword(writer, SyntaxKind.TypeOfKeyword);
                writeSpace(writer);
                writeSymbol(type.symbol, writer, enclosingDeclaration, SymbolFlags.Value);
                */
                throw new Error("writeTypeofSymbol not implemented");
            }

            function writeLiteralType(type: ObjectType, flags: TypeFormatFlags) {
                var resolved = resolver.resolveObjectOrUnionTypeMembers(type);
                if (!resolved.properties.length && !resolved.stringIndexType && !resolved.numberIndexType) {
                    if (!resolved.callSignatures.length && !resolved.constructSignatures.length) {
                        // Empty type {}
                        writer.writeBeginType(DeclarationKind.ObjectType);
                        writer.writeEnd();
                        return;
                    }

                    if (resolved.callSignatures.length === 1 && !resolved.constructSignatures.length) {
                        writer.writeBeginType(DeclarationKind.FunctionType);
                        emitSignatureDeclaration(resolved.callSignatures[0].declaration);
                        writer.writeEnd();
                        return;
                    }
                    if (resolved.constructSignatures.length === 1 && !resolved.callSignatures.length) {
                        writer.writeBeginType(DeclarationKind.ConstructorType);
                        emitSignatureDeclaration(resolved.constructSignatures[0].declaration);
                        writer.writeEnd();
                        return;
                    }
                }

                writer.writeBeginType(DeclarationKind.ObjectType);

                for (var i = 0; i < resolved.callSignatures.length; i++) {
                    emitCallSignatureDeclaration(resolved.callSignatures[i].declaration);
                }
                for (var i = 0; i < resolved.constructSignatures.length; i++) {
                    emitConstructSignatureDeclaration(resolved.constructSignatures[i].declaration);
                }
                if (resolved.stringIndexType) {
                    // [x: string]:
                    writer.writeBeginSignature(DeclarationKind.IndexSignature);
                    writer.writeBeginParameter();
                    writer.writeName("x");
                    writer.writeTypeReference("string");
                    writer.writeEnd();

                    writeType(resolved.stringIndexType, flags | TypeFormatFlags.WriteArrowStyleSignature);

                    writer.writeEnd();
                }
                if (resolved.numberIndexType) {
                    // [x: number]:
                    writer.writeBeginSignature(DeclarationKind.IndexSignature);
                    writer.writeBeginParameter();
                    writer.writeName("x");
                    writer.writeTypeReference("number");
                    writer.writeEnd();

                    writeType(resolved.numberIndexType, flags | TypeFormatFlags.WriteArrowStyleSignature);

                    writer.writeEnd();
                }
                for (var i = 0; i < resolved.properties.length; i++) {
                    var p = resolved.properties[i];
                    var t = resolver.getTypeOfSymbol(p);
                    if (p.flags & (SymbolFlags.Function | SymbolFlags.Method) && !resolver.getPropertiesOfType(t).length) {
                        var signatures = resolver.getSignaturesOfType(t, SignatureKind.Call);
                        for (var j = 0; j < signatures.length; j++) {
                            writer.writeBeginSignature(DeclarationKind.MethodSignature);
                            writer.writeName(p.name);
                            emitJsDocComments(p.valueDeclaration);
                            if (isOptionalProperty(p)) {
                                writer.writeFlags(DeclarationFlag.Optional);
                            }
                            emitSignatureDeclaration(signatures[j].declaration);
                            writer.writeEnd();
                        }
                    }
                    else {
                        writer.writeBeginSignature(DeclarationKind.PropertySignature);
                        writer.writeName(p.name);
                        emitJsDocComments(p.valueDeclaration);
                        if (isOptionalProperty(p)) {
                            writer.writeFlags(DeclarationFlag.Optional);
                        }
                        writeType(t, flags | TypeFormatFlags.WriteArrowStyleSignature);
                        writer.writeEnd();
                    }
                }

                writer.writeEnd();
            }

            function isOptionalProperty(propertySymbol: Symbol): boolean {
                //  class C {
                //      constructor(public x?) { }
                //  }
                //
                // x is an optional parameter, but it is a required property.
                return propertySymbol.valueDeclaration &&
                    hasQuestionToken(propertySymbol.valueDeclaration) &&
                    propertySymbol.valueDeclaration.kind !== SyntaxKind.Parameter;
            }
        }

    }

     // targetSourceFile is when users only want one file in entire project to be emitted. This is used in compilerOnSave feature
    export function emitFiles(resolver: EmitResolver, targetSourceFile?: SourceFile): EmitResult {
        var program = resolver.getProgram();
        var compilerHost = program.getCompilerHost();
        var compilerOptions = program.getCompilerOptions();
        var diagnostics: Diagnostic[] = [];
        var newLine = program.getCompilerHost().getNewLine();

        var hasSemanticErrors = resolver.hasSemanticErrors();

        function emitFile(jsFilePath: string, sourceFile?: SourceFile) {

            emitDeclarations(program, resolver, diagnostics, jsFilePath, sourceFile);
        }

        if (targetSourceFile === undefined) {
            // No targetSourceFile is specified (e.g. calling emitter from batch compiler)
            forEach(program.getSourceFiles(), sourceFile => {
                if (shouldEmitToOwnFile(sourceFile, compilerOptions)) {
                    var outputFilePath = getOwnEmitOutputFilePath(sourceFile, program, ".d.json");
                    emitFile(outputFilePath, sourceFile)
                }
            });

            if (compilerOptions.out) {
                emitFile(compilerOptions.out);
            }
        }
        else {
            // targetSourceFile is specified (e.g calling emitter from language service or calling getSemanticDiagnostic from language service)
            if (shouldEmitToOwnFile(targetSourceFile, compilerOptions)) {
                // If shouldEmitToOwnFile returns true or targetSourceFile is an external module file, then emit targetSourceFile in its own output file
                var jsFilePath = getOwnEmitOutputFilePath(targetSourceFile, program, ".d.json");
                emitFile(jsFilePath, targetSourceFile);
            }
            else if (!isDeclarationFile(targetSourceFile) && compilerOptions.out) {
                // Otherwise, if --out is specified and targetSourceFile is not a declaration file,
                // Emit all, non-external-module file, into one single output file
                emitFile(compilerOptions.out);
            }
        }

        // Sort and make the unique list of diagnostics
        diagnostics.sort(compareDiagnostics);
        diagnostics = deduplicateSortedDiagnostics(diagnostics);

        // Update returnCode if there is any EmitterError
        var hasEmitterError = forEach(diagnostics, diagnostic => diagnostic.category === DiagnosticCategory.Error);

        // Check and update returnCode for syntactic and semantic
        var emitResultStatus: EmitReturnStatus;
        if (hasEmitterError) {
            emitResultStatus = EmitReturnStatus.EmitErrorsEncountered;
        }
        else {
            emitResultStatus = EmitReturnStatus.Succeeded;
        }

        return {
            emitResultStatus,
            diagnostics,
            sourceMaps: undefined
        };
    }
}
