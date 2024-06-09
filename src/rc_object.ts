import {
  ErrorWithPath,
  RcBase,
  RcInferType,
  RcOptionalKeyType,
  RcType,
  defaultProps,
  getWarningOrErrorWithPath,
  isObject,
  isRcType,
  normalizedTypeOf,
  parse,
  snakeCase,
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
  [key: string]: RcBase<any, any> | RcObject
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

  const shapeEntries = Object.entries(objShape).map(([key, type]) => {
    return { key, type }
  })

  return {
    ...defaultProps,
    _obj_shape_: objShape,
    _kind_: 'object',
    _detailed_obj_shape_: '',
    _is_object_: true,
    _parse_(inputObj, ctx) {
      return parse<TypeOfObjectType<T>>(this, inputObj, ctx, () => {
        if (!isObject(inputObj)) {
          ctx.objErrKeyIndex_ = -1

          if (ctx.objErrShortCircuit_ && !this._detailed_obj_shape_) {
            return false
          }

          if (!this._detailed_obj_shape_) {
            let detailedObjShapeDescription = `${this._kind_}{ `
            let i = 0
            for (const { key, type } of shapeEntries) {
              if (detailedObjShapeDescription.length > 100) {
                detailedObjShapeDescription += `, ...`
                break
              }

              if (i !== 0) {
                detailedObjShapeDescription += `, `
              }

              detailedObjShapeDescription += `${key}: ${type._kind_}`
              i++
            }

            detailedObjShapeDescription += ` }`
            this._detailed_obj_shape_ = detailedObjShapeDescription
          }

          return {
            data: undefined,
            errors: [
              getWarningOrErrorWithPath(
                ctx,
                `Type '${normalizedTypeOf(inputObj, false)}' is not assignable to '${this._detailed_obj_shape_}'`,
              ),
            ],
          }
        }

        const isStrict = this._kind_ === 'strict_obj' || ctx.strictObj_

        const excessKeys =
          isStrict ? new Set<string>(Object.keys(inputObj)) : undefined

        if (excessKeys && excessKeys.size > shapeEntries.length) {
          ctx.objErrKeyIndex_ = -1
          const errors: ErrorWithPath[] = []

          if (ctx.objErrShortCircuit_) {
            return {
              data: undefined,
              errors: [
                getWarningOrErrorWithPath(
                  ctx,
                  `Expected strict object with ${shapeEntries.length} keys but got ${excessKeys.size}`,
                ),
              ],
            }
          }

          for (const { key } of shapeEntries) {
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
        for (const shapeEntry of shapeEntries) {
          const key = shapeEntry.key
          const type = shapeEntry.type

          const typekey = key as keyof T
          i += 1

          const subPath =
            key === '' || key.includes(' ') ? `['${key}']` : `.${key}`

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

          const parseResult = type._parse_(input, ctx)

          if (parseResult.ok) {
            resultObj[typekey] = parseResult.data
          }
          //
          else {
            for (const subError of parseResult.errors) {
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

        ctx.path_ = parentPath

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
      shape[key] = keyShape
    }
  }

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
      shape[key] = obj._obj_shape_[key]
    }
  }

  return rc_object(shape) as any
}

type ExpectedSchema<T> = (t: T) => T

type RcTypeWithSchemaEqualTo<T> = { __rc_type: ExpectedSchema<T> }

type StrictObjTypeToRcType<T> = {
  [K in keyof T]-?: StrictTypeToRcType<T[K]>
}

type IsUnion<T, U extends T = T> =
  T extends unknown ?
    [U] extends [T] ?
      false
    : true
  : false

type StrictTypeToRcType<T> =
  [T] extends [any[]] ? RcTypeWithSchemaEqualTo<T>
  : [T] extends [Record<string, any>] ?
    IsUnion<T> extends true ?
      RcTypeWithSchemaEqualTo<T>
    : StrictObjTypeToRcType<T> | RcTypeWithSchemaEqualTo<T>
  : [T] extends [Record<string, any> | null] ?
    ['null_or', StrictObjTypeToRcType<T>] | RcTypeWithSchemaEqualTo<T>
  : [T] extends [Record<string, any> | undefined] ?
    ['optional', StrictObjTypeToRcType<T>] | RcTypeWithSchemaEqualTo<T>
  : [T] extends [Record<string, any> | null | undefined] ?
    ['nullish_or', StrictObjTypeToRcType<T>] | RcTypeWithSchemaEqualTo<T>
  : RcTypeWithSchemaEqualTo<T>

export type StrictTypeToRcTypeBase<T extends Record<string, any>> = {
  [K in keyof T]-?: StrictTypeToRcType<T[K]>
}

export function rc_obj_builder<T extends Record<string, any>>() {
  return <S extends StrictTypeToRcTypeBase<T>>(
    schema: {
      [K in keyof S]: K extends keyof T ? S[K] : never
    },
    options?: ObjOptions,
  ): RcType<T> => {
    return rc_object(schema as any, options) as any
  }
}
