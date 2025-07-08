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
  rc_union,
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
        `Autofixed from error -> Type 'number' is not assignable to 'string'`,
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
        `Autofixed from error -> Type 'number' is not assignable to 'boolean'`,
      ]),
    )
  })

  test('fix a string to number', () => {
    const result = rc_parse('1', rc_number_autofix)

    expect(result).toEqual(
      successResult(1, [
        `Autofixed from error -> Type 'string' is not assignable to 'number'`,
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
          `$.number: Autofixed from error -> Type 'string' is not assignable to 'number'`,
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
          `$.a.b.number: Autofixed from error -> Type 'string' is not assignable to 'number'`,
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
          `$[0].number[1]: Autofixed from error -> Type 'string' is not assignable to 'number'`,
        ],
      ),
    )
  })

  test('return error if autofix is not possible', () => {
    const result = rc_parse(
      { number: 'not-a-number' },
      rc_object({ number: rc_number_autofix }),
    )

    expect(result.ok).toBe(false)
    expect(result.errors).toEqual([
      `$.number: Type 'string' is not assignable to 'number'`,
    ])
  })

  test('autofix with custom error message', () => {
    const schema = rc_string.withAutofix((input) => {
      if (typeof input === 'number') {
        return { fixed: input.toString() }
      }
      return { errors: ['Custom error: cannot convert to string'] }
    })

    const result = rc_parse([], schema)

    expect(result.ok).toBe(false)
    expect(result.errors).toEqual(['Custom error: cannot convert to string'])
  })

  test('custom autofix function returns fixed value', () => {
    const schema = rc_string.withAutofix((input) => {
      if (typeof input === 'number') {
        return { fixed: `number_${input}` }
      }
      return false
    })

    const result = rc_parse(42, schema)

    expect(result).toEqual(
      successResult('number_42', [
        `Autofixed from error -> Type 'number' is not assignable to 'string'`,
      ]),
    )
  })

  test('custom autofix function returns false when cannot fix', () => {
    const schema = rc_string.withAutofix((input) => {
      if (typeof input === 'number') {
        return { fixed: input.toString() }
      }
      return false
    })

    const result = rc_parse([], schema)

    expect(result.ok).toBe(false)
    expect(result.errors).toEqual([
      `Type 'array' is not assignable to 'string'`,
    ])
  })

  test('autofix function receives correct input', () => {
    let capturedInput: unknown
    const schema = rc_string.withAutofix((input) => {
      capturedInput = input
      return { fixed: 'fixed' }
    })

    rc_parse(42, schema)

    expect(capturedInput).toBe(42)
  })

  test('autofix in nested object structures', () => {
    const schema = rc_object({
      data: rc_object({
        value: rc_string.withAutofix((input) => {
          if (typeof input === 'number') {
            return { fixed: `converted_${input}` }
          }
          return false
        }),
      }),
    })

    const result = rc_parse({ data: { value: 123 } }, schema)

    expect(result).toEqual(
      successResult({ data: { value: 'converted_123' } }, [
        `$.data.value: Autofixed from error -> Type 'number' is not assignable to 'string'`,
      ]),
    )
  })

  test('autofix in nested array structures', () => {
    const schema = rc_array(
      rc_object({
        numbers: rc_array(
          rc_string.withAutofix((input) => {
            if (typeof input === 'number') {
              return { fixed: `num_${input}` }
            }
            return false
          }),
        ),
      }),
    )

    const result = rc_parse(
      [{ numbers: [1, 'text', 3] }, { numbers: ['text', 5] }],
      schema,
    )

    expect(result).toEqual(
      successResult(
        [
          { numbers: ['num_1', 'text', 'num_3'] },
          { numbers: ['text', 'num_5'] },
        ],
        [
          `$[0].numbers[0]: Autofixed from error -> Type 'number' is not assignable to 'string'`,
          `$[0].numbers[2]: Autofixed from error -> Type 'number' is not assignable to 'string'`,
          `$[1].numbers[1]: Autofixed from error -> Type 'number' is not assignable to 'string'`,
        ],
      ),
    )
  })

  test('autofix mixed with optional fields', () => {
    const schema = rc_object({
      required: rc_string.withAutofix((input) => {
        if (typeof input === 'number') {
          return { fixed: input.toString() }
        }
        return false
      }),
      optional: rc_string
        .withAutofix((input) => {
          if (typeof input === 'number') {
            return { fixed: input.toString() }
          }
          return false
        })
        .optional(),
    })

    const result = rc_parse({ required: 42, optional: 3.14 }, schema)

    expect(result).toEqual(
      successResult({ required: '42', optional: '3.14' }, [
        `$.required: Autofixed from error -> Type 'number' is not assignable to 'string'`,
        `$.optional: Autofixed from error -> Type 'number' is not assignable to 'undefined | string'`,
      ]),
    )
  })

  test('autofix with union types', () => {
    const stringAutofix = rc_string.withAutofix((input) => {
      if (typeof input === 'number') {
        return { fixed: input.toString() }
      }
      return false
    })

    const result = rc_parse(42, rc_union(stringAutofix, rc_number))

    expect(result).toEqual(
      successResult('42', [
        `Autofixed from error -> Type 'number' is not assignable to 'string'`,
      ]),
    )
  })

  test('autofix chaining with fallback', () => {
    const schema = rc_string
      .withAutofix((input) => {
        if (typeof input === 'number') {
          return { fixed: input.toString() }
        }
        return false
      })
      .withFallback('fallback_value')

    const result = rc_parse([], schema)

    expect(result).toEqual(
      successResult('fallback_value', [
        `Fallback used, errors -> Type 'array' is not assignable to 'string'`,
      ]),
    )
  })

  test('autofix with where predicate', () => {
    const schema = rc_string
      .withAutofix((input) => {
        if (typeof input === 'number' && input >= 100) {
          return { fixed: `valid_${input}` }
        }
        if (typeof input === 'number') {
          return { fixed: `invalid_${input}` }
        }
        return false
      })
      .where((value) => value.startsWith('valid_'))

    const result1 = rc_parse(123, schema)
    const result2 = rc_parse(42, schema)

    expect(result1).toEqual(
      successResult('valid_123', [
        `Autofixed from error -> Type 'number' is not assignable to 'string'`,
      ]),
    )

    expect(result2).toEqual(
      successResult('invalid_42', [
        `Autofixed from error -> Type 'number' is not assignable to 'string'`,
        `Autofixed from error -> Predicate failed for type 'string'`,
      ]),
    )
  })

  test('autofix disabled with noWarnings option', () => {
    const schema = rc_string.withAutofix((input) => {
      if (typeof input === 'number') {
        return { fixed: input.toString() }
      }
      return false
    })

    const result = rc_parse(42, schema, { noWarnings: true })

    expect(result.ok).toBe(false)
    expect(result.errors).toEqual([
      `Type 'number' is not assignable to 'string'`,
    ])
  })

  test('autofix multiple transformations in sequence', () => {
    let transformCount = 0
    const schema = rc_array(
      rc_string.withAutofix((input) => {
        transformCount++
        if (typeof input === 'number') {
          return { fixed: `item_${input}` }
        }
        return false
      }),
    )

    const result = rc_parse([1, 2, 'text', 4], schema)

    expect(transformCount).toBe(3) // Only numbers should be transformed
    expect(result).toEqual(
      successResult(
        ['item_1', 'item_2', 'text', 'item_4'],
        [
          `$[0]: Autofixed from error -> Type 'number' is not assignable to 'string'`,
          `$[1]: Autofixed from error -> Type 'number' is not assignable to 'string'`,
          `$[3]: Autofixed from error -> Type 'number' is not assignable to 'string'`,
        ],
      ),
    )
  })

  test('autofix with complex custom logic', () => {
    const schema = rc_object({
      status: rc_string.withAutofix((input) => {
        if (typeof input === 'boolean') {
          return { fixed: input ? 'active' : 'inactive' }
        }
        if (typeof input === 'number') {
          return { fixed: input > 0 ? 'positive' : 'zero_or_negative' }
        }
        return false
      }),
    })

    const result1 = rc_parse({ status: true }, schema)
    const result2 = rc_parse({ status: false }, schema)
    const result3 = rc_parse({ status: 5 }, schema)
    const result4 = rc_parse({ status: -1 }, schema)

    expect(result1).toEqual(
      successResult({ status: 'active' }, [
        `$.status: Autofixed from error -> Type 'boolean' is not assignable to 'string'`,
      ]),
    )
    expect(result2).toEqual(
      successResult({ status: 'inactive' }, [
        `$.status: Autofixed from error -> Type 'boolean' is not assignable to 'string'`,
      ]),
    )
    expect(result3).toEqual(
      successResult({ status: 'positive' }, [
        `$.status: Autofixed from error -> Type 'number' is not assignable to 'string'`,
      ]),
    )
    expect(result4).toEqual(
      successResult({ status: 'zero_or_negative' }, [
        `$.status: Autofixed from error -> Type 'number' is not assignable to 'string'`,
      ]),
    )
  })

  test('safeFix true - no warning reported', () => {
    const schema = rc_string.withAutofix((input) => {
      if (typeof input === 'number') {
        return { fixed: input.toString(), safeFix: true }
      }
      return false
    })

    const result = rc_parse(42, schema)

    expect(result).toEqual(successResult('42', false))
    expect(result.ok && result.warnings).toBe(false)
  })

  test('safeFix false - warning reported', () => {
    const schema = rc_string.withAutofix((input) => {
      if (typeof input === 'number') {
        return { fixed: input.toString(), safeFix: false }
      }
      return false
    })

    const result = rc_parse(42, schema)

    expect(result).toEqual(
      successResult('42', [
        `Autofixed from error -> Type 'number' is not assignable to 'string'`,
      ]),
    )
  })

  test('safeFix undefined - warning reported (default behavior)', () => {
    const schema = rc_string.withAutofix((input) => {
      if (typeof input === 'number') {
        return { fixed: input.toString() }
      }
      return false
    })

    const result = rc_parse(42, schema)

    expect(result).toEqual(
      successResult('42', [
        `Autofixed from error -> Type 'number' is not assignable to 'string'`,
      ]),
    )
  })

  test('safeFix in nested structures', () => {
    const schema = rc_object({
      safe: rc_string.withAutofix((input) => {
        if (typeof input === 'number') {
          return { fixed: `safe_${input}`, safeFix: true }
        }
        return false
      }),
      warned: rc_string.withAutofix((input) => {
        if (typeof input === 'number') {
          return { fixed: `warned_${input}`, safeFix: false }
        }
        return false
      }),
    })

    const result = rc_parse({ safe: 123, warned: 456 }, schema)

    expect(result).toEqual(
      successResult({ safe: 'safe_123', warned: 'warned_456' }, [
        `$.warned: Autofixed from error -> Type 'number' is not assignable to 'string'`,
      ]),
    )
  })

  test('safeFix in arrays', () => {
    const schema = rc_array(
      rc_string.withAutofix((input) => {
        if (typeof input === 'number') {
          return { fixed: `item_${input}`, safeFix: input % 2 === 0 }
        }
        return false
      }),
    )

    const result = rc_parse([1, 2, 3, 4], schema)

    expect(result).toEqual(
      successResult(
        ['item_1', 'item_2', 'item_3', 'item_4'],
        [
          `$[0]: Autofixed from error -> Type 'number' is not assignable to 'string'`,
          `$[2]: Autofixed from error -> Type 'number' is not assignable to 'string'`,
        ],
      ),
    )
  })

  test('safeFix with custom errors', () => {
    const schema = rc_string.withAutofix((input) => {
      if (typeof input === 'number' && input > 0) {
        return { fixed: input.toString(), safeFix: true }
      }
      if (typeof input === 'number') {
        return { errors: ['Number must be positive'] }
      }
      return false
    })

    const result1 = rc_parse(42, schema)
    const result2 = rc_parse(-5, schema)
    const result3 = rc_parse([], schema)

    expect(result1).toEqual(successResult('42', false))

    expect(result2.ok).toBe(false)
    expect(result2.errors).toEqual(['Number must be positive'])

    expect(result3.ok).toBe(false)
    expect(result3.errors).toEqual([
      `Type 'array' is not assignable to 'string'`,
    ])
  })

  test('safeFix with union types', () => {
    const safeStringAutofix = rc_string.withAutofix((input) => {
      if (typeof input === 'number') {
        return { fixed: input.toString(), safeFix: true }
      }
      return false
    })

    const result = rc_parse(42, rc_union(safeStringAutofix, rc_number))

    expect(result).toEqual(successResult('42', false))
  })

  test('safeFix disabled with noWarnings option', () => {
    const schema = rc_string.withAutofix((input) => {
      if (typeof input === 'number') {
        return { fixed: input.toString(), safeFix: true }
      }
      return false
    })

    const result = rc_parse(42, schema, { noWarnings: true })

    expect(result.ok).toBe(false)
    expect(result.errors).toEqual([
      `Type 'number' is not assignable to 'string'`,
    ])
  })

  test('safeFix with mixed scenarios', () => {
    const schema = rc_string.withAutofix((input) => {
      if (typeof input === 'number' && input > 0) {
        return { fixed: input.toString(), safeFix: true }
      }
      if (typeof input === 'number') {
        return { fixed: input.toString(), safeFix: false }
      }
      return false
    })

    const result1 = rc_parse(42, schema)
    const result2 = rc_parse(-5, schema)

    expect(result1).toEqual(successResult('42', false))

    expect(result2).toEqual(
      successResult('-5', [
        `Autofixed from error -> Type 'number' is not assignable to 'string'`,
      ]),
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
