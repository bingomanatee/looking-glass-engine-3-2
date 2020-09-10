import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { terser } from 'rollup-plugin-terser';
import bundleSize from 'rollup-plugin-bundle-size';

module.exports = {
  input: 'src/index.js',
  plugins: [
    resolve(),
    commonjs(),
    terser(),
    bundleSize(),
  ],
  output: {
    file: 'lib/index.js',
    format: 'umd',
    name: 'LGE',
  },
};
