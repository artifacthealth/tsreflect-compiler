[![Build Status](https://travis-ci.org/artifacthealth/tsreflect-compiler.svg?branch=master)](https://travis-ci.org/artifacthealth/tsreflect-compiler)

The TsReflect compiler is a modified version of the [TypeScript](http://www.typescriptlang.org/) 1.4 compiler that emits JSON
declaration files containing type information for your TypeScript source files. The JSON declaration files are similar
to the .d.ts declaration files that TypeScript generates. However, the JSON format allows for easier loading of type information
at runtime. Additionally, the compiler leverages [JsDoc](http://usejsdoc.org/) comments to add custom annotations to TypeScript. See the Custom Annotations
section below for more information.

On the [Node](http://nodejs.org/) platform, JSON declaration files may be consumed using the [tsreflect](https://github.com/artifacthealth/tsreflect) module.

### NOTE! Currently, there are not any plans to support any version of TypeScript beyond 1.4. If in the future the TypeScript compiler supports an extensible emitter, this project will be picked up again.

## Installation

The TsReflect Compiler can be installed using the Node Package Manager (npm):

```
npm install tsreflect-compiler
```


## Usage

```shell
node lib/tsreflect-compiler.js hello.ts
```


## Example Output

Below is an example of a simple global class declaration for a ```Calculator``` class containing a single method ```add```.
For more example output, take a look at the JSON declaration file generated for [lib.core.d.ts](https://github.com/artifacthealth/tsreflect-compiler/blob/master/lib/lib.core.d.json).

```
{
    "declares": [
        {
            "kind": "class",
            "name": "Calculator",
            "members": [
                {
                    "kind": "method",
                    "name": "add",
                    "parameters": [
                        {
                            "name": "x",
                            "type": "number"
                        },
                        {
                            "name": "y",
                            "type": "number"
                        }
                    ],
                    "returns": "number"
                }
            ]
        }
    ]
}
```


## Custom Annotations

The TsReflect Compiler leverages [JsDoc](http://usejsdoc.org/) comments to add custom annotations to TypeScript. Similar to
[java annotations](http://en.wikipedia.org/wiki/Java_annotation) or
[C# attributes](https://msdn.microsoft.com/en-us/library/aa288454%28v=vs.71%29.aspx) custom annotations allow for
metadata to be added to TypeScript source code and then included in the JSON declaration files that the TsReflect
Compiler generates.

Custom annotation work alongside standard JsDoc annotations. The TsReflect compiler will ignore all standard JsDoc
annotations. The [tsreflect.config.json](https://github.com/artifacthealth/tsreflect-compiler/blob/master/lib/tsreflect.config.json)
file in the ```lib/``` directory contains a list of ignored annotations. This list can be modified to suite your needs.

For example, custom annotations can be used to add [JPA](http://en.wikipedia.org/wiki/Java_Persistence_API)-style
annotations to classes for an ORM:

```
/**
 * An entity for a Customer.
 * @entity
 * @table "customers"
 */
class Customer {

    /** @id */
    id: number;

    /**
     * The name of the customer.
     * @column name: "customer_name", length: 255
     */
    name: string;
}
```

The above TypeScript generates the following JSON declaration output:
```
{
    "declares": [
	    {
            "kind": "class",
            "name": "Customer",
            "description": "An entity for a Customer.",
            "annotations": [
                {
                    "name": "entity",
                    "value": true
                },
                {
                    "name": "table",
                    "value": "customers"
                }
            ],
            "members": [
                {
                    "kind": "field",
                    "name": "id",
                    "type": "number",
                    "annotations": [
                        {
                            "name": "id",
                            "value": true
                        }
                    ]
                },
                {
                    "kind": "field",
                    "name": "name",
                    "type": "string",
                    "description": "The name of the customer.",
                    "annotations": [
                        {
                            "name": "column",
                            "value": {
                                "name": "customer_name",
                                "length": 255
                            }
                        }
                    ]
                }
            ]
        }
    ]
}
```


## Grunt Plug-in

There is a Grunt plug-in available for the TsReflect compiler to allow for generating JSON declaration files
as part of a Grunt build process. See the [grunt-tsreflect](https://github.com/artifacthealth/grunt-tsreflect) project.



## Gulp Plug-in

There is a Gulp plug-in available for the TsReflect compiler to allow for generating JSON declaration files
as part of a Gulp build process. See the [gulp-tsreflect](https://github.com/rogierschouten/gulp-tsreflect) project.



## CommonJS Module

The TsReflect compiler can be included as a CommonJS module in a NodeJS application. A typescript declaration file
 ```tsreflect-compiler.d.ts``` is included in the ```lib``` directory. Below is an example of executing
the compiler from a TypeScript program.

```
/// <reference path="./lib/tsreflect-compiler.d.ts" />
import compiler = require("tsreflect-compiler");

var options = {
    outDir: 'build/'
}
var diagnostics = compiler.compile("./hello.ts", options);
```

Executing the code above will generate a file called `hello.d.json` in the build directory. Any errors will be returned as an array and
assigned to the ```diagnostics``` variable.


### Documentation

* [`compile`](#compile)
* [`CompilerOptions`](#CompilerOptions)
* [`CompilerHost`](#CompilerHost)
* [`Diagnostic`](#Diagnostic)
* [`DiagnosticCategory`](#DiagnosticCategory)

<a name="compile"></a>
#### compile(filenames, options, host)
Compile specified TypeScript files to generate JSON declaration files. Returns an array of diagnostic
information if any errors occur.

__Parameters__
* filenames `string[]`  - The files to compile.
* options `CompilerOptions`  - The compiler options to use.
* host `CompilerHost`  - Optional. The compiler host to use.

__Returns:__ `Diagnostic[]`


<a name="CompilerOptions"></a>
#### CompilerOptions Interface
--------------------
Compiler options.
* [`noLib`](#noLib)
* [`noCheck`](#noCheck)
* [`out`](#out)
* [`outDir`](#outDir)
* [`suppressImplicitAnyIndexErrors`](#suppressImplicitAnyIndexErrors)
* [`noImplicitAny`](#noImplicitAny)
* [`removeComments`](#removeComments)
* [`libPath`](#libPath)
* [`removeAccessors`](#removeAccessors)
* [`removeAnnotations`](#removeAnnotations)
* [`removePrivates`](#removePrivates)
* [`removeTypesOnPrivates`](#removeTypesOnPrivates)
* [`ignoreAnnotation`](#ignoreAnnotation)

<a name="noLib"></a>
##### noLib
If true, the default library is not automatically added to the compile list.

__Type:__ `boolean`


<a name="noCheck"></a>
##### noCheck
If true, type checks are not run. This marginally improves compile time. Only use this option if your
TypeScript already compiles correctly.

__Type:__ `boolean`


<a name="out"></a>
##### out
Specifies a single file to compile all TypeScript to. This is ignored for external modules.

__Type:__ `string`


<a name="outDir"></a>
##### outDir
Specifies the output directory.

__Type:__ `string`


<a name="suppressImplicitAnyIndexErrors"></a>
##### suppressImplicitAnyIndexErrors
Suppress errors that are raised when the index operator is used on an object that does not have an
index defined on it's type.

__Type:__ `boolean`


<a name="noImplicitAny"></a>
##### noImplicitAny
Warn on expressions and declarations with an implied any type

__Type:__ `boolean`


<a name="removeComments"></a>
##### removeComments
If true, JsDoc description is not included in output. Default is false.

__Type:__ `boolean`


<a name="libPath"></a>
##### libPath
Path to the lib.d.json file relative to compiler javascript source.

__Type:__ `string`


<a name="removeAccessors"></a>
##### removeAccessors
Do not emit property accessor declarations.

__Type:__ `boolean`


<a name="removeAnnotations"></a>
##### removeAnnotations
Do not emit custom annotations in output.

__Type:__ `boolean`


<a name="removePrivates"></a>
##### removePrivates
Do not emit private class member declarations.

__Type:__ `boolean`


<a name="removeTypesOnPrivates"></a>
##### removeTypesOnPrivates
Do not emit type information for private class members.

__Type:__ `boolean`


<a name="ignoreAnnotation"></a>
##### ignoreAnnotation
Controls whether or not annotations with a given name are ignored.




<a name="CompilerHost"></a>
#### CompilerHost Interface
--------------------
The compiler host. Allows for control over the interaction of compiler with the file system.
* [`readFile`](#readFile)
* [`writeFile`](#writeFile)

<a name="readFile"></a>
##### readFile(filename, onError)
Reads a file synchronously.

__Parameters__
* filename `string`  - The full path to the file.
* onError - Callback called synchronously to indicate if an error occurred when reading the file. Passed
a single argument containing the error message as a string.

__Returns:__ `string`


<a name="writeFile"></a>
##### writeFile(filename, data, writeByteOrderMark, onError)
Writes a file synchronously.

__Parameters__
* filename `string`  - The full path to the file.
* data `string`  - The data to write.
* writeByteOrderMark `boolean`  - Indicates if the byte order mark should be written.
* onError - Callback called synchronously to indicate if an error occurred when writing the file. Passed
a single argument containing the error message as a string.

__Returns:__ `void`




<a name="Diagnostic"></a>
#### Diagnostic Interface
--------------------
Diagnostic information.
* [`filename`](#filename)
* [`line`](#line)
* [`character`](#character)
* [`messageText`](#messageText)
* [`category`](#category)
* [`code`](#code)

<a name="filename"></a>
##### filename
The name of that file that contains the error.

__Type:__ `string`


<a name="line"></a>
##### line
The line number of the error.

__Type:__ `number`


<a name="character"></a>
##### character
The character offset of the error.

__Type:__ `number`


<a name="messageText"></a>
##### messageText
The error message text.

__Type:__ `string`


<a name="category"></a>
##### category
The category of the error.

__Type:__ `DiagnosticCategory`


<a name="code"></a>
##### code
The error code.

__Type:__ `number`




<a name="DiagnosticCategory"></a>
#### DiagnosticCategory Enumeration
--------------------
Enumeration describing type of Diagnostic.
* Warning
* Error
* Message





