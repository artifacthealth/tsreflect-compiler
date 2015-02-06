/// <reference path="../typings/node.d.ts"/>
/// <reference path="../typings/mocha.d.ts"/>
/// <reference path="../typings/chai.d.ts"/>


import fs = require("fs");
import path = require("path");
import chai = require("chai");
import assert = chai.assert;

import expect = chai.expect;

import compiler = require("./tsreflect-compiler");

describe("compiler", () => {

    it('should use CompilerHost, if provided, to read and write files', () => {

        var readCalled = 0, writeCalled = 0;

        function readFile(filename: string, onError?:(message:string) => void): string {

            readCalled++;
            assert.isNotNull(filename);

            if(readCalled == 1) {
                assert.equal(filename, "test.ts");
                return "var Test: string";
            }
            else {
                assert.isTrue(filename.indexOf("lib.d.ts") !== -1, "Expected lib.d.ts");
                return "";
            }
        }

        function writeFile(filename: string, data: string, writeByteOrderMark: boolean, onError?:(message:string) => void) {

            writeCalled++;
            assert.equal(filename, "test.d.json");

            var baseline = {
                "declares": [
                    {
                        "kind": "variable",
                        "name": "Test",
                        "type": "string"
                    }
                ]
            }

            assert.deepEqual(JSON.parse(data), baseline, "Write data changed from baseline");
        }

        var host: compiler.CompilerHost = {
            readFile,
            writeFile
        }

        compiler.compile(["test.ts"], {}, host);

        assert.equal(readCalled, 2);
        assert.equal(writeCalled, 1);
    });
});