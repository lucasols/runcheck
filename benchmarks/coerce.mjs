import { baseline, bench, group, run } from 'mitata'
import {
  rc_coerce_number,
  rc_number,
  rc_parse,
  rc_string,
  rc_union,
  rc_unsafe_transform,
  rc_unwrap,
} from '../dist/runcheck.js'

function castToNumber(value) {
  const str = String(value)

  return !isNaN(Number(str)) && !isNaN(parseFloat(str)) ? Number(str) : null
}

const rc_numberFromNumericString = rc_unsafe_transform(rc_string, (value) => {
  const numericValue = castToNumber(value)

  return numericValue === null ?
      { ok: false, errors: [`Invalid number: ${value}`] }
    : { ok: true, data: numericValue }
})

const unionSchema = rc_union(rc_number, rc_numberFromNumericString)

const numericStrings = Array.from({ length: 64 }, (_, i) => `${i}.5`)
const numbers = Array.from({ length: 64 }, (_, i) => i + 0.5)

// results are written to this sink so v8 cannot dead-code-eliminate the
// parse calls
let sink

group('coerce number from numeric string (64 values)', () => {
  baseline('rc_coerce_number', () => {
    for (const value of numericStrings) {
      sink = rc_unwrap(rc_parse(value, rc_coerce_number))
    }
  })

  bench('union + transform', () => {
    for (const value of numericStrings) {
      sink = rc_unwrap(rc_parse(value, unionSchema))
    }
  })
})

group('coerce number from number input (64 values)', () => {
  baseline('rc_coerce_number', () => {
    for (const value of numbers) {
      sink = rc_unwrap(rc_parse(value, rc_coerce_number))
    }
  })

  bench('union + transform', () => {
    for (const value of numbers) {
      sink = rc_unwrap(rc_parse(value, unionSchema))
    }
  })
})

await run()

globalThis.__benchSink = sink
