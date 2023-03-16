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
}

type InternalParseResult<T> =
  | [success: true, data: T]
  | [success: false, errors: string[]]

export type RcType<T> = {
  readonly withFallback: (fallback: T) => RcType<T>
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
  readonly _fallback_?: T
  /** @internal */
  readonly _predicate_?: (input: T) => boolean
  /** @internal */
  readonly _optional_?: true
  /** @internal */
  readonly _orNullish_?: true
  /** @internal */
  readonly _orNull_?: true
  /** @internal */
  readonly _useAutFix_?: true
  /** @internal */
  readonly _is_object_?: true
  /** @internal */
  readonly _show_value_in_error_?: true
  /** @internal */
  readonly _alternative_key_?: string
  /** @internal */
  readonly _obj_shape_?: Record<string, RcType<any>>
  /** @internal */
  readonly _array_shape_?: Record<string, RcType<any>>
  /** @internal */
  readonly _autoFix_?: (input: unknown) => false | { fixed: T }
}

function withFallback(this: RcType<any>, fallback: any): RcType<any> {
  return { ...this, _fallback_: fallback }
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

function parse<T>(
  type: RcType<T>,
  input: unknown,
  ctx: ParseResultCtx,
  checkIfIsValid: () => boolean | { data: T } | { errors: string[] },
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
    if (isValid === true || 'data' in isValid) {
      const validResult = isValid === true ? (input as T) : isValid.data

      if (type._predicate_) {
        if (!type._predicate_(validResult)) {
          return [false, [type._getErrorMsg_(validResult)]]
        }
      }

      return [true, validResult]
    }
  }

  if (type._fallback_ !== undefined) {
    addWarning(ctx, `Fallback used, ${type._getErrorMsg_(input)}`)

    return [true, type._fallback_]
  }

  if (type._useAutFix_ && type._autoFix_) {
    const autofixed = type._autoFix_(input)

    if (autofixed) {
      if (type._predicate_) {
        if (!type._predicate_(autofixed.fixed)) {
          return [false, [type._getErrorMsg_(autofixed.fixed)]]
        }
      }

      addWarning(ctx, `Autofixed from error "${type._getErrorMsg_(input)}"`)

      return [true, autofixed.fixed]
    }
  }

  return [
    false,
    isValid && 'errors' in isValid
      ? isValid.errors
      : [type._getErrorMsg_(input)],
  ]
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
    _kind_: `${this._kind_}_with_predicate`,
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

const defaultProps = {
  withFallback,
  where,
  optional,
  _getErrorMsg_,
  orNullish,
  withAutofix,
  orNull,
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
        ? `${normalizedTypeOf(literals[0], false)}_literal`
        : 'literals',
  }
}

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
        for (const type of types) {
          if (type._parse_(input, ctx)[0]) {
            return true
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
    _parse_(inputObj, ctx) {
      return parse<TypeOfObjectType<T>>(this, inputObj, ctx, () => {
        if (!isObject(inputObj)) return false

        const excessKeys = new Set<string>(Object.keys(inputObj))

        const resultObj: Record<any, string> = {} as any
        const resultErrors: string[] = []

        const parentPath = ctx.path

        for (const [key, type] of Object.entries(shape)) {
          const typekey = key as keyof T

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

          excessKeys.delete(keyToDeleteFromExcessKeys)

          const [isValid, result] = type._parse_(input, ctx)

          if (isValid) {
            resultObj[typekey] = result
          }
          //
          else {
            const errors = result

            for (const subError of errors) {
              resultErrors.push(gerWarningOrErrorWithPath(ctx, subError))
            }
          }
        }

        if (this._kind_ === 'strict_obj') {
          if (excessKeys.size > 0) {
            for (const key of excessKeys) {
              resultErrors.push(
                `Key '${key}' is not defined in the object shape`,
              )
            }
          }
        }

        if (resultErrors.length > 0) {
          return { errors: resultErrors }
        }

        if (this._kind_.startsWith('extends_object')) {
          return {
            data: {
              ...(inputObj as any),
              ...(resultObj as any),
            },
          }
        }

        return { data: resultObj as any }
      })
    },
  }
}

export function rc_extends_obj<T extends RcObject>(shape: T): RcObjType<T> {
  return {
    ...rc_object(shape),
    _kind_: `extends_object`,
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
  a: RcObjType<A>,
  b: RcObjType<B>,
): RcObjType<A & B> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return rc_object({ ...a._obj_shape_, ...b._obj_shape_ }) as any
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

          ctx.path = `${parentPath}${subPath}`

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
          }
        }

        if (resultErrors.length > 0) {
          if (looseCheck) {
            addWarnings(ctx, resultErrors)
          } else {
            return { errors: resultErrors }
          }
        }

        return { data: resultObj as any }
      })
    },
  }
}

function checkArrayUniqueOption(
  type: RcType<any>,
  uniqueOption: boolean | string | undefined,
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
  options?: { unique: boolean | string | false },
): { errors: string[] } | { data: any[] } | true {
  let index = -1
  const looseErrors: string[][] = []
  const arrayResult: any[] = []
  const uniqueValues = new Set<any>()

  const parentPath = ctx.path

  for (const _item of input) {
    index++

    const type: RcType<any> = Array.isArray(types) ? types[index] : types

    const subPath = `[${index}]`

    ctx.path = `${parentPath}${subPath}`

    let parseResult = type._parse_(_item, ctx)
    const [initialIsValid, initialResult] = parseResult

    const unique = options?.unique

    if (initialIsValid && unique) {
      let uniqueValueToCheck = initialResult

      const isUniqueKey = typeof unique === 'string'

      if (isUniqueKey) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        uniqueValueToCheck = initialResult[unique]
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
      return { errors: looseErrors.slice(0, 5).flat() }
    } else {
      addWarnings(ctx, looseErrors.flat())
    }
  }

  return { data: arrayResult }
}

export function rc_array<T extends RcType<any>>(
  type: T,
  options?: { unique: boolean | string | false },
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

/** instead of returning a general erroro, rejects invalid array items and return warnings for these items */
export function rc_loose_array<T extends RcType<any>>(
  type: T,
  options?: { unique: boolean | string | false },
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
  }

  return !!type._parse_(input, ctx)[0]
}

export function rc_validator<S>(type: RcType<S>) {
  return (input: any): input is S => rc_is_valid(input, type)
}

export function rc_recursive(type: () => RcType<any>): RcType<any> {
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
