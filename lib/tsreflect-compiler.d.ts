declare module "tsreflect-compiler" {

    export interface Diagnostic {
        filename?: string;
        line?: number;
        character?: number;
        messageText: string;
        category: DiagnosticCategory;
        code: number;
    }

    export enum DiagnosticCategory {
        Warning,
        Error,
        Message,
    }

    export interface IgnoreAnnotationTable {
        [key: string]: boolean;
    }

    export interface CompilerOptions {
        noLib?: boolean;
        noCheck?: boolean;
        out?: string;
        outDir?: string;

        suppressImplicitAnyIndexErrors?: boolean;

        /**
         * Warn on expressions and declarations with an implied any type
         */
        noImplicitAny?: boolean;

        /**
         * If true, JsDoc description is not included in output. Default is false.
         */
        removeComments?: boolean;

        /**
         * Path to the lib.d.json file relative to compiler javascript source.
         */
        libPath?: string;

        /**
         * Do not emit property accessor declarations.
         */
        removeAccessors?: boolean;

        /**
         * Do not emit custom annotations in output.
         */
        removeAnnotations?: boolean;

        /**
         * Do not emit private class member declarations.
         */
        removePrivates?: boolean;

        /**
         * Do not emit type information for private class members.
         */
        removeTypesOnPrivates?: boolean;

        /**
         * Controls whether or not annotations with a given name are ignored.
         */
        ignoreAnnotation?: IgnoreAnnotationTable;
    }

    export function compile(filenames: string[], options: CompilerOptions): Diagnostic[];
}
