import {
  RcType,
  RcInferType,
  RcBase,
  RcOptionalKeyType,
  isObject,
  defaultProps,
  parse,
  snakeCase,
  getWarningOrErrorWithPath,
  ErrorWithPath,
  rc_array,
  rc_loose_array,
} from './runcheck'

/**
 * If the schema key value is undefined uses a value from the fallback key as a safe value
 * Can be used to rename keys from input
 */
export function rc_get_from_key_as_fallback<T extends RcType<any>>(
  fallbackKey: string,
  type: T,
): RcType<RcInferType<T>> {
  return {
    ...type,
    _alternative_key_: fallbackKey,
  }
}

export type RcObject = {
  [key: string]:
    | RcBase<any, any>
    | RcObject
    | [
        'optional' | 'nullish_or' | 'null_or' | 'array' | 'loose_array',
        RcObject,
      ]
}

export type TypeOfObjectType<T extends RcObject> = Flatten<
  AddQuestionMarks<{
    [K in keyof T]: T[K] extends RcType<infer U> ? RequiredKey<U>
    : T[K] extends RcOptionalKeyType<infer W> ? W
    : T[K] extends RcObject ? RequiredKey<TypeOfObjectType<T[K]>>
    : never
  }>
>

export type RcObjTypeReturn<T extends RcObject> = RcType<TypeOfObjectType<T>>

type RequiredKey<T> = { _required_key_: T }

type RequiredKeys<T extends object> = {
  [k in keyof T]: T[k] extends RequiredKey<any> ? k : never
}[keyof T]

type AddQuestionMarks<
  T extends object,
  R extends keyof T = RequiredKeys<T>,
> = Pick<Required<T>, R> & Partial<Omit<T, R>>

type Identity<T> = T

type Flatten<T> = Identity<{
  [k in keyof T]: T[k] extends RequiredKey<infer U> ? U : T[k]
}>

function isRcType(value: any): value is RcType<any> {
  return isObject(value) && '__rc_type' in value
}

function unwrapToObjSchema(input: unknown): RcType<any> {
  if (isRcType(input)) {
    return input
  } else if (isObject(input)) {
    const objSchema: Record<string, RcType<any>> = {}

    for (const [key, value] of Object.entries(input)) {
      objSchema[key] = unwrapToObjSchema(value)
    }

    return rc_object(objSchema)
  } else if (Array.isArray(input)) {
    const [type, value] = input

    switch (type) {
      case 'optional':
        return unwrapToObjSchema(value).optional()
      case 'nullish_or':
        return unwrapToObjSchema(value).orNullish()
      case 'null_or':
        return unwrapToObjSchema(value).orNull()
      case 'array':
        return rc_array(unwrapToObjSchema(value))
      case 'loose_array':
        return rc_loose_array(unwrapToObjSchema(value))
    }
  }

  throw new Error(`invalid schema: ${input}`)
}

export type ObjOptions = {
  normalizeKeysFrom?: 'snake_case'
}

export function rc_object<T extends RcObject>(
  shape: T,
  { normalizeKeysFrom }: ObjOptions = {},
): RcObjTypeReturn<T> {
  const objShape: Record<string, RcType<any>> = {}

  for (const [key, value] of Object.entries(shape)) {
    objShape[key] = unwrapToObjSchema(value)
  }

  return {
    ...defaultProps,
    _obj_shape_: objShape,
    _kind_: 'object',
    _is_object_: true,
    _shape_entries_: Object.entries(objShape),
    _parse_(inputObj, ctx) {
      return parse<TypeOfObjectType<T>>(this, inputObj, ctx, () => {
        if (!isObject(inputObj)) {
          ctx.objErrKeyIndex_ = -1
          return false
        }

        const isStrict = this._kind_ === 'strict_obj' || ctx.strictObj_

        const excessKeys =
          isStrict ? new Set<string>(Object.keys(inputObj)) : undefined

        if (excessKeys && excessKeys.size > this._shape_entries_.length) {
          ctx.objErrKeyIndex_ = -1
          const errors: ErrorWithPath[] = []

          if (ctx.objErrShortCircuit_) {
            return {
              data: undefined,
              errors: [
                getWarningOrErrorWithPath(
                  ctx,
                  `Expected strict object with ${this._shape_entries_.length} keys but got ${excessKeys.size}`,
                ),
              ],
            }
          }

          for (const [key] of this._shape_entries_) {
            if (!excessKeys.has(key)) {
              errors.push(
                getWarningOrErrorWithPath(ctx, `Key '${key}' is missing`),
              )
            } else {
              excessKeys.delete(key)
            }
          }

          for (const key of excessKeys) {
            errors.push(
              getWarningOrErrorWithPath(
                ctx,
                `Key '${key}' is not defined in the object shape`,
              ),
            )
          }

          return {
            data: undefined,
            errors,
          }
        }

        const resultObj: Record<any, string> = {} as any
        const resultErrors: ErrorWithPath[] = []

        const parentPath = ctx.path_

        let i = -1
        for (const [key, type] of this._shape_entries_) {
          const typekey = key as keyof T
          i += 1

          const subPath = `.${key}`

          const path = `${parentPath}${subPath}`

          ctx.path_ = path

          let input = inputObj[key]
          let keyToDeleteFromExcessKeys = key

          if (input === undefined && type._alternative_key_) {
            input = inputObj[type._alternative_key_]
            keyToDeleteFromExcessKeys = type._alternative_key_
          }

          if (input === undefined && normalizeKeysFrom === 'snake_case') {
            const snakeCaseKey = snakeCase(key)

            input = inputObj[snakeCaseKey]
            keyToDeleteFromExcessKeys = snakeCaseKey
          }

          excessKeys?.delete(keyToDeleteFromExcessKeys)

          const [isValid, result] = type._parse_(input, ctx)

          if (isValid) {
            resultObj[typekey] = result
          }
          //
          else {
            for (const subError of result) {
              ctx.path_ = path
              resultErrors.push(subError)
            }

            if (ctx.objErrShortCircuit_) {
              ctx.objErrKeyIndex_ = i
              break
            }
          }
        }

        if (excessKeys) {
          if (excessKeys.size > 0) {
            for (const key of excessKeys) {
              ctx.path_ = parentPath

              resultErrors.push(
                getWarningOrErrorWithPath(
                  ctx,
                  `Key '${key}' is not defined in the object shape`,
                ),
              )
            }
          }
        }

        if (resultErrors.length > 0) {
          return { errors: resultErrors, data: undefined }
        }

        if (this._is_extend_obj_) {
          return {
            errors: false,
            data: {
              ...(inputObj as any),
              ...(resultObj as any),
            },
          }
        }

        return { errors: false, data: resultObj as any }
      })
    },
  }
}

export function rc_obj_extends<T extends RcObject>(
  shape: T,
  options?: ObjOptions,
): RcObjTypeReturn<T> {
  return {
    ...rc_object(shape, options),
    _kind_: `extends_object`,
    _is_extend_obj_: true,
  }
}

export function rc_get_obj_shape<T extends RcObject>(
  type: RcObjTypeReturn<T>,
): T {
  if (!type._obj_shape_) {
    throw new Error(`type does not have an object shape`)
  }

  return type._obj_shape_ as T
}

/** return an error if the obj has more keys than the expected type */
export function rc_obj_strict<T extends RcObject>(
  shape: T,
  options?: ObjOptions,
): RcObjTypeReturn<T> {
  return {
    ...rc_object(shape, options),
    _kind_: `strict_obj`,
  }
}

export function rc_enable_obj_strict<T extends RcType<any>>(
  type: T,
  {
    nonRecursive,
  }: {
    nonRecursive?: boolean
  } = {},
): T {
  if (nonRecursive) {
    if (!type._obj_shape_) {
      throw new Error(
        `rc_enable_obj_strict: nonRecursive option can only be used on object types`,
      )
    }

    return {
      ...type,
      _kind_: `strict_obj`,
    }
  }

  return {
    ...type,
    _parse_(input, ctx) {
      const parentStrictObj = ctx.strictObj_
      ctx.strictObj_ = true
      const result = type._parse_(input, ctx)
      ctx.strictObj_ = parentStrictObj
      return result
    },
  }
}

type AnyObj = Record<string, unknown>

type Extends<T extends AnyObj, W extends AnyObj> = Omit<T, keyof W> & W

export function rc_obj_merge<A extends AnyObj, B extends AnyObj>(
  ...objs: [RcType<A>, RcType<B>]
): RcType<Extends<A, B>>
export function rc_obj_merge<
  A extends AnyObj,
  B extends AnyObj,
  C extends AnyObj,
>(...objs: [RcType<A>, RcType<B>, RcType<C>]): RcType<Extends<Extends<A, B>, C>>
export function rc_obj_merge<
  A extends AnyObj,
  B extends AnyObj,
  C extends AnyObj,
  D extends AnyObj,
>(
  ...objs: [RcType<A>, RcType<B>, RcType<C>, RcType<D>]
): RcType<Extends<Extends<Extends<A, B>, C>, D>>
export function rc_obj_merge(
  ...objs: RcType<Record<string, unknown>>[]
): RcType<any> {
  const finalShape = {} as any

  for (const objShape of objs) {
    Object.assign(finalShape, objShape._obj_shape_)
  }

  return rc_object(finalShape)
}

export function rc_obj_pick<O extends AnyObj, K extends keyof O>(
  obj: RcType<O>,
  keys: K[],
): RcType<Pick<O, K>> {
  const shape = {} as any

  if (!obj._obj_shape_) {
    throw new Error('rc_obj_pick: obj must be an object type')
  }

  for (const key of keys) {
    const keyShape = obj._obj_shape_[key as string]
    if (keyShape) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      shape[key] = keyShape
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return rc_object(shape) as any
}

export function rc_obj_omit<O extends AnyObj, K extends keyof O>(
  obj: RcType<O>,
  keys: K[],
): RcType<Pick<O, K>> {
  const shape = {} as any

  if (!obj._obj_shape_) {
    throw new Error('rc_obj_omit: obj must be an object type')
  }

  for (const key of Object.keys(obj._obj_shape_)) {
    if (!(keys as any[]).includes(key)) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      shape[key] = obj._obj_shape_[key]
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return rc_object(shape) as any
}

type ExpectedSchema<T> = (t: T) => void

type RcTypeWithSquemaEqualTo<T> = { __rc_type: ExpectedSchema<T> }

type StrictObjTypeToRcType<T> = {
  [K in keyof T]-?: StricTypeToRcType<T[K]>
}

type StricTypeToRcType<T> =
  [T] extends [Record<string, any>[]] ?
    | RcTypeWithSquemaEqualTo<T>
    | ['array' | 'loose_array', StrictObjTypeToRcType<T[number]>]
  : [T] extends [any[]] ? RcTypeWithSquemaEqualTo<T>
  : [T] extends [Record<string, any>] ?
    StrictObjTypeToRcType<T> | RcTypeWithSquemaEqualTo<T>
  : [T] extends [Record<string, any> | null] ?
    ['null_or', StrictObjTypeToRcType<T>] | RcTypeWithSquemaEqualTo<T>
  : [T] extends [Record<string, any> | undefined] ?
    ['optional', StrictObjTypeToRcType<T>] | RcTypeWithSquemaEqualTo<T>
  : [T] extends [Record<string, any> | null | undefined] ?
    ['nullish_or', StrictObjTypeToRcType<T>] | RcTypeWithSquemaEqualTo<T>
  : RcTypeWithSquemaEqualTo<T>

type StricTypeToRcTypeBase<T extends Record<string, any>> = {
  [K in keyof T]-?: StricTypeToRcType<T[K]>
}

export function rc_obj_builder<T extends Record<string, any>>() {
  return <S extends StricTypeToRcTypeBase<T>>(
    schema: {
      [K in keyof S]: K extends keyof T ? S[K] : never
    },
    options?: ObjOptions,
  ): RcType<T> => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
    return rc_object(schema as any, options) as any
  }
}
