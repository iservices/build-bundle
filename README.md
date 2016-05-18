# build-bundle

This package is currently in **BETA**

## Overview
This is a node package that defines gulp tasks and other utliites that are used to bundle code that will be provided to a client browser.  The goal of this package
is to provide an easy to use structure that automates the bundling of code in an efficient way that is well suited for large scale enterprise applications.
The [browserify](https://www.npmjs.com/package/browserify) package is used for bundling.

## Guide

To install this package execute the following command in the console from within your project.

```
npm install --save build-bundle
```

Once the package is installed you will need to create a `gulpfile.js` file within the root folder of your project if there isn't one already.
Within this file you will register the gulp tasks that are defined within this package using the registerTasks function.  The following is an example of this.

```
'use strict';

const bundle = require('build-bundle');

bundle.registerTasks({
  inputDir: 'src/client/',
  outputDir: 'dist/',
  version: '1.0.1'
});
```

Once you have registered the bundle tasks you can perform bundling using gulp.
To bundle code simply execute the following console command from within your project.

```
gulp bundle
```

In addition to executing tasks from the console you can also chain the gulp bundle tasks together with other gulp tasks to utilize the bundle functionality however it's needed.

## Bundle Structure

The term bundle is being used here to denote a file created by browserify which contains one or more code files consolidated into a single file.
For more information on how browserify works, consult the browserify [documentation](https://github.com/substack/browserify-handbook).

There are 3 different types of bundles that can be created by this package which are defined as follows.

1. App Bundle - This is a standard browserify file that contains one or more entry points as well as other code which is required by the entry point code.
2. Lib Bundle - This is a browserify file that doesn't have any entry points but contains code which may be used by other browserify files that do.
3. Framework Bundle - This the same as a lib bundle but it specifically contains all of the code found in the the root level framework folder.
4. Package Bundle - This is a browserify file that contains code sourced from npm packages that is referenced by other bundles.

The general idea behind the bundling structure is that code that appears below other code in the folder tree will have dependencies on the code above it.
This way it is easy to visualize the dependency structure as well as chunk out the code into multiple bundles making it more effecient to download the code an 
app will need only once and maximize its reuse.

These bundles are created by the gulp bundle tasks by parsing the code files found in the folder specified by the options.inputDir parameter of the registerTasks function.
Take the following folder structure that may be pointed to by the options.inputDir parameter as an example which will be used throught this document.

```
src/
|__client/
   |__login/
   |  |__sso/
   |  |  |__package.bundle
   |  |  |__sso.app.js
   |  |  |__helper.js
   |  |__oauth/
   |  |  |__oauth.app.js
   |  |  |__thirdParty/
   |  |     |__standard.js
   |  |__util.js
   |  |__log.js
   |__framework/
   |  |__math.js
   |  |__chat.js
   |__package.js

```

### App Bundle

App bundles correspond to a page that is served up by your site where the entry pont of the app bundle gets executed when your page is loaded.
App bundles are created in one of two ways.  One is by giving a file an extension of `.app.js`.  The other is by creating a package.js file
that exports an object that has an app property which is a string path that points to the app file relative to the location of the package.js file.
Below is an example of a package.js file for an app.  Note that a package.js file can contain both app bundle as well as package bundle
configurations.

```javascript
module.exports = {
  app: './myApp.js'
};
```

No additional app bundles can be defined in any folder beneath a folder that contains an app bundle.
When an app bundle is created the files with the .app.js extension will become the entry points and any code referenced directly or indirectly with a require statement will 
be included in the bundle with the following exceptions.

- Code that appears in folders above the folder that contains the .app.js file.
- Code that appears in the framework folder or anywhere below the framework folder.
- Code that appears in any of the package bundles defined within the folder that contains the .app.js file or any folder above it.

From the example above if the src/client/login/oauth/oauth.app.js file defined the following dependencies.

- /src/client/login/util.js
- /src/client/login/log.js
- /src/client/login/oauth/thirdParty.js
- /src/client/framework/math.js

Only the oauth.app.js and thirdParty.js code would be bundled together into a single file since the util.js and log.js files appear in a folder above 
and the math.js folder appears in the framework folder.

### Lib Bundle

A lib bundle is used to contain code that may be reused by one or more app bundles.  By using lib bundles a client can download common code once and have it used by multiple apps.
A lib bundle is created when a folder contains code files but none with a .app.js extension.  All the files in that folder and any code referenced directly or indirectly with a 
require statement will be included in the bundle with the following exceptions.

- Code that appears in folders above the folder.
- Code that appears in the framework folder or anywhere below the framework folder.
- Code that appears in any of the package bundles defined within the folder or any folder above it.

From the example above the util.js and log.js code files would be bundled into a single file since they are in a folder that doesn't contain a .app.js file.

### Framework Bundle

Since the framework bundle is included as a dependency for all apps it is a convenient place to put any code that is required globally for apps.
The framework bundle is created from any code that is found in the framework folder directly beneath the folder specified by the options.inputDir folder.
All code found in this folder or any of it's sub folders is bundled up into a single file.  Just like the other bundles, any packages or code that appears above it in the folder 
tree will be exclued from the bundle.

If a package.bundle file is found in the framework folder a package bundle will be created.  This package will be made available globally as well,
making it a good place to specify packages that may change more frequently than packages defined at the root level.  See below for more details on package bundles.

### Package Bundle

The package bundle makes it easy to include npm packages as part of your bundles.  This is similar to lib bundles in that it allows common code to be downloaded once and have it 
used by multiple apps.  A package bundle is created by files named package.js which export a default object.  These files specify npm packages to be consolidated into a bundle.
The following is an example of a package.bundle file.

```javascript
module.exports = {
  version: '1.0.0',
  modules: [
    { require: 'jquery' },
    { require: 'react' }
  ]
};
```

This file specifies that the jquery and react packages are to be put into a bundle and that bundle will be given a version number of 1.0.0.
The reason package bundles are versioned apart from the version specified with the registerTask function is because it's likely that package bundles will be updated
far less frequently than your application code.

You can also specify a single entry file for each module specified.  The code within these files will be executed when the package
that is associated with it is loaded.  To specify an entry file set the init property on the module and specify a value that can be
resolved using the node require.resolve function.  Below is a made up example.

```javascript
module.exports = {
  version: '1.0.0',
  modules: [
    { require: 'examplePackage', init: 'examplePackage/dist/load' },
    { require: 'react' }
  ]
};
``` 

### Bundle Manager

After all of your client side code has been bundled you are ready to serve it up in your pages.  To do this you will need to include the 
resulting bundles in your pages using script tags that will reference them.  The easiest way to do this is with the BundleManager class included 
in this package.  You use the BundleManager to create the necessary script tags for the app bundles you have created.
Here is an example of using the BundleManager to create script tags for a page associated with the oauth.app.js bundle.

```javascript
'use strict';

const bundle = require('build-bundle');

const bundler = bundle.createManager({
  inputDir: 'dist/',
  baseUrlPath: '/dist',
  version: '1.0.1' });

const tags = bundler.getScriptTags('login/oauth');
```

The resulting tags array would be made up of the following string values in the following order which can be included in your page.

1. `<script src="/dist/packages/bundle-1.0.0.min.js" defer></script>`
2. `<script src="/dist/apps/1.0.1/framework/bundle.min.js"></script>`
3. `<script src="/dist/apps/1.0.1/login/bundle.min.js"></script>`
4. `<script src="/dist/apps/1.0.1/login/oauth/bundle.min.js"></script>`

## API

### `build-bundle.registerTasks(options)`

The registerTasks function will register 3 tasks with gulp which are named as follows:

- 'bundle' - This task will bundle all code.
- 'bundleApps' - This task will bundle only the app, lib and framework code.  It will not bundle the packages.
- 'bundlePackages' - This task will only bundle the packages.  It will not bundle any of the app, lib or framework code.

#### options
Type: `Object`

This parameter is an object that holds the various options to use when registering the tasks.

#### options.inputDir
Type: `String`

The directory that contains all of the code files that will be bundled.  Only files with .js extensions will be bundled.

#### options.outputDir
Type: `String`

The directory that bundle files will be output to.

#### options.version
Type: `String`

An optional version number for the bundled app, lib, and framework code.  This is used with caching schemes so that when the version number is incremented with a new 
release the new bundles will be downloaded instead of loaded from the browser cache.

#### options.appsName
Type: `String` Default: `apps`

An optional name to give the folder that will contain the apps code.

#### options.packagesName
Type: `String` Default: `packages`

An optional name to give the folder that will contain the packages code.

#### options.buildDev
Type: `Boolean` Default: `true`

Flag that indicates if development bundles will be created.

#### options.buildMin
Type: `Boolean` Default: `true`

Flag that indicates if minified bundles will be created.  Defaults to true.

#### options.tasksPrefix
Type: `String`

This is an optional parameter that when set will add a prefix to the names of the tasks that get registered. For example, if tasksPrefix is set to 'hello' then the task 
that would have been registered with the name 'bundle' will be registered with the name 'hello-bundle' instead.

#### options.tasksDependencies
Type: `String[]`

Optional array of tasks names that must be completed before these registered tasks runs.

### `build-bundle.createManager(options)`
Type: `Function`

This function creates a new instance of a BundleManager object and passes the parameters to the constructor.

#### options
Type: `Object`

The configuration options.

#### options.inputDir
Type: `String`

This is the root path of the output from the bundle task.  It should be the same as the value provided with the options.ouputDir parameter when calling registerTasks.

#### options.baseUrlPath
Type: `String`

This is the path to apply to the root of all the urls in the generated script tags.

#### options.version
Type: `String`

The optional version number of the resulting output from the bundle task.  It should be the same as the value provided with the options.version parameter when calling registerTasks.

#### options.appsName
Type: `String` Default: `apps`

The optional name given the folder that contains the apps code.
It should be the same as the value provided with the options.appsName parameter when calling registerTasks.

#### options.packagesName
Type: `String` Default: `packages`

The optional name given the folder that contains the packages code.
It should be the same as the value provided with the options.packagesName parameter when calling registerTasks.

### `BundleManager`
Type: `Class`

This class has functionality that makes it easier to use the resulting bundles generated by the bundle tasks.

### BundleManager.getScriptTags(appPath, format)

This function will get the script tags necessary for the given app to execute in the client browser.
It returns an array of strings with each array element being html markup for including a script tag.  The order 
of the script tags is important and needs to be included in your page in the same order.

#### appPath
Type: `String`

The path relative to the inputDir to the app that script tags are for.

#### format
Type: `String`  Default: `dev`

This is the type files targeted by the script tags returned.  Possible values are:
- dev: Unminified files.
- min: Minified files.
- zip: Minified files compressed using gzip.
