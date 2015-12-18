'use strict';

const tasks = require('./bundleTasks');
const BundleManager = require('./bundleManager');

module.exports = {
  registerTasks: tasks,
  createManager: (rootBundlePath, baseUrlPath, version) => {
    return new BundleManager(rootBundlePath, baseUrlPath, version);
  }
};
