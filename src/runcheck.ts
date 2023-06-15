export type RcParseResult<T> =
  | {
      error: false
      data: T
      warnings: string[] | false
    }
  | {
      error: true
      errors: string[]
    }

export type RcInferType<T extends RcType<any>> = T extends RcType<infer U>
  ? U
  : never

type RcOptional<T> = RcType<T | undefined>

type ParseResultCtx = {
  warnings: string[]
  path: string
  objErrShortCircuit: boolean
  objErrKeyIndex: number
}

type InternalParseResult<T> =
  | [success: true, data: T]
  | [success: false, errors: string[]]

export type RcType<T> = {
  readonly withFallback: (fallback: T | (() => T)) => RcType<T>
  readonly where: (predicate: (input: T) => boolean) => RcType<T>
  /** RcType | undefined */
  readonly optional: () => RcOptional<T>
  /** RcType | null */
  readonly orNull: () => RcType<T | null>
  /** RcType | null | undefined */
  readonly orNullish: () => RcType<T | null | undefined>
  readonly withAutofix: (
    customAutofix: (input: unknown) => false | { fixed: T },
  ) => RcType<T>

  /** @internal */
  readonly _parse_: (
    input: unknown,
    ctx: ParseResultCtx,
  ) => InternalParseResult<T>
  /** @internal */
  readonly _kind_: string
  /** @internal */
  readonly _getErrorMsg_: (input: unknown) => string
  /** @internal */
  readonly _fallback_: T | (() => T) | undefined
  /** @internal */
  readonly _predicate_: ((input: T) => boolean) | undefined
  /** @internal */
  readonly _optional_: boolean
  /** @internal */
  readonly _orNullish_: boolean
  /** @internal */
  readonly _orNull_: boolean
  /** @internal */
  readonly _useAutFix_: boolean
  /** @internal */
  readonly _is_extend_obj_: boolean
  /** @internal */
  readonly _is_object_: boolean
  /** @internal */
  readonly _shape_entries_: [string, RcType<any>][]
  /** @internal */
  readonly _show_value_in_error_: boolean
  /** @internal */
  readonly _alternative_key_: string | undefined
  /** @internal */
  readonly _obj_shape_: Record<string, RcType<any>> | undefined
  /** @internal */
  readonly _array_shape_: Record<string, RcType<any>> | undefined
  /** @internal */
  readonly _autoFix_: ((input: unknown) => false | { fixed: T }) | undefined
}

function withFallback(this: RcType<any>, fallback: any): RcType<any> {
  return {
    ...this,
    _fallback_: fallback,
  }
}

function gerWarningOrErrorWithPath(
  ctx: ParseResultCtx,
  message: string,
): string {
  if (message.startsWith('$[') || message.startsWith('$.')) {
    return message
  }

  return `${ctx.path ? `$${ctx.path}: ` : ''}${message}`
}

function addWarning(ctx: ParseResultCtx, warning: string) {
  ctx.warnings.push(gerWarningOrErrorWithPath(ctx, warning))
}

function addWarnings(ctx: ParseResultCtx, warnings: string[]) {
  warnings.forEach((warning) => addWarning(ctx, warning))
}

type IsValid<T> =
  | boolean
  | { data: T; errors: false }
  | { data: undefined; errors: string[] }

function parse<T>(
  type: RcType<T>,
  input: unknown,
  ctx: ParseResultCtx,
  checkIfIsValid: () => IsValid<T>,
): InternalParseResult<T> {
  if (type._optional_) {
    if (input === undefined) {
      return [true, input as T]
    }
  }

  if (type._orNullish_) {
    if (input === null || input === undefined) {
      return [true, input as T]
    }
  }

  if (type._orNull_) {
    if (input === null) {
      return [true, input as T]
    }
  }

  const isValid = checkIfIsValid()

  if (isValid) {
    if (isValid === true || !isValid.errors) {
      const validResult = isValid === true ? (input as T) : isValid.data

      if (type._predicate_) {
        if (!type._predicate_(validResult)) {
          return [false, [`Predicate failed for type '${type._kind_}'`]]
        }
      }

      return [true, validResult]
    }
  }

  const fb = type._fallback_

  if (fb !== undefined) {
    addWarning(
      ctx,
      `Fallback used, errors -> ${getResultErrors(isValid, ctx, type, input)}`,
    )

    return [true, isFn(fb) ? fb() : fb]
  }

  if (type._useAutFix_ && type._autoFix_) {
    const autofixed = type._autoFix_(input)

    if (autofixed) {
      if (type._predicate_) {
        if (!type._predicate_(autofixed.fixed)) {
          return [
            false,
            [`Predicate failed for autofix in type '${type._kind_}'`],
          ]
        }
      }

      addWarning(
        ctx,
        `Autofixed from error "${getResultErrors(isValid, ctx, type, input)}"`,
      )

      return [true, autofixed.fixed]
    }
  }

  return [false, isValid ? isValid.errors : [type._getErrorMsg_(input)]]
}

function getResultErrors(
  isValid: false | { errors: string[] },
  ctx: ParseResultCtx,
  type: RcType<any>,
  input: unknown,
) {
  return isValid
    ? isValid.errors.map((err) => err.replace(ctx.path, '')).join('; ')
    : type._getErrorMsg_(input)
}

function withAutofix(
  this: RcType<any>,
  customAutofix: (input: unknown) => any,
): RcType<any> {
  return {
    ...this,
    _useAutFix_: true,
    _autoFix_: customAutofix,
  }
}

function where(
  this: RcType<any>,
  predicate: (input: any) => boolean,
): RcType<any> {
  return {
    ...this,
    _predicate_: predicate,
  }
}

function optional(this: RcType<any>): RcOptional<any> {
  return {
    ...this,
    _optional_: true,
  }
}

function _getErrorMsg_(this: RcType<any>, input: unknown): string {
  return `Type '${normalizedTypeOf(
    input,
    !!this._show_value_in_error_,
  )}' is not assignable to '${this._kind_}'`
}

function orNull(this: RcType<any>): RcType<any | null> {
  return {
    ...this,
    _orNull_: true,
    _kind_: `${this._kind_}_or_null`,
  }
}

function orNullish(this: RcType<any>): RcType<any | null | undefined> {
  return {
    ...this,
    _orNullish_: true,
    _kind_: `${this._kind_}_or_nullish`,
  }
}

const defaultProps: Omit<RcType<any>, '_parse_' | '_kind_'> = {
  withFallback,
  where,
  optional,
  _getErrorMsg_,
  orNullish,
  withAutofix,
  orNull,
  _fallback_: undefined,
  _predicate_: undefined,
  _optional_: false,
  _orNull_: false,
  _orNullish_: false,
  _useAutFix_: false,
  _show_value_in_error_: false,
  _alternative_key_: undefined,
  _autoFix_: undefined,
  _array_shape_: undefined,
  _obj_shape_: undefined,
  _is_object_: false,
  _is_extend_obj_: false,
  _shape_entries_: [],
}

export const rc_undefined: RcType<undefined> = {
  ...defaultProps,
  _parse_(input, ctx) {
    return parse(this, input, ctx, () => input === undefined)
  },
  _kind_: 'undefined',
}

export const rc_null: RcType<null> = {
  ...defaultProps,
  _parse_(input, ctx) {
    return parse(this, input, ctx, () => input === null)
  },
  _kind_: 'null',
}

export const rc_any: RcType<any> = {
  ...defaultProps,
  _parse_(input, ctx) {
    return parse(this, input, ctx, () => true)
  },
  _kind_: 'any',
}

export const rc_unknown: RcType<unknown> = {
  ...defaultProps,
  _parse_(input, ctx) {
    return parse(this, input, ctx, () => true)
  },
  _kind_: 'unknown',
}

export const rc_boolean: RcType<boolean> = {
  ...defaultProps,
  _parse_(input, ctx) {
    return parse(this, input, ctx, () => typeof input === 'boolean')
  },
  _kind_: 'boolean',
}

export const rc_string: RcType<string> = {
  ...defaultProps,
  _parse_(input, ctx) {
    return parse(this, input, ctx, () => typeof input === 'string')
  },
  _kind_: 'string',
}

export const rc_number: RcType<number> = {
  ...defaultProps,
  _parse_(input, ctx) {
    return parse(
      this,
      input,
      ctx,
      () => typeof input === 'number' && !Number.isNaN(input),
    )
  },
  _kind_: 'number',
}

export const rc_date: RcType<Date> = {
  ...defaultProps,
  _parse_(input, ctx) {
    return parse(this, input, ctx, () => {
      return (
        typeof input === 'object' &&
        input instanceof Date &&
        !Number.isNaN(input.getTime())
      )
    })
  },
  _kind_: 'date',
}

// eslint-disable-next-line @typescript-eslint/ban-types
export function rc_instanceof<T extends Function>(classToCheck: T): RcType<T> {
  return {
    ...defaultProps,
    _parse_(input, ctx) {
      return parse(this, input, ctx, () => {
        return input instanceof classToCheck
      })
    },
    _kind_: `instanceof_${classToCheck.name ? `_${classToCheck.name}` : ''}`,
  }
}

export function rc_literals<T extends (string | number | boolean)[]>(
  ...literals: T
): RcType<T[number]> {
  if (literals.length === 0) {
    throw new Error('rc_literal requires at least one literal')
  }

  return {
    ...defaultProps,
    _parse_(input, ctx) {
      return parse(this, input, ctx, () => {
        for (const literal of literals) {
          if (input === literal) {
            return true
          }
        }

        return false
      })
    },
    _show_value_in_error_: true,
    _kind_:
      literals.length == 1
        ? normalizedTypeOf(literals[0], true)
        : literals
            .map((literal) => normalizedTypeOf(literal, true))
            .join(' | '),
  }
}

const maxShallowObjErrors = 1

export function rc_union<T extends RcType<any>[]>(
  ...types: T
): RcType<RcInferType<T[number]>> {
  if (types.length === 0) {
    throw new Error('Unions should have at least one type')
  }

  return {
    ...defaultProps,
    _parse_(input, ctx) {
      return parse(this, input, ctx, () => {
        const basePath = ctx.path
        const shallowObjErrors: string[] = []
        let shallowObjErrorsCount = 0
        let hasNonObjTypeMember = false
        const nonShallowObjErrors: string[] = []

        let i = 0
        for (const type of types) {
          i += 1

          if (type._is_object_) {
            ctx.path = `${basePath}|union ${i}|`
          }

          ctx.objErrShortCircuit = true
          ctx.objErrKeyIndex = 0

          const [ok, result] = type._parse_(input, ctx)

          ctx.objErrShortCircuit = false

          const objErrIndex = ctx.objErrKeyIndex

          ctx.objErrKeyIndex = 0

          if (ok) {
            return true
          } else if (type._is_object_ && objErrIndex !== -1) {
            if (objErrIndex > 0) {
              nonShallowObjErrors.push(...result)
            } else {
              if (shallowObjErrorsCount < maxShallowObjErrors) {
                shallowObjErrors.push(...result)
              }

              shallowObjErrorsCount += 1
            }
          } else {
            hasNonObjTypeMember = true
          }
        }

        ctx.path = basePath

        if (nonShallowObjErrors.length > 0 || shallowObjErrors.length > 0) {
          if (
            shallowObjErrorsCount > maxShallowObjErrors ||
            hasNonObjTypeMember
          ) {
            shallowObjErrors.push('not matches any other union member')
          }

          return {
            errors: [...nonShallowObjErrors, ...shallowObjErrors],
            data: undefined,
          }
        }

        return false
      })
    },
    _kind_: types.map((type) => type._kind_).join(' | '),
  }
}

export function rc_rename_from_key<T extends RcType<any>>(
  alternativeNames: string,
  type: T,
): RcType<RcInferType<T>> {
  return {
    ...type,
    _alternative_key_: alternativeNames,
  }
}

/** @deprecated use `rc_rename_from_key` instead */
export const rc_rename_key = rc_rename_from_key

type RcObject = Record<string, RcType<any>>

type TypeOfObjectType<T extends RcObject> = {
  [K in keyof T]: RcInferType<T[K]>
}

type RcObjType<T extends RcObject> = RcType<TypeOfObjectType<T>>

export function rc_object<T extends RcObject>(
  shape: T,
  { normalizeKeysFrom }: { normalizeKeysFrom?: 'snake_case' } = {},
): RcObjType<T> {
  return {
    ...defaultProps,
    _obj_shape_: shape,
    _kind_: 'object',
    _is_object_: true,
    _shape_entries_: Object.entries(shape),
    _parse_(inputObj, ctx) {
      return parse<TypeOfObjectType<T>>(this, inputObj, ctx, () => {
        if (!isObject(inputObj)) {
          ctx.objErrKeyIndex = -1
          return false
        }

        const excessKeys =
          this._kind_ === 'strict_obj'
            ? new Set<string>(Object.keys(inputObj))
            : undefined

        const resultObj: Record<any, string> = {} as any
        const resultErrors: string[] = []

        const parentPath = ctx.path

        let i = -1
        for (const [key, type] of this._shape_entries_) {
          const typekey = key as keyof T
          i += 1

          const subPath = `.${key}`

          ctx.path = `${parentPath}${subPath}`

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
              resultErrors.push(gerWarningOrErrorWithPath(ctx, subError))
            }

            if (ctx.objErrShortCircuit) {
              ctx.objErrKeyIndex = i
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

export function rc_extends_obj<T extends RcObject>(shape: T): RcObjType<T> {
  return {
    ...rc_object(shape),
    _kind_: `extends_object`,
    _is_extend_obj_: true,
  }
}

export function rc_get_obj_schema<T extends RcObject>(type: RcObjType<T>): T {
  return type._obj_shape_ as T
}

/** return an error if the obj has more keys than the expected type */
export function rc_strict_obj<T extends RcObject>(shape: T): RcObjType<T> {
  return {
    ...rc_object(shape),
    _kind_: `strict_obj`,
  }
}

export function rc_obj_intersection<A extends RcObject, B extends RcObject>(
  ...objs: [RcObjType<A>, RcObjType<B>]
): RcObjType<A & B>
export function rc_obj_intersection<
  A extends RcObject,
  B extends RcObject,
  C extends RcObject,
>(...objs: [RcObjType<A>, RcObjType<B>, RcObjType<C>]): RcObjType<A & B & C>
export function rc_obj_intersection<
  A extends RcObject,
  B extends RcObject,
  C extends RcObject,
  D extends RcObject,
>(
  ...objs: [RcObjType<A>, RcObjType<B>, RcObjType<C>, RcObjType<D>]
): RcObjType<A & B & C & D>
export function rc_obj_intersection(...objs: RcObjType<any>[]): RcObjType<any> {
  const finalShape = {} as any

  for (const objShape of objs) {
    Object.assign(finalShape, objShape._obj_shape_)
  }

  return rc_object(finalShape)
}

export function rc_obj_pick<O extends RcObject, K extends keyof O>(
  obj: RcObjType<O>,
  keys: K[],
): RcObjType<Pick<O, K>> {
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

  return rc_object(shape)
}

export function rc_obj_omit<O extends RcObject, K extends keyof O>(
  obj: RcObjType<O>,
  keys: K[],
): RcObjType<Pick<O, K>> {
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

  return rc_object(shape)
}

type RcRecord<V extends RcType<any>> = Record<string, V>

type RcRecordType<V extends RcType<any>> = RcType<TypeOfObjectType<RcRecord<V>>>

export function rc_record<V extends RcType<any>>(
  valueType: V,
  {
    checkKey,
    looseCheck,
  }: { checkKey?: (key: string) => boolean; looseCheck?: boolean } = {},
): RcRecordType<V> {
  return {
    ...defaultProps,
    _kind_: `record<string, ${valueType._kind_}>`,
    _parse_(inputObj, ctx) {
      return parse<TypeOfObjectType<RcRecord<V>>>(this, inputObj, ctx, () => {
        if (!isObject(inputObj)) return false

        const resultObj: Record<any, string> = {} as any
        const resultErrors: string[] = []

        const parentPath = ctx.path

        for (const [key, inputValue] of Object.entries(inputObj)) {
          const subPath = `.${key}`

          const path = `${parentPath}${subPath}`
          ctx.path = path

          if (checkKey && !checkKey(key)) {
            resultErrors.push(
              gerWarningOrErrorWithPath(ctx, `Key '${key}' is not allowed`),
            )
            continue
          }

          const input = inputObj[key]

          const [isValid, result] = valueType._parse_(inputValue, ctx)

          if (isValid) {
            resultObj[key] = input
          }
          //
          else {
            const errors = result

            for (const subError of errors) {
              resultErrors.push(gerWarningOrErrorWithPath(ctx, subError))
            }

            if (ctx.objErrShortCircuit) {
              break
            }
          }
        }

        if (resultErrors.length > 0) {
          if (looseCheck) {
            addWarnings(ctx, resultErrors)
          } else {
            return { errors: resultErrors, data: undefined }
          }
        }

        return { errors: false, data: resultObj as any }
      })
    },
  }
}

/** instead of returning a general error, rejects invalid keys and returns warnings for these items */
export function rc_loose_record<V extends RcType<any>>(
  valueType: V,
  { checkKey }: { checkKey?: (key: string) => boolean } = {},
): RcRecordType<V> {
  return rc_record(valueType, { checkKey, looseCheck: true })
}

function checkArrayUniqueOption(
  type: RcType<any>,
  uniqueOption: boolean | string | undefined | ((item: any) => any),
) {
  if (typeof uniqueOption === 'string') {
    if (!type._obj_shape_?.[uniqueOption]) {
      throw new Error(`${type._kind_} can't be used with unique key option`)
    }
  }
}

function checkArrayItems(
  this: RcType<any>,
  input: any[],
  types: RcType<any> | readonly RcType<any>[],
  ctx: ParseResultCtx,
  loose = false,
  options?: { unique: boolean | string | ((item: any) => any) },
): IsValid<any[]> {
  const looseErrors: string[][] = []
  const arrayResult: any[] = []
  const uniqueValues = new Set<any>()

  const parentPath = ctx.path

  const isTuple = Array.isArray(types)

  let index = -1
  for (const _item of input) {
    index++

    const type: RcType<any> = isTuple ? types[index] : types

    const subPath = `[${index}]`

    const path = `${parentPath}${subPath}`

    ctx.path = path

    let parseResult = type._parse_(_item, ctx)
    const [initialIsValid, initialResult] = parseResult

    ctx.path = path

    const unique = options?.unique

    if (initialIsValid && unique) {
      let uniqueValueToCheck = initialResult

      const isUniqueKey = typeof unique === 'string'

      if (isUniqueKey) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        uniqueValueToCheck = initialResult[unique]
      } else if (typeof unique === 'function') {
        uniqueValueToCheck = unique(initialResult)
      }

      if (uniqueValues.has(uniqueValueToCheck)) {
        if (isUniqueKey) {
          ctx.path = `${parentPath}${subPath}.${unique}`
        }

        parseResult = [
          false,
          [
            gerWarningOrErrorWithPath(
              ctx,
              isUniqueKey
                ? `Type '${type._obj_shape_?.[unique]?._kind_}' with value "${uniqueValueToCheck}" is not unique`
                : typeof unique === 'function'
                ? `Type '${type._kind_}' unique fn return with value "${uniqueValueToCheck}" is not unique`
                : `${type._kind_} value is not unique`,
            ),
          ],
        ]
      } else {
        uniqueValues.add(uniqueValueToCheck)
      }
    }

    const [isValid, result] = parseResult

    if (!isValid) {
      if (!loose) {
        return {
          errors: result.map((error) => gerWarningOrErrorWithPath(ctx, error)),
          data: undefined,
        }
      } else {
        looseErrors.push(
          result.map((error) => gerWarningOrErrorWithPath(ctx, error)),
        )
        continue
      }
    } else {
      arrayResult.push(result)
    }
  }

  if (looseErrors.length > 0) {
    if (arrayResult.length === 0) {
      return { errors: looseErrors.slice(0, 5).flat(), data: undefined }
    } else {
      addWarnings(ctx, looseErrors.flat())
    }
  }

  return { errors: false, data: arrayResult }
}

export function rc_array<T extends RcType<any>>(
  type: T,
  options?: {
    unique: boolean | string | false | ((parsedItem: RcInferType<T>) => any)
  },
): RcType<RcInferType<T>[]> {
  checkArrayUniqueOption(type, options?.unique)

  return {
    ...defaultProps,
    _kind_: `${type._kind_}[]`,
    _parse_(input, ctx) {
      return parse(this, input, ctx, () => {
        if (!Array.isArray(input)) return false

        if (input.length === 0) return true

        return checkArrayItems.call(this, input, type, ctx, false, options)
      })
    },
  }
}

/** instead of returning a general error, rejects invalid array items and returns warnings for these items */
export function rc_loose_array<T extends RcType<any>>(
  type: T,
  options?: {
    unique: boolean | string | false | ((parsedItem: RcInferType<T>) => any)
  },
): RcType<RcInferType<T>[]> {
  checkArrayUniqueOption(type, options?.unique)

  return {
    ...defaultProps,
    _kind_: `${type._kind_}[]`,
    _parse_(input, ctx) {
      return parse(this, input, ctx, () => {
        if (!Array.isArray(input)) return false

        if (input.length === 0) return true

        return checkArrayItems.call(this, input, type, ctx, true, options)
      })
    },
  }
}

type MapTupleToTypes<T extends readonly [...any[]]> = {
  -readonly [K in keyof T]: RcInferType<T[K]>
}

/**
 * Check for a tuple of types
 *
 * TS equivalent example: [string, number, boolean]
 */
export function rc_tuple<T extends readonly RcType<any>[]>(
  types: T,
): RcType<MapTupleToTypes<T>> {
  return {
    ...defaultProps,
    _kind_: `[${types.map((type) => type._kind_).join(', ')}]`,
    _parse_(input, ctx) {
      return parse(this, input, ctx, () => {
        if (!Array.isArray(input)) return false

        if (input.length !== types.length) return false

        return checkArrayItems.call(this, input, types, ctx) as boolean
      })
    },
  }
}

/**
 * Parse a runcheck type. If valid return the valid input, with warning for autofix
 * and fallback, or the errors if invalid
 */
export function rc_parse<S>(input: any, type: RcType<S>): RcParseResult<S> {
  const ctx: ParseResultCtx = {
    warnings: [],
    path: '',
    objErrShortCircuit: false,
    objErrKeyIndex: 0,
  }

  const [success, dataOrError] = type._parse_(input, ctx)

  if (success) {
    return {
      error: false,
      data: dataOrError,
      warnings: ctx.warnings.length > 0 ? ctx.warnings : false,
    }
  }

  return {
    error: true,
    errors: dataOrError,
  }
}

export type RcParser<T> = (input: any) => RcParseResult<T>

/** create a reusable parser for a certain type */
export function rc_parser<S>(type: RcType<S>): RcParser<S> {
  return (input: any) => rc_parse(input, type)
}

/** does the same as `rc_parse` but without requiring to check for errors before using the parsed data */
export function rc_loose_parse<S>(
  input: any,
  type: RcType<S>,
): { data: S | null; errors: string[] | false; warnings: string[] | false } {
  const result = rc_parse(input, type)

  if (result.error) {
    return {
      data: null,
      errors: result.errors,
      warnings: false,
    }
  }

  return { data: result.data, errors: false, warnings: result.warnings }
}

export function rc_is_valid<S>(input: any, type: RcType<S>): input is S {
  const ctx: ParseResultCtx = {
    warnings: [],
    path: '',
    objErrShortCircuit: false,
    objErrKeyIndex: 0,
  }

  return !!type._parse_(input, ctx)[0]
}

export function rc_validator<S>(type: RcType<S>) {
  return (input: any): input is S => rc_is_valid(input, type)
}

export function rc_recursive<T>(type: () => RcType<T>): RcType<T> {
  return {
    ...defaultProps,
    _kind_: 'recursive',
    _parse_(input, ctx) {
      return type()._parse_(input, ctx)
    },
  }
}

/** validate a input or subset of input and transform the valid result */
export function rc_transform<Input, Transformed>(
  type: RcType<Input>,
  transform: (input: Input) => Transformed,
): RcType<Transformed> {
  return {
    ...defaultProps,
    _kind_: `transform_from_${type._kind_}`,
    _parse_(input, ctx) {
      const [success, dataOrError] = type._parse_(input, ctx)

      if (success) {
        return [true, transform(dataOrError)]
      }

      return [false, dataOrError]
    },
  }
}

function normalizedTypeOf(input: unknown, showValueInError: boolean): string {
  const type = ((): string => {
    if (typeof input === 'object') {
      if (Array.isArray(input)) {
        return 'array'
      }

      if (!input) {
        return 'null'
      }
    }

    return typeof input
  })()

  return showValueInError &&
    (type === 'string' || type === 'number' || type === 'boolean')
    ? `${type}(${input})`
    : type
}

type NonArrayObject = {
  [x: string]: any
  [y: number]: never
}

export function rc_assert_is_valid<S>(
  result: RcParseResult<S>,
): asserts result is { error: false; data: S; warnings: string[] | false } {
  if (result.error) {
    throw new Error(`invalid input: ${result.errors.join(', ')}`)
  }
}

function isObject(value: any): value is NonArrayObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** @internal */
export function snakeCase(str: string): string {
  return str
    .replace(/\W+/g, ' ')
    .split(/ |\B(?=[A-Z])/)
    .map((word) => word.toLowerCase())
    .join('_')
}

export function rc_parse_json<T>(
  jsonString: string,
  schema: RcType<T>,
): RcParseResult<T> {
  try {
    const parsed = JSON.parse(jsonString)

    return rc_parse(parsed, schema)
  } catch (err) {
    return {
      error: true,
      errors: [`json parse error: ${isObject(err) ? err.message : ''}`],
    }
  }
}

function isFn(value: any): value is () => any {
  return typeof value === 'function'
}

type Prettify<T> = T extends Record<string, any>
  ? {
      [K in keyof T]: Prettify<T[K]>
    }
  : T

export type RcPrettyInferType<T extends RcType<any>> = Prettify<RcInferType<T>>

export type RcSchemaHasType<E, T extends E> = T
