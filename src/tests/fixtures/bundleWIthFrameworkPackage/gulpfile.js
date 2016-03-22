'use strict';

const bundle = require('../../../index');
const path = require('path');

bundle.registerTasks({
  inputDir: path.normalize(__dirname + '/apps/'),
  outputDir: path.normalize(__dirname + '/../../../../testOutput/bfwkp/dist/'),
  version: '1.0.1',
  name: 'apps',
  tasksPrefix: 'bfwkp'
});