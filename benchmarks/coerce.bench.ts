import {
  rc_coerce_number,
  rc_number,
  rc_parse,
  rc_string,
  rc_union,
  rc_unsafe_transform,
  rc_unwrap,
} from '../src/runcheck.js'
import { baseline, bench, group, run } from './bench.utils.js'

function castToNumber(value: unknown): number | null {
  const str = String(value)

  return !isNaN(Number(str)) && !isNaN(parseFloat(str)) ? Number(str) : null
}

const rc_numberFromNumericString = rc_unsafe_transform(rc_string, (value) => {
  const numericValue = castToNumber(value)

  return numericValue === null ?
      { ok: false as const, errors: [`Invalid number: ${value}`] }
    : { ok: true as const, data: numericValue }
})

const unionSchema = rc_union(rc_number, rc_numberFromNumericString)

group('coerce number from numeric string', { it: 100_000 }, (i) => {
  const valueToTest = `${i}.5`

  baseline('rc_coerce_number', () => {
    rc_unwrap(rc_parse(valueToTest, rc_coerce_number))
  })

  bench('union + transform', () => {
    rc_unwrap(rc_parse(valueToTest, unionSchema))
  })
})

group('coerce number from number input', { it: 100_000 }, (i) => {
  const valueToTest = i + 0.5

  baseline('rc_coerce_number', () => {
    rc_unwrap(rc_parse(valueToTest, rc_coerce_number))
  })

  bench('union + transform', () => {
    rc_unwrap(rc_parse(valueToTest, unionSchema))
  })
})

run()
