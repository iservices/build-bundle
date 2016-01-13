module.exports = function (opts) {
  return opts.bundleManager.createScriptTags(opts.appPath, '/', opts.isMin, 'defer').join('\n');
};
