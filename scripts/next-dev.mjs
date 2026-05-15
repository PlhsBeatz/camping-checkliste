#!/usr/bin/env node
/**
 * Lädt `.dev.vars` in `process.env`, bevor `next dev` startet (JWT_SECRET, API-Keys, …).
 * Kein Next-Instrumentation-Hook: Webpack würde sonst auch eine Edge-Variante bauen → kein `fs`.
 *
 * Weiterleitung: `pnpm dev -- --turbo` → `next dev --turbo`
 */
import { spawn } from 'child_process'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { loadDevVars, applyDevVarsToProcessEnv } from '../dev-vars-node.mjs'

applyDevVarsToProcessEnv(loadDevVars())

const root = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(root, '..')
const nextBin = join(projectRoot, 'node_modules', 'next', 'dist', 'bin', 'next')

const passthrough = process.argv.slice(2)
const nextArgs = ['dev', ...passthrough]

const child = spawn(process.execPath, [nextBin, ...nextArgs], {
  stdio: 'inherit',
  env: process.env,
  cwd: projectRoot,
})

child.on('exit', (code, signal) => {
  if (signal) process.exit(1)
  process.exit(code ?? 0)
})
