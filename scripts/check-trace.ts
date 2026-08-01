/**
 * Assertions over the trace core (M6.1). Not a test framework — a script that
 * drives parse/validate/resolve/check against hand-built traces, proving the
 * §9 constraint is mechanical: nothing without a span, offsets minted by code,
 * a quote that cannot be located verbatim refused rather than guessed.
 *
 * Run: npx tsx scripts/check-trace.ts
 */

import { checkSpans, parseTrace, resolveSpans, validateTrace } from '../src/trace-types.ts'
import type { Trace } from '../src/trace-types.ts'

let failures = 0

function check(label: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual)
  const b = JSON.stringify(expected)
  if (a === b) {
    console.log(`PASS  ${label}`)
  } else {
    failures += 1
    console.log(`FAIL  ${label}`)
    console.log(`      expected ${b}`)
    console.log(`      actual   ${a}`)
  }
}

function section(title: string): void {
  console.log(`\n${title}`)
}

const ESSAY = [
  'The shop opens at seven. The shop stays open because closing would be a verdict.',
  '',
  'Repair is a stance before it is a trade. The shop opens at seven.',
].join('\n')

function base(): Trace {
  return {
    idea: 'Repair is a stance.',
    slug: 'fixture',
    reviewed: false,
    generated: '2026-07-31T00:00:00Z',
    sources: [{ id: 's-1', kind: 'essay', file: 'context/fixture/essay.md', cite: 'Fixture, 2026' }],
    units: [
      {
        id: 'u-1',
        atom: 'stance',
        text: 'Repair is a stance before a trade.',
        holder: null,
        span: { source: 's-1', start: -1, end: -1, quote: 'Repair is a stance before it is a trade.' },
        abstraction: 2,
      },
    ],
    relations: [],
    tensions: [],
    gaps: [],
  }
}

const files = new Map([['context/fixture/essay.md', ESSAY]])

section('parse')
{
  check('rejects a non-object', parseTrace('nope').trace, null)
  const missing = parseTrace({ idea: 'x', slug: 'fixture', generated: 'now', sources: [], units: [], relations: [], tensions: [], gaps: [] })
  check('reviewed must be boolean', missing.issues.some((i) => i.code === 'reviewed'), true)
  check('a well-shaped trace parses', parseTrace(base()).trace !== null, true)
}

section('vocabulary')
{
  const t = base()
  ;(t.units[0] as { atom: string }).atom = 'insight'
  check('a fifth atom type is refused', validateTrace(t).some((i) => i.code === 'atom'), true)

  const h = base()
  ;(h.units[0] as { holder: string }).holder = 'theirs'
  check('holder outside received|mine|null is refused', validateTrace(h).some((i) => i.code === 'holder'), true)

  const r = base()
  r.relations.push({ from: 'u-1', to: 'u-9', kind: 'answers' })
  check('relation to a missing unit is refused', validateTrace(r).some((i) => i.code === 'relation'), true)

  const g = base()
  g.gaps.push({ facing: 'u-9', label: 'absent thing' })
  check('gap facing a missing unit is refused', validateTrace(g).some((i) => i.code === 'gap'), true)

  const s = base()
  s.sources[0].file = 'corpus/elsewhere.md'
  check('source outside context/<slug>/ is refused', validateTrace(s).some((i) => i.code === 'source'), true)
}

section('resolve')
{
  const { trace, issues } = resolveSpans(base(), files)
  check('a unique quote resolves without issues', issues.length, 0)
  const span = trace.units[0].span
  check('offsets reproduce the quote', ESSAY.slice(span.start, span.end), span.quote)
  const again = resolveSpans(trace, files)
  check('resolution is idempotent', again.trace, trace)

  const amb = base()
  amb.units[0].span.quote = 'The shop opens at seven.'
  const ambOut = resolveSpans(amb, files)
  check('an ambiguous quote is refused', ambOut.issues.some((i) => i.code === 'quote-ambiguous'), true)
  check('ambiguity leaves offsets untouched', ambOut.trace.units[0].span.start, -1)

  const missing = base()
  missing.units[0].span.quote = 'These words are not in the pile.'
  check(
    'an absent quote is refused, never guessed',
    resolveSpans(missing, files).issues.some((i) => i.code === 'quote-missing'),
    true
  )
}

section('unfounded')
{
  const unresolved = base()
  check('unresolved offsets fail checkSpans', checkSpans(unresolved, files).some((i) => i.code === 'unfounded'), true)

  const { trace } = resolveSpans(base(), files)
  check('a resolved trace passes checkSpans', checkSpans(trace, files), [])

  const tampered = resolveSpans(base(), files).trace
  tampered.units[0].span.start += 3
  check('drifted offsets fail as quote-mismatch', checkSpans(tampered, files).some((i) => i.code === 'quote-mismatch'), true)

  const moved = resolveSpans(base(), files).trace
  const edited = new Map([['context/fixture/essay.md', `PREFACE. ${ESSAY}`]])
  check('an edited context file is caught', checkSpans(moved, edited).some((i) => i.code === 'quote-mismatch'), true)
}

console.log(failures === 0 ? '\nALL CHECKS PASS' : `\n${failures} CHECK(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
