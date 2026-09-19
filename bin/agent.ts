#!/usr/bin/env node
import { createCli } from '../src/ui/cli.js';

const program = createCli();
program.parse(process.argv);
