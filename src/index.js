'use strict';

const tasks = require('./bundleTasks');
const BundleManager = require('./bundleManager');

module.exports = {
  registerTasks: tasks,
  createManager: (opts) => {
    return new BundleManager(opts);
  }
};
