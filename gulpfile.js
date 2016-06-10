'strict';

const tests = require('build-test');
const doc = require('build-doc');

tests.registerTasks({
  testGlob: ['src/tests/*.js'],
  codeGlob: ['src/**/*.js', '!src/tests/**/*'],
  thresholds: { global: 0 },
  outputDir: './testResults'
});

doc.registerTasks({
  glob: '**/*.[jt]s',
  inputDir: './src/local/',
  templateFile: './doc.md',
  outputDir: './',
  outputFile: 'README.md'
});
