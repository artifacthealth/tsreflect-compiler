module moduleWithImportedVariable {

    export module Inner {

        export var d: boolean;
    }

    export import e = Inner.d;
}