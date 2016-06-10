/**
 * Registers bundle tasks.
 *
 * @module build-bundle
 */
'use strict';

/* eslint no-console:0 */

const gulp = require('gulp');
const path = require('path');
const zlib = require('zlib');
const fs = require('fs');
const del = require('del');
const browserify = require('browserify');
const minifyify = require('minifyify');
const source = require('vinyl-source-stream');
const buffer = require('vinyl-buffer');
const fto = require('file-tree-object');
const BundleManager = require('./bundleManager');

const appsPattern = /\.app\.js$/;
const appsOrPackagePattern = /(\.app\.js$)|([\\\/]package\.js$)/;
const frameworkPattern = /^framework[\\\/]/;

/**
  * This function is used to notify developers of an error that occured
  * as a result of a changed file.
  *
  * @ignore
  * @param {Error} err - The error to notify the user about.
  * @param {string} title - The title for the notification window.
  * @param {string} message - The message to display in the notification window.
  * @returns {void}
  */
function notify(err, title, message) {
  require('node-notifier').notify({
    title: title,
    message: message
  });

  if (err) {
    if (err.message) {
      console.log(err.message);
    } else {
      console.log(err);
    }
  }
}

/**
 * Create a zip file.
 *
 * @ignore
 * @param {String} inputFilename - The name of the input file.
 * @param {String} outputFilename - THe name of the output file.
 * @param {Function} cb - The function to call after the file has been created.
 * @return {void}
 */
function zip(inputFilename, outputFilename, cb) {
  const gzip = zlib.createGzip();
  const input = fs.createReadStream(inputFilename);
  const output = fs.createWriteStream(outputFilename);
  input
    .pipe(gzip)
    .pipe(output)
    .on('error', function (err) { cb(err); })
    .on('close', function () { cb(); });
}

/**
 * Create the path for an exposed module.
 *
 * @ignore
 * @param {String} baseDir - The base directory for the path.
 * @param {String} relativePath - The relative path to the file.
 * @return {String} The path to use for the exposed module.
 */
function exposePath(baseDir, relativePath) {
  return (process.platform === 'win32') ?
    '/' + path.join(baseDir, relativePath).slice(1) :
    path.join(baseDir, relativePath);
}

/**
 * Returns the path property of the given file.
 *
 * @ignore
 * @param {String} file - The file to read the path property from.
 * @returns {String} The path property of the file.
 */
function toPath(file) {
  return file.path;
}

/**
 * Read in a package object.
 *
 * @ignore
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
 *
 * @ignore
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
 *
 * @ignore
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
      bundler.require(file.path, { expose: exposePath(opts.input.baseOutputDir, file.getPathFromRoot()) });
    });
  }

  // start bundling
  bundler.bundle()
    .on('error', function (err) { done(err); })
    .pipe(source(minify ? 'bundle.min.js' : 'bundle.js'))
    .pipe(buffer())
    .pipe(gulp.dest(outputPath))
    .on('end', function () {
      if (minify) {
        zip(path.join(outputPath, 'bundle.min.js'),
            path.join(outputPath, 'bundle.min.js.gz'),
            function (err) {
              done(err);
            });
      } else {
        done();
      }
    });
}

/**
 * Bundle the given directory into a package.
 *
 * @ignore
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
    .on('end', function () {
      if (minify) {
        zip(path.join(outputPath, bundleNameMin),
            path.join(outputPath, bundleNameMin + '.gz'),
            function (err) {
              done(err);
            });
      } else {
        done();
      }
    });
}

/**
 * Bundle either apps or packages.
 *
 * @ignore
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
    dir: tree.getRoot().getChildByPath('framework') || fto.createTreeSync(opts.input.frameworkDir, { ignoreError: true })
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
  }, { recurse: opts.recurse });
}

/**
 * Determine the folder that should be bundled for the given tree node.
 *
 * @ignore
 * @param {TreeNode} treeNode - The tree node to check.
 * @return {String} The tree node that should be bundled.
 */
function getNodeForBundle(treeNode) {
  // any framework files should be bundled with the framework folder
  if (treeNode.getPathFromRoot().indexOf(path.normalize('framework/')) === 0) {
    return treeNode.getRoot().getChildByPath('framework');
  }

  // any files that fall under an app folder should be bundled with the app
  let currentNode = treeNode;
  while (currentNode) {
    if (currentNode.getChildrenByPattern(appsPattern).length > 0) {
      return currentNode;
    }

    const packageNode = currentNode.getChildByPath('package.js');
    if (packageNode) {
      const packageInfo = require(packageNode.path);
      if (packageInfo.app) {
        return currentNode;
      }
    }

    currentNode = currentNode.parent;
  }

  // default to a lib folder
  return treeNode.isDirectory ? treeNode : treeNode.parent;
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
function registerTasks(options) {
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
        bundle(bundleApp, tree, { input: input, recurse: true }, done);
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
    del.sync(input.packagesOutputDir);

    // create tree of directories and bundle directories
    fto.createTree(input.inputDir, { filePattern: /\.js$/ })
      .then(function (tree) {
        bundle(bundlePackage, tree, { input: input, recurse: true }, done);
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

  /*
   * Watch for changes to app files so we can rebundle on the fly.
   */
  gulp.task(input.tasksPrefix + 'watch-bundle', function () {
    const watch = require('gulp-watch');
    const done = function (err) {
      if (err) {
        notify(err, 'Bundle Error', 'See console for details.');
      }
    };

    watch(path.join(input.inputDir, '**/*.js'), function (file) {
      // ignore files that begin with a dot
      if (path.basename(file.path)[0] === '.') {
        return;
      }

      console.log('watch bundle: ' + file.path + ' event: ' + file.event);

      // create tree of directories
      fto.createTree(input.inputDir, { filePattern: /\.js$/ })
        .then(function (tree) {
          // get the tree node
          const treeNode = tree.getByPath(file.path);
          if (!treeNode) {
            throw new Error('Could not find node in tree.');
          }

          const bundleNode = getNodeForBundle(treeNode);

          // package.js file change
          if (treeNode.basename === 'package.js') {
            const packageInfo = require(treeNode.path);
            if (packageInfo.modules) {
              bundle(bundlePackage, bundleNode, { input: input, recurse: false }, done);
            }
            if (packageInfo.app) {
              bundle(bundleApp, bundleNode, { input: input, recurse: false }, done);
            }
          // all other files
          } else {
            bundle(bundleApp, bundleNode, { input: input, recurse: false }, done);
          }
        })
        .catch(function (err) {
          done(err);
        });
    });
  });
}

/**
 * Create a new instance of the BundleManager class.
 *
 * @param {Object} opts - The options passed to the BundleManager constructor.  See {@link BundleManager} for the parameters.
 * @return {BundleManager} A new instance of BundleManager.
 */
function createManager(opts) {
  return new BundleManager(opts);
}

module.exports.registerTasks = registerTasks;
module.exports.createManager = createManager;
