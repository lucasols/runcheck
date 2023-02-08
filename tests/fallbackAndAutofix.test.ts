import { describe, expect, test } from 'vitest'
import { rc_number_autofix, rc_string_autofix } from '../src/autofixable'
import {
  rc_array,
  rc_boolean,
  rc_number,
  rc_object,
  rc_parse,
  rc_string,
} from '../src/runcheck'
import { successResult } from './testUtils'

describe('fallback', () => {
  test('fallback pass check but, return warnings', () => {
    const result = rc_parse(1, rc_string.withFallback('world'))

    expect(result).toEqual(
      successResult('world', [
        "Fallback used, Type 'number' is not assignable to 'string'",
      ]),
    )
  })
})

describe('autofix', () => {
  test('fix number to string', () => {
    const result = rc_parse(1, rc_string_autofix)

    expect(result).toEqual(
      successResult('1', [
        `Autofixed from error "Type 'number' is not assignable to 'string'"`,
      ]),
    )
  })

  test('use a custom implementation', () => {
    const result = rc_parse(
      1,
      rc_boolean.withAutofix(() => {
        return { fixed: true }
      }),
    )

    expect(result).toEqual(
      successResult(true, [
        `Autofixed from error "Type 'number' is not assignable to 'boolean'"`,
      ]),
    )
  })

  test('fix a string to number', () => {
    const result = rc_parse('1', rc_number_autofix)

    expect(result).toEqual(
      successResult(1, [
        `Autofixed from error "Type 'string' is not assignable to 'number'"`,
      ]),
    )
  })

  test('fix a string to number in a object', () => {
    const result = rc_parse(
      {
        number: '1',
      },
      rc_object({ number: rc_number_autofix }),
    )

    expect(result).toEqual(
      successResult(
        {
          number: 1,
        },
        [
          `$.number: Autofixed from error "Type 'string' is not assignable to 'number'"`,
        ],
      ),
    )
  })

  test('fix a string to number in a object, deep nesting', () => {
    const result = rc_parse(
      {
        a: {
          b: {
            ok: 1,
            number: '1',
          },
        },
      },
      rc_object({
        a: rc_object({
          b: rc_object({
            ok: rc_number_autofix,
            number: rc_number_autofix,
          }),
        }),
      }),
    )

    expect(result).toEqual(
      successResult(
        {
          a: {
            b: {
              ok: 1,
              number: 1,
            },
          },
        },
        [
          `$.a.b.number: Autofixed from error "Type 'string' is not assignable to 'number'"`,
        ],
      ),
    )
  })

  test('fix a string to number in a array, deep nesting', () => {
    const result = rc_parse(
      [
        {
          number: [2, '1'],
        },
      ],
      rc_array(
        rc_object({
          number: rc_array(rc_number_autofix),
        }),
      ),
    )

    expect(result).toEqual(
      successResult(
        [
          {
            number: [2, 1],
          },
        ],
        [
          `$[0].number[1]: Autofixed from error "Type 'string' is not assignable to 'number'"`,
        ],
      ),
    )
  })
})
