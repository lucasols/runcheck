import { expect, test } from 'vitest'
import {
  RcParser,
  RcType,
  rc_array,
  rc_intersection,
  rc_literals,
  rc_loose_array,
  rc_object,
  rc_parser,
  rc_recursive,
  rc_string,
  rc_union,
} from '../src/runcheck'
import { errorResult, successResult } from './testUtils'

{
  type MenuTree = {
    name: string
    children: MenuTree[]
  }

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
}

test('recursive with modifiers', () => {
  type MenuTreeOptional = {
    name: string
    children?: MenuTreeOptional[]
    childrenOrNull: MenuTreeOptional[] | null
    childrenOrNullish: MenuTreeOptional[] | null | undefined
    childrenOrFallback: MenuTreeOptional[]
  }

  const menuTreeSchemaOptional: RcType<MenuTreeOptional[]> = rc_array(
    rc_object({
      name: rc_string,
      children: rc_recursive(() => menuTreeSchemaOptional).optionalKey(),
      childrenOrNull: rc_recursive(() => menuTreeSchemaOptional).orNull(),
      childrenOrNullish: rc_recursive(() => menuTreeSchemaOptional).orNullish(),
      childrenOrFallback: rc_recursive(
        () => menuTreeSchemaOptional,
      ).withFallback([]),
    }),
  )

  const parseOptional = rc_parser(menuTreeSchemaOptional)

  expect(
    parseOptional([
      { name: 'hello', childrenOrNull: null, childrenOrFallback: [] },
    ]),
  ).toEqual(
    successResult([
      { name: 'hello', childrenOrNull: null, childrenOrFallback: [] },
    ]),
  )

  expect(
    parseOptional([
      { name: 'hello', childrenOrNull: null, childrenOrFallback: null },
    ]),
  ).toEqual(
    successResult(
      [{ name: 'hello', childrenOrNull: null, childrenOrFallback: [] }],
      [
        `$[0].childrenOrFallback: Fallback used, errors -> Type 'null' is not assignable to 'object[]'`,
      ],
    ),
  )

  expect(parseOptional([])).toEqual(successResult([]))
})

test('bug: recursive with optionalKey not working', () => {
  type ComplexType = {
    id: string
    items?: ComplexType[]
  } & (
    | {
        type: 'item'
      }
    | {
        type: 'b'
        b: string
      }
  )

  const schema: RcType<ComplexType[]> = rc_loose_array(
    rc_intersection(
      rc_object({
        id: rc_string,
        items: rc_recursive(() => schema).optionalKey(),
      }),
      rc_union(
        rc_object({
          type: rc_literals('item'),
        }),
        rc_object({
          type: rc_literals('b'),
          b: rc_string,
        }),
      ),
    ),
  )

  const parse = rc_parser(schema)

  expect(
    parse([
      {
        id: '1',
        type: 'item',
      },
      {
        id: '2',
        type: 'b',
        b: '3',
      },
    ]),
  ).toEqual(
    successResult([
      {
        id: '1',
        type: 'item',
        items: undefined,
      },
      {
        id: '2',
        type: 'b',
        b: '3',
        items: undefined,
      },
    ]),
  )
})
