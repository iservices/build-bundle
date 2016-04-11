'use strict';

const chatHelper = require('../chatHelper');
chatHelper.printLine('my line');

const chatUser = require('./groupChatUser');
console.log('name: ' + chatUser.name);

const example = require('../example');
example();
