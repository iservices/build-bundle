const chatHelper = require('../chatHelper');
const chatUser = require('./groupChatUser');

exports.buildOutput = function (bundler, appPath, isMin) {
  return bundler.createScriptTags(appPath, '/', isMin, 'defer').join('\n');
};
