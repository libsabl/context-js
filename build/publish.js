import * as fs from 'fs/promises';
import rmfr from 'rmfr';
import chalk from 'chalk';
import { exec, packageDirFn, relPathFn } from './util';

/**
 *
 * @param {string} source
 * @param {string} label
 * @returns {string}
 */
function removeChunk(source, label) {
  const startTag = `<!-- BEGIN:${label} -->`;
  const endTag = `<!-- END:${label} -->`;
  let result = source;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const startIx = result.indexOf(startTag);
    if (startIx < 0) break;
    const endIx = result.indexOf(endTag, startIx);
    if (endIx < 0) break;
    const before = result.substring(0, startIx);
    const after = result.substring(endIx + endTag.length);
    result = before + after;
  }

  return result;
}

(async () => {
  const pkgpath = await packageDirFn();
  const pubpath = relPathFn(pkgpath.root, 'publish');

  // Delete existing publish folder
  await rmfr(pubpath.root);

  // Remake empty folder
  await fs.mkdir(pubpath.root);

  // Copy package files
  for (const dir of ['src', 'dist']) {
    console.log(chalk.blueBright(`  Copying ${dir}/*`));
    await fs.cp(pkgpath(dir), pubpath(dir), {
      recursive: true,
    });
  }

  for (const fl of ['LICENSE', 'package.json']) {
    console.log(chalk.blueBright(`  Copying ${fl}`));
    await fs.cp(pkgpath(fl), pubpath(fl));
  }

  // Render tsconfig
  console.log(chalk.blueBright('  Rendering tsconfig.json'));
  const { stdout: tsconfig } = await exec(
    'pnpx tsc --project ./tsconfig.build.json --showConfig ',
    { cwd: pkgpath.root }
  );
  await fs.writeFile(pubpath('tsconfig.json'), tsconfig, 'utf8');

  // Render README
  console.log(chalk.blueBright('  Rendering README.md'));
  let rdme = await fs.readFile(pkgpath('README.md'), 'utf8');
  rdme = removeChunk(rdme, 'REMOVE_FOR_NPM');
  await fs.writeFile(pubpath('README.md'), rdme);
})();
