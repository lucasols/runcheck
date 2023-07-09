import {
  RcType,
  RcInferType,
  RcBase,
  RcOptionalKeyType,
  isObject,
  defaultProps,
  parse,
  snakeCase,
  gerWarningOrErrorWithPath,
} from './runcheck'

export function rc_rename_from_key<T extends RcType<any>>(
  alternativeNames: string,
  type: T,
): RcType<RcInferType<T>> {
  return {
    ...type,
    _alternative_key_: alternativeNames,
  }
}

type RcObject = {
  [key: string]: RcBase<any, any> | RcObject
}

export type TypeOfObjectType<T extends RcObject> = Flatten<
  AddQuestionMarks<{
    [K in keyof T]: T[K] extends RcType<infer U>
      ? RequiredKey<U>
      : T[K] extends RcOptionalKeyType<infer W>
      ? W
      : T[K] extends RcObject
      ? RequiredKey<TypeOfObjectType<T[K]>>
      : never
  }>
>

type RcObjTypeReturn<T extends RcObject> = RcType<TypeOfObjectType<T>>

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

        const isStrict = this._kind_ === 'strict_obj'

        const excessKeys = isStrict
          ? new Set<string>(Object.keys(inputObj))
          : undefined

        if (excessKeys && this._shape_entries_.length !== excessKeys.size) {
          for (const [key] of this._shape_entries_) {
            excessKeys.delete(key)
          }

          ctx.objErrKeyIndex_ = -1
          const errors: string[] = []

          for (const key of excessKeys) {
            errors.push(`Key '${key}' is not defined in the object shape`)
          }
          return {
            data: undefined,
            errors,
          }
        }

        const resultObj: Record<any, string> = {} as any
        const resultErrors: string[] = []

        const parentPath = ctx.path_

        let i = -1
        for (const [key, type] of this._shape_entries_) {
          const typekey = key as keyof T
          i += 1

          const subPath = `.${key}`

          const path = `${parentPath}${subPath}`

          ctx.path_ = path

          let input
          let keyToDeleteFromExcessKeys = key

          if (type._alternative_key_) {
            input = inputObj[type._alternative_key_]
            keyToDeleteFromExcessKeys = type._alternative_key_
          }

          if (input === undefined) {
            input = inputObj[key]
            keyToDeleteFromExcessKeys = key
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
              resultErrors.push(gerWarningOrErrorWithPath(ctx, subError))
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
              resultErrors.push(
                `Key '${key}' is not defined in the object shape`,
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

export function rc_get_obj_schema<T extends RcObject>(
  type: RcObjTypeReturn<T>,
): T {
  return type._obj_shape_ as T
}

/** return an error if the obj has more keys than the expected type */
export function rc_obj_strict<T extends AnyObj>(
  shape: RcType<T>,
  options?: ObjOptions & { nonRecursive?: boolean },
): RcType<T>
export function rc_obj_strict<T extends RcObject>(
  shape: T,
  options?: ObjOptions,
): RcObjTypeReturn<T>
export function rc_obj_strict(
  shape: RcObject | RcType<AnyObj>,
  options?: ObjOptions & { nonRecursive?: boolean },
): RcType<any> {
  const objShape = ((): RcObject => {
    if (isRcType(shape)) {
      if (!shape._obj_shape_) {
        throw new Error(`rc_strict_obj: expected an object type`)
      }

      if (options?.nonRecursive) {
        return shape._obj_shape_
      } else {
        const objShape: RcObject = {}

        for (const [key, value] of Object.entries(shape._obj_shape_)) {
          objShape[key] = value._obj_shape_
            ? rc_obj_strict(value, options)
            : value
        }

        return objShape
      }
    }

    return shape as RcObject
  })()

  return {
    ...rc_object(objShape, options),
    _kind_: `strict_obj`,
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

type StricTypeToRcType<T> = [T] extends [any[]]
  ? RcType<T>
  : [T] extends [Record<string, any>]
  ?
      | ({
          [K in keyof T]-?: StricTypeToRcType<T[K]>
        } & Partial<Record<keyof RcType<any>, never>>)
      | RcType<T>
  : RcType<T>

export function rc_obj_builder<T extends Record<string, any>>() {
  return <S extends StricTypeToRcType<T>>(
    schema: {
      [K in keyof S]: K extends keyof T ? S[K] : never
    },
    options?: ObjOptions,
  ): RcType<T> => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
    return rc_object(schema as any, options) as any
  }
}
