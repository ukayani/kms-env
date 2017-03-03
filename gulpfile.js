'use strict';

var gulp = require('gulp');
var mocha = require('gulp-mocha');
var istanbul = require('gulp-istanbul');
var gutil = require('gulp-util');
let eslint = require('gulp-eslint');


var sourceFiles = ['index.js', 'lib/**/*.js', 'bin/index.js'];
var testSourceFiles = ['test/**/**.spec.js'];
var allSourceFiles = sourceFiles.concat(testSourceFiles);

gulp.task('test', function (done) {

    gulp.src(sourceFiles)
        .pipe(istanbul()) // Covering files
        .pipe(istanbul.hookRequire()) // Force `require` to return covered files
        .on('finish', function () {
            return gulp.src(testSourceFiles)
                       .pipe(mocha())
                       .on('error', gutil.log)
                       .pipe(istanbul.writeReports()) // Creating the reports after tests ran
                       .pipe(istanbul.enforceThresholds({thresholds: {global: 100}})) // Enforce a coverage of at least 100%
                       .on('end', done);

        })
        .on('error', gutil.log);
});

gulp.task('lint', function () {
    return gulp.src(allSourceFiles)
               .pipe(eslint())
               .pipe(eslint.format())
               .pipe(eslint.failAfterError());
});

gulp.task('default', ['lint']);