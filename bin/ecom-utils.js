#!/usr/bin/env node

import { runCli } from '../src/cli.js';

runCli(process.argv).catch((error) => {
  console.error(error.message);
  if (process.env.DEBUG) {
    console.error(error);
  }
  process.exitCode = 1;
});
