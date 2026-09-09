#!/usr/bin/env node
/**
 * @module detailed-verifier
 * @author Perijn Huijser
 * Runs configured formatter and static-analysis checks for explicit project paths.
 *
 * @remarks
 * Usage:
 *   Core principle: Keep expensive or environment-dependent analysis out of the
 *   write hook while exposing one explicit verification command.
 *   Setup: Install the tools selected by the project's policy on PATH or through
 *   its package manager, then pass candidate source or Compose paths.
 *   Workflow: Classify supplied paths, invoke each profile's check-only commands,
 *   and return the first nonzero result.
 *   API guide: Run without paths for package verification; pass --optional to
 *   report unavailable external tools without failing.
 *   Worked example: node scripts/verify.mjs compose.yaml src/main.py
 */

import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, extname, join, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const optional = process.argv.includes('--optional')
const paths = process.argv.slice(2).filter((item) => !item.startsWith('-'))
const composeNames = new Set(['compose.yaml', 'compose.yml', 'docker-compose.yaml', 'docker-compose.yml'])

/**
 * Runs one external verifier and handles missing tools consistently.
 *
 * @param {string} command - Executable name.
 * @param {string[]} args - Check-only arguments.
 * @returns {void} Completion when the command succeeds or is optional and absent.
 * @throws {Error} When a required tool is unavailable or returns nonzero.
 */
function execute(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' })
  if (result.error?.code === 'ENOENT') {
    if (optional) return console.warn(`coding-doc-standard: optional tool unavailable: ${command}`)
    throw new Error(`required verification tool unavailable: ${command}; rerun with --optional to skip it`)
  }
  if (result.status !== 0) throw new Error(`${command} failed with exit ${result.status ?? 1}`)
}

/**
 * Identifies configured Docker Compose filenames.
 *
 * @param {string} path - Candidate filesystem path.
 * @returns {boolean} Whether the path is recognized as Docker Compose.
 */
function isCompose(path) {
  const file = basename(path).toLowerCase()
  return composeNames.has(file) || /^compose\..+\.ya?ml$/.test(file)
}

if (!paths.length) {
  await import('./verify-install.mjs')
} else {
  for (const path of paths) {
    if (!existsSync(path)) throw new Error(`verification path does not exist: ${path}`)
    if (isCompose(path)) {
      execute('prettier', ['--check', path])
      execute('yamllint', [path])
      execute('docker', ['compose', '-f', path, 'config', '-q'])
      continue
    }
    switch (extname(path).toLowerCase()) {
      case '.py':
        execute('ruff', ['format', '--check', path])
        execute('ruff', ['check', path])
        break
      case '.ts': case '.js': case '.mjs': case '.cjs':
        execute('biome', ['check', path])
        break
      case '.rs':
        execute('cargo', ['fmt', '--check'])
        execute('cargo', ['clippy', '--', '-D', 'warnings'])
        break
      case '.c': case '.h': case '.cc': case '.cpp': case '.hpp':
        execute('clang-format', ['--dry-run', '--Werror', path])
        execute('clang-tidy', [path])
        break
      default:
        console.warn(`coding-doc-standard: no detailed profile for ${path}`)
    }
  }
}
