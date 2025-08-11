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
  rc_array,
  rc_loose_array,
  snakeCase,
} from './runcheck'

/**
 * Creates a type that uses a fallback key when the primary key is undefined.
 * Can be used to rename keys from input or provide alternative key names.
 * @param fallbackKey - The alternative key to use when the primary key is undefined
 * @param type - The type to validate the value against
 * @returns A runcheck type that supports fallback key lookup
 * @example
 * ```typescript
 * const userSchema = rc_object({
 *   name: rc_get_from_key_as_fallback('username', rc_string)
 * })
 * // Will look for 'name' first, then 'username' if 'name' is undefined
 * const result = userSchema.parse({ username: 'john' }) // valid
 * ```
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
      case 'array_of':
        return rc_array(unwrapToObjSchema(value))
      case 'loose_array_of':
        return rc_loose_array(unwrapToObjSchema(value))
      case 'optional_array_of':
        return rc_array(unwrapToObjSchema(value)).optional()
      case 'optional_loose_array_of':
        return rc_loose_array(unwrapToObjSchema(value)).optional()
      case 'null_or_array_of':
        return rc_array(unwrapToObjSchema(value)).orNull()
      case 'null_or_loose_array_of':
        return rc_loose_array(unwrapToObjSchema(value)).orNull()
      case 'nullish_or_array_of':
        return rc_array(unwrapToObjSchema(value)).orNullish()
      case 'nullish_or_loose_array_of':
        return rc_loose_array(unwrapToObjSchema(value)).orNullish()
      default:
        return type
    }
  }

  throw new Error(`invalid schema: ${input}`)
}

export type ObjOptions = {
  normalizeKeysFrom?: 'snake_case'
  /** excess keys are not removed if extends is true */
  extends?: boolean
}

/**
 * Creates an object type validator with specified shape and options.
 * @param shape - The object shape defining the expected properties and their types
 * @param options - Configuration options for the object validator
 * @param options.normalizeKeysFrom - If 'snake_case', automatically converts camelCase keys to snake_case for lookup
 * @param options.extends - If true, allows excess properties in the input object
 * @returns A runcheck type that validates objects with the specified shape
 * @example
 * ```typescript
 * const userSchema = rc_object({
 *   name: rc_string,
 *   age: rc_number,
 *   email: rc_string.optional()
 * })
 * const result = userSchema.parse({ name: 'John', age: 30 }) // valid
 * ```
 */
export function rc_object<T extends RcObject>(
  shape: T,
  { normalizeKeysFrom, extends: extendsObj }: ObjOptions = {},
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
    _kind_: extendsObj ? 'extends_object' : 'object',
    _detailed_obj_shape_: '',
    _is_object_: true,
    _is_extend_obj_: !!extendsObj,
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

type ExtendsOptions = Omit<ObjOptions, 'extends'>

/**
 * Creates an object type that extends the input with additional properties.
 * Unlike strict objects, this allows excess properties from the input to be preserved.
 * @param shapeOrSchema - Either an object shape or an existing object type
 * @param options - Configuration options (excluding 'extends' which is always true)
 * @returns A runcheck type that validates and extends objects
 * @example
 * ```typescript
 * const baseSchema = rc_obj_extends({
 *   name: rc_string
 * })
 * // Input: { name: 'John', extra: 'data' }
 * // Output: { name: 'John', extra: 'data' } (preserves extra properties)
 * ```
 */
export function rc_obj_extends<T extends RcObject>(
  shape: T,
  options?: ExtendsOptions,
): RcObjTypeReturn<T>
export function rc_obj_extends<T extends Record<string, any>>(
  schema: RcType<T>,
  options?: ExtendsOptions,
): RcType<T>
export function rc_obj_extends(
  shapeOrSchema: RcObject | RcType<Record<string, any>>,
  options?: ExtendsOptions,
): RcType<Record<string, any>> {
  // If it's an existing RcType with object shape, use it directly
  if (isRcType(shapeOrSchema)) {
    if (!shapeOrSchema._obj_shape_) {
      throw new Error('rc_obj_extends: schema must be an object type')
    }

    return {
      ...shapeOrSchema,
      _kind_: `extends_object`,
      _is_extend_obj_: true,
    }
  }

  // Otherwise, treat it as a shape and create a new object
  return {
    ...rc_object(shapeOrSchema as any, options),
    _kind_: `extends_object`,
    _is_extend_obj_: true,
  }
}

/**
 * Extracts the object shape from an object type for inspection or manipulation.
 * @param type - The object type to extract the shape from
 * @returns The object shape containing the property types
 * @throws Error if the type is not an object type
 * @example
 * ```typescript
 * const userSchema = rc_object({ name: rc_string, age: rc_number })
 * const shape = rc_get_obj_shape(userSchema)
 * // shape = { name: RcType<string>, age: RcType<number> }
 * ```
 */
export function rc_get_obj_shape<T extends Record<string, any>>(
  type: RcType<T>,
): {
  [K in keyof T]: RcType<T[K]>
} {
  if (!type._obj_shape_) {
    throw new Error(`type does not have an object shape`)
  }

  return type._obj_shape_ as T
}

/**
 * Creates a strict object type that rejects input with excess properties.
 * @param shape - The object shape defining the expected properties and their types
 * @param options - Configuration options for the object validator
 * @returns A runcheck type that validates objects strictly (no excess properties allowed)
 * @example
 * ```typescript
 * const strictUser = rc_obj_strict({
 *   name: rc_string,
 *   age: rc_number
 * })
 * const result = strictUser.parse({ name: 'John', age: 30 }) // valid
 * const result2 = strictUser.parse({ name: 'John', age: 30, extra: 'data' }) // invalid
 * ```
 */
export function rc_obj_strict<T extends RcObject>(
  shape: T,
  options?: ObjOptions,
): RcObjTypeReturn<T> {
  return {
    ...rc_object(shape, options),
    _kind_: `strict_obj`,
  }
}

/**
 * Enables strict object validation for a type, rejecting excess properties.
 * @param type - The type to make strict
 * @param options - Configuration options
 * @param options.nonRecursive - If true, only affects the immediate object type, not nested objects
 * @returns The type with strict object validation enabled
 * @example
 * ```typescript
 * const userSchema = rc_object({ name: rc_string, age: rc_number })
 * const strictUser = rc_enable_obj_strict(userSchema)
 * // Now rejects objects with excess properties
 * ```
 */
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

/**
 * Merges multiple object types into a single object type.
 * Later objects override properties from earlier objects.
 * @param objs - The object types to merge (2-4 objects supported)
 * @returns A runcheck type representing the merged object
 * @example
 * ```typescript
 * const base = rc_object({ name: rc_string, age: rc_number })
 * const extended = rc_object({ email: rc_string, age: rc_string }) // age overrides
 * const merged = rc_obj_merge(base, extended)
 * // Result: { name: string, age: string, email: string }
 * ```
 */
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

/**
 * Creates a new object type with only the specified properties from the original.
 * @param obj - The object type to pick properties from
 * @param keys - The keys to pick from the object
 * @returns A runcheck type containing only the picked properties
 * @throws Error if the input is not an object type
 * @example
 * ```typescript
 * const userSchema = rc_object({ name: rc_string, age: rc_number, email: rc_string })
 * const nameAndAge = rc_obj_pick(userSchema, ['name', 'age'])
 * // Result: { name: string, age: number }
 * ```
 */
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

  return rc_object(shape) as any
}

/**
 * Creates a new object type without the specified properties from the original.
 * @param obj - The object type to omit properties from
 * @param keys - The keys to omit from the object
 * @returns A runcheck type without the omitted properties
 * @throws Error if the input is not an object type
 * @example
 * ```typescript
 * const userSchema = rc_object({ name: rc_string, age: rc_number, email: rc_string })
 * const withoutEmail = rc_obj_omit(userSchema, ['email'])
 * // Result: { name: string, age: number }
 * ```
 */
export function rc_obj_omit<O extends AnyObj, K extends keyof O>(
  obj: RcType<O>,
  keys: K[],
): RcType<Omit<O, K>> {
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
  [T] extends [(infer U)[]] ?
    | ['array_of' | 'loose_array_of', StrictTypeToRcType<U>]
    | RcTypeWithSchemaEqualTo<T>
  : [T] extends [(infer U)[] | undefined] ?
    | ['optional_array_of' | 'optional_loose_array_of', StrictTypeToRcType<U>]
    | RcTypeWithSchemaEqualTo<T>
  : [T] extends [(infer U)[] | null] ?
    | ['null_or_array_of' | 'null_or_loose_array_of', StrictTypeToRcType<U>]
    | RcTypeWithSchemaEqualTo<T>
  : [T] extends [(infer U)[] | undefined | null] ?
    | [
        'nullish_or_array_of' | 'nullish_or_loose_array_of',
        StrictTypeToRcType<U>,
      ]
    | RcTypeWithSchemaEqualTo<T>
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

/**
 * Creates a type-safe object builder that enforces the structure matches a TypeScript type.
 * Useful for creating schemas that must conform to existing TypeScript interfaces.
 * @returns A builder function that takes a schema matching the specified TypeScript type
 * @example
 * ```typescript
 * interface User {
 *   name: string
 *   age: number
 *   email?: string
 * }
 *
 * const userBuilder = rc_obj_builder<User>()
 * const userSchema = userBuilder({
 *   name: rc_string,
 *   age: rc_number,
 *   email: ['optional', rc_string]
 * })
 * ```
 */
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
