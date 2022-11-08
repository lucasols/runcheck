import { describe, expect, test } from 'vitest'
import { rc_loose_parse, rc_number } from '../src/runcheck'

describe('loose parsing', () => {
  test('pass', () => {
    const result = rc_loose_parse(1, rc_number)

    expect(result).toEqual({
      data: 1,
      errors: false,
      warnings: false,
    })
  })

  test('fail', () => {
    const result = rc_loose_parse('1', rc_number)

    expect(result).toEqual({
      data: null,
      errors: ["Type 'string' is not assignable to 'number'"],
      warnings: false,
    })
  })
})
