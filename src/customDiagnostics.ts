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
        Emit_accessors: { code: 10001, category: DiagnosticCategory.Message, key: "Emit property accessor declarations." },
        Missing_annotation_name: { code: 10002, category: DiagnosticCategory.Error, key: "Missing annotation name." },
        Invalid_annotation_name: { code: 10003, category: DiagnosticCategory.Error, key: "Invalid annotation name." },
        Annotation_value_must_be_valid_JSON: { code: 10004, category: DiagnosticCategory.Error, key: "Annotation value must be a valid JSON document, not JavaScript." },
        Do_not_emit_private_class_member_declaration: { code: 10005, category: DiagnosticCategory.Error, key: "Do not emit private class member declarations." },
        Emit_type_information_for_private_class_members: { code: 10006, category: DiagnosticCategory.Error, key: "Emit type information, if accessible, for private class members." },
        Do_not_emit_JsDoc_descriptions_in_output: { code: 10007, category: DiagnosticCategory.Error, key: "Do not emit JsDoc descriptions in output." },
        Emit_custom_annotations: { code: 10008, category: DiagnosticCategory.Error, key: "Include custom annotations in output." }
    }
}
