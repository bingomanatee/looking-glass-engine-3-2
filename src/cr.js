import chalk from 'chalk';
import { nanoid } from 'nanoid/non-secure';

const def = chalk.white.bgBlack;

const choices = new Map([
  ['0', chalk.bold.gray.bgBlack],
  ['1', chalk.bold.red.bgBlack],
  ['2', chalk.bold.green.bgBlack],
  ['3', chalk.bold.yellow.bgBlack],
  ['4', chalk.bold.blue.bgBlack],
  ['5', chalk.bold.magenta.bgBlack],
  ['6', chalk.bold.cyan.bgBlack],
  ['7', chalk.bold.white.bgBlack],
  ['8', chalk.bold.black.bgBlack],
  ['9', chalk.bold.red.bgBlack],
]);

export default cr;
const cr = (num) => {
  if (!num) num = nanoid();
  let numStr = `${num}`.toLowerCase().replace('0.', '');
  let prefix = '';
  if (/_.+/.test(numStr)) {
    const parts = numStr.split('_');
    prefix = `${parts.shift()}_`;
    numStr = parts.join('_');
  }
  const str = prefix + numStr
    .split('').reduce((out, value) => {
      let code = value;
      if (!choices.has(value)) {
        code = `${code.charCodeAt(0) % 10}`;
      }
      return out + choices.get(code)(value);
    }, '');
  return str;
};
