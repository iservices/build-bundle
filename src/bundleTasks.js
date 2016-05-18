/* eslint no-console:0,object-shorthand:0 */
'use strict';

const gulp = require('gulp');
const path = require('path');
const del = require('del');
const browserify = require('browserify');
const minifyify = require('minifyify');
const source = require('vinyl-source-stream');
const buffer = require('vinyl-buffer');
const fto = require('file-tree-object');

const appsPattern = /\.app\.js$/;
const appsOrPackagePattern = /(\.app\.js$)|([\\\/]package\.js$)/;
const frameworkPattern = /^framework[\\\/]/;

/**
 * Returns the path property of the given file.
 * @param {String} file - The file to read the path property from.
 * @returns {String} The path property of the file.
 */
function toPath(file) {
  return file.path;
}

/**
 * Read in a package object.
 * @param {String|TreeNode} file - The file to read in the package from.
 * @returns {Package} The package object that was read in.
 */
function readInPackage(file) {
  let pack = null;
  if (file.path) {
    pack = require(file.path);
  } else {
    pack = require(file);
  }

  return pack.default || pack;
}

/**
 * Get all of the require values found in packages that are the parent of the given folder.
 * @param {TreeNode} dir - The folder to get parent require values for.
 * @param {Boolean} includeDir - If set to true then any package in the dir folder will be included.
 * @returns {Array} An array of the require values.
 */
function getParentPackageRequires(dir, includeDir) {
  const result = [];
  const addToResult = function (packModule) { result.push(packModule.require); };
  let frameworkFlag = false;

  // traverse up the tree
  let parent = includeDir ? dir : dir.parent;
  while (parent) {
    if (parent.getPathFromRoot() === 'framework') {
      frameworkFlag = true;
    }
    const parentPack = parent.getChildByPath('package.js');
    if (parentPack) {
      const parentPackInfo = readInPackage(parentPack);
      if (parentPackInfo.modules) {
        parentPackInfo.modules.forEach(addToResult);
      }
    }
    parent = parent.parent;
  }

  // exlude packages found in the framework
  if (!frameworkFlag && dir.getPathFromRoot() !== 'framework') {
    const frameworkDir = dir.getRoot().getChildByPath('framework');
    if (frameworkDir) {
      const pack = frameworkDir.getChildByPath('package.js');
      if (pack) {
        const packData = readInPackage(pack);
        if (packData.modules) {
          packData.modules.forEach(addToResult);
        }
      }
    }
  }

  return result;
}

/**
 * Bundle the given directory into an app.
 * @param {TreeNode} dir - The directory to bundle into an app.
 * @param {Object} opts - The options.
 * @param {Boolean} minify - If true the resulting bundle will be minified.
 * @param {Function} cb - The callback function to execute when complete.
 * @returns {void}
 */
function bundleApp(dir, opts, minify, cb) {
  const done = cb || function () {};
  const outputPath = path.join(opts.input.appsOutputDir, dir.getPathFromRoot());
  let apps = null;
  let libs = null;
  const externals = [];
  const addToExternals = function (file) { externals.push(file); };

  if (dir === opts.framework.dir) {
    // if this is the framework folder collect all files underneath it
    apps = opts.framework.apps;
    libs = opts.framework.libs;
  } else if (frameworkPattern.test(dir.getPathFromRoot())) {
    // bail if we are in a folder under the framework
    done();
    return;
  } else {
    // collect just the files in this folder
    apps = dir.getFilesByPattern(appsPattern);
    libs = dir.getFilesByPattern(appsOrPackagePattern, { negate: true });
    Array.prototype.push.apply(externals, opts.framework.libs);
  }

  // check for any apps defined in a package.js file
  const packageFile = dir.getByPath('package.js');
  if (packageFile) {
    let packageData = require(packageFile.path);
    if (packageData.default) {
      packageData = packageData.default;
    }
    if (packageData.app) {
      const appPaths = Array.isArray(packageData.app) ? packageData.app : [packageData.app];
      appPaths.forEach(function (appPath) {
        apps.push({
          path: path.resolve(dir.path, appPath)
        });
      });
    }
  }

  // collect list of files to exclude
  let parent = dir.parent;
  while (parent) {
    // bail if a parent app is found
    if (parent.getFilesByPattern(appsPattern).length > 0) {
      done();
      return;
    }
    // collect list of files
    parent.files.forEach(addToExternals);
    parent = parent.parent;
  }

  // don't bundle if there aren't any files
  if (!apps.length && !libs.length) {
    done();
    return;
  }

  // configure the bundler
  const bundler = browserify({ debug: true, builtins: false, detectGlobals: false });
  bundler.plugin(minifyify, {
    map: 'bundle.min.js.map',
    output: path.join(outputPath, 'bundle.min.js.map'),
    minify: minify
  });

  // excluded files and packages
  bundler.external(externals.map(toPath));
  bundler.external(getParentPackageRequires(dir, true));

  if (apps.length > 0) {
    // entry point modules
    bundler.add(apps.map(toPath));
  } else {
    // exported modules
    libs.forEach(function (file) {
      bundler.require(file.path, { expose: path.join(opts.input.baseOutputDir, file.getPathFromRoot()) });
    });
  }

  // start bundling
  bundler.bundle()
    .on('error', function (err) { done(err); })
    .pipe(source(minify ? 'bundle.min.js' : 'bundle.js'))
    .pipe(buffer())
    .pipe(gulp.dest(outputPath))
    .on('end', function () { done(); });
}

/**
 * Bundle the given directory into a package.
 * @param {TreeNode} dir - The directory to bundle into a package.
 * @param {Object} opts - The options.
 * @param {Boolean} minify - If true the resulting bundle will be minified.
 * @param {Function} cb - The callback function to execute when complete.
 * @returns {void}
 */
function bundlePackage(dir, opts, minify, cb) {
  const done = cb || function () {};
  const outputPath = path.join(opts.input.packagesOutputDir, dir.getPathFromRoot());

  // read in package info
  const pack = dir.getChildByPath('package.js');
  if (!pack) {
    done();
    return;
  }
  const packData = readInPackage(pack);
  if (!packData.modules || !packData.modules.length) {
    done();
    return;
  }
  const bundleName = 'bundle' + (packData.version ? '-' + packData.version : '') + '.js';
  const bundleNameMin = 'bundle' + (packData.version ? '-' + packData.version : '') + '.min.js';

  // configure the bundler
  const bundler = browserify({ debug: true, builtins: false, detectGlobals: false });
  bundler.plugin(minifyify, {
    map: bundleNameMin + '.map',
    output: path.join(outputPath, bundleNameMin + '.map'),
    minify: minify
  });

  // exclude parent packages
  bundler.external(getParentPackageRequires(dir));

  // add packages
  packData.modules.forEach(function (packModule) {
    bundler.require(packModule.require);
    if (packModule.init) {
      bundler.add(require.resolve(packModule.init));
    }
  });

  // start bundling
  bundler.bundle()
    .on('error', function (err) { done(err); })
    .pipe(source(minify ? bundleNameMin : bundleName))
    .pipe(buffer())
    .pipe(gulp.dest(outputPath))
    .on('end', function () { done(); });
}

/**
 * Bundle either apps or packages.
 * @param {Function} fn - The bundle function to execute.  Either bundleApps or bundlePackages.
 * @param {TreeNode} tree - The tree to bundle.
 * @param {Object} opts - Options to pass to the bundle functions.
 * @param {Function} cb - The call back function to execute when done.
 * @returns {void}
 */
function bundle(fn, tree, opts, cb) {
  const done = cb || function () {};

  // determine the number of directories that will be processed
  let pending = 0;
  let pendNumber = 0;
  if (opts.input.buildDev) {
    pendNumber++;
  }
  if (opts.input.buildMin) {
    pendNumber++;
  }
  tree.forEachDirectory(function () { pending += pendNumber; }, { recurse: true });
  if (!pending) {
    done();
    return;
  }

  // define the function that is called after each app is bundled
  const bundleDone = function (err) {
    if (err) {
      done(err);
      return;
    }
    if (!--pending) {
      done();
    }
  };

  // collect framework fies as they will be used repeatedly
  const fwk = {
    apps: [],
    libs: [],
    dir: tree.getChildByPath('framework')
  };
  if (fwk.dir) {
    fwk.dir.forEachDirectory(function (folder) {
      Array.prototype.push.apply(fwk.apps, folder.getFilesByPattern(appsPattern));
      Array.prototype.push.apply(fwk.libs, folder.getFilesByPattern(appsOrPackagePattern, { negate: true }));
    }, { recurse: true });
  }

  // enumerate through each directory and kick off bundle function
  tree.forEachDirectory(function (dir) {
    if (opts.input.buildMin) {
      fn(dir, { input: opts.input, framework: fwk }, true, bundleDone);
    }
    if (opts.input.buildDev) {
      fn(dir, { input: opts.input, framework: fwk }, false, bundleDone);
    }
  }, { recurse: true });
}

/**
 * Register tasks using the given options.
 *
 * @param {Object} options - Options for bundling.
 * @param {String} options.inputDir - The folder to bundle app code from.
 * @param {String} options.outputDir - The output for the bundled code.
 * @param {String} [options.version] - An optional version number to output apps code into within the outputDir.
 * @param {String} [options.appsName] - An optional name to give to the folder for app output.
 * @param {String} [options.packagesName] - An optional name to give to the folder for package output.
 * @param {Boolean} [options.buildDev] - Flag that indicates if unminified bundles will be created.  Defaults to true.
 * @param {Boolean} [options.buildMin] - Flag that indicates if minified bundles will be created.  Defaults to true.
 * @param {String} [options.tasksPrefix] - Prefix to prepend to registered tasks.
 * @param {String[]} [options.tasksDependencies] - Optional array of tasks names that must be completed before these registered tasks runs.
 * @returns {void}
 */
module.exports = (options) => {
  const opts = options || {};
  const input = {
    inputDir: path.resolve(opts.inputDir),
    outputDir: path.resolve(opts.outputDir),
    version: opts.version,
    buildDev: (opts.buildDev === undefined) ? true : opts.buildDev,
    buildMin: (opts.buildMin === undefined) ? true : opts.buildMin,
    tasksDependencies: opts.tasksDependencies || [],
    tasksPrefix: (opts.tasksPrefix === undefined) ? '' : opts.tasksPrefix + '-'
  };

  input.appsOutputDir = input.outputDir;
  if (opts.version) {
    input.appsOutputDir = path.join(input.appsOutputDir, opts.version);
  }
  input.appsOutputDir = path.join(input.appsOutputDir, opts.appsName || 'apps');

  input.packagesOutputDir = path.join(input.outputDir, opts.packagesName || 'packages');
  input.frameworkDir = path.join(input.inputDir, 'framework');
  input.baseOutputDir = input.inputDir.slice(process.cwd().length);

  /**
   * Bundle just the apps.
   */
  gulp.task(input.tasksPrefix + 'bundleApps', input.tasksDependencies, function (done) {
    // clear out any previous bundles
    del.sync(input.appsOutputDir);

    // create tree of directories and bundle directories
    fto.createTree(input.inputDir, { filePattern: /\.js$/ })
      .then(function (tree) {
        bundle(bundleApp, tree, { input: input }, done);
      })
      .catch(function (err) {
        done(err);
      });
  });

  /**
   * Bundle just the packages.
   */
  gulp.task(input.tasksPrefix + 'bundlePackages', input.tasksDependencies, function (done) {
    // clear out any previous bundles
    del.sync(input.appsOutputDir);

    // create tree of directories and bundle directories
    fto.createTree(input.inputDir, { filePattern: /\.js$/ })
      .then(function (tree) {
        bundle(bundlePackage, tree, { input: input }, done);
      })
      .catch(function (err) {
        done(err);
      });
  });

  /**
   * Bundle both apps and packages.
   */
  gulp.task(input.tasksPrefix + 'bundle', [input.tasksPrefix + 'bundleApps', input.tasksPrefix + 'bundlePackages'], function () {
  });
};
