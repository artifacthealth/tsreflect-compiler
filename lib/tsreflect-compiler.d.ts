declare module "tsreflect-compiler" {

    /**
     * Compile specified TypeScript files to generate JSON declaration files. Returns an array of diagnostic
     * information if any errors occur.
     * @param filenames The files to compile.
     * @param options The compiler options to use.
     * @param host Optional. The compiler host to use.
     */
    export function compile(filenames: string[], options: CompilerOptions, host?: CompilerHost): Diagnostic[];

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
        ignoreAnnotation?: { [annotationName: string]: boolean };
    }

    /**
     * The compiler host. Allows for control over the interaction of compiler with the file system.
     */
    export interface CompilerHost {

        /**
         * Reads a file synchronously.
         * @param filename The full path to the file.
         * @param onError  Callback called synchronously to indicate if an error occurred when reading the file. Passed
         * a single argument containing the error message as a string.
         */
        readFile(filename: string, onError?: (message: string) => void): string;

        /**
         * Writes a file synchronously.
         * @param filename The full path to the file.
         * @param data The data to write.
         * @param writeByteOrderMark Indicates if the byte order mark should be written.
         * @param onError Callback called synchronously to indicate if an error occurred when writing the file. Passed
         * a single argument containing the error message as a string.
         */
        writeFile(filename: string, data: string, writeByteOrderMark: boolean, onError?: (message: string) => void): void;
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
