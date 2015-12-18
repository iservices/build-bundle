/* eslint-env node, mocha */
'use strict';

const gulp = require('gulp');
const del = require('del');
const path = require('path');
const assert = require('assert');
const bundle = require('../index');

/**
 * Unit tests for the BundleManager object.
 */
describe('BundleManager', function () {
  it('createScriptTags function works with framework bundles.', function (done) {
    this.timeout(4000);
    del.sync(path.normalize(__dirname + '/../../testOutput/bfwk/'));
    require(__dirname + '/fixtures/bundleWithFramework/gulpfile');
    gulp.on('task_stop', function (e) {
      if (e.task === 'bfwk-bundle') {
        const bundler = bundle.createManager(__dirname + '/../../testOutput/bfwk/dist/', '/', '1.0.1');
        const tags = bundler.createScriptTags('/chat/group/');
        assert.equal(tags.length, 3, 'wrong number of tags.');
        assert.equal('<script src="/apps/1.0.1/framework/bundle.js"></script>', tags[0], 'tag 1 is not correct.');
        assert.equal('<script src="/apps/1.0.1/chat/bundle.js"></script>', tags[1], 'tag 2 is not correct.');
        assert.equal('<script src="/apps/1.0.1/chat/group/bundle.js"></script>', tags[2], 'tag 3 is not correct.');
        done();
      }
    });
    gulp.start('bfwk-bundle');
  });

  it('createScriptTags function works with bundle bundles.', function (done) {
    this.timeout(4000);
    del.sync(path.normalize(__dirname + '/../../testOutput/bpck/'));
    require(__dirname + '/fixtures/bundleWithPackage/gulpfile');
    gulp.on('task_stop', function (e) {
      if (e.task === 'bpck-bundle') {
        const bundler = bundle.createManager(__dirname + '/../../testOutput/bpck/dist/', '/');
        const tags = bundler.createScriptTags('/chat/group/');
        assert.equal(tags.length, 4, 'wrong number of tags.');
        assert.equal('<script src="/packages/package-1.0.0.js"></script>', tags[0], 'tag 1 is not correct.');
        assert.equal('<script src="/apps/framework/bundle.js"></script>', tags[1], 'tag 2 is not correct.');
        assert.equal('<script src="/apps/chat/bundle.js"></script>', tags[2], 'tag 3 is not correct.');
        assert.equal('<script src="/apps/chat/group/bundle.js"></script>', tags[3], 'tag 4 is not correct.');
        done();
      }
    });
    gulp.start('bpck-bundle');
  });
});
