module.exports = function(grunt) {

    grunt.loadNpmTasks("grunt-contrib-clean");
    grunt.loadNpmTasks("grunt-typescript");
    grunt.loadNpmTasks("grunt-contrib-watch");
    grunt.loadNpmTasks("grunt-contrib-concat");
    grunt.loadNpmTasks("grunt-contrib-copy");
    grunt.loadNpmTasks("grunt-mocha-test");
    grunt.loadNpmTasks("grunt-shell");

    // Project configuration.
    grunt.initConfig({
        pkg: grunt.file.readJSON("package.json"),

        clean: {
            build: {
                src: [
                    "build/"
                ]
            },
            lib: {
                src: [
                    "lib/tsreflect-compiler.js"
                ]
            }
        },

        typescript: {
            build: {
                options: {
                    target: "es5",
                    sourceMap: true,
                    declaration: false,
                    noImplicitAny: true
                },
                src: ['src/compiler.ts'],
                dest: 'build/tsreflect-compiler.js'
            },
            tests: {
                options: {
                    target: "es5",
                    module: "commonjs",
                    sourceMap: true,
                    noImplicitAny: true,
                    basePath: 'tests/'
                },
                src: ['tests/**/*.tests.ts'],
                dest: 'build/'
            }
        },

        concat: {
            lib: {
                options: {
                    banner: grunt.file.read("COPYRIGHT.txt")
                },
                src: ['build/tsreflect-compiler.js'],
                dest: 'lib/tsreflect-compiler.js'
            }
        },

        copy: {
            build: {
                files: [
                    {
                        expand: true,
                        cwd: 'lib/',
                        src: [
                            'lib.d.ts',
                            'lib.core.d.ts',
                            'tsreflect-compiler.config.json'
                        ],
                        dest: 'build/'
                    }
                ]
            }
        },

        // Use built compiler to generated .d.json for lib.d.ts
        shell: {
            lib: {
                options: {
                    execOptions: {
                        cwd: 'lib/'
                    }
                },
                command: 'node tsreflect-compiler.js lib.d.ts'
            },
            libCore: {
                options: {
                    execOptions: {
                        cwd: 'lib/'
                    }
                },
                command: 'node tsreflect-compiler.js lib.core.d.ts lib.scriptHost.d.ts lib.webworker.d.ts'
            },
            libDom: {
                options: {
                    execOptions: {
                        cwd: 'lib/'
                    }
                },
                command: 'node tsreflect-compiler.js lib.dom.d.ts'
            }
        },

        watch: {
            typescript: {
                files: [
                    "src/**/*.ts",
                    "typings/**/*.ts"
                ],
                tasks: [ "typescript:build" ]
            }
        },

        mochaTest: {
            tests: {
                options: {
                    reporter: 'spec'
                },
                src: ['build/**/*.tests.js']
            }
        }
    });

    // Default task(s).
    grunt.registerTask("default", [ "build", "lib", "tests" ]);
    grunt.registerTask("build", [ "clean:build", "typescript:build", "copy:build" ]);
    grunt.registerTask("lib", [ "clean:lib", "concat:lib", "shell:lib", "shell:libCore", "shell:libDom" ]);
    grunt.registerTask("tests", [ "typescript:tests", "mochaTest:tests" ]);
};