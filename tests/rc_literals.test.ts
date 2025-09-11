import { describe, expect, test } from 'vitest'
import {
  RcParseResult,
  rc_get_literal_values,
  rc_literals,
  rc_parse,
  rc_parser,
} from '../src/runcheck'
import { errorResult, successResult } from './testUtils'

describe('rc_literal', () => {
  test('simple input', () => {
    const helloParser = rc_parser(rc_literals('hello'))

    const result: RcParseResult<'hello'> = helloParser('hello')

    expect(result).toEqual(successResult('hello'))

    expect(helloParser('world')).toEqual(
      errorResult("Type 'string(world)' is not assignable to 'string(hello)'"),
    )
  })

  test('multiple inputs', () => {
    const helloParser = rc_parser(rc_literals('hello', 'world'))

    const result: RcParseResult<'hello' | 'world'> = helloParser('hello')

    expect(result).toEqual(successResult('hello'))

    expect(helloParser('world')).toEqual(successResult('world'))

    expect(helloParser('worlds')).toEqual(
      errorResult(
        "Type 'string(worlds)' is not assignable to 'string(hello) | string(world)'",
      ),
    )

    expect(helloParser(undefined)).toEqual(
      errorResult(
        "Type 'undefined' is not assignable to 'string(hello) | string(world)'",
      ),
    )
  })

  test('literal types', () => {
    expect(rc_parse(1, rc_literals(1))).toEqual(successResult(1))

    expect(rc_parse(2, rc_literals(1))).toEqual(
      errorResult("Type 'number(2)' is not assignable to 'number(1)'"),
    )

    expect(rc_parse(2, rc_literals(1, 2))).toEqual(successResult(2))

    expect(rc_parse(true, rc_literals(true))).toEqual(successResult(true))

    expect(rc_parse(false, rc_literals(true))).toEqual(
      errorResult("Type 'boolean(false)' is not assignable to 'boolean(true)'"),
    )
  })
})

describe('rc_literals with one argument', () => {
  test('simple input', () => {
    const literals = ['hello'] as const
    const helloParser = rc_parser(rc_literals(literals))

    const result: RcParseResult<'hello'> = helloParser('hello')

    expect(result).toEqual(successResult('hello'))

    expect(helloParser('world')).toEqual(
      errorResult("Type 'string(world)' is not assignable to 'string(hello)'"),
    )

    const helloParser2 = rc_parser(rc_literals([1]))

    const result2: RcParseResult<1> = helloParser2(1)

    expect(result2).toEqual(successResult(1))

    expect(helloParser2(2)).toEqual(
      errorResult("Type 'number(2)' is not assignable to 'number(1)'"),
    )

    expect(helloParser2(undefined)).toEqual(
      errorResult("Type 'undefined' is not assignable to 'number(1)'"),
    )
  })

  test('multiple inputs', () => {
    const literals = ['hello', 'world'] as const
    const helloParser = rc_parser(rc_literals(literals))

    const result: RcParseResult<'hello' | 'world'> = helloParser('hello')

    expect(result).toEqual(successResult('hello'))

    expect(helloParser('world')).toEqual(successResult('world'))

    expect(helloParser('worlds')).toEqual(
      errorResult(
        "Type 'string(worlds)' is not assignable to 'string(hello) | string(world)'",
      ),
    )

    expect(helloParser(undefined)).toEqual(
      errorResult(
        "Type 'undefined' is not assignable to 'string(hello) | string(world)'",
      ),
    )
  })

  test('literal types', () => {
    expect(rc_parse(1, rc_literals([1]))).toEqual(successResult(1))

    expect(rc_parse(2, rc_literals([1]))).toEqual(
      errorResult("Type 'number(2)' is not assignable to 'number(1)'"),
    )

    expect(rc_parse(2, rc_literals([1, 2]))).toEqual(successResult(2))

    expect(rc_parse(true, rc_literals([true]))).toEqual(successResult(true))

    expect(rc_parse(false, rc_literals([true]))).toEqual(
      errorResult("Type 'boolean(false)' is not assignable to 'boolean(true)'"),
    )
  })
})

test('rc_get_literal_values', () => {
  const literals = rc_literals('hello', 'world')

  const values: ('hello' | 'world')[] = rc_get_literal_values(literals)

  expect(values).toEqual(['hello', 'world'])

  const literals2 = rc_literals([1, 2])

  const values2: (1 | 2)[] = rc_get_literal_values(literals2)

  expect(values2).toEqual([1, 2])
})
