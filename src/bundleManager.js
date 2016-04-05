'use strict';

const fs = require('fs');
const path = require('path');

const slash = path.normalize('/');

/**
 * This object can be used to manage bundles that have been created through the registered tasks.
 *
 * @constructor
 * @param {Object} opts - The configuration object.
 * @param {string} opts.rootBundlePath - The root path to the generated bundles.  This should match the path outputDir
 *                                       value used with the bundle tasks.
 * @param {string} [opts.version] - Optional version number.  This should be the same value that was provided to the registerTasks function.
 */
const BundleManager = function (opts) {
  this.rootBundlePath = path.normalize(opts.rootBundlePath + '/');
  this.version = opts.version;

  try {
    this.manifest = JSON.parse(fs.readFileSync(path.normalize(this.rootBundlePath + '/manifest.json'), 'utf8'));
  } catch (err) {
    this.manifest = null;
  }
};

/**
 * Create a script tag using the given text.
 *
 * @param {string} filePath - The file path for the script tag.
 * @param {string} fileName - The file name for the script tag.  The extension needs to be ommitted as the function sets it.
 * @param {boolean} isMinified - Identifies if the minified version of the file should be used.
 * @param {string} [attr] - Optional attribute to include in the script tag such as async or defer.
 * @returns {string} The formatted script tag.
 */
function formatScriptTag(filePath, fileName, isMinified, attr) {
  const attrText = attr ? ' ' + attr : '';
  return '<script src="' + (filePath + (isMinified ? fileName + '.min.js' : fileName + '.js')).replace(/\\/g, '/') + '"' + attrText + '></script>';
}

/**
 * Turn the given data object into script tags.
 *
 * @param {string} baseUrlPath - The base url path for script tags.
 * @param {string} filePath - The path to create script tags for.
 * @param {object} data - The object to turn into script tags.
 * @param {boolean} data.files - Indicates if there is a bundle for files.
 * @param {object} data.pack - Package data.
 * @param {string} data.pack.version - Optional version number for the package.
 * @param {boolean} data.pack.modules - Indicates if there is a bunlde for a package.
 * @param {string} [version] - Optional version number to add to app bundle paths.
 * @param {boolean} isMinified - Indicates if the minified version of files should be used.
 * @param {string} [attr] - Optional attribute to include in the script tag such as async or defer.
 * @returns {string[]} - The tags that were parsed.
 */
function parseScriptTags(baseUrlPath, filePath, data, version, isMinified, attr) {
  const result = [];
  if (!data) {
    return result;
  }

  if (data.pack && data.pack.modules) {
    if (data.pack.version) {
      result.push(formatScriptTag(baseUrlPath + 'packages' + filePath, 'package-' + data.pack.version, isMinified, attr));
    } else {
      result.push(formatScriptTag(baseUrlPath + 'packages' + filePath, 'package', isMinified, attr));
    }
  }

  if (data.files) {
    let appPath = baseUrlPath + 'apps';
    if (version) {
      appPath += '/' + version;
    }

    result.push(formatScriptTag(appPath + filePath, 'bundle', isMinified, attr));
  }

  return result;
}

/**
 * Creates the script tags that are required for the given app path.
 *
 * @param {string} appPath - The path to the app to create script tags for.  This path needs to be relative to the rootBundlePath.
 * @param {string} [baseUrlPath] - The base url path for all scripts served up.  Defaults to /.
 * @param {boolean} [isMinified] - If true the minified version of scripts tags are returned.  The default is false.
 * @param {string} [attr] - An optional attribute to include with the tags such as async or defer.
 * @returns {script[]} - The script tags for the given app path.
 */
BundleManager.prototype.createScriptTags = function (appPath, baseUrlPath, isMinified, attr) {
  const result = [];

  let baseUrl = baseUrlPath;
  if (baseUrlPath) {
    if (baseUrlPath.length > 0 && baseUrlPath.charAt(baseUrlPath.length - 1) !== '/') {
      baseUrl = baseUrlPath + '/';
    }
  } else {
    baseUrl = '/';
  }

  if (this.manifest) {
    // root level tags
    Array.prototype.push.apply(result, parseScriptTags(
      baseUrl,
      path.normalize('/'),
      this.manifest[path.normalize('/')],
      this.version,
      isMinified,
      attr));

    // framework tags
    Array.prototype.push.apply(result, parseScriptTags(
      baseUrl,
      path.normalize('/framework/'),
      this.manifest[path.normalize('/framework/')],
      this.version,
      isMinified,
      attr));

    const tags = [];
    let currentPath = path.normalize('/' + appPath + '/').toLowerCase();

    // all other tags
    for (;;) {
      if (currentPath === slash) {
        break;
      }

      Array.prototype.unshift.apply(tags, parseScriptTags(
        baseUrl,
        currentPath,
        this.manifest[currentPath],
        this.version,
        isMinified,
        attr));

      currentPath = path.normalize(currentPath + '/..');
      if (currentPath === '.' || currentPath === slash) {
        currentPath = slash;
      } else {
        currentPath = currentPath + slash;
      }
    }

    if (tags.length > 0) {
      Array.prototype.push.apply(result, tags);
    }
  }

  return result;
};

/**
 * Check to see if the given path is an app or not.
 *
 * @param {String} appPath - The app path to check.
 * @returns {Boolean} If the given app path is in fact an app, true will be returned, otherwise false will be returned.
 */
BundleManager.prototype.isApp = function (appPath) {
  const normPath = path.normalize('/' + appPath + '/').toLowerCase();
  if (this.manifest && this.manifest[normPath]) {
    return this.manifest[normPath].isApp;
  }
  return false;
};

module.exports = BundleManager;
