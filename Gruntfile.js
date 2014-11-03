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
            bin: {
                src: [
                    "bin/lib.d.ts",
                    "bin/lib.d.json",
                    "bin/tsreflect-compiler.d.ts",
                    "bin/tsreflect-compiler.js"
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
                src: ['tests/run.ts'],
                dest: 'build/'
            }
        },

        concat: {
            bin: {
                options: {
                    banner: grunt.file.read("COPYRIGHT.txt")
                },
                src: ['build/tsreflect-compiler.js'],
                dest: 'bin/tsreflect-compiler.js'
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
                            'lib.core.d.ts'
                        ],
                        dest: 'build/'
                    }
                ]
            },
            bin: {
                files: [
                    {
                        expand: true,
                        cwd: 'lib/',
                        src: [
                            'tsreflect-compiler.d.ts',
                            'lib.d.ts',
                            'lib.core.d.ts'
                        ],
                        dest: 'bin/'
                    }
                ]
            }
        },

        // Use built compiler to generated .d.json for lib.d.ts
        shell: {
            bin: {
                options: {
                    execOptions: {
                        cwd: 'bin/'
                    }
                },
                command: 'node tsreflect-compiler.js lib.d.ts'
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
                src: ['build/run.js']
            }
        }
    });

    // Default task(s).
    grunt.registerTask("default", [ "build", "bin", "tests" ]);
    grunt.registerTask("build", [ "clean:build", "typescript:build", "copy:build" ]);
    grunt.registerTask("bin", [ "clean:bin", "concat:bin", "copy:bin", "shell:bin" ]);
    grunt.registerTask("tests", [ "typescript:tests", "mochaTest:tests" ]);
};