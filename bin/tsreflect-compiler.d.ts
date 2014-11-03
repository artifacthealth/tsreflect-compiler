declare module "tsreflect" {

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

    export interface CompilerOptions {
        noLib?: boolean;
        noCheck?: boolean;
        out?: string;
        outDir?: string;

        /**
         * Warn on expressions and declarations with an implied any type
         */
        noImplicitAny?: boolean;

        /**
         * If true, JsDoc description is not included in output. Default is false.
         */
        removeComments?: boolean;

        /**
         * Path to the lib.d.ts file relative to compiler javascript source.
         */
        libPath?: string;

        /**
         * Emit property accessor declarations.
         */
        accessors?: boolean;

        /**
         * Include custom annotations in output.
         */
        annotations?: boolean;

        /**
         * Do not emit private class member declarations.
         */
        removePrivates?: boolean;

        /**
         * Emit type information, if accessible, for private class members.
         */
        typePrivates?: boolean;
    }

    export function compile(filenames: string[], options: CompilerOptions): Diagnostic[];
}
