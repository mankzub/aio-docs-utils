#!/usr/bin/env node
import Jasmine = require('jasmine');
import 'source-map-support/register';
import {IJasmineRunner} from './jasmine-typings';
import {bold, cyan, green, red, symbols} from './string-utils';


type OnCompleteCb = (passed: boolean) => void;
type TestType = 'e2e' | 'unit';

export const runE2e = (testDir: string): Promise<boolean> => runTests('e2e', testDir);
export const runUnit = (testDir: string): Promise<boolean> => runTests('unit', testDir);

// Main
if (require.main === module) {
  _main();
}

// Helpers
function _main(): void {
  const {resolve} = require('path');
  runUnit(resolve(`${__dirname}/..`));
}

function runTests(testType: TestType, testDir: string): Promise<boolean> {
  // `vscode` APIs are only provided when running tests through VSCode (i.e. e2e tests).
  // For "standalone" unit tests, we need to mock them.
  if (testType === 'unit') {
    const mock = require('mock-require');
    const {mockVscode} = require('./vscode.mock');

    mock('vscode', mockVscode);
  }

  return new Promise(resolve => {
    const runner = new Jasmine({projectBaseDir: testDir});

    loadConfig(testType, runner);
    setUpReporting(testType, runner, resolve);

    console.log(cyan(bold(`Running ${testType} tests...`)));
    runner.execute();
  });
}

function loadConfig(specDir: string, runner: IJasmineRunner): void {
  runner.loadConfig({
    random: true,
    spec_dir: specDir,
    spec_files: [
      '**/*.spec.js',
    ],
  });
}

function setUpReporting(testType: TestType, runner: IJasmineRunner, cb: OnCompleteCb): void {
  let pending = '';

  if (testType === 'e2e') {
    // VSCode monkey-patches the environment that tests are run in, so that `process.stdout.write`
    // is a no-op. Test runners are expected to use `console.log/info/warn/error` instead :(
    runner.configureDefaultReporter({
      print: (input: string | Buffer) => {
        const inputStr = (typeof input === 'string') ? input : input.toString();
        const newLineIdx = inputStr.lastIndexOf('\n');

        if (newLineIdx === -1) {
          pending += inputStr;
        } else {
          console.log(pending + inputStr.slice(0, newLineIdx));
          pending = inputStr.slice(newLineIdx + 1);
        }
      },
    });
  }

  runner.onComplete(passed => {
    if (pending) {
      console.log(pending);
      pending = '';
    }

    console.log(passed ?
      green(bold(`${symbols.CHECK_MARK} All tests passed.`)) :
      red(bold(`${symbols.X_MARK} Some tests failed.`)));

    cb(passed);
  });
}
