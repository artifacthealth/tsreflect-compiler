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

/// <reference path="../typings/node.d.ts"/>

/// <reference path="sys.ts" />
/// <reference path="parser.ts" />
/// <reference path="checker.ts" />
/// <reference path="commandLineParser.ts"/>
/// <reference path="types.ts" />

module ts {
    var version = "0.1";
    var configFilename = "tsreflect.config.json";

    export interface CompilerDiagnostic {
        filename?: string;
        line?: number;
        character?: number;
        messageText: string;
        category: DiagnosticCategory;
        code: number;
    }

    export function executeCommandLine(args:string[]):void {

        var commandLine = ts.parseCommandLine(args);

        if (commandLine.errors.length > 0) {
            reportDiagnostics(commandLine.errors);
            sys.exit(1);
            return;
        }

        if (commandLine.options.version) {
            reportDiagnostic(createCompilerDiagnostic(Diagnostics.Version_0, version));
            return sys.exit(0);
        }

        if (commandLine.options.help || commandLine.filenames.length === 0) {
            printVersion();
            printHelp();
            return sys.exit(0);
        }

        var hasErrors = false;
        var start = process.hrtime();

        reportDiagnostics(compile(commandLine.filenames, commandLine.options));

        if(hasErrors) {
            sys.exit(1);
        }
        else {
            var elapsed = process.hrtime(start);
            console.log("Completed without errors in " + elapsed[0] + "s, " + (elapsed[1] / 1000000).toFixed(3) + "ms");
            sys.exit(0);
        }


        function reportDiagnostics(diagnostics: Diagnostic[]): void;
        function reportDiagnostics(diagnostics: CompilerDiagnostic[]): void;
        function reportDiagnostics(diagnostics: any): void {

            for (var i = 0; i < diagnostics.length; i++) {
                reportDiagnostic(diagnostics[i]);
            }
        }

        function reportDiagnostic(diagnostic: Diagnostic): void;
        function reportDiagnostic(diagnostic: CompilerDiagnostic): void;
        function reportDiagnostic(diagnostic: any): void {
            var output = "";

            if(diagnostic.file) {
                var loc = diagnostic.file.getLineAndCharacterFromPosition(diagnostic.start);
                output += diagnostic.file.filename + "(" + loc.line + "," + loc.character + "): ";
            }
            else if(diagnostic.filename) {
                output += diagnostic.filename + "(" + diagnostic.line + "," + diagnostic.character + "): ";
            }

            var category = ts.DiagnosticCategory[diagnostic.category].toLowerCase();
            output += category + " TS" + diagnostic.code + ": " + diagnostic.messageText + sys.newLine;

            if(diagnostic.category == ts.DiagnosticCategory.Error) {
                hasErrors = true;
            }

            sys.write(output);
        }
    }

    export function compile(filenames: string[], options: CompilerOptions): CompilerDiagnostic[] {

        var errors: Diagnostic[] = [];

        // look for config file in current working directory
        var localOptions = loadConfig(combinePaths(normalizePath(process.cwd()), configFilename));
        if(localOptions) {
            mergeOptions(localOptions, options);
        }

        // look for config file in installed directory
        var globalOptions = loadConfig(combinePaths(normalizePath(__dirname), configFilename));
        if(globalOptions) {
            mergeOptions(globalOptions, options);
        }

        if(errors.length == 0) {

            var compilerHost = createCompilerHost(options);
            var program = ts.createProgram(filenames, options, compilerHost);

            errors = program.getDiagnostics();

            if (errors.length == 0) {
                var checker = program.getTypeChecker(!options.noCheck);

                var semanticErrors: Diagnostic[] = [];
                if (!options.noCheck) {
                    semanticErrors = checker.getDiagnostics();
                }

                var emitErrors = checker.emitFiles().diagnostics;
                errors = ts.concatenate(semanticErrors, emitErrors);
            }
        }

        return errors.map(diagnostic => {

            var ret: CompilerDiagnostic = {
                messageText: diagnostic.messageText,
                category: diagnostic.category,
                code: diagnostic.code
            }

            if(diagnostic.file) {
                var loc = diagnostic.file.getLineAndCharacterFromPosition(diagnostic.start);

                ret.filename = diagnostic.file.filename;
                ret.line = loc.line;
                ret.character = loc.character;
            }

            return ret;
        });

        function loadConfig(filename: string): CompilerOptions {

            if(sys.fileExists(filename)) {
                try {
                    var text = sys.readFile(filename, "utf8");

                    try {
                        return <any>JSON.parse(text);
                    }
                    catch(e) {
                        var diagnostic = createCompilerDiagnostic(CustomDiagnostics.File_0_has_invalid_json_format_1, filename, e.message);
                    }
                }
                catch (e) {
                    var diagnostic = createCompilerDiagnostic(Diagnostics.Cannot_read_file_0_Colon_1, filename, e.message);
                }
                errors.push(diagnostic);
                sys.exit(1);
            }
        }

        function mergeOptions(from: CompilerOptions, to: CompilerOptions): void {

            for(var name in from) {
                if(hasProperty(from, name)) {
                    if(!hasProperty(to, name)) {
                        to[name] = from[name];
                    }
                }
            }
        }
    }

    function getDiagnosticText(message:DiagnosticMessage, ...args:any[]):string {
        var diagnostic: Diagnostic = createCompilerDiagnostic.apply(undefined, arguments);
        return diagnostic.messageText;
    }

    function createCompilerHost(options:ts.CompilerOptions):ts.CompilerHost {
        var currentDirectory:string;
        var existingDirectories:ts.Map<boolean> = {};

        function getCanonicalFileName(fileName:string):string {
            // if underlying system can distinguish between two files whose names differs only in cases then file name already in canonical form.
            // otherwise use toLowerCase as a canonical form.
            return sys.useCaseSensitiveFileNames ? fileName : fileName.toLowerCase();
        }

        function getSourceFile(filename:string, languageVersion:ts.ScriptTarget, onError?:(message:string) => void):ts.SourceFile {
            try {
                var text = sys.readFile(filename, options.charset);
            }
            catch (e) {
                if (onError) {
                    onError(e.message);
                }
                text = "";
            }
            return text !== undefined ? ts.createSourceFile(filename, text, languageVersion, /*version:*/ "0") : undefined;
        }

        function writeFile(fileName:string, data:string, writeByteOrderMark:boolean, onError?:(message:string) => void) {

            function directoryExists(directoryPath:string):boolean {
                if (ts.hasProperty(existingDirectories, directoryPath)) {
                    return true;
                }
                if (sys.directoryExists(directoryPath)) {
                    existingDirectories[directoryPath] = true;
                    return true;
                }
                return false;
            }

            function ensureDirectoriesExist(directoryPath:string) {
                if (directoryPath.length > ts.getRootLength(directoryPath) && !directoryExists(directoryPath)) {
                    var parentDirectory = ts.getDirectoryPath(directoryPath);
                    ensureDirectoriesExist(parentDirectory);
                    sys.createDirectory(directoryPath);
                }
            }

            try {
                ensureDirectoriesExist(ts.getDirectoryPath(ts.normalizePath(fileName)));
                sys.writeFile(fileName, data, writeByteOrderMark);
            }
            catch (e) {
                if (onError) onError(e.message);
            }
        }

        return {
            getSourceFile: getSourceFile,
            getDefaultLibFilename: () => combinePaths(ts.normalizePath(__dirname), options.libPath || "lib.d.ts"),
            writeFile: writeFile,
            getCurrentDirectory: () => currentDirectory || (currentDirectory = sys.getCurrentDirectory()),
            useCaseSensitiveFileNames: () => sys.useCaseSensitiveFileNames,
            getCanonicalFileName: getCanonicalFileName,
            getNewLine: () => sys.newLine
        };
    }

    function printVersion() {
        sys.write(getDiagnosticText(Diagnostics.Version_0, version) + sys.newLine);
    }

    function printHelp() {
        var output = "";

        // We want to align our "syntax" and "examples" commands to a certain margin.
        var syntaxLength = getDiagnosticText(Diagnostics.Syntax_Colon_0, "").length;
        var examplesLength = getDiagnosticText(Diagnostics.Examples_Colon_0, "").length;
        var marginLength = Math.max(syntaxLength, examplesLength);

        // Build up the syntactic skeleton.
        var syntax = makePadding(marginLength - syntaxLength);
        syntax += "tsreflect [" + getDiagnosticText(Diagnostics.options) + "] [" + getDiagnosticText(Diagnostics.file) + " ...]";

        output += getDiagnosticText(Diagnostics.Syntax_Colon_0, syntax);
        output += sys.newLine + sys.newLine;

        // Build up the list of examples.
        var padding = makePadding(marginLength);
        output += getDiagnosticText(Diagnostics.Examples_Colon_0, makePadding(marginLength - examplesLength) + "tsreflect hello.ts") + sys.newLine;
        output += padding + "tsreflect --out foo.d.json foo.ts" + sys.newLine;
        output += padding + "tsreflect @args.txt" + sys.newLine;
        output += sys.newLine;

        output += getDiagnosticText(Diagnostics.Options_Colon) + sys.newLine;

        // Sort our options by their names, (e.g. "--noImplicitAny" comes before "--watch")
        var optsList = optionDeclarations.slice();
        optsList.sort((a, b) => compareValues<string>(a.name.toLowerCase(), b.name.toLowerCase()));

        // We want our descriptions to align at the same column in our output,
        // so we keep track of the longest option usage string.
        var marginLength = 0;
        var usageColumn:string[] = []; // Things like "-d, --declaration" go in here.
        var descriptionColumn:string[] = [];

        for (var i = 0; i < optsList.length; i++) {
            var option = optsList[i];

            // If an option lacks a description,
            // it is not officially supported.
            if (!option.description) {
                continue;
            }

            var usageText = " ";
            if (option.shortName) {
                usageText += "-" + option.shortName;
                usageText += getParamType(option);
                usageText += ", ";
            }

            usageText += "--" + option.name;
            usageText += getParamType(option);

            usageColumn.push(usageText);
            descriptionColumn.push(getDiagnosticText(option.description));

            // Set the new margin for the description column if necessary.
            marginLength = Math.max(usageText.length, marginLength);
        }

        // Special case that can't fit in the loop.
        var usageText = " @<" + getDiagnosticText(Diagnostics.file) + ">";
        usageColumn.push(usageText);
        descriptionColumn.push(getDiagnosticText(Diagnostics.Insert_command_line_options_and_files_from_a_file));
        marginLength = Math.max(usageText.length, marginLength);

        // Print out each row, aligning all the descriptions on the same column.
        for (var i = 0; i < usageColumn.length; i++) {
            var usage = usageColumn[i];
            var description = descriptionColumn[i];
            output += usage + makePadding(marginLength - usage.length + 2) + description + sys.newLine;
        }

        sys.write(output);
        return;

        function getParamType(option: CommandLineOption) {
            if (option.paramType !== undefined) {
                return " " + getDiagnosticText(option.paramType);
            }
            return "";
        }

        function makePadding(paddingLength: number): string {
            return Array(paddingLength + 1).join(" ");
        }
    }
}

exports.DiagnosticCategory = ts.DiagnosticCategory;
exports.executeCommandLine = ts.executeCommandLine;
exports.compile = ts.compile;

// If we were run directly then execute the command line
if(require.main === module) {
    ts.executeCommandLine(ts.sys.args);
}
