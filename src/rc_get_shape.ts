import type { InternalShapeMarker, RcBase } from './runcheck'

export type RcPrimitiveShape = {
  kind:
    | 'string'
    | 'number'
    | 'boolean'
    | 'date'
    | 'null'
    | 'undefined'
    | 'any'
    | 'unknown'
}

export type RcLiteralShape = {
  kind: 'literal'
  values: (string | number | boolean)[]
}

export type RcCoerceShape = {
  kind: 'coerce'
  target: 'string' | 'number' | 'boolean' | 'date'
}

/** `undefined | T` */
export type RcOptionalShape = { kind: 'optional'; shape: RcShape }
/** `null | T` */
export type RcNullableShape = { kind: 'nullable'; shape: RcShape }
/** `null | undefined | T` */
export type RcNullishShape = { kind: 'nullish'; shape: RcShape }

export type RcObjectShape = {
  kind: 'object'
  properties: Record<string, RcShape>
  /**
   * How keys not defined in the shape are handled: `strip` removes them from
   * the result (`rc_object`), `error` rejects the input (`rc_obj_strict`),
   * `preserve` keeps them in the result (`rc_obj_extends`)
   */
  excessKeys: 'strip' | 'error' | 'preserve'
}

export type RcRecordShape = { kind: 'record'; valueShape: RcShape }

export type RcArrayShape = { kind: 'array'; itemShape: RcShape }

export type RcTupleShape = { kind: 'tuple'; shapes: RcShape[] }

export type RcUnionShape = { kind: 'union'; shapes: RcShape[] }

export type RcIntersectionShape = { kind: 'intersection'; shapes: RcShape[] }

/** member shapes do not include the discriminator key itself */
export type RcDiscriminatedUnionShape = {
  kind: 'discriminated_union'
  discriminatorKey: string
  shapes: Record<string, RcShape>
}

/**
 * Shape of a `rc_recursive` type. `getShape` is lazy to support circular
 * references, handle cycles when consuming it to avoid infinite loops.
 */
export type RcRecursiveShape = { kind: 'recursive'; getShape: () => RcShape }

/**
 * Typed description of a schema structure, returned by `rc_get_shape`.
 * Schemas without a statically known shape (transforms, `rc_instanceof`,
 * standard schemas, etc.) are represented as `{ kind: 'unknown' }`.
 */
export type RcShape =
  | RcPrimitiveShape
  | RcLiteralShape
  | RcCoerceShape
  | RcOptionalShape
  | RcNullableShape
  | RcNullishShape
  | RcObjectShape
  | RcRecordShape
  | RcArrayShape
  | RcTupleShape
  | RcUnionShape
  | RcIntersectionShape
  | RcDiscriminatedUnionShape
  | RcRecursiveShape

/**
 * Extracts the full shape of a schema as a typed tree, for use in schema
 * conversions (e.g. to zod or JSON Schema) and other schema introspection.
 *
 * The shape is derived lazily from the schema, so there is no parsing or
 * schema creation overhead.
 *
 * - `optional()`/`orNull()`/`orNullish()` modifiers are represented as
 *   wrapper shapes
 * - `where` predicates, `withFallback`/`withAutofix`/`default` values are
 *   transparent: the underlying shape is returned
 * - transforms and other schemas without a clear static shape return
 *   `{ kind: 'unknown' }`
 *
 * @example
 * ```typescript
 * const shape = rc_get_shape(rc_object({ name: rc_string.optional() }))
 * // {
 * //   kind: 'object',
 * //   properties: { name: { kind: 'optional', shape: { kind: 'string' } } },
 * //   excessKeys: 'strip',
 * // }
 * ```
 */
export function rc_get_shape(type: RcBase<any, any>): RcShape {
  const baseShape = getBaseShape(type)

  if (type._orNullish_ || (type._optional_ && type._orNull_)) {
    return { kind: 'nullish', shape: baseShape }
  }

  if (type._orNull_) {
    return { kind: 'nullable', shape: baseShape }
  }

  if (type._optional_) {
    return { kind: 'optional', shape: baseShape }
  }

  return baseShape
}

function getShapesRecord(
  types: Record<string, RcBase<any, any>>,
): Record<string, RcShape> {
  const shapes: Record<string, RcShape> = {}

  for (const [key, type] of Object.entries(types)) {
    shapes[key] = rc_get_shape(type)
  }

  return shapes
}

function getBaseShape(type: RcBase<any, any>): RcShape {
  const marker: InternalShapeMarker | undefined = type._shape_

  if (marker) {
    if (typeof marker === 'string') {
      return { kind: marker }
    }

    switch (marker.kind) {
      case 'literal':
        return { kind: 'literal', values: marker.values }
      case 'coerce':
        return { kind: 'coerce', target: marker.target }
      case 'union':
        return {
          kind: 'union',
          shapes: marker.types.map((memberType) => rc_get_shape(memberType)),
        }
      case 'intersection':
        return {
          kind: 'intersection',
          shapes: marker.types.map((memberType) => rc_get_shape(memberType)),
        }
      case 'tuple':
        return {
          kind: 'tuple',
          shapes: marker.types.map((itemType) => rc_get_shape(itemType)),
        }
      case 'record':
        return { kind: 'record', valueShape: rc_get_shape(marker.valueType) }
      case 'discriminated_union':
        return {
          kind: 'discriminated_union',
          discriminatorKey: marker.key,
          shapes: getShapesRecord(marker.types),
        }
      case 'recursive':
        return {
          kind: 'recursive',
          getShape: () => rc_get_shape(marker.getType()),
        }
    }
  }

  if (type._obj_shape_) {
    return {
      kind: 'object',
      properties: getShapesRecord(type._obj_shape_),
      excessKeys:
        type._is_extend_obj_ ? 'preserve'
        : type._kind_.endsWith('strict_obj') ? 'error'
        : 'strip',
    }
  }

  if (type._array_item_type_) {
    return { kind: 'array', itemShape: rc_get_shape(type._array_item_type_) }
  }

  return { kind: 'unknown' }
}
