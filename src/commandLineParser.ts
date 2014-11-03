/*! *****************************************************************************
 The source code contained in this file was originally from TypeScript by
 Microsoft. It has been modified by Meir Gottlieb. The original copyright notice
 is provide below for informational purposes only.

 Copyright (c) Artifact Health. All rights reserved.
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

/// <reference path="sys.ts"/>
/// <reference path="types.ts"/>
/// <reference path="core.ts"/>
/// <reference path="scanner.ts"/>
/// <reference path="customDiagnostics.ts"/>

module ts {

    export var optionDeclarations: CommandLineOption[] = [
        {
            name: "help",
            shortName: "h",
            type: "boolean",
            description: Diagnostics.Print_this_message
        },
        {
            name: "noLib",
            type: "boolean"
        },
        {
            name: "noCheck",
            type: "boolean",
            description: CustomDiagnostics.Disable_type_checks
        },
        {
            name: "accessors",
            type: "boolean",
            description: CustomDiagnostics.Emit_accessors
        },
        {
            name: "removePrivates",
            type: "boolean",
            description: CustomDiagnostics.Do_not_emit_private_class_member_declaration
        },
        {
            name: "typePrivates",
            type: "boolean",
            description: CustomDiagnostics.Emit_type_information_for_private_class_members
        },
        {
            name: "annotations",
            type: "boolean",
            description: CustomDiagnostics.Emit_custom_annotations
        },
        {
            name: "out",
            type: "string",
            description: Diagnostics.Concatenate_and_emit_output_to_single_file,
            paramType: Diagnostics.FILE
        },
        {
            name: "outDir",
            type: "string",
            description: Diagnostics.Redirect_output_structure_to_the_directory,
            paramType: Diagnostics.DIRECTORY
        },
        {
            name: "removeComment",
            type: "boolean",
            description: CustomDiagnostics.Do_not_emit_JsDoc_descriptions_in_output
        },
        {
            name: "noImplicitAny",
            type: "boolean",
            description: Diagnostics.Warn_on_expressions_and_declarations_with_an_implied_any_type,
        },
        {
            name: "version",
            shortName: "v",
            type: "boolean",
            description: Diagnostics.Print_the_compiler_s_version
        }
    ];

    var shortOptionNames: Map<string> = {};
    var optionNameMap: Map<CommandLineOption> = {};

    forEach(optionDeclarations, option => {
        optionNameMap[option.name.toLowerCase()] = option;

        if (option.shortName) {
            shortOptionNames[option.shortName] = option.name;
        }
    });

    export function parseCommandLine(commandLine: string[]): ParsedCommandLine {
        // Set default compiler option values
        var options: CompilerOptions = {
            // we don't actually emit JS so support all available options
            target: ScriptTarget.ES5,
            module: ModuleKind.CommonJS
        };
        var filenames: string[] = [];
        var errors: Diagnostic[] = [];

        parseStrings(commandLine);
        return {
            options: options,
            filenames: filenames,
            errors: errors
        };

        function parseStrings(args: string[]) {
            var i = 0;
            while (i < args.length) {
                var s = args[i++];
                if (s.charCodeAt(0) === CharacterCodes.at) {
                    parseResponseFile(s.slice(1));
                }
                else if (s.charCodeAt(0) === CharacterCodes.minus) {
                    s = s.slice(s.charCodeAt(1) === CharacterCodes.minus ? 2 : 1).toLowerCase();

                    // Try to translate short option names to their full equivalents.
                    if (hasProperty(shortOptionNames, s)) {
                        s = shortOptionNames[s];
                    }

                    if (hasProperty(optionNameMap, s)) {
                        var opt = optionNameMap[s];

                        // Check to see if no argument was provided (e.g. "--locale" is the last command-line argument).
                        if (!args[i] && opt.type !== "boolean") {
                            errors.push(createCompilerDiagnostic(Diagnostics.Compiler_option_0_expects_an_argument, opt.name));
                        }

                        switch (opt.type) {
                            case "number":
                                options[opt.name] = parseInt(args[i++]);
                                break;
                            case "boolean":
                                options[opt.name] = true;
                                break;
                            case "string":
                                options[opt.name] = args[i++] || "";
                                break;
                            // If not a primitive, the possible types are specified in what is effectively a map of options.
                            default:
                                var value = (args[i++] || "").toLowerCase();
                                if (hasProperty(opt.type, value)) {
                                    options[opt.name] = opt.type[value];
                                }
                                else {
                                    errors.push(createCompilerDiagnostic(opt.error));
                                }
                        }
                    }
                    else {
                        errors.push(createCompilerDiagnostic(Diagnostics.Unknown_compiler_option_0, s));
                    }
                }
                else {
                    filenames.push(s);
                }
            }
        }

        function parseResponseFile(filename: string) {
            var text = sys.readFile(filename);

            if (!text) {
                errors.push(createCompilerDiagnostic(Diagnostics.File_0_not_found, filename));
                return;
            }

            var args: string[] = [];
            var pos = 0;
            while (true) {
                while (pos < text.length && text.charCodeAt(pos) <= CharacterCodes.space) pos++;
                if (pos >= text.length) break;
                var start = pos;
                if (text.charCodeAt(start) === CharacterCodes.doubleQuote) {
                    pos++;
                    while (pos < text.length && text.charCodeAt(pos) !== CharacterCodes.doubleQuote) pos++;
                    if (pos < text.length) {
                        args.push(text.substring(start + 1, pos));
                        pos++;
                    }
                    else {
                        errors.push(createCompilerDiagnostic(Diagnostics.Unterminated_quoted_string_in_response_file_0, filename));
                    }
                }
                else {
                    while (text.charCodeAt(pos) > CharacterCodes.space) pos++;
                    args.push(text.substring(start, pos));
                }
            }
            parseStrings(args);
        }
    }
}
