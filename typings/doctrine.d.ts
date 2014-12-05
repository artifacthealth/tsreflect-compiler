declare module "doctrine" {

    export interface IParseOptions {

        unwrap?: boolean;
        tags?: string[];
        recoverable?: boolean;
        sloppy?: boolean;
        lineNumbers?: boolean;
    }

    export function parse(comment: string, options: IParseOptions): IDoctrineParseResults;
    export function unwrapComment(comment: string): string;
}

interface IDoctrineParseResults {

    description: string;
    tags: IDoctrineTagInformation[];
}

interface IDoctrineTagInformation {

    title: string;
    description: string;
    name: string;
    type: any;
}

