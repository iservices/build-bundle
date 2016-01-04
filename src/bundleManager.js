'use strict';

const fs = require('fs');
const path = require('path');

const slash = path.normalize('/');

/*
 * This object can be used to manage bundles that have been created through the registered tasks.
 *
 * @param {string} rootBundlePath - The root path to the generated bundles.  This should match the path outputDir
 *                                  value used with the bundle tasks.
 * @param {string} baseUrlPath - The base url path for all scripts served up.
 * @param {string} [version] - Optional version number.  This should be the same value that was provided to the registerTasks function.
 * @param {string} [name] - Optional name.  This should be the same value that was provided to the registerTasks function.
 */
const BundleManager = function init(rootBundlePath, baseUrlPath, version, name) {
  this.rootBundlePath = path.normalize(rootBundlePath + '/');
  this.version = version;
  this.name = name;

  if (baseUrlPath && baseUrlPath.length > 0 && baseUrlPath.charAt(baseUrlPath.length - 1) !== '/') {
    this.baseUrlPath = baseUrlPath + '/';
  } else {
    this.baseUrlPath = baseUrlPath;
  }

  try {
    this.manifest = JSON.parse(fs.readFileSync(path.normalize(rootBundlePath + '/manifest.json'), 'utf8'));
  } catch (err) {
    this.manifest = null;
  }
};

/*
 * Create a script tag using the given text.
 *
 * @param {string} filePath - The file path for the script tag.
 * @param {string} fileName - The file name for the script tag.  The extension needs to be ommitted as the function sets it.
 * @param {boolean} isMinified - Identifies if the minified version of the file should be used.
 */
function formatScriptTag(filePath, fileName, isMinified) {
  return '<script src="' + filePath.replace('\\', '/') + (isMinified ? fileName + '.min.js' : fileName + '.js') + '"></script>';
}

/**
 * Turn the given data object into script tags.
 *
 * @param {string} baseUrlPath - The base url path for script tags.
 * @param {string} path - The path to create script tags for.
 * @param {object} data - The object to turn into script tags.
 * @param {boolean} data.files - Indicates if there is a bundle for files.
 * @param {object} data.pack - Package data.
 * @param {string} data.pack.version - Optional version number for the package.
 * @param {boolean} data.pack.modules - Indicates if there is a bunlde for a package.
 * @param {string} [version] - Optional version number to add to app bundle paths.
 * @param {string} [name] - Optional name to add to app bundle paths.
 * @param {boolean} isMinified - Indicates if the minified version of files should be used.
 * @returns {string[]} - The tags that were parsed.
 */
function parseScriptTags(baseUrlPath, filePath, data, version, name, isMinified) {
  const result = [];
  if (!data) {
    return result;
  }

  if (data.pack && data.pack.modules) {
    if (data.pack.version) {
      result.push(formatScriptTag(baseUrlPath + 'packages' + filePath, 'package-' + data.pack.version, isMinified));
    } else {
      result.push(formatScriptTag(baseUrlPath + 'packages' + filePath, 'package', isMinified));
    }
  }

  if (data.files) {
    let appPath = baseUrlPath;
    if (version) {
      appPath += version;
    }
    if (name) {
      if (version) {
        appPath += '/' + name;
      } else {
        appPath += name;
      }
    }

    result.push(formatScriptTag(appPath + filePath, 'bundle', isMinified));
  }

  return result;
}

/*
 * Creates the script tags that are required for the given app path.
 *
 * @param {string} appPath - The path to the app to create script tags for.  This path needs to be relative to the rootBundlePath.
 * @param {boolean} [isMinified] - If true the minified version of scripts tags are returned.  The default is false.
 * @returns {script[]} - The script tags for the given app path.
 */
BundleManager.prototype.createScriptTags = function createScriptTags(appPath, isMinified) {
  const result = [];

  if (this.manifest) {
    // root level tags
    Array.prototype.push.apply(result, parseScriptTags(
      this.baseUrlPath,
      path.normalize('/'),
      this.manifest[path.normalize('/')],
      this.version,
      this.name,
      isMinified));

    // framework tags
    Array.prototype.push.apply(result, parseScriptTags(
      this.baseUrlPath,
      path.normalize('/framework/'),
      this.manifest[path.normalize('/framework/')],
      this.version,
      this.name,
      isMinified));

    const tags = [];
    let currentPath = path.normalize('/' + appPath);

    // all other tags
    for (;;) {
      if (currentPath === slash) {
        break;
      }

      Array.prototype.unshift.apply(tags, parseScriptTags(
        this.baseUrlPath,
        currentPath,
        this.manifest[currentPath],
        this.version,
        this.name,
        isMinified));

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

module.exports = BundleManager;
