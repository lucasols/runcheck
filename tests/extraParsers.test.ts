import { describe, expect, test } from 'vitest'
import {
  rc_number,
  rc_object,
  rc_parse,
  rc_unwrap_or_null,
} from '../src/runcheck'
import { errorResult, successResult } from './testUtils'

describe('loose parsing', () => {
  test('pass', () => {
    const result = rc_unwrap_or_null(rc_parse(1, rc_number))

    expect(result).toEqual({
      value: 1,
      errors: false,
      warnings: false,
    })
  })

  test('fail', () => {
    const result = rc_unwrap_or_null(rc_parse('1', rc_number))

    expect(result).toEqual({
      value: null,
      errors: ["Type 'string' is not assignable to 'number'"],
      warnings: false,
    })
  })
})

describe('strict parsing', () => {
  const schema = rc_object({
    withAutofix: rc_number.withAutofix(() => ({
      fixed: 1,
    })),
    withFallback: rc_number.withFallback(1),
  })

  test('pass', () => {
    const result = rc_parse(
      {
        withAutofix: '1',
        withFallback: '1',
      },
      schema,
    )

    expect(result).toEqual(
      successResult({ withAutofix: 1, withFallback: 1 }, [
        "$.withAutofix: Autofixed from error \"Type 'string' is not assignable to 'number'\"",
        "$.withFallback: Fallback used, errors -> Type 'string' is not assignable to 'number'",
      ]),
    )
  })

  test('do not pass with noWarnings: true', () => {
    const result = rc_parse(
      {
        withAutofix: '1',
        withFallback: '1',
      },
      schema,
      { noWarnings: true },
    )

    expect(result).toEqual(
      errorResult(
        "$.withAutofix: Type 'string' is not assignable to 'number'",
        "$.withFallback: Type 'string' is not assignable to 'number'",
      ),
    )
  })
})
