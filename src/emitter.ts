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

/// <reference path="types.ts"/>
/// <reference path="core.ts"/>
/// <reference path="scanner.ts"/>
/// <reference path="parser.ts"/>
/// <reference path="declarationWriter.ts"/>
/// <reference path="../typings/doctrine.d.ts" />

var doctrine = require("doctrine");

module ts {

    export function emitFiles(resolver: EmitResolver): EmitResult {

        var program = resolver.getProgram();
        var compilerHost = program.getCompilerHost();
        var compilerOptions = program.getCompilerOptions();
        var diagnostics: Diagnostic[] = [];

        function getSourceFilePathInNewDir(newDirPath: string, sourceFile: SourceFile) {
            var sourceFilePath = getNormalizedPathFromPathCompoments(getNormalizedPathComponents(sourceFile.filename, compilerHost.getCurrentDirectory()));
            sourceFilePath = sourceFilePath.replace(program.getCommonSourceDirectory(), "");
            return combinePaths(newDirPath, sourceFilePath);
        }

        function shouldEmitToOwnFile(sourceFile: SourceFile): boolean {

            if (sourceFile.flags & NodeFlags.DeclarationFile) {
                return (sourceFile.flags & NodeFlags.RootFile) !== 0;
            }

            return (isExternalModule(sourceFile) || !compilerOptions.out) && !fileExtensionIs(sourceFile.filename, ".js");
        }

        function getOwnEmitOutputFilePath(sourceFile: SourceFile, extension: string) {
            if (program.getCompilerOptions().outDir) {
                var emitOutputFilePathWithoutExtension = getModuleNameFromFilename(getSourceFilePathInNewDir(program.getCompilerOptions().outDir, sourceFile));
            }
            else {
                var emitOutputFilePathWithoutExtension = getModuleNameFromFilename(sourceFile.filename);
            }

            return emitOutputFilePathWithoutExtension + extension;
        }

        // Get source text of node in the current source file. Unlike getSourceTextOfNode this function
        // doesn't walk the parent chain to find the containing source file, rather it assumes the node is
        // in the source file currently being processed.
        var currentSourceFile: SourceFile;
        function getSourceTextOfLocalNode(node: Node): string {
            var text = currentSourceFile.text;
            return text.substring(skipTrivia(text, node.pos), node.end);
        }

        function getCommentText(node: Comment): string {
            return currentSourceFile.text.substring(node.pos, node.end);
        }

        function getAllAccessorDeclarations(node: ClassDeclaration, accessor: AccessorDeclaration) {
            var firstAccessor: AccessorDeclaration;
            var getAccessor: AccessorDeclaration;
            var setAccessor: AccessorDeclaration;
            forEach(node.members, (member: Declaration) => {
                if ((member.kind === SyntaxKind.GetAccessor || member.kind === SyntaxKind.SetAccessor) &&
                    member.name.text === accessor.name.text &&
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
            return {
                firstAccessor: firstAccessor,
                getAccessor: getAccessor,
                setAccessor: setAccessor
            };
        }

        function getFirstConstructorWithBody(node: ClassDeclaration): ConstructorDeclaration {
            return forEach(node.members, member => {
                if (member.kind === SyntaxKind.Constructor && (<ConstructorDeclaration>member).body) {
                    return <ConstructorDeclaration>member;
                }
            });
        }

        function isExternalModuleOrDeclarationFile(sourceFile: SourceFile) {
            return isExternalModule(sourceFile) || (sourceFile.flags & NodeFlags.DeclarationFile) !== 0;
        }

        function emitDeclarations(writer: IDeclarationWriter, jsFilePath: string, root?: SourceFile) {

            var enclosingDeclaration: Node;
            var reportedDeclarationError = false;

            var emitJsDocComments = compilerOptions.removeComments && !compilerOptions.annotations ?
                function (declaration: Declaration) { } : writeJsDocComments;

            var aliasDeclarationsToRemove: {
                declaration: ImportDeclaration;
                handle: IRemovableModuleElement;
            }[] = [];

            var getSymbolVisibilityDiagnosticMessage: (symbolAccesibilityResult: SymbolAccessiblityResult) => {
                errorNode: Node;
                diagnosticMessage: DiagnosticMessage;
                typeName?: Identifier
            }

            function makeAliasesVisible(importDeclarations: ImportDeclaration[]) {
                forEach(importDeclarations, aliasToWrite => {

                    for(var i = 0, l = aliasDeclarationsToRemove.length; i < l; i++) {

                        if(aliasDeclarationsToRemove[i].declaration == aliasToWrite) {

                            // Alias is now visible so take it off the remove list
                            aliasDeclarationsToRemove.splice(i, 1);
                            break;
                        }
                    }
                });
            }

            function writeSymbol(symbol: Symbol, enclosingDeclaration?: Node, meaning?: SymbolFlags) {
                var symbolAccesibilityResult = resolver.isSymbolAccessible(symbol, enclosingDeclaration, meaning);
                if (symbolAccesibilityResult.accessibility === SymbolAccessibility.Accessible) {
                    writer.writeTypeReference(resolver.symbolToString(symbol, enclosingDeclaration, meaning));

                    if (symbolAccesibilityResult && symbolAccesibilityResult.aliasesToMakeVisible) {

                        makeAliasesVisible(symbolAccesibilityResult.aliasesToMakeVisible);
                    }
                }
                else {
                    // Report error
                    reportedDeclarationError = true;
                    var errorInfo = getSymbolVisibilityDiagnosticMessage(symbolAccesibilityResult);
                    if (errorInfo) {
                        if (errorInfo.typeName) {
                            diagnostics.push(createDiagnosticForNode(errorInfo.errorNode,
                                errorInfo.diagnosticMessage,
                                getSourceTextOfLocalNode(errorInfo.typeName),
                                symbolAccesibilityResult.errorSymbolName,
                                symbolAccesibilityResult.errorModuleName));
                        }
                        else {
                            diagnostics.push(createDiagnosticForNode(errorInfo.errorNode,
                                errorInfo.diagnosticMessage,
                                symbolAccesibilityResult.errorSymbolName,
                                symbolAccesibilityResult.errorModuleName));
                        }
                    }
                }
            }

            function emitLines(nodes: Node[]) {
                for (var i = 0, n = nodes.length; i < n; i++) {
                    emitNode(nodes[i]);
                }
            }

            function emitCommaList(nodes: Node[], eachNodeEmitFn: (node: Node) => void) {
                for (var i = 0, n = nodes.length; i < n; i++) {
                    eachNodeEmitFn(nodes[i]);
                }
            }

            var paramDescriptions: Map<string> = {};

            function writeJsDocComments(declaration: Declaration): void {

                var comment = getJsDocComment(declaration);
                if (comment) {

                    if(!compilerOptions.removeComments) {

                        var description = getJsDocDescription(comment);
                        if (description) {
                            writer.writeDescription(description);
                        }

                        // cache the parameter descriptions for use later by visitParameter
                        paramDescriptions = getJsDocParamDescriptions(comment);
                    }

                    if(compilerOptions.annotations) {
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

            function getJsDocComment(declaration: Declaration): JsDocComment {

                if (declaration) {
                    var jsDocComments = getJsDocComments(declaration, currentSourceFile);
                    if(jsDocComments && jsDocComments.length > 0) {
                        // use the last comment before the declaration
                        var commentText = getCommentText(jsDocComments[jsDocComments.length - 1]);

                        return {
                            node: declaration,
                            parseResults: doctrine.parse(commentText, { unwrap: true })
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

            var annotationExp = /^([$A-Z_][0-9A-Z_$]*)( (.*))?$/i;

            function getJsDocAnnotations(jsDocComment: JsDocComment): any[] {

                var ret: any[] = [];

                for(var i = 0, l = jsDocComment.parseResults.tags.length; i < l; i++) {

                    var tag = jsDocComment.parseResults.tags[i];

                    if(tag.title == "annotation") {

                        if(!tag.description) {
                            diagnostics.push(createDiagnosticForNode(jsDocComment.node,
                                CustomDiagnostics.Missing_annotation_name));
                        }
                        else {
                            var matches = annotationExp.exec(tag.description);

                            var name = matches && matches[1];
                            if (!name) {
                                diagnostics.push(createDiagnosticForNode(jsDocComment.node,
                                    CustomDiagnostics.Invalid_annotation_name));
                            }
                            else {

                                var value:any = matches[3];
                                if (value === undefined) {
                                    value = true;
                                }
                                else {
                                    try {
                                        value = JSON.parse(value);
                                    }
                                    catch (e) {
                                        diagnostics.push(createDiagnosticForNode(jsDocComment.node,
                                            CustomDiagnostics.Annotation_value_must_be_valid_JSON));
                                    }
                                }

                                ret.push({ name: name, value: value });
                            }
                        }
                    }
                }

                return ret;
            }

            function getJsDocParamDescriptions(jsDocComment: JsDocComment): Map<string> {

                var map: Map<string> = {};

                // give priority to the @description tag

                for(var i = 0, l = jsDocComment.parseResults.tags.length; i < l; i++) {

                    var tag = jsDocComment.parseResults.tags[i];
                    if(tag.title == "param") {

                        map[tag.name] = tag.description;
                    }
                }

                return map;
            }

            function emitSourceFile(node: SourceFile) {
                currentSourceFile = node;
                enclosingDeclaration = node;

                emitLines(node.statements);
            }

            function emitExportAssignment(node: ExportAssignment) {

                writer.writeExportAssignment(getSourceTextOfLocalNode(node.exportName));
            }

            function emitDeclarationFlags(node: Declaration) {
                if (node.flags & NodeFlags.Static) {
                    if (node.flags & NodeFlags.Private) {
                        writer.writeFlags(DeclarationFlag.Private);
                    }
                    writer.writeFlags(DeclarationFlag.Static);
                }
                else {
                    if (node.flags & NodeFlags.Private) {
                        writer.writeFlags(DeclarationFlag.Private);
                    }
                    // If the node is parented in the current source file we need to emit export declare or just export
                    else if (node.parent === currentSourceFile) {
                        // If the node is exported
                        if (node.flags & NodeFlags.Export) {
                            writer.writeFlags(DeclarationFlag.Exported);
                        }

                        if (node.kind !== SyntaxKind.InterfaceDeclaration) {
                            writer.writeFlags(DeclarationFlag.Ambient);
                        }
                    }
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
                        aliasDeclarationsToRemove.push({
                            declaration: node,
                            handle: handle
                        });
                    }
                }
            }

            function writeImportDeclaration(node: ImportDeclaration): IRemovableModuleElement {

                var handle = writer.writeBeginRemovableModuleElement(DeclarationKind.Import);

                emitName(node);
                emitJsDocComments(node);
                if (node.flags & NodeFlags.Export) {
                    writer.writeFlags(DeclarationFlag.Exported);
                }

                if(node.entityName) {
                    checkEntityNameAccessible();
                    writer.writeValue(getSourceTextOfLocalNode(node.entityName))
                }
                else {
                    // remove quotes at beginning and ending of module name
                    writer.writeRequire(unquoteString(getSourceTextOfLocalNode(node.externalModuleName)));
                }

                writer.writeEnd();

                function checkEntityNameAccessible() {
                    var symbolAccesibilityResult = resolver.isImportDeclarationEntityNameReferenceDeclarationVisibile(node.entityName);
                    if (symbolAccesibilityResult.accessibility === SymbolAccessibility.Accessible) {
                        // write the aliases
                        if (symbolAccesibilityResult.aliasesToMakeVisible) {
                            makeAliasesVisible(symbolAccesibilityResult.aliasesToMakeVisible);
                        }
                    }
                    else {
                        // Report error
                        reportedDeclarationError = true;
                        diagnostics.push(createDiagnosticForNode(node,
                            Diagnostics.Import_declaration_0_is_using_private_name_1,
                            getSourceTextOfLocalNode(node.name),
                            symbolAccesibilityResult.errorSymbolName));
                    }
                }

                return handle;
            }

            function emitModuleDeclaration(node: ModuleDeclaration) {
                if (resolver.isDeclarationVisible(node)) {

                    writer.writeBeginModuleElement(DeclarationKind.Module);

                    if(isAmbientExternalModule(node)) {

                        writer.writeName(unquoteString(getSourceTextOfLocalNode(node.name)))
                        writer.writeFlags(DeclarationFlag.ExternalModule);
                    }
                    else {

                        var name = getSourceTextOfLocalNode(node.name);
                        while (node.body.kind !== SyntaxKind.ModuleBlock) {
                            node = <ModuleDeclaration>node.body;
                            name += "." + getSourceTextOfLocalNode(node.name);
                        }

                        writer.writeName(name);
                    }

                    emitJsDocComments(node);
                    emitDeclarationFlags(node);

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
                    return /^"[^"]+"$/.test(getSourceTextOfLocalNode(node.name));
                }

                return false;
            }

            function unquoteString(str: string): string {
                if(!str) return str;
                return str.replace(/^"|"$/g,"");
            }

            function emitEnumDeclaration(node: EnumDeclaration) {
                if (resolver.isDeclarationVisible(node)) {

                    writer.writeBeginModuleElement(DeclarationKind.Enum);

                    emitName(node);
                    emitDeclarationFlags(node);
                    emitJsDocComments(node);

                    emitLines(node.members);

                    writer.writeEnd();
                }
            }

            function emitName(node: Declaration) {

                writer.writeName(getSourceTextOfLocalNode(node.name));
            }

            function emitEnumMemberDeclaration(node: EnumMember) {

                writer.writeBeginEnumMember();

                emitName(node);
                emitJsDocComments(node);

                var enumMemberValue = resolver.getEnumMemberValue(node);
                if (enumMemberValue !== undefined) {

                    writer.writeValue(enumMemberValue.toString());
                }

                writer.writeEnd();
            }

            function emitTypeParameters(typeParameters: TypeParameterDeclaration[]) {
                function emitTypeParameter(node: TypeParameterDeclaration) {
                    function getTypeParameterConstraintVisibilityError(symbolAccesibilityResult: SymbolAccessiblityResult) {
                        // Type parameter constraints are named by user so we should always be able to name it
                        var diagnosticMessage: DiagnosticMessage;
                        switch (node.parent.kind) {
                            case SyntaxKind.ClassDeclaration:
                                diagnosticMessage = symbolAccesibilityResult.errorModuleName ?
                                    Diagnostics.Type_parameter_0_of_exported_class_has_or_is_using_name_1_from_private_module_2 :
                                    Diagnostics.Type_parameter_0_of_exported_class_has_or_is_using_private_name_1;
                                break;

                            case SyntaxKind.InterfaceDeclaration:
                                diagnosticMessage = symbolAccesibilityResult.errorModuleName ?
                                    Diagnostics.Type_parameter_0_of_exported_interface_has_or_is_using_name_1_from_private_module_2 :
                                    Diagnostics.Type_parameter_0_of_exported_interface_has_or_is_using_private_name_1;
                                break;

                            case SyntaxKind.ConstructSignature:
                                diagnosticMessage = symbolAccesibilityResult.errorModuleName ?
                                    Diagnostics.Type_parameter_0_of_constructor_signature_from_exported_interface_has_or_is_using_name_1_from_private_module_2 :
                                    Diagnostics.Type_parameter_0_of_constructor_signature_from_exported_interface_has_or_is_using_private_name_1;
                                break;

                            case SyntaxKind.CallSignature:
                                diagnosticMessage = symbolAccesibilityResult.errorModuleName ?
                                    Diagnostics.Type_parameter_0_of_call_signature_from_exported_interface_has_or_is_using_name_1_from_private_module_2 :
                                    Diagnostics.Type_parameter_0_of_call_signature_from_exported_interface_has_or_is_using_private_name_1;
                                break;

                            case SyntaxKind.Method:
                                if (node.parent.flags & NodeFlags.Static) {
                                    diagnosticMessage = symbolAccesibilityResult.errorModuleName ?
                                        Diagnostics.Type_parameter_0_of_public_static_method_from_exported_class_has_or_is_using_name_1_from_private_module_2 :
                                        Diagnostics.Type_parameter_0_of_public_static_method_from_exported_class_has_or_is_using_private_name_1;
                                }
                                else if (node.parent.parent.kind === SyntaxKind.ClassDeclaration) {
                                    diagnosticMessage = symbolAccesibilityResult.errorModuleName ?
                                        Diagnostics.Type_parameter_0_of_public_method_from_exported_class_has_or_is_using_name_1_from_private_module_2 :
                                        Diagnostics.Type_parameter_0_of_public_method_from_exported_class_has_or_is_using_private_name_1;
                                }
                                else {
                                    diagnosticMessage = symbolAccesibilityResult.errorModuleName ?
                                        Diagnostics.Type_parameter_0_of_method_from_exported_interface_has_or_is_using_name_1_from_private_module_2 :
                                        Diagnostics.Type_parameter_0_of_method_from_exported_interface_has_or_is_using_private_name_1;
                                }
                                break;

                            case SyntaxKind.FunctionDeclaration:
                                diagnosticMessage = symbolAccesibilityResult.errorModuleName ?
                                    Diagnostics.Type_parameter_0_of_exported_function_has_or_is_using_name_1_from_private_module_2 :
                                    Diagnostics.Type_parameter_0_of_exported_function_has_or_is_using_private_name_1;
                                break;

                            default:
                                Debug.fail("This is unknown parent for type parameter: " + SyntaxKind[node.parent.kind]);
                        }

                        return {
                            diagnosticMessage: diagnosticMessage,
                            errorNode: node,
                            typeName: node.name
                        };
                    }

                    writer.writeBeginTypeParameter();

                    emitName(node);
                    emitJsDocComments(node);

                    // If there is constraint present and this is not a type parameter of the private method emit the constraint
                    if (node.constraint) {

                        if(node.parent.kind !== SyntaxKind.Method || !(node.parent.flags & NodeFlags.Private)) {
                            getSymbolVisibilityDiagnosticMessage = getTypeParameterConstraintVisibilityError;
                            writeTypeAtLocation(node.constraint, enclosingDeclaration, TypeFormatFlags.UseTypeOfFunction, writer);
                        }
                        else {
                            if(compilerOptions.typePrivates) {
                                writeTypeAtLocationIfAccessible(node.constraint, enclosingDeclaration, TypeFormatFlags.UseTypeOfFunction, writer);
                            }
                        }
                    }

                    writer.writeEnd();
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

                function emitTypeOfTypeReference(node: Node) {

                    getSymbolVisibilityDiagnosticMessage = getHeritageClauseVisibilityError;
                    writeTypeAtLocation(node, enclosingDeclaration, TypeFormatFlags.WriteArrayAsGenericType | TypeFormatFlags.UseTypeOfFunction, writer);

                    function getHeritageClauseVisibilityError(symbolAccesibilityResult: SymbolAccessiblityResult) {
                        var diagnosticMessage: DiagnosticMessage;
                        // Heritage clause is written by user so it can always be named
                        if (node.parent.kind === SyntaxKind.ClassDeclaration) {
                            // Class
                            if (symbolAccesibilityResult.errorModuleName) {
                                // Module is inaccessible
                                diagnosticMessage = isImplementsList ?
                                    Diagnostics.Implements_clause_of_exported_class_0_has_or_is_using_name_1_from_private_module_2 :
                                    Diagnostics.Extends_clause_of_exported_class_0_has_or_is_using_name_1_from_private_module_2;
                            }
                            else {
                                // Class or Interface implemented/extended is inaccessible
                                diagnosticMessage = isImplementsList ?
                                    Diagnostics.Implements_clause_of_exported_class_0_has_or_is_using_private_name_1 :
                                    Diagnostics.Extends_clause_of_exported_class_0_has_or_is_using_private_name_1;
                            }
                        }
                        else {
                            if (symbolAccesibilityResult.errorModuleName) {
                                // Module is inaccessible
                                diagnosticMessage = Diagnostics.Extends_clause_of_exported_interface_0_has_or_is_using_name_1_from_private_module_2;
                            }
                            else {
                                // interface is inaccessible
                                diagnosticMessage = Diagnostics.Extends_clause_of_exported_interface_0_has_or_is_using_private_name_1;
                            }
                        }

                        return {
                            diagnosticMessage: diagnosticMessage,
                            errorNode: node,
                            typeName: (<Declaration>node.parent).name
                        };
                    }
                }
            }

            function emitClassDeclaration(node: ClassDeclaration) {
                function emitParameterProperties(constructorDeclaration: ConstructorDeclaration) {
                    if (constructorDeclaration) {

                        var jsDocComment = getJsDocComment(constructorDeclaration),
                            paramDescriptions: Map<string>;

                        if(jsDocComment) {
                            paramDescriptions = getJsDocParamDescriptions(jsDocComment);
                        }

                        forEach(constructorDeclaration.parameters, param => {
                            if (param.flags & (NodeFlags.Public | NodeFlags.Private)) {

                                emitPropertyDeclaration(param, paramDescriptions ? paramDescriptions[getSourceTextOfLocalNode(param.name)] : null);
                            }
                        });
                    }
                }

                if (resolver.isDeclarationVisible(node)) {

                    writer.writeBeginModuleElement(DeclarationKind.Class);

                    emitName(node);
                    emitJsDocComments(node);
                    emitDeclarationFlags(node);

                    var prevEnclosingDeclaration = enclosingDeclaration;
                    enclosingDeclaration = node;

                    emitTypeParameters(node.typeParameters);
                    if (node.baseType) {
                        emitHeritageClause([node.baseType], /*isImplementsList*/ false);
                    }

                    emitHeritageClause(node.implementedTypes, /*isImplementsList*/ true);
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
                    emitDeclarationFlags(node);

                    var prevEnclosingDeclaration = enclosingDeclaration;
                    enclosingDeclaration = node;

                    emitTypeParameters(node.typeParameters);
                    emitHeritageClause(node.baseTypes, /*isImplementsList*/ false);
                    emitLines(node.members);

                    enclosingDeclaration = prevEnclosingDeclaration;

                    writer.writeEnd();
                }
            }

            function emitPropertyDeclaration(node: PropertyDeclaration, description?: string) {


                if(node.parent.kind == SyntaxKind.ClassDeclaration || node.parent.kind == SyntaxKind.Constructor) {

                    if((node.flags & NodeFlags.Private) && compilerOptions.removePrivates) {
                        return;
                    }

                    writer.writeBeginClassMember(DeclarationKind.Field);
                }
                else {

                    writer.writeBeginSignature(DeclarationKind.PropertySignature);
                }

                emitVariableDeclaration(node);
                emitDeclarationFlags(node);

                // Use the description if provided; otherwise, check the doc comments
                if(description) {
                    writer.writeDescription(description);
                }
                else {
                    emitJsDocComments(node);
                }

                writer.writeEnd();
            }

            function emitVariableDeclaration(node: VariableDeclaration) {
                // If we are emitting property it isn't moduleElement and hence we already know it needs to be emitted
                // so there is no check needed to see if declaration is visible
                if (node.kind !== SyntaxKind.VariableDeclaration || resolver.isDeclarationVisible(node)) {

                    emitName(node);
                    // If optional property emit ?
                    if (node.kind === SyntaxKind.Property && (node.flags & NodeFlags.QuestionMark)) {
                        writer.writeFlags(DeclarationFlag.Optional);
                    }
                    if (!(node.flags & NodeFlags.Private)) {
                        getSymbolVisibilityDiagnosticMessage = getVariableDeclarationTypeVisibilityError;
                        writeTypeAtLocation(node, enclosingDeclaration, TypeFormatFlags.UseTypeOfFunction, writer);
                    }
                    else {
                        if(compilerOptions.typePrivates) {
                            writeTypeAtLocationIfAccessible(node, enclosingDeclaration, TypeFormatFlags.UseTypeOfFunction, writer);
                        }
                    }
                }

                function getVariableDeclarationTypeVisibilityError(symbolAccesibilityResult: SymbolAccessiblityResult) {
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
                        diagnosticMessage: diagnosticMessage,
                        errorNode: node,
                        typeName: node.name
                    } : undefined;
                }
            }

            function emitVariableStatement(node: VariableStatement) {
                var hasDeclarationWithEmit = forEach(node.declarations, varDeclaration => resolver.isDeclarationVisible(varDeclaration));
                if (hasDeclarationWithEmit) {

                    var declarations = node.declarations;
                    for (var i = 0, n = declarations.length; i < n; i++) {

                        var declaration = declarations[i];

                        writer.writeBeginModuleElement(DeclarationKind.Variable);

                        // For the first variable in the statement, use the comment on the statement declaration
                        // if one is not found on the variable declaration
                        emitJsDocComments(i == 0 && !hasJsDocComment(declaration) ? node : declaration);
                        emitDeclarationFlags(node);

                        emitVariableDeclaration(declaration);

                        writer.writeEnd();
                    }
                }
            }

            function emitAccessorDeclaration(node: AccessorDeclaration) {

                if((node.flags & NodeFlags.Private) && compilerOptions.removePrivates) {
                    return;
                }

                if(compilerOptions.accessors) {

                    writer.writeBeginClassMember(node.kind === SyntaxKind.GetAccessor ?
                        DeclarationKind.GetAccessor : DeclarationKind.SetAccessor);
                    emitName(node);
                    emitDeclarationFlags(node);
                    emitJsDocComments(node);
                    emitSignatureDeclaration(node);
                    writer.writeEnd();
                }
                else {
                    var accessors = getAllAccessorDeclarations(<ClassDeclaration>node.parent, node);
                    if (node === accessors.firstAccessor) {

                        writer.writeBeginClassMember(DeclarationKind.Field);
                        emitName(node);
                        emitDeclarationFlags(node);
                        emitJsDocComments(accessors.firstAccessor);
                        if (!(node.flags & NodeFlags.Private)) {
                            getSymbolVisibilityDiagnosticMessage = getAccessorDeclarationTypeVisibilityError;
                            writeTypeAtLocation(node, enclosingDeclaration, TypeFormatFlags.UseTypeOfFunction, writer);
                        }
                        else {
                            if(compilerOptions.typePrivates) {
                                writeTypeAtLocationIfAccessible(node, enclosingDeclaration, TypeFormatFlags.UseTypeOfFunction, writer);
                            }
                        }
                        writer.writeEnd();
                    }
                }

                function getAccessorDeclarationTypeVisibilityError(symbolAccesibilityResult: SymbolAccessiblityResult) {
                    var diagnosticMessage: DiagnosticMessage;
                    if (node.kind === SyntaxKind.SetAccessor) {
                        // Setters have to have type named and cannot infer it so, the type should always be named
                        if (node.parent.flags & NodeFlags.Static) {
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
                            diagnosticMessage: diagnosticMessage,
                            errorNode: node.parameters[0],
                            typeName: node.name
                        };
                    }
                    else {
                        if (node.flags & NodeFlags.Static) {
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
                            diagnosticMessage: diagnosticMessage,
                            errorNode: node.name,
                            typeName: undefined
                        };
                    }
                }
            }

            function emitFunctionDeclaration(node: FunctionDeclaration) {
                // If we are emitting Method/Constructor it isn't moduleElement and hence already determined to be emitting
                // so no need to verify if the declaration is visible
                if ((node.kind !== SyntaxKind.FunctionDeclaration || resolver.isDeclarationVisible(node)) &&
                    !resolver.isImplementationOfOverload(node)) {

                    // only emit declaration for first private member
                    if(node.flags & NodeFlags.Private) {

                        if(compilerOptions.removePrivates) {
                            return;
                        }

                        if(!compilerOptions.typePrivates) {
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
                        if (node.flags & NodeFlags.QuestionMark) {
                            writer.writeFlags(DeclarationFlag.Optional);
                        }
                    }
                    emitJsDocComments(node);
                    emitDeclarationFlags(node);
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
                // Parameters

                var hasParamList = false;
                if(node.kind != SyntaxKind.IndexSignature && node.kind != SyntaxKind.SetAccessor && node.parameters.length > 0) {
                    writer.writeBeginParameterList();
                    hasParamList = true;
                }

                emitCommaList(node.parameters, emitParameterDeclaration);

                if(hasParamList) {
                    writer.writeEnd();
                }

                // If this is not a constructor and is not private, emit the return type
                if (node.kind !== SyntaxKind.Constructor && node.kind !== SyntaxKind.SetAccessor) {

                    if (!(node.flags & NodeFlags.Private)) {
                        getSymbolVisibilityDiagnosticMessage = getReturnTypeVisibilityError;
                        writeReturnTypeOfSignatureDeclaration(node, enclosingDeclaration, TypeFormatFlags.UseTypeOfFunction, writer);
                    }
                    else {
                        if(compilerOptions.typePrivates) {
                            writeReturnTypeOfSignatureDeclarationIfAccessible(node, enclosingDeclaration, TypeFormatFlags.UseTypeOfFunction, writer);
                        }
                    }
                }

                function getReturnTypeVisibilityError(symbolAccesibilityResult: SymbolAccessiblityResult) {
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
                            Debug.fail("This is unknown kind for signature: " + SyntaxKind[node.kind]);
                    }

                    return {
                        diagnosticMessage: diagnosticMessage,
                        errorNode: <Node>node.name || node
                    };
                }
            }

            function emitParameterDeclaration(node: ParameterDeclaration) {

                writer.writeBeginParameter();

                emitName(node);

                // See if the method jsdoc comments defined the description for the parameter
                var description = paramDescriptions[getSourceTextOfLocalNode(node.name)];
                if(description) {
                    writer.writeDescription(description);
                }
                else {
                    emitJsDocComments(node);
                }

                if (node.flags & NodeFlags.Rest) {
                    writer.writeFlags(DeclarationFlag.RestParameter);
                }

                if (node.initializer || (node.flags & NodeFlags.QuestionMark)) {
                    writer.writeFlags(DeclarationFlag.Optional);
                }

                if (!(node.parent.flags & NodeFlags.Private)) {
                    getSymbolVisibilityDiagnosticMessage = getParameterDeclarationTypeVisibilityError;
                    writeTypeAtLocation(node, enclosingDeclaration, TypeFormatFlags.UseTypeOfFunction, writer);
                }
                else {
                    if(compilerOptions.typePrivates) {
                        writeTypeAtLocationIfAccessible(node, enclosingDeclaration, TypeFormatFlags.UseTypeOfFunction, writer);
                    }
                }

                writer.writeEnd(); // Parameter

                function getParameterDeclarationTypeVisibilityError(symbolAccesibilityResult: SymbolAccessiblityResult) {
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
                            Debug.fail("This is unknown parent for parameter: " + SyntaxKind[node.parent.kind]);
                    }

                    return {
                        diagnosticMessage: diagnosticMessage,
                        errorNode: node,
                        typeName: node.name
                    };
                }
            }

            function writeTypeAtLocationIfAccessible(location: Node, enclosingDeclaration: Node, flags: TypeFormatFlags, writer: IDeclarationWriter) {

                var type = getTypeAtLocation(location);
                if(!isTypeAccessible(type, enclosingDeclaration)) {
                    return;
                }

                writeTypeToTextWriter(type, enclosingDeclaration, flags, writer);
            }

            function getTypeAtLocation(location: Node): Type {

                var symbol = resolver.getSymbolOfNode(location);
                return symbol && !(symbol.flags & SymbolFlags.TypeLiteral) ? resolver.getTypeOfSymbol(symbol) : resolver.getTypeFromTypeNode(location);
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

            function writeTypeAtLocation(location: Node, enclosingDeclaration: Node, flags: TypeFormatFlags, writer: IDeclarationWriter) {
                // Get type of the symbol if this is the valid symbol otherwise get type at location
                var symbol = resolver.getSymbolOfNode(location);
                var type = symbol && !(symbol.flags & SymbolFlags.TypeLiteral) ? resolver.getTypeOfSymbol(symbol) : resolver.getTypeFromTypeNode(location);

                writeTypeToTextWriter(type, enclosingDeclaration, flags, writer);
            }

            function writeReturnTypeOfSignatureDeclarationIfAccessible(signatureDeclaration: SignatureDeclaration, enclosingDeclaration: Node, flags: TypeFormatFlags, writer: IDeclarationWriter) {
                var signature = resolver.getSignatureFromDeclaration(signatureDeclaration);
                var returnType = resolver.getReturnTypeOfSignature(signature);

                if(!isTypeAccessible(returnType, enclosingDeclaration)) {
                    return;
                }

                writeTypeToTextWriter(returnType, enclosingDeclaration, flags , writer);
            }

            function writeReturnTypeOfSignatureDeclaration(signatureDeclaration: SignatureDeclaration, enclosingDeclaration: Node, flags: TypeFormatFlags, writer: IDeclarationWriter) {
                var signature = resolver.getSignatureFromDeclaration(signatureDeclaration);
                writeTypeToTextWriter(resolver.getReturnTypeOfSignature(signature), enclosingDeclaration, flags , writer);
            }


            function writeTypeToTextWriter(type: Type, enclosingDeclaration: Node, flags: TypeFormatFlags, writer: IDeclarationWriter) {
                var typeStack: Type[];
                return writeType(type, /*allowFunctionOrConstructorTypeLiteral*/ true);

                function writeType(type: Type, allowFunctionOrConstructorTypeLiteral: boolean) {
                    if (type.flags & TypeFlags.Intrinsic) {
                        writer.writeTypeReference((<IntrinsicType>type).intrinsicName);
                    }
                    else if (type.flags & TypeFlags.Reference) {
                        writeTypeReference(<TypeReference>type);
                    }
                    else if (type.flags & (TypeFlags.Class | TypeFlags.Interface | TypeFlags.Enum | TypeFlags.TypeParameter)) {
                        writeSymbol(type.symbol, enclosingDeclaration, SymbolFlags.Type);
                    }
                    else if (type.flags & TypeFlags.Anonymous) {
                        writeAnonymousType(<ObjectType>type, allowFunctionOrConstructorTypeLiteral);
                    }
                    else if (type.flags & TypeFlags.StringLiteral) {
                        writer.writeTypeReference((<StringLiteralType>type).text);
                    }
                    else {
                        // Should never get here
                        throw new Error("Unknown type")
                    }
                }

                function writeTypeReference(type: TypeReference) {
                    if (resolver.isArrayType(type) && !(flags & TypeFormatFlags.WriteArrayAsGenericType)) {
                        writer.writeBeginType(DeclarationKind.ArrayType);
                        writeType(type.typeArguments[0], /*allowFunctionOrConstructorTypeLiteral*/ false);
                    }
                    else {
                        writer.writeBeginType(DeclarationKind.TypeReference);
                        writeSymbol(type.target.symbol, enclosingDeclaration, SymbolFlags.Type);
                        writer.writeBeginTypeArgumentList();
                        for (var i = 0; i < type.typeArguments.length; i++) {
                            writeType(type.typeArguments[i], /*allowFunctionOrConstructorTypeLiteral*/ true);
                        }
                        writer.writeEnd();
                    }
                    writer.writeEnd();
                }

                function writeAnonymousType(type: ObjectType, allowFunctionOrConstructorTypeLiteral: boolean) {
                    // Always use 'typeof T' for type of class, enum, and module objects
                    if (type.symbol && type.symbol.flags & (SymbolFlags.Class | SymbolFlags.Enum | SymbolFlags.ValueModule)) {
                        writeTypeofSymbol(type);
                    }
                    // Use 'typeof T' for types of functions and methods that circularly reference themselves
                    else if (shouldWriteTypeOfFunctionSymbol()) {
                        writeTypeofSymbol(type);
                    }
                    else if (typeStack && contains(typeStack, type)) {
                        // Recursive usage, use any
                        writer.writeTypeReference("any");
                    }
                    else {
                        if (!typeStack) {
                            typeStack = [];
                        }
                        typeStack.push(type);
                        writeLiteralType(type, allowFunctionOrConstructorTypeLiteral);
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
                    throw new Error("writeTypeofSymbol not implemented");
                    /*
                     writer.write("typeof ");
                     writeSymbol(type.symbol, enclosingDeclaration, SymbolFlags.Value);
                     */
                }

                function writeLiteralType(type: ObjectType, allowFunctionOrConstructorTypeLiteral: boolean) {

                    var resolved = resolver.resolveObjectTypeMembers(type);
                    if (!resolved.properties.length && !resolved.stringIndexType && !resolved.numberIndexType) {
                        if (!resolved.callSignatures.length && !resolved.constructSignatures.length) {

                            // Empty type {}
                            writer.writeBeginType(DeclarationKind.ObjectType);
                            writer.writeEnd();
                            return;
                        }

                        if (allowFunctionOrConstructorTypeLiteral) {
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
                    }

                    writer.writeBeginType(DeclarationKind.ObjectType);

                    for (var i = 0; i < resolved.callSignatures.length; i++) {
                        emitCallSignatureDeclaration(resolved.callSignatures[i].declaration);
                    }
                    for (var i = 0; i < resolved.constructSignatures.length; i++) {
                        emitConstructSignatureDeclaration(resolved.constructSignatures[i].declaration);
                    }
                    if (resolved.stringIndexType) {

                        writer.writeBeginSignature(DeclarationKind.IndexSignature);
                        writer.writeBeginParameter();
                        writer.writeName("x");
                        writer.writeTypeReference("string");
                        writer.writeEnd();

                        writeType(resolved.stringIndexType, /*allowFunctionOrConstructorTypeLiteral*/ true);

                        writer.writeEnd();
                    }
                    if (resolved.numberIndexType) {
                        writer.writeBeginSignature(DeclarationKind.IndexSignature);
                        writer.writeBeginParameter();
                        writer.writeName("x");
                        writer.writeTypeReference("number");
                        writer.writeEnd();

                        writeType(resolved.numberIndexType, /*allowFunctionOrConstructorTypeLiteral*/ true);

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
                            if (isOptionalProperty(p)) {
                                writer.writeFlags(DeclarationFlag.Optional);
                            }
                            writeType(t, /*allowFunctionOrConstructorTypeLiteral*/ true);
                            writer.writeEnd();
                        }
                    }

                    writer.writeEnd();
                }

                function isOptionalProperty(propertySymbol: Symbol): boolean {
                    if (propertySymbol.flags & SymbolFlags.Prototype) {
                        return false;
                    }
                    //  class C {
                    //      constructor(public x?) { }
                    //  }
                    //
                    // x is an optional parameter, but it is a required property.
                    return (propertySymbol.valueDeclaration.flags & NodeFlags.QuestionMark) && propertySymbol.valueDeclaration.kind !== SyntaxKind.Parameter;
                }
            }


            function emitNode(node: Node) {
                switch (node.kind) {
                    case SyntaxKind.Constructor:
                    case SyntaxKind.FunctionDeclaration:
                    case SyntaxKind.Method:
                        return emitFunctionDeclaration(<FunctionDeclaration>node);
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

            function resolveScriptReference(sourceFile: SourceFile, reference: FileReference) {
                var referenceFileName = normalizePath(combinePaths(getDirectoryPath(sourceFile.filename), reference.filename));
                return program.getSourceFile(referenceFileName);
            }

            function writeReferencePath(referencedFile: SourceFile) {

                var declFileName: string;

                if(referencedFile.flags & NodeFlags.DeclarationFile) {
                    // declaration file
                    declFileName = getModuleNameFromFilename(referencedFile.filename) + ".d.json"
                }
                else {
                    declFileName = shouldEmitToOwnFile(referencedFile)
                        ? getOwnEmitOutputFilePath(referencedFile, ".d.json") // Own output file so get the .d.ts file
                        : getModuleNameFromFilename(compilerOptions.out) + ".d.json";// Global out file
                }

                declFileName = getRelativePathToDirectoryOrUrl(
                    getDirectoryPath(normalizeSlashes(jsFilePath)),
                    declFileName,
                    compilerHost.getCurrentDirectory(),
                    /*isAbsolutePathAnUrl*/ false);

                writer.writeReference(declFileName);
            }

            if (root) {
                // Emitting just a single file, so emit references in this file only
                if (!compilerOptions.noResolve) {
                    var addedGlobalFileReference = false;
                    forEach(root.referencedFiles, fileReference => {
                        var referencedFile = resolveScriptReference(root, fileReference);

                        // All the references that are not going to be part of same file
                        if ((referencedFile.flags & NodeFlags.DeclarationFile) || // This is a declare file reference
                            shouldEmitToOwnFile(referencedFile) || // This is referenced file is emitting its own js file
                            !addedGlobalFileReference) { // Or the global out file corresponding to this reference was not added

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

                // Emit declarations
                emitNode(root);
            }
            else {
                // --out option specified

                // Emit references corresponding to this file
                var emittedReferencedFiles: SourceFile[] = [];
                forEach(program.getSourceFiles(), sourceFile => {
                    if (!isExternalModuleOrDeclarationFile(sourceFile)) {
                        // Check what references need to be added
                        if (!compilerOptions.noResolve) {
                            forEach(sourceFile.referencedFiles, fileReference => {
                                var referencedFile = resolveScriptReference(sourceFile, fileReference);

                                // If the reference file is a declaration file or an external module, emit that reference
                                if (isExternalModuleOrDeclarationFile(referencedFile) &&
                                    !contains(emittedReferencedFiles, referencedFile)) { // If the file reference was not already emitted

                                    writeReferencePath(referencedFile);
                                    emittedReferencedFiles.push(referencedFile);
                                }
                            });
                        }
                    }
                });

                // Emit declarations
                forEach(program.getSourceFiles(), sourceFile => {
                    if (!isExternalModuleOrDeclarationFile(sourceFile)) {
                        emitNode(sourceFile);
                    }
                });
            }

            // cleanup any import declarations that need to be removed
            forEach(aliasDeclarationsToRemove, aliasInfo => {

                aliasInfo.handle.remove();
            });

            if (!reportedDeclarationError) {

                // TODO: Don't emit output if any file has an error
                var writerDiagnostics = writer.close();
                if(writerDiagnostics) {
                    diagnostics = diagnostics.concat(writerDiagnostics);
                }
            }
        }

        forEach(program.getSourceFiles(), sourceFile => {
            if (shouldEmitToOwnFile(sourceFile)) {
                var outputFilePath = getOwnEmitOutputFilePath(sourceFile, ".d.json");
                emitDeclarations(resolver.createDeclarationWriter(outputFilePath), outputFilePath, sourceFile);
            }
        });

        if (compilerOptions.out) {
            emitDeclarations(resolver.createDeclarationWriter(compilerOptions.out), compilerOptions.out);
        }

        // Sort and make the unique list of diagnostics
        diagnostics.sort(compareDiagnostics);
        diagnostics = deduplicateSortedDiagnostics(diagnostics);

        return {
            errors: diagnostics,
            sourceMaps: []
        };
    }

    interface JsDocComment {
        node: Node;
        parseResults: IDoctrineParseResults;
    }
}
