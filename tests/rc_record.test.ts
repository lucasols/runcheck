import { describe, expect, test } from 'vitest'
import {
  RcParser,
  rc_parser,
  rc_record,
  rc_string,
  rc_object,
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
    const parse: RcParser<Record<string, { hello: string }>> = rc_parser(
      rc_record(rc_object({ hello: rc_string })),
    )

    expect(parse({ hello: 'world', a: { hello: 1 } })).toEqual(
      errorResult(
        "$.hello: Type 'string' is not assignable to 'object'",
        "$.a.hello: Type 'number' is not assignable to 'string'",
      ),
    )

    expect(parse({ hello: { hello: '1' } })).toEqual(
      successResult({
        hello: { hello: '1' },
      }),
    )
  })
})
