import { describe, expect, test } from 'vitest'
import { rc_number_autofix } from '../src/autofixable'
import {
  RcShape,
  RcType,
  rc_any,
  rc_array,
  rc_array_filter_from_schema,
  rc_boolean,
  rc_coerce_boolean,
  rc_coerce_date,
  rc_coerce_number,
  rc_coerce_string,
  rc_date,
  rc_default,
  rc_disable_loose_array,
  rc_discriminated_union,
  rc_enable_obj_strict,
  rc_from_standard,
  rc_get_from_key_as_fallback,
  rc_get_shape,
  rc_instanceof,
  rc_intersection,
  rc_literals,
  rc_loose_array,
  rc_loose_record,
  rc_null,
  rc_number,
  rc_obj_builder,
  rc_obj_extends,
  rc_obj_merge,
  rc_obj_omit,
  rc_obj_pick,
  rc_obj_strict,
  rc_object,
  rc_parse,
  rc_record,
  rc_recursive,
  rc_string,
  rc_string_contains,
  rc_string_ends_with,
  rc_string_starts_with,
  rc_to_standard,
  rc_transform,
  rc_tuple,
  rc_undefined,
  rc_union,
  rc_unknown,
  rc_unsafe_transform,
} from '../src/runcheck'

describe('primitive shapes', () => {
  test.each([
    ['string', rc_string],
    ['number', rc_number],
    ['boolean', rc_boolean],
    ['date', rc_date],
    ['null', rc_null],
    ['undefined', rc_undefined],
    ['any', rc_any],
    ['unknown', rc_unknown],
  ] as const)('%s', (kind, type) => {
    expect(rc_get_shape(type)).toEqual({ kind })
  })
})

describe('coerce shapes', () => {
  test.each([
    ['number', rc_coerce_number],
    ['string', rc_coerce_string],
    ['boolean', rc_coerce_boolean],
    ['date', rc_coerce_date],
  ] as const)('coerce %s', (target, type) => {
    expect(rc_get_shape(type)).toEqual({ kind: 'coerce', target })
  })
})

test('literal shapes', () => {
  expect(rc_get_shape(rc_literals('hello'))).toEqual({
    kind: 'literal',
    values: ['hello'],
  })

  expect(rc_get_shape(rc_literals('a', 1, true))).toEqual({
    kind: 'literal',
    values: ['a', 1, true],
  })
})

test('mutating literal shape values does not affect the schema', () => {
  const schema = rc_literals('a', 'b')

  const shape = rc_get_shape(schema)

  if (shape.kind !== 'literal') throw new Error('expected literal shape')

  shape.values.push('c')

  expect(rc_parse('c', schema).ok).toBe(false)
  expect(rc_get_shape(schema)).toEqual({ kind: 'literal', values: ['a', 'b'] })
})

test('string template shapes are represented as string', () => {
  expect(rc_get_shape(rc_string_starts_with('user_'))).toEqual({
    kind: 'string',
  })
  expect(rc_get_shape(rc_string_ends_with('.png'))).toEqual({ kind: 'string' })
  expect(rc_get_shape(rc_string_contains('@'))).toEqual({ kind: 'string' })
})

describe('modifier shapes', () => {
  test('optional', () => {
    expect(rc_get_shape(rc_string.optional())).toEqual({
      kind: 'optional',
      shape: { kind: 'string' },
    })
  })

  test('orNull', () => {
    expect(rc_get_shape(rc_string.orNull())).toEqual({
      kind: 'nullable',
      shape: { kind: 'string' },
    })
  })

  test('orNullish', () => {
    expect(rc_get_shape(rc_string.orNullish())).toEqual({
      kind: 'nullish',
      shape: { kind: 'string' },
    })
  })

  test('orNull + optional is normalized to nullish', () => {
    expect(rc_get_shape(rc_string.orNull().optional())).toEqual({
      kind: 'nullish',
      shape: { kind: 'string' },
    })
  })
})

describe('object shapes', () => {
  test('basic object', () => {
    const schema = rc_object({
      name: rc_string,
      age: rc_number.optional(),
    })

    expect(rc_get_shape(schema)).toEqual({
      kind: 'object',
      properties: {
        name: { kind: 'string' },
        age: { kind: 'optional', shape: { kind: 'number' } },
      },
      excessKeys: 'strip',
    })
  })

  test('optionalKey properties', () => {
    const schema = rc_object({ a: rc_string.optionalKey() })

    expect(rc_get_shape(schema)).toEqual({
      kind: 'object',
      properties: { a: { kind: 'optional', shape: { kind: 'string' } } },
      excessKeys: 'strip',
    })
  })

  test('nested object shorthand', () => {
    const schema = rc_object({
      nested: { a: rc_string },
    })

    expect(rc_get_shape(schema)).toEqual({
      kind: 'object',
      properties: {
        nested: {
          kind: 'object',
          properties: { a: { kind: 'string' } },
          excessKeys: 'strip',
        },
      },
      excessKeys: 'strip',
    })
  })

  test('strict object', () => {
    expect(rc_get_shape(rc_obj_strict({ a: rc_string }))).toEqual({
      kind: 'object',
      properties: { a: { kind: 'string' } },
      excessKeys: 'error',
    })
  })

  test('optional strict object', () => {
    expect(rc_get_shape(rc_obj_strict({ a: rc_string }).optional())).toEqual({
      kind: 'optional',
      shape: {
        kind: 'object',
        properties: { a: { kind: 'string' } },
        excessKeys: 'error',
      },
    })
  })

  test('non recursive rc_enable_obj_strict', () => {
    const schema = rc_enable_obj_strict(rc_object({ a: rc_string }), {
      nonRecursive: true,
    })

    expect(rc_get_shape(schema)).toEqual({
      kind: 'object',
      properties: { a: { kind: 'string' } },
      excessKeys: 'error',
    })
  })

  test('extends object', () => {
    expect(rc_get_shape(rc_obj_extends({ a: rc_string }))).toEqual({
      kind: 'object',
      properties: { a: { kind: 'string' } },
      excessKeys: 'preserve',
    })
  })

  test('rc_obj_builder', () => {
    const schema = rc_obj_builder<{ a: string; b?: string[] }>()({
      a: rc_string,
      b: ['optional_array_of', rc_string],
    })

    expect(rc_get_shape(schema)).toEqual({
      kind: 'object',
      properties: {
        a: { kind: 'string' },
        b: {
          kind: 'optional',
          shape: { kind: 'array', itemShape: { kind: 'string' } },
        },
      },
      excessKeys: 'strip',
    })
  })

  test('rc_obj_pick, rc_obj_omit and rc_obj_merge', () => {
    const base = rc_object({ a: rc_string, b: rc_number, c: rc_boolean })

    expect(rc_get_shape(rc_obj_pick(base, ['a']))).toEqual({
      kind: 'object',
      properties: { a: { kind: 'string' } },
      excessKeys: 'strip',
    })

    expect(rc_get_shape(rc_obj_omit(base, ['a', 'b']))).toEqual({
      kind: 'object',
      properties: { c: { kind: 'boolean' } },
      excessKeys: 'strip',
    })

    expect(
      rc_get_shape(rc_obj_merge(base, rc_object({ d: rc_string }))),
    ).toEqual({
      kind: 'object',
      properties: {
        a: { kind: 'string' },
        b: { kind: 'number' },
        c: { kind: 'boolean' },
        d: { kind: 'string' },
      },
      excessKeys: 'strip',
    })
  })

  test('rc_get_from_key_as_fallback keeps the wrapped shape', () => {
    const schema = rc_object({
      name: rc_get_from_key_as_fallback('username', rc_string),
    })

    expect(rc_get_shape(schema)).toEqual({
      kind: 'object',
      properties: { name: { kind: 'string' } },
      excessKeys: 'strip',
    })
  })
})

describe('array shapes', () => {
  test('array', () => {
    expect(rc_get_shape(rc_array(rc_string))).toEqual({
      kind: 'array',
      itemShape: { kind: 'string' },
    })
  })

  test('loose array', () => {
    expect(rc_get_shape(rc_loose_array(rc_number))).toEqual({
      kind: 'array',
      itemShape: { kind: 'number' },
    })
  })

  test('disable loose array keeps the shape', () => {
    expect(rc_get_shape(rc_disable_loose_array(rc_array(rc_string)))).toEqual({
      kind: 'array',
      itemShape: { kind: 'string' },
    })
  })

  test('array filter from schema', () => {
    const schema = rc_array_filter_from_schema(
      rc_number,
      (n) => n % 2 === 0,
      rc_number,
    )

    expect(rc_get_shape(schema)).toEqual({
      kind: 'array',
      itemShape: { kind: 'number' },
    })
  })

  test('tuple', () => {
    expect(rc_get_shape(rc_tuple([rc_string, rc_number]))).toEqual({
      kind: 'tuple',
      shapes: [{ kind: 'string' }, { kind: 'number' }],
    })
  })
})

describe('record shapes', () => {
  test('record', () => {
    expect(rc_get_shape(rc_record(rc_number))).toEqual({
      kind: 'record',
      valueShape: { kind: 'number' },
    })
  })

  test('loose record', () => {
    expect(rc_get_shape(rc_loose_record(rc_number))).toEqual({
      kind: 'record',
      valueShape: { kind: 'number' },
    })
  })
})

describe('union and intersection shapes', () => {
  test('union', () => {
    expect(rc_get_shape(rc_union(rc_string, rc_number))).toEqual({
      kind: 'union',
      shapes: [{ kind: 'string' }, { kind: 'number' }],
    })
  })

  test('or method', () => {
    expect(rc_get_shape(rc_string.or(rc_number))).toEqual({
      kind: 'union',
      shapes: [{ kind: 'string' }, { kind: 'number' }],
    })
  })

  test('intersection', () => {
    const schema = rc_intersection(
      rc_object({ a: rc_string }),
      rc_object({ b: rc_number }),
    )

    expect(rc_get_shape(schema)).toEqual({
      kind: 'intersection',
      shapes: [
        {
          kind: 'object',
          properties: { a: { kind: 'string' } },
          excessKeys: 'strip',
        },
        {
          kind: 'object',
          properties: { b: { kind: 'number' } },
          excessKeys: 'strip',
        },
      ],
    })
  })
})

test('discriminated union shapes', () => {
  const schema = rc_discriminated_union('type', {
    circle: { radius: rc_number },
    rectangle: rc_object({ width: rc_number, height: rc_number }),
  })

  expect(rc_get_shape(schema)).toEqual({
    kind: 'discriminated_union',
    discriminatorKey: 'type',
    shapes: {
      circle: {
        kind: 'object',
        properties: { radius: { kind: 'number' } },
        excessKeys: 'strip',
      },
      rectangle: {
        kind: 'object',
        properties: {
          width: { kind: 'number' },
          height: { kind: 'number' },
        },
        excessKeys: 'strip',
      },
    },
  })
})

test('recursive shapes are resolved lazily', () => {
  type TreeNode = {
    value: string
    children?: TreeNode[]
  }

  const treeNode: RcType<TreeNode> = rc_recursive(() =>
    rc_object({
      value: rc_string,
      children: rc_array(treeNode).optionalKey(),
    }),
  )

  const shape = rc_get_shape(treeNode)

  if (shape.kind !== 'recursive') {
    throw new Error('expected recursive shape')
  }

  const resolved = shape.getShape()

  if (resolved.kind !== 'object') {
    throw new Error('expected object shape')
  }

  expect(resolved.properties.value).toEqual({ kind: 'string' })

  const children = resolved.properties.children

  if (children?.kind !== 'optional' || children.shape.kind !== 'array') {
    throw new Error('expected optional array shape')
  }

  expect(children.shape.itemShape.kind).toBe('recursive')
})

describe('shapes without a clear static shape are unknown', () => {
  test('transforms', () => {
    expect(
      rc_get_shape(rc_transform(rc_string, (s) => s.toUpperCase())),
    ).toEqual({ kind: 'unknown' })

    expect(
      rc_get_shape(
        rc_unsafe_transform(rc_string, (s) => ({ ok: true, data: s })),
      ),
    ).toEqual({ kind: 'unknown' })
  })

  test('instanceof', () => {
    expect(rc_get_shape(rc_instanceof(Map))).toEqual({ kind: 'unknown' })
  })

  test('standard schema', () => {
    expect(rc_get_shape(rc_from_standard(rc_to_standard(rc_string)))).toEqual({
      kind: 'unknown',
    })
  })
})

describe('shape is preserved through validation-only wrappers', () => {
  test('where', () => {
    expect(rc_get_shape(rc_string.where((s) => s.length > 2))).toEqual({
      kind: 'string',
    })
  })

  test('withFallback', () => {
    expect(rc_get_shape(rc_string.withFallback('fallback'))).toEqual({
      kind: 'string',
    })
  })

  test('withAutofix', () => {
    expect(rc_get_shape(rc_number_autofix)).toEqual({ kind: 'number' })
  })

  test('default', () => {
    expect(rc_get_shape(rc_default(rc_string.optional(), 'default'))).toEqual({
      kind: 'string',
    })

    expect(rc_get_shape(rc_string.optional().default('default'))).toEqual({
      kind: 'string',
    })
  })

  test('default keeps strict object excessKeys', () => {
    const schema = rc_default(rc_obj_strict({ a: rc_string }).optional(), {
      a: 'x',
    })

    expect(rc_get_shape(schema)).toEqual({
      kind: 'object',
      properties: { a: { kind: 'string' } },
      excessKeys: 'error',
    })
  })
})

test('RcShape can be consumed exhaustively', () => {
  function shapeToString(shape: RcShape): string {
    switch (shape.kind) {
      case 'string':
      case 'number':
      case 'boolean':
      case 'date':
      case 'null':
      case 'undefined':
      case 'any':
      case 'unknown':
        return shape.kind
      case 'literal':
        return shape.values.map((value) => JSON.stringify(value)).join(' | ')
      case 'coerce':
        return `coerce<${shape.target}>`
      case 'optional':
        return `undefined | ${shapeToString(shape.shape)}`
      case 'nullable':
        return `null | ${shapeToString(shape.shape)}`
      case 'nullish':
        return `null | undefined | ${shapeToString(shape.shape)}`
      case 'object':
        return `{ ${Object.entries(shape.properties)
          .map(([key, value]) => `${key}: ${shapeToString(value)}`)
          .join(', ')} }`
      case 'record':
        return `Record<string, ${shapeToString(shape.valueShape)}>`
      case 'array':
        return `${shapeToString(shape.itemShape)}[]`
      case 'tuple':
        return `[${shape.shapes.map(shapeToString).join(', ')}]`
      case 'union':
        return shape.shapes.map(shapeToString).join(' | ')
      case 'intersection':
        return shape.shapes.map(shapeToString).join(' & ')
      case 'discriminated_union':
        return Object.entries(shape.shapes)
          .map(
            ([key, value]) =>
              `({ ${shape.discriminatorKey}: ${JSON.stringify(key)} } & ${shapeToString(value)})`,
          )
          .join(' | ')
      case 'recursive':
        return 'recursive'
    }
  }

  const schema = rc_object({
    id: rc_string,
    tags: rc_array(rc_literals('a', 'b')),
    meta: rc_record(rc_union(rc_string, rc_number)).orNull(),
  })

  expect(shapeToString(rc_get_shape(schema))).toBe(
    '{ id: string, tags: "a" | "b"[], meta: null | Record<string, string | number> }',
  )
})
