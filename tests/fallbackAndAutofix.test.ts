import { describe, expect, test } from 'vitest'
import { rc_number_autofix, rc_string_autofix } from '../src/autofixable'
import {
  rc_array,
  rc_boolean,
  rc_number,
  rc_object,
  rc_parse,
  rc_record,
  rc_safe_fallback,
  rc_string,
} from '../src/runcheck'
import { successResult } from './testUtils'

describe('fallback', () => {
  test('fallback pass check but, return warnings', () => {
    const result = rc_parse(1, rc_string.withFallback('world'))

    expect(result).toEqual(
      successResult('world', [
        "Fallback used, errors -> Type 'number' is not assignable to 'string'",
      ]),
    )
  })

  test('lazy fallback', () => {
    const shape = rc_number.withFallback(() => Math.random())

    const result1 = rc_parse('1', shape)

    const result2 = rc_parse('2', shape)

    expect(!result1.error && result1.data).not.toBe(
      !result2.error && result2.data,
    )
  })

  test('fallback function receives invalidInput argument', () => {
    const capturedInputs: unknown[] = []
    const shape = rc_number.withFallback((invalidInput) => {
      capturedInputs.push(invalidInput)
      return 42
    })

    const result1 = rc_parse('invalid', shape)
    const result2 = rc_parse([], shape)
    const result3 = rc_parse({ foo: 'bar' }, shape)

    expect(result1).toEqual(
      successResult(42, [
        "Fallback used, errors -> Type 'string' is not assignable to 'number'",
      ]),
    )
    expect(result2).toEqual(
      successResult(42, [
        "Fallback used, errors -> Type 'array' is not assignable to 'number'",
      ]),
    )
    expect(result3).toEqual(
      successResult(42, [
        "Fallback used, errors -> Type 'object' is not assignable to 'number'",
      ]),
    )

    expect(capturedInputs).toEqual(['invalid', [], { foo: 'bar' }])
  })

  test('fallback function can use invalidInput for transformation', () => {
    const shape = rc_number.withFallback((invalidInput: unknown) => {
      if (typeof invalidInput === 'string') {
        const parsed = Number(invalidInput)
        return isNaN(parsed) ? 0 : parsed
      }
      return 0
    })

    const result1 = rc_parse('123', shape)
    const result2 = rc_parse('not-a-number', shape)
    const result3 = rc_parse({}, shape)

    expect(result1).toEqual(
      successResult(123, [
        "Fallback used, errors -> Type 'string' is not assignable to 'number'",
      ]),
    )
    expect(result2).toEqual(
      successResult(0, [
        "Fallback used, errors -> Type 'string' is not assignable to 'number'",
      ]),
    )
    expect(result3).toEqual(
      successResult(0, [
        "Fallback used, errors -> Type 'object' is not assignable to 'number'",
      ]),
    )
  })

  test('optional and fallback', () => {
    const result = rc_parse([], rc_string.optional().withFallback('world'))

    expect(result).toEqual(
      successResult('world', [
        "Fallback used, errors -> Type 'array' is not assignable to 'undefined | string'",
      ]),
    )
  })

  test('nullable and fallback', () => {
    const result = rc_parse([], rc_string.orNull().withFallback('world'))

    expect(result).toEqual(
      successResult('world', [
        "Fallback used, errors -> Type 'array' is not assignable to 'null | string'",
      ]),
    )
  })

  test('nullish and fallback', () => {
    const result = rc_parse([], rc_string.orNullish().withFallback('world'))

    expect(result).toEqual(
      successResult('world', [
        "Fallback used, errors -> Type 'array' is not assignable to 'null | undefined | string'",
      ]),
    )
  })

  test('optional and nullable and fallback', () => {
    const result = rc_parse(
      [],
      rc_string.optional().orNull().withFallback('world'),
    )

    expect(result).toEqual(
      successResult('world', [
        "Fallback used, errors -> Type 'array' is not assignable to 'null | undefined | string'",
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

test('withFallback not working sometimes', () => {
  const object = rc_object({
    a: rc_record(rc_string).optional().withFallback(undefined),
  })

  const result = rc_parse({ a: [] }, object)

  expect(result).toEqual(
    successResult(
      {
        a: undefined,
      },
      [
        // eslint-disable-next-line no-useless-escape
        `$.a: Fallback used, errors -> Type 'array' is not assignable to 'undefined | record\<string, string\>'`,
      ],
    ),
  )
})

describe('rc_safe_fallback', () => {
  const schema = rc_object({
    a: rc_safe_fallback(rc_string, 'world'),
  })

  test('fallback not used', () => {
    const result = rc_parse({ a: 'hello' }, schema)

    expect(result).toEqual(successResult({ a: 'hello' }))
  })

  test('when fallback is used no warning should be returned', () => {
    const result = rc_parse({}, schema)

    expect(result).toEqual(successResult({ a: 'world' }))

    expect(result.ok && !result.warnings).toBe(true)
  })
})
