#!/usr/bin/env node
/**
 * `galeed-git-history`: run it before `astro build` (astro.config.mjs reads
 * the dates while it loads, before any integration hook).
 */
import { fetchFullHistory } from '../git.ts';

fetchFullHistory();
