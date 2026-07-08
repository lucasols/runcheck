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

const numericStrings = Array.from({ length: 1024 }, (_, i) => `${i}.5`)
const numbers = Array.from({ length: 1024 }, (_, i) => i + 0.5)

group('coerce number from numeric string', () => {
  let ci = 0
  let ui = 0

  baseline('rc_coerce_number', () => {
    rc_unwrap(rc_parse(numericStrings[ci++ & 1023], rc_coerce_number))
  })

  bench('union + transform', () => {
    rc_unwrap(rc_parse(numericStrings[ui++ & 1023], unionSchema))
  })
})

group('coerce number from number input', () => {
  let ci = 0
  let ui = 0

  baseline('rc_coerce_number', () => {
    rc_unwrap(rc_parse(numbers[ci++ & 1023], rc_coerce_number))
  })

  bench('union + transform', () => {
    rc_unwrap(rc_parse(numbers[ui++ & 1023], unionSchema))
  })
})

await run()
