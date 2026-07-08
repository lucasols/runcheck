import { RcType, defaultProps, isObject, parse } from './runcheck'

/**
 * Creates an intersection type validator that requires input to satisfy all provided types.
 * For object types, merges the properties from all types.
 * For non-object types, input must be valid for all types simultaneously.
 * @param types - The types to intersect (2-4 types supported)
 * @returns A runcheck type representing the intersection of all input types
 * @example
 * ```typescript
 * const userBase = rc_object({ name: rc_string })
 * const userMeta = rc_object({ createdAt: rc_date })
 * const fullUser = rc_intersection(userBase, userMeta)
 * // Result: { name: string, createdAt: Date }
 * 
 * const result = fullUser.parse({ name: 'John', createdAt: new Date() }) // valid
 * const result2 = fullUser.parse({ name: 'John' }) // invalid - missing createdAt
 * ```
 */
export function rc_intersection<A, B>(a: RcType<A>, b: RcType<B>): RcType<A & B>
export function rc_intersection<A, B, C>(
  a: RcType<A>,
  b: RcType<B>,
  c: RcType<C>,
): RcType<A & B & C>
export function rc_intersection<A, B, C, D>(
  a: RcType<A>,
  b: RcType<B>,
  c: RcType<C>,
  d: RcType<D>,
): RcType<A & B & C & D>
export function rc_intersection(...types: RcType<any>[]): RcType<any> {
  let kind = ''
  let allIsObject = true

  for (const type of types) {
    if (kind) {
      kind += ' & '
    }

    if (!type._is_object_) {
      allIsObject = false
    }

    kind += type._kind_.includes('|') ? `(${type._kind_})` : type._kind_
  }

  return {
    ...defaultProps,
    _kind_: kind,
    _is_object_: allIsObject,
    _shape_: { kind: 'intersection', types },
    _parse_(input, ctx) {
      return parse(this, input, ctx, () => {
        let objResultData: Record<string, unknown> | null = null

        for (const type of types) {
          const result = type._parse_(input, ctx)

          if (!result.ok) {
            if (type._is_object_) {
              return result
            }

            return false
          } else {
            if (
              type._is_object_ ||
              // safety net for object schemas wrapped in types that don't
              // propagate the object metadata, e.g. transforms: a result that
              // is an object with a new identity was reconstructed by the
              // type, so it should be merged. Pass-through results (rc_any,
              // rc_instanceof, etc.) keep the input identity and are skipped
              (result.data !== input && isObject(result.data))
            ) {
              objResultData = { ...(objResultData || {}), ...result.data }
            }
          }
        }

        if (objResultData) {
          return {
            data: objResultData as any,
            errors: false,
          }
        }

        return true
      })
    },
  }
}
