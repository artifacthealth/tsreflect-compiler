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

/// <reference path="types.ts" />

module ts {

    export var CustomDiagnostics = {

        Disable_type_checks: { code: 10000, category: DiagnosticCategory.Message, key: "Disable type checks." },
        Do_not_emit_accessors: { code: 10001, category: DiagnosticCategory.Message, key: "Do not emit property accessor declarations; instead, emit as fields." },
        Missing_annotation_name: { code: 10002, category: DiagnosticCategory.Error, key: "Missing annotation name." },
        Invalid_annotation_name: { code: 10003, category: DiagnosticCategory.Error, key: "Invalid annotation name." },
        Invalid_annotation_value_0: { code: 10004, category: DiagnosticCategory.Error, key: "Invalid annotation value: {0}" },
        Do_not_emit_private_class_member_declaration: { code: 10005, category: DiagnosticCategory.Error, key: "Do not emit private class member declarations." },
        Do_not_emit_type_information_for_private_class_members: { code: 10006, category: DiagnosticCategory.Error, key: "Do not emit type information for private class members." },
        Do_not_emit_JsDoc_descriptions_in_output: { code: 10007, category: DiagnosticCategory.Error, key: "Do not emit JsDoc descriptions." },
        Do_not_emit_custom_annotations: { code: 10008, category: DiagnosticCategory.Error, key: "Do not emit custom annotations." },
        File_0_must_have_extension_d_json: { code: 10009, category: DiagnosticCategory.Error, key: "File '{0}' must have extension '.d.json'." },
        File_0_has_invalid_json_format_1: { code: 10010, category: DiagnosticCategory.Error, key: "File '{0}' has invalid JSON format: {1}" },
        Error_parsing_JsDoc_comment_on_line_0_of_comment_1: { code: 10011, category: DiagnosticCategory.Error, key: "Error parsing JsDoc comment on line {0} of comment: {1}." }
    }
}
