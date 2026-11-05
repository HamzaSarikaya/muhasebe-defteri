import {FlatCompat} from '@eslint/eslintrc';
import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const compat = new FlatCompat({baseDirectory: dirname(fileURLToPath(import.meta.url))});

const config = [
  {ignores: ['.next/**', 'node_modules/**', 'public/sw.js', 'public/sw.js.map', 'test-results/**', 'playwright-report/**', 'next-env.d.ts']},
  ...compat.extends('next/core-web-vitals', 'next/typescript')
];
export default config;
