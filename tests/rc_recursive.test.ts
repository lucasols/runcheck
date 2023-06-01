import { describe, expect, test } from 'vitest'
import { RcType } from '../src/runcheck'
import {
  RcParser,
  rc_parser,
  rc_string,
  rc_object,
  rc_array,
  rc_recursive,
} from '../src/runcheck'
import { errorResult, successResult } from './testUtils'

type MenuTree = {
  name: string
  children: MenuTree[]
}

describe('rc_recursive', () => {
  const menuTreeSchema: RcType<MenuTree[]> = rc_array(
    rc_object({
      name: rc_string,
      children: rc_recursive(() => menuTreeSchema),
    }),
  )

  const parse: RcParser<MenuTree[]> = rc_parser(menuTreeSchema)

  test('valid inputs', () => {
    const input = [
      {
        name: 'hello',
        children: [{ name: 'world', children: [] }],
      },
    ]

    expect(parse(input)).toEqual(successResult(structuredClone(input)))

    const input2: MenuTree[] = [
      {
        name: 'hello',
        children: [
          {
            name: 'world',
            children: [
              { name: 'foo', children: [{ name: 'bar', children: [] }] },
            ],
          },
        ],
      },
    ]

    expect(parse(input2)).toEqual(successResult(structuredClone(input2)))
  })

  test('invalid inputs', () => {
    const input = [
      {
        name: 'hello',
        children: [{ name: 'world', childrenr: [] }],
      },
    ]

    expect(parse(input)).toEqual(
      errorResult(
        "$[0].children[0].children: Type 'undefined' is not assignable to 'object[]'",
      ),
    )

    const input2 = [
      {
        name: 'hello',
        children: [
          {
            name: 'world',
            children: [
              {
                name: 'foo',
                children: [{ name: 'bar', children: [{ name: 9 }] }],
              },
            ],
          },
        ],
      },
    ]

    expect(parse(input2)).toEqual(
      errorResult(
        "$[0].children[0].children[0].children[0].children[0].name: Type 'number' is not assignable to 'string'",
        "$[0].children[0].children[0].children[0].children[0].children: Type 'undefined' is not assignable to 'object[]'",
      ),
    )
  })
})
