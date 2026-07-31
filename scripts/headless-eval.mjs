/**
 * Runs an expression inside the app in headless Chrome, and prints its result.
 *
 * Milestone gates that touch export or the live canvas need a real browser.
 * Driving one by hand is not reproducible, and the editor extension can drop
 * mid-run; this makes those gates a command. No dependencies — node 23 has a
 * global `WebSocket` and `fetch`, so the whole CDP client is about forty lines.
 *
 * Usage:
 *
 *   node scripts/headless-eval.mjs --essay test-essay --expr "window.editor.getCurrentPageShapes().length"
 *   node scripts/headless-eval.mjs --essay test-essay --file /tmp/step.js
 *   node scripts/headless-eval.mjs --url http://localhost:5173/ --expr "1 + 1"
 *
 * The expression is evaluated with `awaitPromise`, so `await` works at the top
 * level and a returned promise is settled before printing. Vite serves the app
 * as ES modules, so `await import('/src/lib/exportFigure.ts')` reaches straight
 * into the real code rather than a copy of it.
 *
 * The dev server must already be running. Exits non-zero on a thrown
 * expression, so a gate can depend on it.
 */

import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT = 9333
const READY_TIMEOUT_MS = 30_000
/** The app has to mount, fetch its inputs, and load the snapshot before it is drivable. */
const APP_SETTLE_MS = 6_000

function parseArgs(argv) {
  const args = { url: null, essay: null, expr: null, file: null, settle: APP_SETTLE_MS }
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i]
    const value = argv[i + 1]
    if (flag === '--url') (args.url = value), i++
    else if (flag === '--essay') (args.essay = value), i++
    else if (flag === '--expr') (args.expr = value), i++
    else if (flag === '--file') (args.file = value), i++
    else if (flag === '--settle') (args.settle = Number(value)), i++
    else die(`Unknown flag: ${flag}`)
  }
  if (!args.expr && !args.file) die('Give one of --expr <js> or --file <path>')
  if (args.expr && args.file) die('Give only one of --expr or --file')
  if (!args.url) {
    args.url = args.essay
      ? `http://localhost:5173/?essay=${encodeURIComponent(args.essay)}`
      : 'http://localhost:5173/'
  }
  return args
}

function die(message) {
  console.error(message)
  console.error('\nUsage: node scripts/headless-eval.mjs [--essay <slug> | --url <url>] (--expr <js> | --file <path>)')
  process.exit(1)
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function waitForDevtools() {
  const deadline = Date.now() + READY_TIMEOUT_MS
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`)
      if (res.ok) return
    } catch {
      // devtools is not listening yet
    }
    await sleep(250)
  }
  throw new Error('headless chrome never opened its devtools port')
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const expression = args.file ? readFileSync(args.file, 'utf8') : args.expr
  const profile = `/tmp/essay-canvas-headless-${process.pid}`

  const chrome = spawn(
    CHROME,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${profile}`,
      'about:blank',
    ],
    { stdio: 'ignore' }
  )
  const stop = () => chrome.kill('SIGKILL')
  process.on('exit', stop)

  await waitForDevtools()

  const target = await (
    await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(args.url)}`, {
      method: 'PUT',
    })
  ).json()

  const ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    ws.onopen = resolve
    ws.onerror = () => reject(new Error('could not attach to the page'))
  })

  let nextId = 0
  const pending = new Map()
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data)
    const settle = pending.get(message.id)
    if (settle) {
      pending.delete(message.id)
      settle(message)
    }
  }
  const send = (method, params) =>
    new Promise((resolve) => {
      const id = ++nextId
      pending.set(id, resolve)
      ws.send(JSON.stringify({ id, method, params }))
    })

  await send('Runtime.enable')
  await sleep(args.settle)

  const response = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  })

  const details = response.result?.exceptionDetails
  if (details) {
    console.error(details.exception?.description ?? JSON.stringify(details))
    stop()
    process.exit(1)
  }

  const value = response.result?.result?.value
  console.log(typeof value === 'string' ? value : JSON.stringify(value, null, 1))
  stop()
  process.exit(0)
}

main().catch((err) => {
  console.error(String(err))
  process.exit(1)
})
