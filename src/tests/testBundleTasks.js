/* eslint-env node, mocha */
'use strict';

const gulp = require('gulp');
const del = require('del');
const path = require('path');
const fs = require('fs');

/**
 * Unit tests for registerTasks function.
 */
describe('registerTasks', function () {
  gulp.on('stop', function () {
    process.exit(0); // need this call to end long running watch process
  });

  it('simple task setup works as expected.', function (done) {
    this.timeout(5000);
    del.sync(path.normalize(__dirname + '/../../testOutput/simple/'));
    require(__dirname + '/fixtures/tasksSimple/gulpfile');
    gulp.on('task_stop', function (e) {
      if (e.task === 'simple-bundle') {
        fs.statSync(__dirname + '/../../testOutput/simple/dist/apps/chat/bundle.js');
        fs.statSync(__dirname + '/../../testOutput/simple/dist/apps/chat/bundle.min.js');
        fs.statSync(__dirname + '/../../testOutput/simple/dist/apps/chat/bundle.min.js.map');
        fs.statSync(__dirname + '/../../testOutput/simple/dist/apps/chat/group/bundle.js');
        fs.statSync(__dirname + '/../../testOutput/simple/dist/apps/chat/group/bundle.min.js');
        fs.statSync(__dirname + '/../../testOutput/simple/dist/apps/chat/group/bundle.min.js.map');
        done();
      }
    });
    gulp.start('simple-bundle');
  });

  it('task setup with framework works as expected.', function (done) {
    this.timeout(5000);
    del.sync(path.normalize(__dirname + '/../../testOutput/fwk/'));
    require(__dirname + '/fixtures/tasksWithFramework/gulpfile');
    gulp.on('task_stop', function (e) {
      if (e.task === 'fwk-bundle') {
        fs.statSync(__dirname + '/../../testOutput/fwk/dist/apps/chat/bundle.js');
        fs.statSync(__dirname + '/../../testOutput/fwk/dist/apps/chat/bundle.min.js');
        fs.statSync(__dirname + '/../../testOutput/fwk/dist/apps/chat/bundle.min.js.map');
        fs.statSync(__dirname + '/../../testOutput/fwk/dist/apps/chat/group/bundle.js');
        fs.statSync(__dirname + '/../../testOutput/fwk/dist/apps/chat/group/bundle.min.js');
        fs.statSync(__dirname + '/../../testOutput/fwk/dist/apps/chat/group/bundle.min.js.map');
        fs.statSync(__dirname + '/../../testOutput/fwk/dist/apps/framework/bundle.js');
        fs.statSync(__dirname + '/../../testOutput/fwk/dist/apps/framework/bundle.min.js');
        fs.statSync(__dirname + '/../../testOutput/fwk/dist/apps/framework/bundle.min.js.map');
        done();
      }
    });
    gulp.start('fwk-bundle');
  });

  it('task setup with packages works as expected.', function (done) {
    this.timeout(5000);
    del.sync(path.normalize(__dirname + '/../../testOutput/pck/'));
    require(__dirname + '/fixtures/tasksWithPackage/gulpfile');
    gulp.on('task_stop', function (e) {
      if (e.task === 'pck-bundle') {
        fs.statSync(__dirname + '/../../testOutput/pck/dist/apps/chat/bundle.js');
        fs.statSync(__dirname + '/../../testOutput/pck/dist/apps/chat/bundle.min.js');
        fs.statSync(__dirname + '/../../testOutput/pck/dist/apps/chat/bundle.min.js.map');
        fs.statSync(__dirname + '/../../testOutput/pck/dist/apps/chat/group/bundle.js');
        fs.statSync(__dirname + '/../../testOutput/pck/dist/apps/chat/group/bundle.min.js');
        fs.statSync(__dirname + '/../../testOutput/pck/dist/apps/chat/group/bundle.min.js.map');
        fs.statSync(__dirname + '/../../testOutput/pck/dist/apps/framework/bundle.js');
        fs.statSync(__dirname + '/../../testOutput/pck/dist/apps/framework/bundle.min.js');
        fs.statSync(__dirname + '/../../testOutput/pck/dist/apps/framework/bundle.min.js.map');
        fs.statSync(__dirname + '/../../testOutput/pck/dist/packages/bundle-1.0.0.js');
        fs.statSync(__dirname + '/../../testOutput/pck/dist/packages/bundle-1.0.0.min.js');
        fs.statSync(__dirname + '/../../testOutput/pck/dist/packages/bundle-1.0.0.min.js.map');
        done();
      }
    });
    gulp.start('pck-bundle');
  });
});
