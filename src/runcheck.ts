export {
  rc_get_obj_shape as rc_get_obj_schema,
  rc_obj_builder,
  rc_obj_extends,
  rc_obj_merge,
  rc_obj_omit,
  rc_obj_pick,
  rc_obj_strict,
  rc_object,
  rc_enable_obj_strict,
  rc_rename_from_key,
} from './rc_object'

export type RcParseResult<T> =
  | {
      error: false
      ok: true
      data: T
      warnings: string[] | false
    }
  | {
      ok: false
      error: true
      errors: string[]
    }

export type RcInferType<T extends RcType<any>> = T extends RcType<infer U>
  ? U
  : never

type ParseResultCtx = {
  warnings_: string[]
  path_: string
  objErrShortCircuit_: boolean
  objErrKeyIndex_: number
  strictObj_: boolean
  noWarnings_: boolean
  noLooseArray_: boolean
}

type InternalParseResult<T> =
  | [success: true, data: T]
  | [success: false, errors: ErrorWithPath[]]

type WithFallback<T> = (fallback: T | (() => T)) => RcType<T>

export type RcOptionalKeyType<T> = RcBase<T, true>

export type RcType<T> = RcBase<T, false>

export type RcBase<T, RequiredKey extends boolean> = {
  __rc_type: T
  readonly withFallback: WithFallback<T>
  readonly where: (predicate: (input: T) => boolean) => RcType<T>
  /** RcType | undefined */
  readonly optional: () => RcType<T | undefined>
  /** { key?: RcType | undefined } */
  readonly optionalKey: () => RcOptionalKeyType<T | undefined>
  /** RcType | null */
  readonly orNull: () => RcType<T | null>
  /** RcType | null | undefined */
  readonly orNullish: () => RcType<T | null | undefined>
  readonly withAutofix: (
    customAutofix: (input: unknown) => false | { fixed: T },
  ) => RcType<T>

  readonly _optional_key_?: RequiredKey
  /** @internal */
  readonly _parse_: (
    input: unknown,
    ctx: ParseResultCtx,
  ) => InternalParseResult<T>
  /** @internal */
  readonly _kind_: string
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
  readonly _array_item_type_: RcType<any> | undefined
  /** @internal */
  readonly _show_value_in_error_: boolean
  /** @internal */
  readonly _alternative_key_: string | undefined
  /** @internal */
  readonly _obj_shape_: Record<string, RcType<any>> | undefined
  /** @internal */
  readonly _autoFix_: ((input: unknown) => false | { fixed: T }) | undefined
}

function withFallback(this: RcType<any>, fallback: any): RcType<any> {
  return {
    ...this,
    _fallback_: fallback,
  }
}

/** @internal */
export type ErrorWithPath = string & { __withPath: true }
type ErrorWithouPath = string & { __withPath?: never }

export function getWarningOrErrorWithPath(
  ctx: ParseResultCtx,
  message: ErrorWithouPath,
): ErrorWithPath {
  return `${ctx.path_ ? `$${ctx.path_}: ` : ''}${message}` as ErrorWithPath
}

function addWarning(ctx: ParseResultCtx, warning: string) {
  ctx.warnings_.push(
    warning.startsWith('$') ? warning : getWarningOrErrorWithPath(ctx, warning),
  )
}

function addWarnings(ctx: ParseResultCtx, warnings: string[]) {
  warnings.forEach((warning) => addWarning(ctx, warning))
}

type IsValid<T> =
  | boolean
  | { data: T; errors: false }
  | { data: undefined; errors: ErrorWithPath[] }

export function parse<T>(
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
          return [
            false,
            [
              getWarningOrErrorWithPath(
                ctx,
                `Predicate failed for type '${type._kind_}'`,
              ),
            ],
          ]
        }
      }

      return [true, validResult]
    }
  }

  if (!ctx.noWarnings_) {
    const fb = type._fallback_

    if (fb !== undefined) {
      addWarning(
        ctx,
        `Fallback used, errors -> ${getResultErrors(
          isValid,
          ctx,
          type,
          input,
        )}`,
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
              [
                getWarningOrErrorWithPath(
                  ctx,
                  `Predicate failed for autofix in type '${type._kind_}'`,
                ),
              ],
            ]
          }
        }

        addWarning(
          ctx,
          `Autofixed from error "${getResultErrors(
            isValid,
            ctx,
            type,
            input,
          )}"`,
        )

        return [true, autofixed.fixed]
      }
    }
  }

  return [
    false,
    isValid
      ? isValid.errors
      : [getWarningOrErrorWithPath(ctx, getErrorMsg(type, input))],
  ]
}

function getResultErrors(
  isValid: false | { errors: string[] },
  ctx: ParseResultCtx,
  type: RcType<any>,
  input: unknown,
) {
  return isValid
    ? isValid.errors.map((err) => err.replace(ctx.path_, '')).join('; ')
    : getErrorMsg(type, input)
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

function optional(this: RcType<any>): RcType<any> {
  return {
    ...this,
    _optional_: true,
  }
}

function getErrorMsg(type: RcType<any>, input: unknown): string {
  return `Type '${normalizedTypeOf(
    input,
    !!type._show_value_in_error_,
  )}' is not assignable to '${type._kind_}'`
}

function orNull(this: RcType<any>): RcType<any> {
  return {
    ...this,
    _orNull_: true,
    _kind_: `${this._kind_}_or_null`,
  }
}

function orNullish(this: RcType<any>): RcType<any> {
  return {
    ...this,
    _orNullish_: true,
    _kind_: `${this._kind_}_or_nullish`,
  }
}

export const defaultProps: Omit<RcType<any>, '_parse_' | '_kind_'> = {
  __rc_type: undefined,
  withFallback,
  where,
  optional,
  optionalKey: optional as any,
  orNullish,
  withAutofix,
  orNull,
  _array_item_type_: undefined,
  _fallback_: undefined,
  _predicate_: undefined,
  _optional_: false,
  _orNull_: false,
  _orNullish_: false,
  _useAutFix_: false,
  _show_value_in_error_: false,
  _alternative_key_: undefined,
  _autoFix_: undefined,
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
        const basePath = ctx.path_
        const shallowObjErrors: ErrorWithPath[] = []
        let shallowObjErrorsCount = 0
        let hasNonObjTypeMember = false
        const nonShallowObjErrors: ErrorWithPath[] = []

        let i = 0
        for (const type of types) {
          i += 1

          if (type._is_object_) {
            ctx.path_ = `${basePath}|union ${i}|`
          }

          const currentObjErrShortCircuit = ctx.objErrShortCircuit_
          ctx.objErrShortCircuit_ = true
          ctx.objErrKeyIndex_ = 0

          const [ok, result] = type._parse_(input, ctx)

          const objErrIndex = ctx.objErrKeyIndex_

          ctx.objErrShortCircuit_ = currentObjErrShortCircuit
          ctx.objErrKeyIndex_ = 0

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

        ctx.path_ = basePath

        if (nonShallowObjErrors.length > 0 || shallowObjErrors.length > 0) {
          if (
            shallowObjErrorsCount > maxShallowObjErrors ||
            hasNonObjTypeMember
          ) {
            shallowObjErrors.push(
              getWarningOrErrorWithPath(
                ctx,
                'not matches any other union member',
              ),
            )
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

type NotUndefined<T> = T extends undefined ? never : T

export function rc_default<T>(
  schema: RcType<T>,
  defaultValue: NotUndefined<T> | (() => NotUndefined<T>),
): RcType<NotUndefined<T>> {
  return {
    ...(schema as unknown as RcType<NotUndefined<T>>),
    _optional_: false,
    _orNullish_: false,
    _orNull_: false,
    _parse_(input, ctx) {
      return parse(this, input, ctx, () => {
        const result = schema._parse_(input, ctx)
        const [ok, value] = result

        if (ok) {
          if (value !== undefined) {
            return true
          }

          return {
            data: isFn(defaultValue) ? defaultValue() : defaultValue,
            errors: false,
          }
        }

        return {
          data: undefined,
          errors: value,
        }
      })
    },
    _kind_: `${schema._kind_}_default`,
  }
}

type NotNullish<T> = T extends null | undefined ? never : T

export function rc_nullish_default<T>(
  schema: RcType<T>,
  defaultValue: NotNullish<T> | (() => NotNullish<T>),
): RcType<NotNullish<T>> {
  return {
    ...(schema as unknown as RcType<NotNullish<T>>),
    _optional_: false,
    _orNullish_: false,
    _orNull_: false,
    _parse_(input, ctx) {
      return parse(this, input, ctx, () => {
        const result = schema._parse_(input, ctx)

        const [ok, value] = result

        if (ok) {
          if (value !== null && value !== undefined) {
            return true
          }

          return {
            data: isFn(defaultValue) ? defaultValue() : defaultValue,
            errors: false,
          }
        }

        return {
          data: undefined,
          errors: value,
        }
      })
    },
    _kind_: `${schema._kind_}_nullish_default`,
  }
}

export function rc_record<V>(
  valueType: RcType<V>,
  {
    checkKey,
    looseCheck,
  }: { checkKey?: (key: string) => boolean; looseCheck?: boolean } = {},
): RcType<Record<string, V>> {
  return {
    ...defaultProps,
    _kind_: `record<string, ${valueType._kind_}>`,
    _parse_(inputObj, ctx) {
      return parse<Record<string, V>>(this, inputObj, ctx, () => {
        if (!isObject(inputObj)) return false

        const resultObj: Record<any, string> = {} as any
        const resultErrors: ErrorWithPath[] = []

        const parentPath = ctx.path_

        for (const [key, inputValue] of Object.entries(inputObj)) {
          const subPath = `.${key}`

          const path = `${parentPath}${subPath}`
          ctx.path_ = path

          if (checkKey && !checkKey(key)) {
            resultErrors.push(
              getWarningOrErrorWithPath(ctx, `Key '${key}' is not allowed`),
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
              resultErrors.push(subError)
            }

            if (ctx.objErrShortCircuit_) {
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
export function rc_loose_record<V>(
  valueType: RcType<V>,
  { checkKey }: { checkKey?: (key: string) => boolean } = {},
): RcType<Record<string, V>> {
  return rc_record(valueType, { checkKey, looseCheck: true })
}

function checkArrayItems(
  this: RcType<any>,
  input: any[],
  types: RcType<any> | readonly RcType<any>[],
  ctx: ParseResultCtx,
  _loose = false,
  options?: ArrayOptions<RcType<any>>,
): IsValid<any[]> {
  const useLooseMode = _loose && !ctx.noWarnings_ && !ctx.noLooseArray_
  const unique = options?.unique

  const looseErrors: ErrorWithPath[][] = []
  const arrayResult: any[] = []
  const uniqueValues = unique ? new Set<any>() : undefined

  const parentPath = ctx.path_

  const isTuple = Array.isArray(types)

  let index = -1
  for (const _item of input) {
    index++

    const type: RcType<any> = isTuple ? types[index] : types

    const subPath = `[${index}]`

    const path = `${parentPath}${subPath}`

    ctx.path_ = path

    let parseResult = type._parse_(_item, ctx)
    const [initialIsValid, initialResult] = parseResult

    ctx.path_ = path

    if (initialIsValid && uniqueValues) {
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
          ctx.path_ = `${parentPath}${subPath}.${unique}`
        }

        parseResult = [
          false,
          [
            getWarningOrErrorWithPath(
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
      if (!useLooseMode) {
        return {
          errors: result,
          data: undefined,
        }
      } else {
        looseErrors.push(result)
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

type ArrayOptions<T extends RcType<any>> = {
  unique?: RcInferType<T> extends Record<string, any>
    ? keyof RcInferType<T> | ((parsedItem: RcInferType<T>) => any)
    : boolean | ((parsedItem: RcInferType<T>) => any)
}

export function rc_array<T extends RcType<any>>(
  type: T,
  options?: ArrayOptions<T>,
): RcType<RcInferType<T>[]> {
  return {
    ...defaultProps,
    _kind_: `${type._kind_}[]`,
    _array_item_type_: type,
    _parse_(input, ctx) {
      return parse(this, input, ctx, () => {
        if (!Array.isArray(input)) return false

        if (input.length === 0) return true

        return checkArrayItems.call(this, input, type, ctx, false, options)
      })
    },
  }
}

export function rc_get_array_item_type<T>(type: RcType<T[]>): RcType<T> {
  if (!type._array_item_type_) {
    throw new Error(`Type does not have an item type`)
  }

  return type._array_item_type_
}

export function rc_disable_loose_array<T extends RcType<any>>(
  type: T,
  { nonRecursive = false }: { nonRecursive?: boolean } = {},
): T {
  if (nonRecursive) {
    if (!type._kind_.endsWith('[]')) {
      throw new Error(
        `rc_disable_loose_array: nonRecursive option can only be used with array types`,
      )
    }

    return {
      ...type,
      _parse_(input, ctx) {
        return parse(this, input, ctx, () => {
          if (!Array.isArray(input)) return false

          if (input.length === 0) return true

          return checkArrayItems.call(this, input, type, ctx, false)
        })
      },
    }
  }

  return {
    ...type,
    _parse_(input, ctx) {
      const parentDisableLooseArray = ctx.noLooseArray_

      ctx.noLooseArray_ = true
      const result = type._parse_(input, ctx)
      ctx.noLooseArray_ = parentDisableLooseArray

      return result
    },
  }
}

/** instead of returning a general error, rejects invalid array items and returns warnings for these items */
export function rc_loose_array<T extends RcType<any>>(
  type: T,
  options?: ArrayOptions<T>,
): RcType<RcInferType<T>[]> {
  return {
    ...defaultProps,
    _array_item_type_: type,
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

type ParseOptions = {
  /** ignore fallback and autofix */
  noWarnings?: boolean
}

/**
 * Parse a runcheck type. If valid return the valid input, with warning for autofix
 * and fallback, or the errors if invalid
 */
export function rc_parse<S>(
  input: any,
  type: RcType<S>,
  { noWarnings = false }: ParseOptions = {},
): RcParseResult<S> {
  const ctx: ParseResultCtx = {
    warnings_: [],
    path_: '',
    objErrShortCircuit_: false,
    objErrKeyIndex_: 0,
    noWarnings_: noWarnings,
    strictObj_: false,
    noLooseArray_: false,
  }

  const [success, dataOrError] = type._parse_(input, ctx)

  if (success) {
    return {
      error: false,
      ok: true,
      data: dataOrError,
      warnings: ctx.warnings_.length > 0 ? ctx.warnings_ : false,
    }
  }

  return {
    ok: false,
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
  options?: ParseOptions,
): { data: S | null; errors: string[] | false; warnings: string[] | false } {
  const result = rc_parse(input, type, options)

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
    warnings_: [],
    path_: '',
    objErrShortCircuit_: false,
    objErrKeyIndex_: 0,
    noWarnings_: false,
    strictObj_: false,
    noLooseArray_: false,
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

type TransformOptions<T> = {
  /** if the input type is invalid, the transform will be ignored and this schema will be used to validate the input */
  outputSchema?: RcType<T>
  disableStrictOutputSchema?: boolean
}

function validateTransformOutput<T>(
  ctx: ParseResultCtx,
  outputSchema: RcType<T>,
  input: any,
  disableStrictOutputSchema: boolean | undefined,
): InternalParseResult<T> {
  const parentPath = ctx.path_
  const parentObjErrShortCircuit = ctx.objErrShortCircuit_
  const parentStrictObj = ctx.strictObj_
  const parentNoWarnings = ctx.noWarnings_

  ctx.objErrShortCircuit_ = true
  ctx.path_ = `${parentPath}|output|`

  if (!disableStrictOutputSchema) {
    ctx.strictObj_ = true
    ctx.noWarnings_ = true
  }

  const result = outputSchema._parse_(input, ctx)

  ctx.strictObj_ = parentStrictObj
  ctx.noWarnings_ = parentNoWarnings
  ctx.path_ = parentPath
  ctx.objErrShortCircuit_ = parentObjErrShortCircuit

  return result
}

/** validate a input or subset of input and transform the valid result */
export function rc_transform<Input, Transformed>(
  type: RcType<Input>,
  transform: (input: Input, inputSchema: RcType<Input>) => Transformed,
  {
    outputSchema,
    disableStrictOutputSchema,
  }: TransformOptions<Transformed> = {},
): RcType<Transformed> {
  return {
    ...defaultProps,
    _kind_: `transform_from_${type._kind_}`,
    _parse_(input, ctx) {
      let outputResultErrors: ErrorWithPath[] | null = null

      if (outputSchema) {
        const [outputSuccess, dataOrError] = validateTransformOutput(
          ctx,
          outputSchema,
          input,
          disableStrictOutputSchema,
        )

        if (outputSuccess) {
          return [true, dataOrError]
        } else {
          outputResultErrors = dataOrError
        }
      }

      const [success, dataOrError] = type._parse_(input, ctx)

      if (success) {
        return [true, transform(dataOrError, type)]
      } else {
        return [false, [...(outputResultErrors || []), ...dataOrError]]
      }
    },
  }
}

export function rc_unsafe_transform<Input, Transformed>(
  type: RcType<Input>,
  transform: (
    input: Input,
    inputSchema: RcType<Input>,
  ) =>
    | { ok: true; data: Transformed }
    | { ok: false; errors: string | string[] },
  {
    outputSchema,
    disableStrictOutputSchema,
  }: TransformOptions<Transformed> = {},
): RcType<Transformed> {
  return {
    ...defaultProps,
    _kind_: `transform_from_${type._kind_}`,
    _parse_(input, ctx) {
      let outputResultErrors: ErrorWithPath[] | null = null

      if (outputSchema) {
        const [outputSuccess, dataOrError] = validateTransformOutput(
          ctx,
          outputSchema,
          input,
          disableStrictOutputSchema,
        )

        if (outputSuccess) {
          return [true, dataOrError]
        } else {
          outputResultErrors = dataOrError
        }
      }

      const [success, dataOrError] = type._parse_(input, ctx)

      if (success) {
        const transformResult = transform(dataOrError, type)

        if (transformResult.ok) {
          return [true, transformResult.data]
        } else {
          return [
            false,
            typeof transformResult.errors === 'string'
              ? [getWarningOrErrorWithPath(ctx, transformResult.errors)]
              : transformResult.errors.map((error) =>
                  getWarningOrErrorWithPath(ctx, error),
                ),
          ]
        }
      }

      return [false, [...(outputResultErrors || []), ...dataOrError]]
    },
  }
}

function normalizedTypeOf(input: unknown, showValueInError: boolean): string {
  const typeOf = typeof input

  const type = ((): string => {
    if (typeOf === 'object') {
      if (Array.isArray(input)) {
        return 'array'
      }

      if (!input) {
        return 'null'
      }
    }

    return typeOf
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
): asserts result is {
  ok: true
  error: false
  data: S
  warnings: string[] | false
} {
  if (result.error) {
    throw new Error(`invalid input: ${result.errors.join(', ')}`)
  }
}

export function isObject(value: any): value is NonArrayObject {
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
  jsonString: unknown,
  schema: RcType<T>,
  options?: ParseOptions,
): RcParseResult<T> {
  try {
    if (typeof jsonString !== 'string') {
      return {
        ok: false,
        error: true,
        errors: [
          `expected a json string, got ${normalizedTypeOf(jsonString, true)}`,
        ],
      }
    }

    const parsed = JSON.parse(jsonString)

    return rc_parse(parsed, schema, options)
  } catch (err) {
    return {
      ok: false,
      error: true,
      errors: [`json parsing error: ${isObject(err) ? err.message : ''}`],
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
