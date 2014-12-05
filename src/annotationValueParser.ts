/*! *****************************************************************************
 The source code contained in this file was originally from JSON v3.3.2 by
 Kit Cambridge. It has been modified by Artifact Health, LLC. The original copyright
 notice is provide below for informational purposes only.

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

/* JSON v3.3.2 | https://bestiejs.github.io/json3 | Copyright 2012-2014, Kit Cambridge | http://kit.mit-license.org */

module ts {

    // Internal: A map of escaped control characters and their unescaped
    // equivalents.
    var unescapes: { [key: number]: string } = {

        92: "\\",
        34: '"',
        47: "/",
        98: "\b",
        116: "\t",
        110: "\n",
        102: "\f",
        114: "\r"
    }

    // Generate a unique name for anonymous properties that is extremely unlikely to be used by someone else
    var anonymousName = "__anonymous" + (new Date().getTime()).toString();

    // Internal: Stores the parser state.
    var _index: number,
        _source: string;

    // Internal: Resets the parser state and throws a `SyntaxError`.
    function abort (message: string) {
        reset();
        throw SyntaxError(message);
    }

    // Reset the state of the parser
    function reset() {
        _index = _source = null;
    }

    // Internal: Returns the next token, or `"$"` if the parser has reached
    // the end of the source string. A token may be a string, number, `null`
    // literal, or Boolean literal.
    function lex (): any {
        var source: string = _source,
            length = source.length,
            value: string,
            begin: number,
            position: number,
            isSigned: boolean,
            charCode: number;

        while (_index < length) {
            charCode = source.charCodeAt(_index);
            switch (charCode) {
                case 9:
                case 10:
                case 13:
                case 32:
                    // Skip whitespace tokens, including tabs, carriage returns, line
                    // feeds, and space characters.
                    _index++;
                    break;
                case 123:
                case 125:
                case 91:
                case 93:
                case 58:
                case 44:
                    // Parse a punctuator token (`{`, `}`, `[`, `]`, `:`, or `,`) at
                    // the current position.
                    value = source[_index];
                    _index++;
                    return value;
                case 34:
                    // `"` delimits a JSON string; advance to the next character and
                    // begin parsing the string. String tokens are prefixed with the
                    // sentinel `@` character to distinguish them from punctuators and
                    // end-of-string tokens.
                    for (value = "@", _index++; _index < length;) {
                        charCode = source.charCodeAt(_index);
                        if (charCode < 32) {
                            // Unescaped ASCII control characters (those with a code unit
                            // less than the space character) are not permitted.
                            abort("Unescaped ASCII control characters are not permitted.");
                        } else if (charCode == 92) {
                            // A reverse solidus (`\`) marks the beginning of an escaped
                            // control character (including `"`, `\`, and `/`) or Unicode
                            // escape sequence.
                            charCode = source.charCodeAt(++_index);
                            switch (charCode) {
                                case 92:
                                case 34:
                                case 47:
                                case 98:
                                case 116:
                                case 110:
                                case 102:
                                case 114:
                                    // Revive escaped control characters.
                                    value += unescapes[charCode];
                                    _index++;
                                    break;
                                case 117:
                                    // `\u` marks the beginning of a Unicode escape sequence.
                                    // Advance to the first character and validate the
                                    // four-digit code point.
                                    begin = ++_index;
                                    for (position = _index + 4; _index < position; _index++) {
                                        charCode = source.charCodeAt(_index);
                                        // A valid sequence comprises four hexdigits (case-
                                        // insensitive) that form a single hexadecimal value.
                                        if (!(charCode >= 48 && charCode <= 57 || charCode >= 97 && charCode <= 102 || charCode >= 65 && charCode <= 70)) {
                                            // Invalid Unicode escape sequence.
                                            abort("Invalid Unicode escape sequence.");
                                        }
                                    }
                                    // Revive the escaped character.
                                    value += parseInt(source.slice(begin, _index), 16);
                                    break;
                                default:
                                    // Invalid escape sequence.
                                    abort("Invalid escape sequence.");
                            }
                        } else {
                            if (charCode == 34) {
                                // An unescaped double-quote character marks the end of the
                                // string.
                                break;
                            }

                            charCode = source.charCodeAt(_index);
                            begin = _index;
                            // Optimize for the common case where a string is valid.
                            while (charCode >= 32 && charCode != 92 && charCode != 34) {
                                charCode = source.charCodeAt(++_index);
                            }
                            // Append the string as-is.
                            value += source.slice(begin, _index);
                        }
                    }
                    if (source.charCodeAt(_index) == 34) {
                        // Advance to the next character and return the revived string.
                        _index++;
                        return value;
                    }
                    // Unterminated string.
                    abort("Unterminated string.");
                default:
                    // Parse numbers and literals.
                    begin = _index;
                    // Advance past the negative sign, if one is specified.
                    if (charCode == 45) {
                        isSigned = true;
                        charCode = source.charCodeAt(++_index);
                    }
                    // Parse an integer or floating-point value.
                    if (charCode >= 48 && charCode <= 57) {
                        // Leading zeroes are interpreted as octal literals.
                        if (charCode == 48 && ((charCode = source.charCodeAt(_index + 1)), charCode >= 48 && charCode <= 57)) {
                            // Illegal octal literal.
                            abort("Illegal octal literal.");
                        }
                        isSigned = false;
                        // Parse the integer component.
                        for (; _index < length && ((charCode = source.charCodeAt(_index)), charCode >= 48 && charCode <= 57); _index++);
                        // Floats cannot contain a leading decimal point; however, this
                        // case is already accounted for by the parser.
                        if (source.charCodeAt(_index) == 46) {
                            position = ++_index;
                            // Parse the decimal component.
                            for (; position < length && ((charCode = source.charCodeAt(position)), charCode >= 48 && charCode <= 57); position++);
                            if (position == _index) {
                                // Illegal trailing decimal.
                                abort("Illegal trailing decimal.");
                            }
                            _index = position;
                        }
                        // Parse exponents. The `e` denoting the exponent is
                        // case-insensitive.
                        charCode = source.charCodeAt(_index);
                        if (charCode == 101 || charCode == 69) {
                            charCode = source.charCodeAt(++_index);
                            // Skip past the sign following the exponent, if one is
                            // specified.
                            if (charCode == 43 || charCode == 45) {
                                _index++;
                            }
                            // Parse the exponential component.
                            for (position = _index; position < length && ((charCode = source.charCodeAt(position)), charCode >= 48 && charCode <= 57); position++);
                            if (position == _index) {
                                // Illegal empty exponent.
                                abort("Illegal empty exponent.");
                            }
                            _index = position;
                        }
                        // Coerce the parsed value to a JavaScript number.
                        return +source.slice(begin, _index);
                    }
                    // A negative sign may only precede numbers.
                    if (isSigned) {
                        abort("A negative sign may only precede numbers.");
                    }

                    // parse identifier
                    if((charCode >= 65 && charCode <= 90) || (charCode >= 97 && charCode <= 122) || charCode == 95 || charCode == 36) {

                        charCode = source.charCodeAt(++_index);
                        while((charCode >= 65 && charCode <= 90) || (charCode >= 97 && charCode <= 122) || (charCode >= 48 && charCode <= 57) ||  charCode == 95) {
                            charCode = source.charCodeAt(++_index);
                        }
                        value = source.slice(begin, _index);

                        switch(value) {
                            case "true":
                                return true;
                            case "false":
                                return false;
                            case "null":
                                return null;
                            default:
                                return value;
                        }
                    }

                    // Unrecognized token.
                    abort("Unrecognized token.");
            }
        }
        // Return the sentinel `$` character if the parser has reached the end
        // of the source string.
        return "$";
    }

    // Internal: Parses a JSON `value` token.
    function get (value: any): any {

        var results: any,
            hasMembers: boolean;

        if (value == "$") {
            // Unexpected end of input.
            abort("Unexpected end of input.");
        }
        if (typeof value == "string") {
            if (value[0] == "@") {
                // Remove the sentinel `@` character.
                return value.slice(1);
            }
            // Parse object and array literals.
            if (value == "[") {
                // Parses a JSON array, returning a new JavaScript array.
                results = [];
                for (; ; hasMembers || (hasMembers = true)) {
                    value = lex();
                    // A closing square bracket marks the end of the array literal.
                    if (value == "]") {
                        break;
                    }
                    // If the array literal contains elements, the current token
                    // should be a comma separating the previous element from the
                    // next.
                    if (hasMembers) {
                        if (value == ",") {
                            value = lex();
                            if (value == "]") {
                                // Unexpected trailing `,` in array literal.
                                abort("Unexpected trailing `,` in array literal.");
                            }
                        } else {
                            // A `,` must separate each array element.
                            abort("A `,` must separate each array element.");
                        }
                    }
                    // Elisions and leading commas are not permitted.
                    if (value == ",") {
                        abort("Elisions and leading commas are not permitted.");
                    }
                    results.push(get(value));
                }
                return results;
            } else if (value == "{") {
                // Parses a JSON object, returning a new JavaScript object.
                results = {};
                for (; ; hasMembers || (hasMembers = true)) {
                    value = lex();
                    // A closing curly brace marks the end of the object literal.
                    if (value == "}") {
                        break;
                    }
                    // If the object literal contains members, the current token
                    // should be a comma separator.
                    if (hasMembers) {
                        if (value == ",") {
                            value = lex();
                            if (value == "}") {
                                // Unexpected trailing `,` in object literal.
                                abort("Unexpected trailing `,` in object literal.");
                            }
                        } else {
                            // A `,` must separate each object member.
                            abort("A `,` must separate each object member.");
                        }
                    }
                    // Leading commas are not permitted, object property names must be
                    // double-quoted strings or identifiers, and a `:` must separate each property
                    // name and value.
                    if(value == ",") {
                        abort("Leading commas are not permitted.");
                    }
                    if(typeof value != "string") {
                        abort("Invalid property identifier.");
                    }
                    if (lex() != ":") {
                        abort("A ':' must separate each object property.");
                    }
                    results[value[0] == "@" ? value.slice(1) : value] = get(lex());
                }
                return results;
            }
            // Unexpected token encountered.
            abort("Unexpected token encountered.");
        }
        return value;
    }

    function peek(): any {

        var index = _index;
        var ret = lex();
        _index = index;
        return ret;
    }

    export function parseAnnotationValue (source: string): any {

        _index = 0;
        _source = "" + source;

        var value = lex();
        if(peek() == '$') {
            // this is the only value, return it
            var result = get(value);
        }
        else {
            if (value != "[" && value != "{") {
                // We don't have an array or object so make it an object by adding open and close brackets.
                source = ["{ ", source, " }"].join("");
            }

            _index = 0;
            _source = source;

            var result = get(lex());
            // If a JSON string contains multiple tokens, it is invalid.
            if (lex() != "$") {
                abort("Unexpected token.");
            }
        }

        reset();
        return result;
    }
}