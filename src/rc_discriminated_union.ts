import { RcObject, TypeOfObjectType, rc_object } from './rc_object'
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

        parseResult.data[discriminatorKey] = discriminator

        return { errors: false, data: parseResult.data }
      })
    },
  }
}
