/* eslint no-console:0,object-shorthand:0 */
'use strict';

const gulp = require('gulp');
const browserify = require('browserify');
const babelify = require('babelify');
const minifyify = require('minifyify');
const source = require('vinyl-source-stream');
const buffer = require('vinyl-buffer');
const glob = require('glob');
const globStream = require('glob-stream');
const through = require('through2');
const path = require('path');
const fs = require('fs');
const del = require('del');
const ps = require('process');
const BundleManager = require('./bundleManager');

const codeExt = '/*.js?(x)';
const packagesExt = '/package.bundle';
const appFileRegEx = /[a-zA-Z0-9_\\-\\.]*\.[aA][pP][pP]\.[jJ][sS]/;
const appFilesExt = '*.app.js';

/**
 * Bundle the source code found in the given folder.
 *
 * @param {object} opts - Options for bundling.
 * @param {object} opts.input - options provided by configuration.
 * @param {string|vinyl} opts.folder - The folder to create a bundle for.
 * @param {object} opts.filesMap - An optional map object that is used to cache folder contents for re-use in future calls.
 * @param {boolean} opts.minify - When true the resulting bundle will be minified.
 * @param {function} opts.errorHandler - A function that handles any bundling errors that occur.
 * @param {function} opts.done - A function that is called when bundling is completed.
 * @returns {void}
 */
function bundle(opts) {
  let filesMap = opts.filesMap;
  if (!filesMap) {
    filesMap = {};
  }

  const folderPath = path.normalize(opts.folder.path || opts.folder);

  const parentFiles = [];
  const parentPackages = [];
  const appFiles = [];
  let files = [];
  let pack = null;
  let currentPath = folderPath;

  // collect and cache files from the top down for framework
  if (!filesMap[opts.input.frameworkDir]) {
    const packageFiles = glob.sync(path.normalize(opts.input.frameworkDir + packagesExt), { nodir: true });
    filesMap[opts.input.frameworkDir] = {
      files: glob.sync(opts.input.frameworkDir + '/**' + codeExt, { nodir: true }),
      pack: (packageFiles.length > 0) ? JSON.parse(fs.readFileSync(packageFiles[0], 'utf8')) : { modules: [] }
    };
  }

  if (folderPath === opts.input.frameworkDir) {
    // we've already collected framework files
    files = filesMap[opts.input.frameworkDir].files;
    pack = filesMap[opts.input.frameworkDir].pack;
  } else if (folderPath.indexOf(opts.input.frameworkDir) === 0) {
    // folders under the framework folder are bundled up into a single top level
    // bundle so there is no need to continue.
    if (opts.done) {
      opts.done();
    }
    return;
  }

  // collect and cache files from the bottom up for apps and libraries
  while (currentPath.length >= opts.input.inputDir.length) {
    if (currentPath !== opts.input.frameworkDir) {
      // get code files and packages
      if (!filesMap[currentPath]) {
        const packageFiles = glob.sync(path.normalize(currentPath + packagesExt), { nodir: true });
        filesMap[currentPath] = {
          files: glob.sync(currentPath + codeExt, { nodir: true }),
          pack: (packageFiles.length > 0) ? JSON.parse(fs.readFileSync(packageFiles[0], 'utf8')) : { modules: [] }
        };
      }

      // sort files in the current folder
      for (let fileIndex = 0; fileIndex < filesMap[currentPath].files.length; fileIndex++) {
        const file = filesMap[currentPath].files[fileIndex];

        if (file.match(appFileRegEx)) {
          // app files
          if (currentPath !== folderPath) {
            // if a parent folder has an app file then any code underneath it
            // doesn't get it's own bundle.
            if (opts.done) {
              opts.done();
            }
            return;
          }
          appFiles.push(file);
        } else if (currentPath === folderPath) {
          // non app files
          files.push(file);
        } else {
          // parent files
          parentFiles.push(file);
        }
      }

      // process any packages in folder
      if (currentPath === folderPath) {
        pack = filesMap[currentPath].pack;
      } else {
        Array.prototype.push.apply(parentPackages, filesMap[currentPath].pack.modules);
      }
    }

    const nextPath = path.normalize(currentPath + '/../');
    if (nextPath === currentPath) {
      break;
    }

    currentPath = nextPath;
  }

  // always exclude framework files and packages unless we are bundling the framework
  if (folderPath !== opts.input.frameworkDir) {
    Array.prototype.push.apply(parentFiles, filesMap[opts.input.frameworkDir].files);
    Array.prototype.push.apply(parentPackages, filesMap[opts.input.frameworkDir].pack.modules);
  }

  // create bundles
  let doneCount = 2;
  if (files.length === 0 && appFiles.length === 0) {
    doneCount--;
  }
  if (!pack || !pack.modules || pack.modules.length === 0) {
    doneCount--;
  }
  if (doneCount === 0) {
    if (opts.done) {
      opts.done();
    }
    return;
  }

  // file bundle
  if (files.length > 0 || appFiles.length > 0) {
    const appsOutputFolder = path.normalize(opts.input.appsOutputDir + folderPath.slice(opts.input.inputDir.length));
    const fileBry = browserify({ debug: true, extensions: ['.jsx'] });
    fileBry.transform(babelify, { presets: ['es2015', 'react'] });
    fileBry.plugin(minifyify, {
      map: 'bundle.min.js.map',
      output: path.normalize(appsOutputFolder + '/bundle.min.js.map'),
      minify: opts.minify,
      uglify: opts.input.uglify
    });
    fileBry.external(parentFiles);
    fileBry.external(parentPackages);

    if (pack && pack.modules) {
      fileBry.external(pack.modules);
    }

    if (appFiles.length > 0) {
      // bundle files for apps
      fileBry.add(appFiles);
    } else if (files.length > 0) {
      // bundle files for libraries
      files.forEach(function (file) {
        fileBry.require(file, { expose: opts.input.baseOutputDir + file.slice(opts.input.inputDir.length) });
      });
    }

    fileBry.bundle()
      .on('error', function (err) {
        doneCount--;
        if (opts.errorHandler) {
          opts.errorHandler(err);
        } else {
          throw err;
        }

        if (opts.done && doneCount === 0) {
          opts.done();
        }
      })
    .pipe(source('bundle' + (opts.minify ? '.min.js' : '.js')))
    .pipe(buffer())
    .pipe(gulp.dest(appsOutputFolder))
    .on('end', function () {
      doneCount--;
      if (opts.done && doneCount === 0) {
        opts.done();
      }
    });
  }

  // package bundle
  if (pack && pack.modules && pack.modules.length > 0) {
    const packagesOutputFolder = path.normalize(opts.input.packagesOutputDir + folderPath.slice(opts.input.inputDir.length));
    const packagesOutputName = pack.version ? 'package-' + pack.version : 'package';
    const packageBry = browserify({
      debug: opts.minify,
      noParse: opts.packages
    });

    packageBry.plugin(minifyify, {
      map: packagesOutputName + '.min.js.map',
      output: path.normalize(packagesOutputFolder + '/' + packagesOutputName + '.min.js.map'),
      minify: opts.minify,
      uglify: opts.input.uglify
    });

    packageBry.external(parentPackages);

    pack.modules.forEach(function (pck) {
      packageBry.require(pck);
    });

    packageBry.bundle()
      .on('error', function (err) {
        doneCount--;
        if (opts.errorHandler) {
          opts.errorHandler(err);
        } else {
          throw err;
        }

        if (opts.done && doneCount === 0) {
          opts.done();
        }
      })
    .pipe(source(packagesOutputName + (opts.minify ? '.min.js' : '.js')))
    .pipe(buffer())
    .pipe(gulp.dest(packagesOutputFolder))
    .on('end', function () {
      doneCount--;
      if (opts.done && doneCount === 0) {
        opts.done();
      }
    });
  }
}

/**
 * Stream that bundles folders.
 *
 * @param {object} opts - Options for the stream.
 * @param {object} opts.input - Options provided through configuration.
 * @param {boolean} opts.minify - If set to true the bundles will be minified.
 * @param {object} opts.filesMap - If set to an object files will be cached here for performance.
 * @returns {stream} A stream that bundles code.
 */
function bundleStream(opts) {
  const options = (opts || { minify: false, filesMap: {} });
  return through({ objectMode: true }, function (data, encoding, done) {
    if ((!options.input.buildDev && !options.minify) || (!options.input.buildMin && options.minify)) {
      this.push(data);
      done();
      return;
    }
    const self = this;
    bundle({
      input: opts.input,
      folder: data,
      filesMap: options.filesMap,
      minify: options.minify,
      errorHandler: options.errorHandler,
      done: function () {
        self.push(data);
        done();
      }
    });
  });
}

/**
 * Process the given app.
 * @param {object} opts - The options for the function.
 * @param {object} opts.input - The input for the build tasks.
 * @param {string} opts.file - The file that is the app to process.
 * @param {BundleManager} opts.bundleManager - The bundle manager to pass to the function for processing the app.
 * @returns {void}
 */
function processHtml(opts) {
  delete require.cache[require.resolve(opts.file)];
  let htmlFunc = require(opts.file);
  if (htmlFunc && !(typeof htmlFunc === 'function')) {
    htmlFunc = htmlFunc.default;
  }
  if (!htmlFunc || !(typeof htmlFunc === 'function')) {
    throw new Error('The given module is not defined as a function to generate html: ' + opts.file);
  }
  const relativePath = '/' + path.dirname(opts.file).slice(opts.input.buildHtmlDir.length) + '/';
  const outputFolder = path.normalize(opts.input.appsOutputDir + relativePath);
  const fileName = path.basename(opts.file, '.html.js');
  if (htmlFunc) {
    let result = htmlFunc({
      bundleManager: opts.bundleManager,
      appPath: relativePath,
      isMin: true });
    if (result) {
      fs.writeFileSync(outputFolder + fileName + '.html', result);
    }
    result = htmlFunc({
      bundleManager: opts.bundleManager,
      appPath: relativePath,
      isMin: false });
    if (result) {
      fs.writeFileSync(outputFolder + fileName + '.dev.html', result);
    }
  }
}

/**
 * Stream that bundles folders.
 *
 * @param {object} opts - Options for the stream.
 * @param {object} opts.input - Options provided through configuration.
 * @param {boolean} opts.minify - If set to true the bundles will be minified.
 * @param {object} opts.filesMap - If set to an object files will be cached here for performance.
 * @returns {stream} A stream that bundles code.
 */
function processHtmlStream(opts) {
  return through({ objectMode: true }, function (data, encoding, done) {
    try {
      const self = this;
      processHtml({
        input: opts.input,
        file: data.path,
        bundleManager: opts.bundleManager
      });
      self.push(data);
      done();
    } catch (error) {
      done(error);
    }
  });
}

/**
 * Write out a map of what folders have a bundle in them which can
 * be used to build script tags.
 *
 * @param {object} opts - Options.
 * @param {object} opts.filesMap - An object that maps folder paths to the files that are contained within them.
 * @param {string} opts.basePath - The basepath for the files.
 * @param {object} opts.input - The configuration input.
 * @returns {void}
 */
function writeManifest(opts) {
  const basePathSize = opts.input.inputDir.length - 1;
  const result = {};
  for (const prop in opts.filesMap) {
    if (opts.filesMap.hasOwnProperty(prop)) {
      result[prop.toLowerCase().slice(basePathSize)] = {
        files: (opts.filesMap[prop].files.length > 0),
        pack: {
          version: opts.filesMap[prop].pack.version,
          modules: (opts.filesMap[prop].pack.modules && opts.filesMap[prop].pack.modules.length > 0)
        }
      };
    }
  }

  try {
    fs.writeFileSync(opts.input.outputDir + 'manifest.json', JSON.stringify(result));
  } catch (err) {
    if (err.code !== 'ENOENT') {
      throw err;
    }
  }
}

/**
 * Update map of what folders have a bundle in them which can
 * be used to build script tags.
 *
 * @param {object} opts - Options.
 * @param {object} opts.filesMap An object that maps folder paths to the files that are contained within them.
 * @param {object} opts.input - The configuration input.
 * @returns {void}
 */
function updateManifest(opts) {
  const basePathSize = opts.input.inputDir.length - 1;
  let existingMap = null;
  try {
    existingMap = JSON.parse(fs.readFileSync(opts.input.outputDir + 'manifest.json', 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') {
      existingMap = {};
    } else {
      throw err;
    }
  }

  for (const prop in opts.filesMap) {
    if (opts.filesMap.hasOwnProperty(prop)) {
      existingMap[prop.toLowerCase().slice(basePathSize)] = {
        files: (opts.filesMap[prop].files.length > 0),
        pack: {
          version: opts.filesMap[prop].pack.version,
          modules: (opts.filesMap[prop].pack.modules && opts.filesMap[prop].pack.modules.length > 0)
        }
      };
    }
  }

  try {
    fs.writeFileSync(opts.input.outputDir + 'manifest.json', JSON.stringify(existingMap));
  } catch (err) {
    if (err.code !== 'ENOENT') {
      throw err;
    }
  }
}

/**
  * This function is used to notify developers of an error that occured
  * as a result of a changed file.
  *
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
 * Register tasks using the given options.
 *
 * @param {object} opts - Options for bundling.
 * @param {string} opts.inputDir - The folder to bundle app code from.
 * @param {string} opts.outputDir - The output for the bundled code.
 * @param {string} [opts.version] - An optional version number to output apps code into within the outputDir.
 * @param {string} [opts.name] - Optional name to append to the output dir for apps code.  This would appear after the version number.
 * @param {boolean} [opts.buildDev] - Flag that indicates if development bundles will be created.  Defaults to true.
 * @param {boolean} [opts.buildMin] - Flag that indicates if minified bundles will be created.  Defaults to true.
 * @param {object} [opts.uglify] - Options passed to the uglify package.  See the uglify docs for option definitions.
 * @param {string} [opts.buildHtmlDir] - An alternative base path to load *.html.js files from.  This is useful if you are transforming
 *                                       files to some alternative output such as ecma6 to ecma5.  If not set then *.html.js files are loaded
 *                                       from the inputDir.
 * @param {string} [opts.tasksPrefix] - Prefix to prepend to registered tasks.
 * @param {string[]} [opts.tasksDependencies] - Optional array of tasks names that must be completed before these registered tasks runs.
 * @returns {void}
 */
module.exports = (opts) => {
  const input = {
    glob: path.normalize(opts.inputDir + '/**/*/').replace(/\\/g, '/'),
    version: opts.version,
    name: opts.name,
    uglify: opts.uglify || {},
    buildOutput: opts.buildOutput,
    tasksDependencies: opts.tasksDependencies || []
  };

  if (opts.buildDev !== undefined) {
    input.buildDev = opts.buildDev;
  } else {
    input.buildDev = true;
  }

  if (opts.buildMin !== undefined) {
    input.buildMin = opts.buildMin;
  } else {
    input.buildMin = true;
  }

  if (!path.isAbsolute(opts.inputDir)) {
    input.inputDir = path.normalize(ps.cwd() + '/' + opts.inputDir);
  } else {
    input.inputDir = path.normalize(opts.inputDir + '/');
  }

  if (!path.isAbsolute(opts.outputDir)) {
    input.outputDir = path.normalize(ps.cwd() + '/' + opts.outputDir);
  } else {
    input.outputDir = path.normalize(opts.outputDir + '/');
  }

  if (opts.version) {
    input.appsOutputDir = path.normalize(input.outputDir + opts.version + '/');
  } else {
    input.appsOutputDir = path.normalize(input.outputDir + '/');
  }

  if (opts.name) {
    input.appsOutputDir = path.normalize(input.appsOutputDir + opts.name + '/');
  }

  input.packagesOutputDir = path.normalize(input.outputDir + 'packages/');
  input.frameworkDir = path.normalize(input.inputDir + 'framework/');

  if (opts.tasksPrefix) {
    input.tasksPrefix = opts.tasksPrefix + '-';
  } else {
    input.tasksPrefix = '';
  }

  input.baseOutputDir = input.inputDir.slice(process.cwd().length);

  if (opts.buildHtmlDir) {
    if (!path.isAbsolute(opts.buildHtmlDir)) {
      input.buildHtmlDir = path.normalize(ps.cwd() + '/' + opts.buildHtmlDir);
    } else {
      input.buildHtmlDir = path.normalize(opts.buildHtmlDir + '/');
    }
  } else {
    input.buildHtmlDir = input.inputDir;
  }

  /*
   * Browserify code.
   */
  gulp.task(input.tasksPrefix + 'bundleApps', input.tasksDependencies, function () {
    del.sync(input.appsOutputDir);
    del.sync(input.packagesOutputDir);
    del.sync(path.normalize(input.outputDir + '/manifest.json'));
    const filesMap = {};
    return globStream.create([input.inputDir.replace(/\\/g, '/'), input.glob], { read: false })
      .pipe(bundleStream({ input: input, minify: false, filesMap: filesMap }))
      .pipe(bundleStream({ input: input, minify: true, filesMap: filesMap }))
      .on('end', () => {
        writeManifest({ input: input, filesMap: filesMap });
      });
  });

  /*
   * Process apps.
   */
  gulp.task(input.tasksPrefix + 'bundle', [input.tasksPrefix + 'bundleApps'], function () {
    const bundler = new BundleManager({
      rootBundlePath: input.outputDir,
      version: input.version,
      name: input.name
    });
    return globStream.create(input.buildHtmlDir + '**/*.html.js', { read: false })
      .pipe(processHtmlStream({ input: input, bundleManager: bundler }));
  });

  /*
   * Watch for changes to app files so we can rebundle on the fly.
   */
  gulp.task(input.tasksPrefix + 'watch-bundle', function () {
    const watch = require('gulp-watch');
    watch(input.inputDir + '**' + codeExt, function (file) {
      console.log('watch bundle: ' + file.path + ' event: ' + file.event);

      // determine the folder that needs to be bundled
      let isAppPath = false;
      let isFramework = false;
      const isEdit = (file.event === 'change');
      const isPackage = (path.basename(file.path) === 'package.bundle');
      let targetPath = path.normalize(file.path + '/../');

      if (targetPath.indexOf(input.frameworkDir) === 0) {
        targetPath = input.frameworkDir;
        isFramework = true;
      } else {
        let currentPath = targetPath;
        while (currentPath !== input.inputDir && currentPath.length >= input.inputDir.length) {
          const appFiles = glob.sync(currentPath + appFilesExt, { nodir: true });
          if (appFiles.length > 0) {
            targetPath = currentPath;
            isAppPath = true;
            break;
          }

          const nextPath = path.normalize(currentPath + '/../');
          if (nextPath === currentPath) {
            break;
          }

          currentPath = nextPath;
        }
      }

      // report errors that occur when bundling
      let errorReported = false;
      const errorHandler = function (err) {
        if (errorReported) {
          return;
        }

        errorReported = true;
        notify(err, 'Bundle Error', 'See console for details.');
      };

      const filesMap = {};
      let streamBundle = null;

      if (!isPackage && (isAppPath || isEdit)) {
        // simple bundle conditions
        streamBundle = globStream.create([targetPath], { read: false })
          .pipe(bundleStream({ input: input, minify: false, filesMap: filesMap, errorHandler: errorHandler }))
          .pipe(bundleStream({ input: input, minify: true, filesMap: filesMap, errorHandler: errorHandler }))
          .on('end', () => {
            updateManifest({ input: input, filesMap: filesMap });
          });
      } else if (isFramework) {
        // framework add/delete requires entire system rebundle
        streamBundle = globStream.create([input.inputDir, input.glob], { read: false })
          .pipe(bundleStream({ input: input, minify: false, filesMap: filesMap, errorHandler: errorHandler }))
          .pipe(bundleStream({ input: input, minify: true, filesMap: filesMap, errorHandler: errorHandler }))
          .on('end', () => {
            updateManifest({ input: input, filesMap: filesMap });
          });
      } else {
        // bundle from the target directory down
        streamBundle = globStream.create([targetPath, targetPath + '/**/*/'], { read: false })
          .pipe(bundleStream({ input: input, minify: false, filesMap: filesMap, errorHandler: errorHandler }))
          .pipe(bundleStream({ input: input, minify: true, filesMap: filesMap, errorHandler: errorHandler }))
          .on('end', () => {
            updateManifest({ input: input, filesMap: filesMap });
          });
      }

      streamBundle.on('readable', () => {
        while (streamBundle.read() !== null) {
          // process the entire bundle stream
        }
      }).on('end', () => {
        // process apps after bundle updates are done
        const bundler = new BundleManager({
          rootBundlePath: input.outputDir,
          version: input.version,
          name: input.name
        });

        const streamApp = globStream.create(input.buildHtmlDir + '**/*.html.js', { read: false })
          .pipe(processHtmlStream({ input: input, bundleManager: bundler }))
          .on('error', errorHandler);

        streamApp.on('readable', () => {
          while (streamApp.read() !== null) {
            // process the entire app stream
          }
        });
      });
    });
  });
};
