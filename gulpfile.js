'strict';

const tests = require('build-test');

tests.registerTasks({
  testGlob: ['src/tests/*.js'],
  codeGlob: ['src/*.js'],
  thresholds: { global: 0 },
  outputDir: './testResults'
});
