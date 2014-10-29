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
        removeComments?: boolean;
        sourceRoot?: string;
    }

    export function compile(filenames: string[], options: CompilerOptions): Diagnostic[];
}
