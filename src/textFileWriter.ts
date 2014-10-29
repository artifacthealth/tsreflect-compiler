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

module ts {

    export interface ITextFileWriter {

        filePath: string;
        write(text: string, onError?: (message: string) => void): void;
    }

    export class TextFileWriter implements ITextFileWriter {

        private _compilerHost: CompilerHost;
        private _compilerOptions: CompilerOptions;

        constructor(program: Program, public filePath: string) {

            this._compilerHost = program.getCompilerHost();
            this._compilerOptions = program.getCompilerOptions();
        }

        write(text: string, onError?: (message: string) => void): void {

            this._compilerHost.writeFile(this.filePath, text, this._compilerOptions.emitBOM, onError);
        }
    }
}