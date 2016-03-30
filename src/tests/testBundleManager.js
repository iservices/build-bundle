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
        const bundler = bundle.createManager({
          rootBundlePath: __dirname + '/../../testOutput/bfwk/dist/',
          version: '1.0.1',
          name: 'apps' });
        let tags = bundler.createScriptTags('/chat/group/');
        assert.equal(tags.length, 3, 'wrong number of tags.');
        assert.equal(tags[0], '<script src="/1.0.1/apps/framework/bundle.js"></script>', 'tag 1a is not correct.');
        assert.equal(tags[1], '<script src="/1.0.1/apps/chat/bundle.js"></script>', 'tag 2a is not correct.');
        assert.equal(tags[2], '<script src="/1.0.1/apps/chat/group/bundle.js"></script>', 'tag 3a is not correct.');
        assert.equal(bundler.isApp('/chat/group/'), true, '1a isApp result is incorrect.');
        assert.equal(bundler.isApp('/chat/'), false, '2a isApp result is incorrect.');
        assert.equal(bundler.isApp('/fake/'), false, '3a isApp result is incorrect.');
        assert.equal(bundler.isApp('/'), false, '4a isApp result is incorrect.');
        assert.equal(bundler.isApp('/framework/'), false, '5a isApp result is incorrect.');

        tags = bundler.createScriptTags('/chat/group/', '/', true);
        assert.equal(tags.length, 3, 'wrong number of tags.');
        assert.equal(tags[0], '<script src="/1.0.1/apps/framework/bundle.min.js"></script>', 'tag 1b is not correct.');
        assert.equal(tags[1], '<script src="/1.0.1/apps/chat/bundle.min.js"></script>', 'tag 2b is not correct.');
        assert.equal(tags[2], '<script src="/1.0.1/apps/chat/group/bundle.min.js"></script>', 'tag 3b is not correct.');

        tags = bundler.createScriptTags('/chat/group/', '/', false, 'defer');
        assert.equal(tags.length, 3, 'wrong number of tags.');
        assert.equal(tags[0], '<script src="/1.0.1/apps/framework/bundle.js" defer></script>', 'tag 1c is not correct.');
        assert.equal(tags[1], '<script src="/1.0.1/apps/chat/bundle.js" defer></script>', 'tag 2c is not correct.');
        assert.equal(tags[2], '<script src="/1.0.1/apps/chat/group/bundle.js" defer></script>', 'tag 3c is not correct.');
        done();
      }
    });
    gulp.start('bfwk-bundle');
  });

  it('createScriptTags function works with framework package bundles.', function (done) {
    this.timeout(4000);
    del.sync(path.normalize(__dirname + '/../../testOutput/bfwkp/'));
    require(__dirname + '/fixtures/bundleWithFrameworkPackage/gulpfile');
    gulp.on('task_stop', function (e) {
      if (e.task === 'bfwkp-bundle') {
        const bundler = bundle.createManager({
          rootBundlePath: __dirname + '/../../testOutput/bfwkp/dist/',
          version: '1.0.1',
          name: 'apps' });

        let tags = bundler.createScriptTags('/chat/group/');
        assert.equal(tags.length, 4, 'wrong number of tags.');
        assert.equal(tags[0], '<script src="/packages/framework/package-1.0.0.js"></script>', 'tag 1a is not correct.');
        assert.equal(tags[1], '<script src="/1.0.1/apps/framework/bundle.js"></script>', 'tag 2a is not correct.');
        assert.equal(tags[2], '<script src="/1.0.1/apps/chat/bundle.js"></script>', 'tag 3a is not correct.');
        assert.equal(tags[3], '<script src="/1.0.1/apps/chat/group/bundle.js"></script>', 'tag 4a is not correct.');

        tags = bundler.createScriptTags('/chat/group/', '/', true);
        assert.equal(tags.length, 4, 'wrong number of tags.');
        assert.equal(tags[0], '<script src="/packages/framework/package-1.0.0.min.js"></script>', 'tag 1b is not correct.');
        assert.equal(tags[1], '<script src="/1.0.1/apps/framework/bundle.min.js"></script>', 'tag 2b is not correct.');
        assert.equal(tags[2], '<script src="/1.0.1/apps/chat/bundle.min.js"></script>', 'tag 3b is not correct.');
        assert.equal(tags[3], '<script src="/1.0.1/apps/chat/group/bundle.min.js"></script>', 'tag 4b is not correct.');

        tags = bundler.createScriptTags('/chat/group/', '/', false, 'defer');
        assert.equal(tags.length, 4, 'wrong number of tags.');
        assert.equal(tags[0], '<script src="/packages/framework/package-1.0.0.js" defer></script>', 'tag 1c is not correct.');
        assert.equal(tags[1], '<script src="/1.0.1/apps/framework/bundle.js" defer></script>', 'tag 2c is not correct.');
        assert.equal(tags[2], '<script src="/1.0.1/apps/chat/bundle.js" defer></script>', 'tag 3c is not correct.');
        assert.equal(tags[3], '<script src="/1.0.1/apps/chat/group/bundle.js" defer></script>', 'tag 4c is not correct.');
        done();
      }
    });
    gulp.start('bfwkp-bundle');
  });

  it('createScriptTags function works with bundle bundles.', function (done) {
    this.timeout(4000);
    del.sync(path.normalize(__dirname + '/../../testOutput/bpck/'));
    require(__dirname + '/fixtures/bundleWithPackage/gulpfile');
    gulp.on('task_stop', function (e) {
      if (e.task === 'bpck-bundle') {
        const bundler = bundle.createManager({
          rootBundlePath: __dirname + '/../../testOutput/bpck/dist/',
          name: 'apps' });
        const tags = bundler.createScriptTags('/chat/group/');
        assert.equal(tags.length, 4, 'wrong number of tags.');
        assert.equal(tags[0], '<script src="/packages/package-1.0.0.js"></script>', 'tag 1 is not correct.');
        assert.equal(tags[1], '<script src="/apps/framework/bundle.js"></script>', 'tag 2 is not correct.');
        assert.equal(tags[2], '<script src="/apps/chat/bundle.js"></script>', 'tag 3 is not correct.');
        assert.equal(tags[3], '<script src="/apps/chat/group/bundle.js"></script>', 'tag 4 is not correct.');
        done();
      }
    });
    gulp.start('bpck-bundle');
  });
});
