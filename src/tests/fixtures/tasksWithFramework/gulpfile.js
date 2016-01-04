'use strict';

const bundle = require('../../../index');
const path = require('path');

bundle.registerTasks({
  inputDir: path.normalize(__dirname + '/apps/'),
  outputDir: path.normalize(__dirname + '/../../../../testOutput/fwk/dist/'),
  name: 'apps',
  tasksPrefix: 'fwk'
});
