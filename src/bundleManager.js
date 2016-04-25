'use strict';

const path = require('path');
const fto = require('file-tree-object');

const appBundleDevName = 'bundle.js';
const appBundleMinName = 'bundle.min.js';
const packageBundleDevPattern = /bundle(?!.*\.min\.js$).*\.js$/;
const packageBundleMinPattern = /bundle.*\.min\.js$/;

/**
 * This object can be used to manage bundles that have been created through the registered tasks.
 *
 * @constructor
 * @param {Object} opts - The configuration object.
 * @param {string} opts.inputDir - The root path to the generated bundles.  This should match the outputDir
 *                                 value used with the bundle task.
 * @param {String} opts.baseUrlPath - The base path prepended to the script urls.
 * @param {string} [opts.version] - Optional version number.  This should be the same value that was provided to the registerTasks function.
 */
const BundleManager = function (opts) {
  this.inputDir = path.join(opts.inputDir);
  this.baseUrlPath = opts.baseUrlPath || '/';
  this.version = opts.version || '';
  this.appsName = opts.appsName || 'apps';
  this.packagesName = opts.packagesName || 'packages';

  this.reset();
};

/**
 * Format a script tag.
 * @param {String} fileType - The type of script.  Either 'apps' or 'packages'.
 * @param {TreeNode} file - The file to create a script tag for.
 * @returns {String} The script tag.
 */
BundleManager.prototype.formatScriptTag = function (fileType, file) {
  return '<script src="' +
         path.join(this.baseUrlPath,
                   fileType,
                   (fileType === this.packagesName ? '' : this.version),
                   file.getPathFromRoot())
          .replace(/\\/g, '/') + '" defer></script>';
};

/**
 * Build a single set of script tags.
 * @param {TreeNode} dir - The app directory to create a tag set for.
 * @param {TreeNode} packDir - The package directory that corresponds to the given dir.
 * @param {Stirng} appBundleName - The name of the app bundle.
 * @param {Array} result - The array to add the resulting script tags to.
 * @returns {void}
 */
BundleManager.prototype.buildScriptTag = function (dir, packDir, appBundleName, result) {
  // add app
  const app = dir.getByPath(appBundleName);
  if (app) {
    result.unshift(this.formatScriptTag(this.appsName, app));
  }
  // add package
  if (packDir) {
    const packFiles = packDir.getFilesByPattern((appBundleName === appBundleDevName) ? packageBundleDevPattern : packageBundleMinPattern);
    if (packFiles.length > 0) {
      result.unshift(this.formatScriptTag(this.packagesName, packFiles[0]));
    }
  }
};

/**
 * Build all script tags for the given app.
 * @param {TreeNode} appsDir - The root apps directory.
 * @param {TreeNode} packagesDir - The root packages directory.
 * @param {TreeNode} dir - The app to create tags for.
 * @param {Boolean} minify - If true create minified script tags.
 * @param {Array} result - The array to add the resulting script tags to.
 * @returns {void}
 */
BundleManager.prototype.buildScriptTags = function (appsDir, packagesDir, dir, minify, result) {
  if (!dir) {
    return;
  }

  const isRoot = (dir === appsDir);

  // add in framework just before root bundles
  if (isRoot) {
    const appFwkDir = dir.getByPath('framework');
    const packageFwkDir = packagesDir ? packagesDir.getByPath('framework') : null;
    if (appFwkDir) {
      if (minify) {
        this.buildScriptTag(appFwkDir, packageFwkDir, appBundleMinName, result);
      } else {
        this.buildScriptTag(appFwkDir, packageFwkDir, appBundleDevName, result);
      }
    }
  }

  // get corresponding package directory
  let packDir = null;
  if (isRoot) {
    packDir = packagesDir;
  } else {
    packDir = packagesDir ? packagesDir.getByPath(dir.getPathFromRoot()) : null;
  }

  // add in bundles
  if (minify) {
    this.buildScriptTag(dir, packDir, appBundleMinName, result);
  } else {
    this.buildScriptTag(dir, packDir, appBundleDevName, result);
  }

  // recurse
  if (!isRoot) {
    this.buildScriptTags(appsDir, packagesDir, dir.parent, minify, result);
  }
};

/**
 * Read in the files that make up the bundles.
 * @returns {void}
 */
BundleManager.prototype.reset = function () {
  this.manifestDev = {};
  this.manifestMin = {};
  const tree = fto.createTreeSync(this.inputDir);

  // get apps and packages directories
  const appsDir = tree.getByPath(path.join(this.version, this.appsName));
  if (!appsDir) {
    return;
  }
  const packagesDir = tree.getByPath(this.packagesName);

  // make directories roots
  appsDir.parent = null;
  if (packagesDir) {
    packagesDir.parent = null;
  }

  // loop through all of the apps and build manifest
  appsDir.forEachDirectory(function (dir) {
    // bail if this is a lib bundle
    if (dir.directories.length) {
      return;
    }

    // bail if this is the framework
    if (dir.getPathFromRoot() === path.join(this.version, 'framework')) {
      return;
    }

    // dev tags
    const scriptsDev = [];
    this.buildScriptTags(appsDir, packagesDir, dir, false, scriptsDev);
    if (scriptsDev.length) {
      this.manifestDev[dir.getPathFromRoot().toLowerCase() + path.sep] = scriptsDev;
    }

    // min tags
    const scriptsMin = [];
    this.buildScriptTags(appsDir, packagesDir, dir, true, scriptsMin);
    if (scriptsMin.length) {
      this.manifestMin[dir.getPathFromRoot().toLowerCase() + path.sep] = scriptsMin;
    }
  }.bind(this), { recurse: true });
};

/**
 * Get the script tags for the given app path.
 * @param {String} appPath - The path for the app to get script tags for.
 * @param {minify} minify - When false, unminified script tags are returned.  Default is true.
 * @returns {Array} The script tags for the app or undefined if there isn't an app with the given path.
 */
BundleManager.prototype.getScriptTags = function (appPath, minify) {
  let normPath = path.join(appPath, '/').toLowerCase();
  if (normPath.charAt(0) === path.sep) {
    normPath = normPath.slice(1);
  }
  if (minify || minify === undefined) {
    return this.manifestMin[normPath];
  }
  return this.manifestDev[normPath];
};

module.exports = BundleManager;
