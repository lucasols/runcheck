import { describe, expect, test } from 'vitest'
import {
  RcParser,
  rc_parser,
  rc_record,
  rc_string,
  rc_object,
  rc_array,
  rc_any,
  rc_boolean,
  rc_unknown,
  rc_union,
  rc_undefined,
  rc_literals,
  rc_parse,
} from '../src/runcheck'
import { errorResult, successResult } from './testUtils'

describe('rc_record', () => {
  const parse: RcParser<Record<string, string>> = rc_parser(
    rc_record(rc_string),
  )

  test('dynamic string key', () => {
    expect(parse({ hello: 'world', a: 'b' })).toEqual(
      successResult({ hello: 'world', a: 'b' }),
    )

    expect(parse({ hello: 1 })).toEqual(
      errorResult(`$.hello: Type 'number' is not assignable to 'string'`),
    )
  })

  test('multiple keys and one error', () => {
    expect(parse({ hello: 'world', a: 1 })).toEqual(
      errorResult(`$.a: Type 'number' is not assignable to 'string'`),
    )
  })

  test('rc_record of rc_object', () => {
    const parse2: RcParser<Record<string, { hello: string }>> = rc_parser(
      rc_record(rc_object({ hello: rc_string })),
    )

    expect(parse2({ hello: 'world', a: { hello: 1 } })).toEqual(
      errorResult(
        "$.hello: Type 'string' is not assignable to 'object'",
        "$.a.hello: Type 'number' is not assignable to 'string'",
      ),
    )

    expect(parse2({ hello: { hello: '1' } })).toEqual(
      successResult({
        hello: { hello: '1' },
      }),
    )
  })

  test('rc_record with checkKey', () => {
    const parse2: RcParser<Record<string, string>> = rc_parser(
      rc_record(rc_string, {
        checkKey: (key) => key !== 'a',
      }),
    )

    expect(parse2({ hello: 'world', a: 'b' })).toEqual(
      errorResult(`$.a: Key 'a' is not allowed`),
    )

    expect(parse2({ hello: 'world' })).toEqual(
      successResult({ hello: 'world' }),
    )
  })

  test('rc_record with checkKey nested error', () => {
    const parse2 = rc_parser(
      rc_object({
        array: rc_array(
          rc_record(rc_string, {
            checkKey: (key) => key !== 'a',
          }),
        ),
      }),
    )

    expect(parse2({ array: [{ hello: 'world', a: 'b' }] })).toEqual(
      errorResult(`$.array[0].a: Key 'a' is not allowed`),
    )
  })

  test('rc_record with checkKey and looseCheck', () => {
    const parse2: RcParser<Record<string, string>> = rc_parser(
      rc_record(rc_string, {
        checkKey: (key) => key !== 'a',
        looseCheck: true,
      }),
    )

    expect(parse2({ hello: 'world', a: 'b', b: 2 })).toEqual(
      successResult({ hello: 'world' }, [
        `$.a: Key 'a' is not allowed`,
        `$.b: Type 'number' is not assignable to 'string'`,
      ]),
    )

    expect(parse2({ hello: 'world' })).toEqual(
      successResult({ hello: 'world' }),
    )
  })

  test('rc_record with checkKey and looseCheck nested', () => {
    const parse2 = rc_parser(
      rc_object({
        array: rc_array(
          rc_record(rc_string, {
            checkKey: (key) => key !== 'a',
            looseCheck: true,
          }),
        ),
      }),
    )

    expect(parse2({ array: [{ hello: 'world', a: 'b' }] })).toEqual(
      successResult(
        {
          array: [{ hello: 'world' }],
        },
        [`$.array[0].a: Key 'a' is not allowed`],
      ),
    )
  })

  test('rc_record with empty array returns error', () => {
    const parse2 = rc_parser(rc_record(rc_any))

    expect(parse2([])).toEqual(
      errorResult(`Type 'array' is not assignable to 'record<string, any>'`),
    )

    expect(parse2({})).toEqual(successResult({}))
  })

  test('error msg bug', () => {
    const valueToParse = {
      test: {
        '*': '*',
        ops: {
          data: [
            {
              field: 'criado_por',
              reference: 'id_user',
            },
          ],
        },
        channels: {
          data: [
            {
              OR: [1, 2, 3],
            },
          ],
          fields_excluded: ['add_users', 'add_profiles', 'type'],
        },
        sdfsdf: '*',
        u2rgpuxmvmws4ze6xgzn6: '*',
        '9l5h87yk8337h8giv1846': '*',
      },
    }

    const testObjSchema = rc_object({
      data: rc_array(rc_unknown).optional,
      required: rc_boolean,
    })

    const testSchema = rc_object({
      test: rc_record(rc_union(rc_undefined, rc_literals('*'), testObjSchema)),
    })

    const result = rc_parse(valueToParse, testSchema)

    expect(result).toEqual(
      errorResult(
        "$.test.ops|union 3|.required: Type 'undefined' is not assignable to 'boolean'",
        "$.test.ops: not matches any other union member",
        "$.test.channels|union 3|.required: Type 'undefined' is not assignable to 'boolean'",
        "$.test.channels: not matches any other union member",
      ),
    )
  })
})
