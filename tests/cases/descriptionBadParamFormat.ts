"use strict";
class Bag<T> {
    /**
     * Constructor
     * @param (optional) a collection of initial values, must have a forEach()
     */
    constructor(elements?: any) {
        if (elements) {
            elements.forEach((element: T): void => {
                // do nothing
            });
        }
    }
}

export = Bag;