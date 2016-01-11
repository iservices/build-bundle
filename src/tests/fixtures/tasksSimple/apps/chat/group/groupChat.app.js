const chatHelper = require('../chatHelper');
const chatUser = require('./groupChatUser');

exports.buildOutput = function (opts) {
  return opts.bundleManager.createScriptTags(opts.appPath, '/', opts.isMin, 'defer').join('\n');
};
