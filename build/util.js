import path from 'path';
import * as fs from 'fs/promises';

import { exec as exec_cb } from 'child_process';
import { promisify } from 'util';
import { EOL } from 'os';
import glob_cb from 'glob';

/**
 * Check if a path exists, using underlying fs.access API
 * @param {import('fs').PathLike} path
 */
export async function exists(path, mode) {
  try {
    await fs.access(path, mode);
    return true;
  } catch {
    return false;
  }
}

/**
 * Return a function which resolves paths relative to that directory
 * @param {string[]} startPath The starting search path
 */
export function relPathFn(...startPath) {
  const root = path.join(...startPath);
  /**
   * Resolves a path relative to an injected root directory
   * @param {string[]} parts
   */
  const resolvePath = function (...parts) {
    return path.resolve(path.join(root, ...parts));
  };

  /**
   * Joins a path relative to an injected root directory
   * @param {string[]} parts
   */
  const joinPath = function (...parts) {
    return path.join(root, ...parts);
  };

  Object.defineProperty(resolvePath, 'root', {
    value: root,
    configurable: false,
  });
  Object.defineProperty(resolvePath, 'join', {
    value: joinPath,
    configurable: false,
  });
  return resolvePath;
}

/**
 * Find the nearest directory that contains a package.json file
 * @param {string} [startPath] The starting search path. Defaults to process.cwd()
 */
export async function packageDir(startPath) {
  let testPath = startPath || process.cwd();
  while (!(await exists(path.join(testPath, 'package.json')))) {
    let parent = path.dirname(testPath);
    if (parent == testPath) {
      throw new Error('No package.json found');
    }
    testPath = parent;
  }
  return testPath;
}

/**
 * Find the nearest directory that contains a package.json file,
 * and return a function which resolves paths relative to that directory
 * @param {string} [startPath] The starting search path. Defaults to process.cwd()
 */
export async function packageDirFn(startPath) {
  let pkgdir = await packageDir(startPath);
  return relPathFn(pkgdir);
}

/**
 * Find the nearest directory that contains a .git directory
 * @param {string} [startPath] The starting search path. Defaults to process.cwd()
 */
export async function repoDir(startPath) {
  let testPath = startPath || process.cwd();
  while (!(await exists(path.join(testPath, '.git')))) {
    let parent = path.dirname(testPath);
    if (parent == testPath) {
      throw new Error('No .git folder found');
    }
    testPath = parent;
  }
  return testPath;
}

/**
 * Find the nearest directory that contains a .git directory,
 * and return a function which resolves paths relative to that directory
 * @param {string} [startPath] The starting search path. Defaults to process.cwd()
 */
export async function repoDirFn(startPath) {
  let pkgdir = await repoDir(startPath);
  return relPathFn(pkgdir);
}

/**
 * Ensure source string is line-commented
 * @param {string} source
 * @returns
 */
export function comment(source) {
  return source
    .split(/[\r\n]+/)
    .map((line) => {
      let m;
      if (line.match(/^\s*\/\//)) return line;
      if ((m = line.match(/^(\s+)(.*)$/))) {
        return m[1] + '// ' + m[2];
      }
      return '// ' + line;
    })
    .join(EOL);
}

/**
 * Indent each line of `source` by `count` spaces
 * @param {string} source
 * @param {number} [count=2]
 * @returns
 */
export function indent(source, count = 2) {
  let indent = new Array(count + 1).join(' ');
  return source
    .split(/[\r\n]+/)
    .map((l) => indent + l)
    .join(EOL);
}

/**
 * Return an array of all the tag names attached to the curent commit
 * @returns {Promise<string[]>}
 */
export async function gitGetTags() {
  const { stdout: data } = await exec('git log --oneline -n 1');
  const rx = /tag: ([^,\s]+)/;
  return [...data.matchAll(rx)].map((m) => m[1]);
}

/**
 * Return an array of all the uncommitted changes
 * @returns {Promise<string[]>}
 */
export async function gitGetChanges() {
  const { stdout: data } = await exec('git diff-index HEAD --');
  return data.split(/[\r\n]+/);
}

/**
 * Check whether there are any uncommitted changes
 * @returns {Promise<boolean>}
 */
export async function gitHasChanges() {
  const changes = await gitGetChanges();
  return changes.some((l) => l.trim().length);
}

export const exec = promisify(exec_cb);
export const glob = promisify(glob_cb);
