import {
  RcObject,
  StrictTypeToRcTypeBase,
  TypeOfObjectType,
  rc_object,
} from './rc_object'
import {
  Prettify,
  RcBase,
  RcType,
  defaultProps,
  getWarningOrErrorWithPath,
  isObject,
  isRcType,
  normalizedTypeOf,
  parse,
} from './runcheck'

/**
 * Creates a discriminated union type validator.
 * Uses a discriminator key to determine which schema to validate against.
 * @param discriminatorKey - The property name used to discriminate between union members
 * @param types - An object mapping discriminator values to their corresponding schemas
 * @returns A runcheck type that validates discriminated union objects
 * @example
 * ```typescript
 * const shapeSchema = rc_discriminated_union('type', {
 *   circle: { radius: rc_number },
 *   rectangle: { width: rc_number, height: rc_number }
 * })
 * 
 * const result1 = shapeSchema.parse({ type: 'circle', radius: 5 }) // valid
 * const result2 = shapeSchema.parse({ type: 'rectangle', width: 10, height: 20 }) // valid
 * const result3 = shapeSchema.parse({ type: 'triangle', sides: 3 }) // invalid - unknown discriminator
 * ```
 */
export function rc_discriminated_union<
  K extends string,
  T extends Record<string, RcObject | RcBase<any, any>>,
>(
  discriminatorKey: K,
  types: T,
): RcType<
  Prettify<
    {
      [P in keyof T]: {
        [Q in K]: P
      } & (T[P] extends RcType<infer U> ? U
      : T[P] extends RcObject ? TypeOfObjectType<T[P]>
      : never)
    }[keyof T]
  >
> {
  const preComputedTypesShape = {} as Record<string, RcType<any>>

  for (const [key, type] of Object.entries(types)) {
    preComputedTypesShape[key] = isRcType(type) ? type : rc_object(type as any)
  }

  return {
    ...defaultProps,
    _kind_: `discriminated_union`,
    _is_object_: true,
    _parse_(input, ctx) {
      return parse<any>(this, input, ctx, () => {
        if (!isObject(input)) {
          ctx.objErrKeyIndex_ = -1
          return false
        }

        const discriminator = input[discriminatorKey]

        const parentPath = ctx.path_

        const type = preComputedTypesShape[discriminator]

        if (!type) {
          const invalidValueType = normalizedTypeOf(discriminator, true)

          return {
            errors: [
              getWarningOrErrorWithPath(
                { path_: `${parentPath}.${discriminatorKey}` },
                `Type '${invalidValueType}' is not a valid discriminator`,
              ),
            ],
            data: undefined,
          }
        }

        ctx.path_ = `${parentPath}|${discriminatorKey}: ${discriminator}|`

        const parseResult = type._parse_(input, ctx)

        ctx.path_ = parentPath

        if (!parseResult.ok) {
          return { errors: parseResult.errors, data: undefined }
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        parseResult.data[discriminatorKey] = discriminator

        return { errors: false, data: parseResult.data }
      })
    },
  }
}

type OmitDiscriminator<K, D extends Record<string, unknown>> =
  D extends any ? Omit<D, K & string> : never

/**
 * Creates a type-safe discriminated union builder that enforces the structure matches a TypeScript type.
 * @param discriminatorKey - The property name used to discriminate between union members
 * @returns A builder function that takes a schema mapping matching the specified TypeScript discriminated union
 * @example
 * ```typescript
 * type Shape = 
 *   | { type: 'circle', radius: number }
 *   | { type: 'rectangle', width: number, height: number }
 * 
 * const shapeBuilder = rc_discriminated_union_builder<Shape, 'type'>('type')
 * const shapeSchema = shapeBuilder({
 *   circle: { radius: rc_number },
 *   rectangle: { width: rc_number, height: rc_number }
 * })
 * ```
 */
export function rc_discriminated_union_builder<
  D extends Record<string, unknown>,
  K extends keyof D,
>(discriminatorKey: K) {
  return (schema: {
    [P in D[K] & string]: StrictTypeToRcTypeBase<
      OmitDiscriminator<K, D & { [Q in K]: P }>
    >
  }): RcType<D> => {
    return rc_discriminated_union(
      discriminatorKey as any,
      schema as any,
    ) as unknown as RcType<D>
  }
}
