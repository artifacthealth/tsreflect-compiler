declare module "tsreflect-compiler" {

    /**
     * Compile specified TypeScript files to generate JSON declaration files. Returns an array of diagnostic
     * information if any errors occur.
     * @param filenames The files to compile.
     * @param options The compiler options to use.
     */
    export function compile(filenames: string[], options: CompilerOptions): Diagnostic[];

    /**
     * Compiler options.
     */
    export interface CompilerOptions {

        /**
         * If true, the default library is not automatically added to the compile list.
         */
        noLib?: boolean;

        /**
         * If true, type checks are not run. This marginally improves compile time. Only use this option if your
         * TypeScript already compiles correctly.
         */
        noCheck?: boolean;

        /**
         * Specifies a single file to compile all TypeScript to. This is ignored for external modules.
         */
        out?: string;

        /**
         * Specifies the output directory.
         */
        outDir?: string;

        /**
         * Suppress errors that are raised when the index operator is used on an object that does not have an
         * index defined on it's type.
         */
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

    /**
     * Table that describes which JsDoc annotations are ignored.
     */
    export interface IgnoreAnnotationTable {
        [key: string]: boolean;
    }

    /**
     * Diagnostic information.
     */
    export interface Diagnostic {
        /**
         * The name of that file that contains the error.
         */
        filename?: string;
        /**
         * The line number of the error.
         */
        line?: number;
        /**
         * The character offset of the error.
         */
        character?: number;
        /**
         * The error message text.
         */
        messageText: string;
        /**
         * The category of the error.
         */
        category: DiagnosticCategory;
        /**
         * The error code.
         */
        code: number;
    }

    /**
     * Enumeration describing type of Diagnostic.
     */
    export enum DiagnosticCategory {
        Warning,
        Error,
        Message,
    }
}
