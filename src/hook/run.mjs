/**
 * @module hook-runner
 * @author Perijn Huijser
 * Builds pending write candidates and invokes the documentation checker.
 *
 * @remarks
 * Usage:
 *   Core principle: Validate exactly the candidate text a write or edit would
 *   create, never stale disk content.
 *   Setup: Configure this file as the command entry in the hooks bridge and
 *   provide its JSON payload through standard input.
 *   Workflow: Parse the tool payload, construct candidate content, then spawn
 *   the Python checker with the candidate on standard input.
 *   API guide: The exported `runHook` function supports direct integration tests.
 *   Worked example: echo '{"tool_name":"write","tool_input":{"file_path":"a.py","content":""}}' | node run.mjs
 */

import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const sourceRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const checker = join(sourceRoot, 'hook', 'checker.py')
const defaultsPolicy = join(sourceRoot, 'policy', 'defaults.json')
const durablePolicy = join(homedir(), '.dsh', 'plugins', 'coding-doc-standard', 'policy.json')
const policy = process.env.CODING_DOC_STANDARD_POLICY ?? (existsSync(durablePolicy) ? durablePolicy : defaultsPolicy)

/**
 * Builds the proposed content from a DeepSeek Harness write or edit payload.
 *
 * @param {Record<string, unknown>} payload - Hook event payload.
 * @returns {Promise<{path: string, content: string}>} Candidate path and complete content.
 * @throws {Error} When the payload is unsupported or an edit cannot be applied exactly once.
 */
export async function candidateFromPayload(payload) {
  const input = payload.tool_input
  if (!input || typeof input !== 'object') throw new Error('tool_input must be an object')
  const path = input.file_path
  if (typeof path !== 'string' || !path) throw new Error('tool_input.file_path is required')
  if (typeof input.content === 'string') return { path, content: input.content }
  if (typeof input.old_string !== 'string' || typeof input.new_string !== 'string') {
    throw new Error('expected write content or edit old_string/new_string')
  }
  const before = await readFile(path, 'utf8')
  const count = before.split(input.old_string).length - 1
  if (count !== 1) throw new Error(`edit old_string must match exactly once (matched ${count})`)
  return { path, content: before.replace(input.old_string, input.new_string) }
}

/**
 * Runs the Python documentation checker for one pending candidate.
 *
 * @param {{path: string, content: string}} candidate - Proposed file state.
 * @returns {Promise<number>} Checker exit code.
 */
export function runChecker(candidate) {
  const python = process.platform === 'win32' ? 'py' : 'python3'
  const args = process.platform === 'win32'
    ? ['-3', checker, candidate.path, '--policy', policy, '--stdin']
    : [checker, candidate.path, '--policy', policy, '--stdin']
  return new Promise((resolve, reject) => {
    const child = spawn(python, args, { stdio: ['pipe', 'inherit', 'inherit'] })
    child.once('error', reject)
    child.once('exit', (code) => resolve(code ?? 1))
    child.stdin.end(candidate.content)
  })
}

/**
 * Executes a hook payload and converts invalid payloads into blocking feedback.
 *
 * @param {Record<string, unknown>} payload - Hook event payload.
 * @returns {Promise<number>} Hook-compatible process status.
 */
export async function runHook(payload) {
  try {
    return await runChecker(await candidateFromPayload(payload))
  } catch (error) {
    console.error(`[doc-standard] Cannot validate pending write: ${error.message}`)
    return 2
  }
}

if (import.meta.url === `file://${process.argv[1]?.replaceAll('\\', '/')}`) {
  let raw = ''
  process.stdin.setEncoding('utf8')
  process.stdin.on('data', (chunk) => { raw += chunk })
  process.stdin.once('end', async () => {
    try {
      process.exitCode = await runHook(JSON.parse(raw))
    } catch {
      console.error('[doc-standard] Hook payload is not valid JSON')
      process.exitCode = 2
    }
  })
}
