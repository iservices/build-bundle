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
  it('getScriptTags function works with framework bundles.', function (done) {
    this.timeout(100000);
    del.sync(path.normalize(__dirname + '/../../testOutput/bfwk/'));
    require(__dirname + '/fixtures/bundleWithFramework/gulpfile');
    gulp.on('task_stop', function (e) {
      if (e.task === 'bfwk-bundle') {
        const bundler = bundle.createManager({
          inputDir: __dirname + '/../../testOutput/bfwk/dist/',
          version: '1.0.1'
        });
        let tags = bundler.getScriptTags('/chat/group/', false);
        assert.ok(tags, 'a: no tags found');
        assert.equal(tags.length, 3, 'a: wrong number of tags.');
        assert.equal(tags[0], '<script src="/apps/1.0.1/framework/bundle.js" defer></script>', 'tag 1a is not correct.');
        assert.equal(tags[1], '<script src="/apps/1.0.1/chat/bundle.js" defer></script>', 'tag 2a is not correct.');
        assert.equal(tags[2], '<script src="/apps/1.0.1/chat/group/bundle.js" defer></script>', 'tag 3a is not correct.');

        tags = bundler.getScriptTags('/chat/group');
        assert.ok(tags, 'b: no tags found');
        assert.equal(tags.length, 3, 'b: wrong number of tags.');
        assert.equal(tags[0], '<script src="/apps/1.0.1/framework/bundle.min.js" defer></script>', 'tag 1b is not correct.');
        assert.equal(tags[1], '<script src="/apps/1.0.1/chat/bundle.min.js" defer></script>', 'tag 2b is not correct.');
        assert.equal(tags[2], '<script src="/apps/1.0.1/chat/group/bundle.min.js" defer></script>', 'tag 3b is not correct.');

        done();
      }
    });
    gulp.start('bfwk-bundle');
  });

  it('getScriptTags function works with framework package bundles.', function (done) {
    this.timeout(100000);
    del.sync(path.normalize(__dirname + '/../../testOutput/bfwkp/'));
    require(__dirname + '/fixtures/bundleWithFrameworkPackage/gulpfile');
    gulp.on('task_stop', function (e) {
      if (e.task === 'bfwkp-bundle') {
        const bundler = bundle.createManager({
          inputDir: __dirname + '/../../testOutput/bfwkp/dist/',
          version: '1.0.1',
          name: 'apps' });

        let tags = bundler.getScriptTags('/chat/group/', false);
        assert.equal(tags.length, 4, 'a: wrong number of tags.');
        assert.equal(tags[0], '<script src="/packages/framework/bundle-1.0.0.js" defer></script>', 'tag 1a is not correct.');
        assert.equal(tags[1], '<script src="/apps/1.0.1/framework/bundle.js" defer></script>', 'tag 2a is not correct.');
        assert.equal(tags[2], '<script src="/apps/1.0.1/chat/bundle.js" defer></script>', 'tag 3a is not correct.');
        assert.equal(tags[3], '<script src="/apps/1.0.1/chat/group/bundle.js" defer></script>', 'tag 4a is not correct.');

        tags = bundler.getScriptTags('/chat/group/', true);
        assert.equal(tags.length, 4, 'wrong number of tags.');
        assert.equal(tags[0], '<script src="/packages/framework/bundle-1.0.0.min.js" defer></script>', 'tag 1b is not correct.');
        assert.equal(tags[1], '<script src="/apps/1.0.1/framework/bundle.min.js" defer></script>', 'tag 2b is not correct.');
        assert.equal(tags[2], '<script src="/apps/1.0.1/chat/bundle.min.js" defer></script>', 'tag 3b is not correct.');
        assert.equal(tags[3], '<script src="/apps/1.0.1/chat/group/bundle.min.js" defer></script>', 'tag 4b is not correct.');
        done();
      }
    });
    gulp.start('bfwkp-bundle');
  });

  it('getScriptTags function works with bundle bundles.', function (done) {
    this.timeout(100000);
    del.sync(path.normalize(__dirname + '/../../testOutput/bpck/'));
    require(__dirname + '/fixtures/bundleWithPackage/gulpfile');
    gulp.on('task_stop', function (e) {
      if (e.task === 'bpck-bundle') {
        const bundler = bundle.createManager({
          inputDir: __dirname + '/../../testOutput/bpck/dist/',
          name: 'apps' });
        const tags = bundler.getScriptTags('/chat/group/', false);
        assert.ok(tags, 'tags were not found');
        assert.equal(tags.length, 4, 'wrong number of tags.');
        assert.equal(tags[0], '<script src="/packages/bundle-1.0.0.js" defer></script>', 'tag 1 is not correct.');
        assert.equal(tags[1], '<script src="/apps/framework/bundle.js" defer></script>', 'tag 2 is not correct.');
        assert.equal(tags[2], '<script src="/apps/chat/bundle.js" defer></script>', 'tag 3 is not correct.');
        assert.equal(tags[3], '<script src="/apps/chat/group/bundle.js" defer></script>', 'tag 4 is not correct.');
        done();
      }
    });
    gulp.start('bpck-bundle');
  });
});
