#!/usr/bin/env node
/**
 * @module harness-installer
 * @author Perijn Huijser
 * Installs the skill and package link without mutating a DSH profile patch.
 *
 * @remarks
 * Usage:
 *   Core principle: Bundle metadata owns Cordis registration, while installation
 *   only makes package and skill assets discoverable to DSH.
 *   Setup: Run node scripts/install.mjs from a checked-out package directory.
 *   Workflow: Validate bundle metadata, copy skill files, and replace package
 *   links under DSH resolution roots.
 *   API guide: Run with --dry-run to preview every filesystem mutation.
 *   Worked example: node scripts/install.mjs --dry-run
 */

import { cpSync, existsSync, lstatSync, mkdirSync, rmSync, symlinkSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const dryRun = process.argv.includes('--dry-run')
const packageJson = JSON.parse(await (await import('node:fs/promises')).readFile(join(packageRoot, 'package.json'), 'utf8'))
const patch = packageJson.dsh?.bundle?.patch
if (patch !== './bundle.patch.yml' || !existsSync(join(packageRoot, patch))) {
  throw new Error('package must declare an existing dsh.bundle.patch')
}

const targets = [
  join(homedir(), '.dsh', 'node_modules', packageJson.name),
  join(homedir(), '.dsh', 'profiles', 'web', 'node_modules', packageJson.name),
]
const skillTarget = join(homedir(), '.dsh', 'skills', packageJson.name)

for (const target of targets) {
  console.log(`${dryRun ? 'would link' : 'linking'} ${target} -> ${packageRoot}`)
  if (dryRun) continue
  mkdirSync(dirname(target), { recursive: true })
  if (existsSync(target) || lstatSync(target, { throwIfNoEntry: false })) rmSync(target, { recursive: true, force: true })
  symlinkSync(packageRoot, target, process.platform === 'win32' ? 'junction' : 'dir')
}
console.log(`${dryRun ? 'would copy' : 'copying'} skill ${skillTarget}`)
if (!dryRun) {
  rmSync(skillTarget, { recursive: true, force: true })
  mkdirSync(dirname(skillTarget), { recursive: true })
  cpSync(join(packageRoot, 'skill'), skillTarget, { recursive: true })
}
console.log('Bundle patch registration remains package-owned; no profile patch was modified.')
