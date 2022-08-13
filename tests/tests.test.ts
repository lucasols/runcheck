import { describe, expect, test } from 'vitest'
import {
  RcParseResult,
  RcType,
  rc_number,
  rc_object,
  rc_parse,
  rc_string,
  rc_union,
} from '../src/runcheck'
import { z } from 'zod'
import { dedent, pipe, simplifyResult } from './testUtils'

describe('rc_string', () => {
  test('pass', () => {
    const result: RcParseResult<string> = rc_parse('hello', rc_string)

    expect(result).toEqual({ error: false, data: 'hello' })
  })

  test('fail', () => {
    const result = rc_parse(1, rc_string)

    expect(result).toEqual({
      error: `Type 'number' is not assignable to 'string'`,
      data: '',
    })
  })

  test('with fallback', () => {
    // TODO: cast number to string
    expect(
      pipe(rc_parse(1, rc_string.withFallback('world')), simplifyResult),
    ).toEqual({
      error: true,
      data: 'world',
    })
  })

  test('extra checks', () => {
    expect(rc_parse('hello', rc_string.where({ has_lenght: 6 }))).toEqual({
      error: `Type 'string' is not assignable to 'string_has_lenght'`,
      data: '',
    })

    expect(
      rc_parse(
        'hello world',
        rc_string.where({ starts_with: 'https' }).withFallback('ok'),
      ),
    ).toEqual({
      error: `Type 'string' is not assignable to 'string_starts_with'`,
      data: 'ok',
    })

    expect(
      rc_parse('hello world', rc_string.where({ ends_with: 'test' })),
    ).toEqual({
      error: `Type 'string' is not assignable to 'string_ends_with'`,
      data: '',
    })
  })
})

describe('rc_number', () => {
  test('pass', () => {
    const result: RcParseResult<number> = rc_parse(1, rc_number)

    expect(result).toEqual({ error: false, data: 1 })
  })

  test('fail', () => {
    // TODO: cast string number to number
    expect(rc_parse('1', rc_number)).toEqual({
      error: `Type 'string' is not assignable to 'number'`,
      data: 0,
    })

    expect(pipe(rc_parse(NaN, rc_number), simplifyResult)).toEqual({
      error: true,
      data: 0,
    })

    expect(
      pipe(rc_parse(NaN, rc_number.withFallback(5)), simplifyResult),
    ).toEqual({
      error: true,
      data: 5,
    })
  })

  test('int number', () => {
    const type: RcType<number> = rc_number.int().withFallback(5)

    expect(rc_parse(1.1, type)).toEqual({
      error: `Type 'number' is not assignable to 'int_number'`,
      data: 5,
    })

    expect(rc_parse(1, type).error).toBeFalsy()
  })

  test('extra checks', () => {
    function getError(operator: string) {
      return {
        error: `Type 'number' is not assignable to 'number_${operator}'`,
        data: 0,
      }
    }

    expect(rc_parse(2, rc_number.where({ less_than: 2 }))).toEqual(
      getError('less_than'),
    )
    expect(rc_parse(1, rc_number.where({ less_than: 2 })).error).toBeFalsy()

    expect(rc_parse(2, rc_number.where({ greater_than: 2 }))).toEqual(
      getError('greater_than'),
    )
    expect(rc_parse(3, rc_number.where({ greater_than: 2 })).error).toBeFalsy()

    expect(rc_parse(3, rc_number.where({ less_than_or_equal: 2 }))).toEqual(
      getError('less_than_or_equal'),
    )

    expect(rc_parse(1, rc_number.where({ greater_than_or_equal: 2 }))).toEqual(
      getError('greater_than_or_equal'),
    )
  })
})

describe('rc_union', () => {
  test('throw error on empty inpu', () => {
    expect(() => rc_union()).toThrowError()
  })

  const shape: RcType<string | number> = rc_union(rc_string, rc_number)

  test('pass', () => {
    expect(rc_parse('hello', shape)).toEqual({
      error: false,
      data: 'hello',
    })

    expect(rc_parse(1, shape)).toEqual({
      error: false,
      data: 1,
    })
  })

  test('fail', () => {
    expect(rc_parse(true, shape)).toEqual({
      error: `Type 'boolean' is not assignable to 'string | number'`,
      data: '',
    })
  })

  test('with fallback', () => {
    const result = rc_parse({}, shape.withFallback('world'))

    expect(result).toEqual({
      data: 'world',
      error: "Type 'object' is not assignable to 'string | number'",
    })
  })
})

describe('rc_object', () => {
  test('pass', () => {
    const result: RcParseResult<{ hello: string }> = rc_parse(
      { hello: 'world' },
      rc_object({ hello: rc_string }),
    )

    expect(result).toEqual({ error: false, data: { hello: 'world' } })
  })

  test('input is wrong', () => {
    const result: RcParseResult<{ hello: string }> = rc_parse(
      1,
      rc_object({ hello: rc_string }),
    )

    expect(result).toEqual({
      error: `Type 'number' is not assignable to 'object'`,
      data: {},
    })
  })

  test('input is wrong with fallback', () => {
    const result: RcParseResult<{ hello: string }> = rc_parse(
      1,
      rc_object({ hello: rc_string }).withFallback({ hello: 'world' }),
    )

    expect(result).toEqual({
      error: `Type 'number' is not assignable to 'object'`,
      data: { hello: 'world' },
    })
  })

  test('input property is wrong', () => {
    const result: RcParseResult<{ hello: string }> = rc_parse(
      { hello: 1 },
      rc_object({ hello: rc_string }),
    )

    expect(result).toEqual({
      error: dedent`
        Errors:
          - $.hello: Type 'number' is not assignable to 'string'`,
      data: { hello: '' },
    })
  })

  test('input properties are wrong', () => {
    const result: RcParseResult<{ hello: string; ok: number; world: string }> =
      rc_parse(
        { hello: 1, ok: '2', world: 'ok' },
        rc_object({ hello: rc_string, ok: rc_number, world: rc_string }),
      )

    expect(result).toEqual({
      data: { hello: '', ok: 0, world: 'ok' },
      error: dedent`
        Errors:
          - $.hello: Type 'number' is not assignable to 'string'
          - $.ok: Type 'string' is not assignable to 'number'`,
    })
  })

  test('nested object error', () => {
    const result: RcParseResult<{
      hello: { world: string }
      value: string
    }> = rc_parse(
      { hello: { world: 1 }, value: 'ok' },
      rc_object({
        hello: rc_object({ world: rc_string }).withFallback({ world: '1' }),
        value: rc_string,
      }),
    )

    expect(result).toEqual({
      error: dedent`
        Errors:
          - $.hello.world: Type 'number' is not assignable to 'string'`,
      data: { hello: { world: '1' }, value: 'ok' },
    })
  })

  test('2 levels nested object error', () => {
    const result: RcParseResult<{
      hello: { world: { value: number } }
      value: string
    }> = rc_parse(
      { hello: { world: { value: '1' } }, value: 'ok' },
      rc_object({
        hello: rc_object({
          world: rc_object({
            value: rc_number.withFallback(1),
          }),
        }),
        value: rc_string,
      }),
    )

    expect(result).toEqual({
      error: dedent`
        Errors:
          - $.hello.world.value: Type 'string' is not assignable to 'number'`,
      data: { hello: { world: { value: 1 } }, value: 'ok' },
    })
  })
})

// test.skip('validates', () => {
// const dataToTest = {
//   status: true,
//   data: [1, 2, 3],
//   metadata: { response: 'ok', message: 'OK', notifications: [] },
// }
// const validatedSchema = rc_object({
//   status: rc_boolean(),
//   data: rc_array(rc_number()),
//   metadata: rc_object({
//     response: rc_string(),
//     message: rc_string(),
//     notifications: rc_array(rc_string()),
//   }),
// })
// const result = rc_parse(validatedSchema, dataToTest)
// })
