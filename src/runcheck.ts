export {
  rc_discriminated_union,
  rc_discriminated_union_builder,
} from './rc_discriminated_union'
export { rc_intersection } from './rc_intersection'
export {
  rc_enable_obj_strict,
  rc_get_from_key_as_fallback,
  rc_get_obj_shape,
  rc_obj_builder,
  rc_obj_extends,
  rc_obj_merge,
  rc_obj_omit,
  rc_obj_pick,
  rc_obj_strict,
  rc_object,
} from './rc_object'
import { StandardSchemaV1 } from '@standard-schema/spec'

export type RcParseResult<T> =
  | {
      /** @deprecated use errors instead */
      error: false
      errors: false
      ok: true
      /** @deprecated use value instead */
      data: T
      value: T
      warnings: string[] | false
    }
  | {
      ok: false
      /** @deprecated use errors instead */
      error: true
      errors: string[]
    }

export type RcInferType<T extends RcType<any>> =
  T extends RcType<infer U> ? U : never

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
  | { ok: true; data: T; errors: undefined }
  | { ok: false; errors: ErrorWithPath[]; data: undefined }

type WithFallback<T> = (fallback: T | (() => T)) => RcType<T>

export type RcOptionalKeyType<T> = RcBase<T, true>

export type RcType<T> = RcBase<T, false>

type Schema<T> = (t: T) => T

export type RcBase<T, RequiredKey extends boolean> = {
  __rc_type: Schema<T>
  readonly withFallback: WithFallback<T>
  readonly where: (
    predicate: (input: T) => boolean | { error: string },
  ) => RcType<T>
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
  readonly default: <D extends NotUndefined<T>>(
    defaultValue: D | (() => D),
  ) => RcType<NotUndefined<T> | D>
  readonly nullishDefault: <D extends NotNullish<T>>(
    defaultValue: D | (() => D),
  ) => RcType<NotNullish<T> | D>

  readonly or: <O>(schema: RcType<O>) => RcType<T | O>
  readonly parse: (input: unknown, options?: ParseOptions) => RcParseResult<T>

  // This should not be stripped out because it is used in type inference
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
  readonly _array_item_type_: RcType<any> | undefined
  /** @internal */
  readonly _show_value_in_error_: boolean
  /** @internal */
  readonly _alternative_key_: string | undefined
  /** @internal */
  _detailed_obj_shape_: string | undefined
  /** @internal */
  readonly _obj_shape_: Record<string, RcType<any>> | undefined
  /** @internal */
  readonly _autoFix_: ((input: unknown) => false | { fixed: T }) | undefined
}

const getUndefined = () => undefined

function withFallback(this: RcType<any>, fallback: any): RcType<any> {
  return {
    ...this,
    _fallback_: fallback === undefined ? getUndefined : fallback,
  }
}

function defaultMethod<T>(
  this: RcType<T>,
  defaultValue: NotUndefined<T> | (() => NotUndefined<T>),
): RcType<NotUndefined<T>> {
  return rc_default(this, defaultValue)
}

function nullishDefaultMethod<T>(
  this: RcType<T>,
  defaultValue: NotNullish<T> | (() => NotNullish<T>),
): RcType<NotNullish<T>> {
  return rc_nullish_default(this, defaultValue)
}

function orMethod<T, O>(this: RcType<T>, schema: RcType<O>): RcType<T | O> {
  return rc_union(this, schema)
}

function parseMethod<T>(
  this: RcType<T>,
  input: unknown,
  options: ParseOptions,
): RcParseResult<T> {
  return rc_parse(input, this, options)
}

/** @internal */
export type ErrorWithPath = string & { __withPath: true }
type ErrorWithoutPath = string & { __withPath?: never }

export function getWarningOrErrorWithPath(
  ctx: { path_: string },
  message: ErrorWithoutPath,
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
      return { ok: true, data: input as T, errors: undefined }
    }
  }

  if (type._orNullish_) {
    if (input === null || input === undefined) {
      return { ok: true, data: input as T, errors: undefined }
    }
  }

  if (type._orNull_) {
    if (input === null) {
      return { ok: true, data: input as T, errors: undefined }
    }
  }

  const isValid = checkIfIsValid()

  if (isValid) {
    if (isValid === true || !isValid.errors) {
      const validResult = isValid === true ? (input as T) : isValid.data

      return { ok: true, data: validResult, errors: undefined }
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

      return { ok: true, data: isFn(fb) ? fb() : fb, errors: undefined }
    }

    if (type._useAutFix_ && type._autoFix_) {
      const autofixed = type._autoFix_(input)

      if (autofixed) {
        addWarning(
          ctx,
          `Autofixed from error "${getResultErrors(
            isValid,
            ctx,
            type,
            input,
          )}"`,
        )

        return { ok: true, data: autofixed.fixed, errors: undefined }
      }
    }
  }

  return {
    ok: false,
    data: undefined,
    errors:
      isValid ?
        isValid.errors
      : [getWarningOrErrorWithPath(ctx, getErrorMsg(type, input))],
  }
}

function getResultErrors(
  isValid: false | { errors: string[] },
  ctx: ParseResultCtx,
  type: RcType<any>,
  input: unknown,
) {
  return isValid ?
      isValid.errors.map((err) => err.replace(ctx.path_, '')).join('; ')
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
  predicate: (input: any) => boolean | { error: string },
): RcType<any> {
  return {
    ...this,
    _parse_: (input, ctx) => {
      return parse(this, input, ctx, () => {
        const result = this._parse_(input, ctx)

        if (!result.ok) {
          return {
            errors: result.errors,
            data: undefined,
          }
        }

        const predicateResult = predicate(result.data)

        if (predicateResult !== true) {
          return {
            errors: [
              getWarningOrErrorWithPath(
                ctx,
                `Predicate failed${
                  predicateResult === false ?
                    ` for type '${this._kind_}'`
                  : `: ${predicateResult.error}`
                }`,
              ),
            ],
            data: undefined,
          }
        }

        return { errors: false, data: result.data }
      })
    },
  }
}

function optional(this: RcType<any>): RcType<any> {
  return {
    ...this,
    _optional_: true,
    _kind_: `undefined | ${this._kind_}`,
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
    _kind_: `null | ${this._kind_}`,
  }
}

function orNullish(this: RcType<any>): RcType<any> {
  return {
    ...this,
    _orNullish_: true,
    _kind_: `null | undefined | ${this._kind_}`,
  }
}

export const defaultProps: Omit<RcType<any>, '_parse_' | '_kind_'> = {
  __rc_type: undefined as any,
  withFallback,
  where,
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment -- perf improvement to avoid polymorphic deoptimizations
  // @ts-ignore
  _parse_: undefined as any,
  _kind_: undefined as any,
  optional,
  optionalKey: optional as any,
  orNullish,
  withAutofix,
  orNull,
  default: defaultMethod as any,
  nullishDefault: nullishDefaultMethod as any,
  or: orMethod as any,
  parse: parseMethod as any,
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
  _detailed_obj_shape_: undefined,
  _is_object_: false,
  _is_extend_obj_: false,
}

export const rc_undefined: RcType<undefined> = {
  ...(defaultProps as Omit<RcType<undefined>, '_parse_' | '_kind_'>),
  _parse_(input, ctx) {
    return parse(this, input, ctx, () => input === undefined)
  },
  _kind_: 'undefined',
}

export const rc_null: RcType<null> = {
  ...(defaultProps as Omit<RcType<null>, '_parse_' | '_kind_'>),
  _parse_(input, ctx) {
    return parse(this, input, ctx, () => input === null)
  },
  _kind_: 'null',
}

export const rc_any: RcType<any> = {
  ...defaultProps,
  _parse_(input) {
    return { ok: true, data: input, errors: undefined }
  },
  _kind_: 'any',
}

export const rc_unknown: RcType<unknown> = {
  ...defaultProps,
  _parse_(input) {
    return { ok: true, data: input, errors: undefined }
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

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
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
      literals.length == 1 ?
        normalizedTypeOf(literals[0], true)
      : literals.map((literal) => normalizedTypeOf(literal, true)).join(' | '),
  }
}

const maxShallowObjErrors = 1

export function rc_union<T extends RcType<any>[]>(
  ...types: T
): RcType<RcInferType<T[number]>> {
  if (types.length === 0) {
    throw new Error('Unions should have at least one type')
  }

  let kind = ''
  let allIsObject = false

  for (const type of types) {
    if (kind) {
      kind += ' | '
    }

    kind += type._kind_

    if (!allIsObject && type._is_object_) {
      allIsObject = true
    }
  }

  return {
    ...defaultProps,
    _kind_: kind,
    _is_object_: allIsObject,
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

          const parseResult = type._parse_(input, ctx)

          const objErrIndex = ctx.objErrKeyIndex_

          ctx.objErrShortCircuit_ = currentObjErrShortCircuit
          ctx.objErrKeyIndex_ = 0

          if (parseResult.ok) {
            return { data: parseResult.data, errors: false }
          } else if (type._is_object_ && objErrIndex !== -1) {
            if (objErrIndex > 0) {
              nonShallowObjErrors.push(...parseResult.errors)
            } else {
              if (shallowObjErrorsCount < maxShallowObjErrors) {
                shallowObjErrors.push(...parseResult.errors)
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
  }
}

type NotUndefined<T> = Exclude<T, undefined>

/** Generate a schema with valid fallback value for undefined inputs */
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
        if (input === undefined) {
          return getDefaultResult()
        }

        const parseResult = schema._parse_(input, ctx)

        if (parseResult.ok) {
          if (parseResult.data === undefined) {
            return getDefaultResult()
          }

          return { data: parseResult.data as NotUndefined<T>, errors: false }
        } else {
          return { data: undefined, errors: parseResult.errors }
        }
      })
    },
    _kind_: `${schema._kind_}_default`,
  }

  function getDefaultResult(): IsValid<NotUndefined<T>> {
    return {
      data: isFn(defaultValue) ? defaultValue() : defaultValue,
      errors: false,
    }
  }
}

type NotNullish<T> = Exclude<T, null | undefined>

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
        if (input === null || input === undefined) {
          return getDefaultResult()
        }

        const parseResult = schema._parse_(input, ctx)

        if (parseResult.ok) {
          if (parseResult.data === null || parseResult.data === undefined) {
            return getDefaultResult()
          }

          return { data: parseResult.data as NotNullish<T>, errors: false }
        } else {
          return { data: undefined, errors: parseResult.errors }
        }
      })
    },
    _kind_: `${schema._kind_}_nullish_default`,
  }

  function getDefaultResult(): IsValid<NotNullish<T>> {
    return {
      data: isFn(defaultValue) ? defaultValue() : defaultValue,
      errors: false,
    }
  }
}

/** returns a fallback in case of wrong inputs without adding a warning */
export function rc_safe_fallback<T>(
  schema: RcType<T>,
  fallback: NoInfer<T> | (() => NoInfer<T>),
): RcType<T> {
  return {
    ...(schema as unknown as RcType<T>),
    _parse_(input, ctx) {
      return parse(this, input, ctx, () => {
        const parseResult = schema._parse_(input, ctx)

        if (parseResult.ok) {
          return { data: parseResult.data, errors: false }
        }

        return { data: isFn(fallback) ? fallback() : fallback, errors: false }
      })
    },
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
    _is_object_: true,
    _parse_(inputObj, ctx) {
      return parse<Record<string, V>>(this, inputObj, ctx, () => {
        if (!isObject(inputObj)) return false

        const resultObj: Record<any, string> = {} as any
        const resultErrors: ErrorWithPath[] = []

        const parentPath = ctx.path_

        for (const [key, inputValue] of Object.entries(inputObj)) {
          const subPath =
            key === '' || key.includes(' ') ? `['${key}']` : `.${key}`

          const path = `${parentPath}${subPath}`
          ctx.path_ = path

          if (checkKey && !checkKey(key)) {
            resultErrors.push(
              getWarningOrErrorWithPath(ctx, `Key '${key}' is not allowed`),
            )
            continue
          }

          const input = inputObj[key]

          const parseResult = valueType._parse_(inputValue, ctx)

          if (parseResult.ok) {
            resultObj[key] = input
          }
          //
          else {
            const errors = parseResult.errors

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

        ctx.path_ = parentPath

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

  const looseErrors: [err: ErrorWithPath[], path: string][] = []
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

    if (options?.filter) {
      const filterResult = options.filter(_item)

      if (typeof filterResult === 'boolean') {
        if (!filterResult) {
          continue
        }
      } else if ('errors' in filterResult) {
        if (!useLooseMode) {
          return { errors: filterResult.errors, data: undefined }
        } else {
          looseErrors.push([filterResult.errors, path])
          continue
        }
      }

      ctx.path_ = path
    }

    let parseResult = type._parse_(_item, ctx)

    ctx.path_ = path

    if (parseResult.ok && uniqueValues) {
      let uniqueValueToCheck = parseResult.data

      const isUniqueKey = typeof unique === 'string'

      if (isUniqueKey) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        uniqueValueToCheck = parseResult.data[unique]
      } else if (typeof unique === 'function') {
        uniqueValueToCheck = unique(parseResult.data)
      }

      if (uniqueValues.has(uniqueValueToCheck)) {
        if (isUniqueKey) {
          ctx.path_ = `${parentPath}${subPath}.${unique}`
        }

        parseResult = {
          ok: false,
          data: undefined,
          errors: [
            getWarningOrErrorWithPath(
              ctx,
              isUniqueKey ?
                `Type '${type._obj_shape_?.[unique]?._kind_}' with value "${uniqueValueToCheck}" is not unique`
              : typeof unique === 'function' ?
                `Type '${type._kind_}' unique fn return with value "${uniqueValueToCheck}" is not unique`
              : `${type._kind_} value is not unique`,
            ),
          ],
        }
      } else {
        uniqueValues.add(uniqueValueToCheck)
      }
    }

    if (!parseResult.ok) {
      if (!useLooseMode) {
        return {
          errors: parseResult.errors,
          data: undefined,
        }
      } else {
        looseErrors.push([parseResult.errors, path])
        continue
      }
    } else {
      arrayResult.push(parseResult.data)
    }
  }

  if (looseErrors.length > 0) {
    const adjustedLooseErrors: ErrorWithPath[] = []

    for (const [errors, path] of looseErrors) {
      for (const err of errors) {
        let itemError = err.slice(path.length + 1)

        if (itemError.startsWith(': ')) {
          itemError = itemError.slice(2)
        }

        if (itemError.startsWith('.') || itemError.startsWith('[')) {
          itemError = `#${itemError}`
        }

        const newError = `$${path}: Rejected, error -> ${itemError}`

        adjustedLooseErrors.push(newError as ErrorWithPath)
      }

      addWarnings(ctx, adjustedLooseErrors)
    }
  }

  return { errors: false, data: arrayResult }
}

type ArrayOptions<T extends RcType<any>> = {
  unique?: RcInferType<T> extends Record<string, any> ?
    keyof RcInferType<T> | ((parsedItem: RcInferType<T>) => any)
  : boolean | ((parsedItem: RcInferType<T>) => any)
  filter?: (item: RcInferType<T>) => boolean | { errors: ErrorWithPath[] }
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

export function rc_array_filter_from_schema<B, T>(
  filterSchema: RcType<B>,
  filterFn: (item: B) => boolean,
  type: RcType<T>,
  options?: Omit<ArrayOptions<RcType<any>>, 'filter'> & {
    loose?: boolean
  },
): RcType<T[]> {
  return {
    ...defaultProps,
    _array_item_type_: type,
    _kind_: `${type._kind_}[]`,
    _parse_(input, ctx) {
      return parse(this, input, ctx, () => {
        if (!Array.isArray(input)) return false

        if (input.length === 0) return true

        return checkArrayItems.call(this, input, type, ctx, options?.loose, {
          ...options,
          filter(item) {
            const filterResult = filterSchema._parse_(item, ctx)

            if (!filterResult.ok) {
              return { errors: filterResult.errors }
            }

            return filterFn(filterResult.data)
          },
        })
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
export function rc_tuple<const T extends readonly RcType<any>[]>(
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

  const parseResult = type._parse_(input, ctx)

  if (parseResult.ok) {
    return {
      error: false,
      errors: false,
      ok: true,
      data: parseResult.data,
      value: parseResult.data,
      warnings: ctx.warnings_.length > 0 ? ctx.warnings_ : false,
    }
  }

  return {
    ok: false,
    error: true,
    errors: parseResult.errors,
  }
}

export type RcParser<T> = (input: any) => RcParseResult<T>

/** create a reusable parser for a certain type */
export function rc_parser<S>(type: RcType<S>): RcParser<S> {
  return (input: any) => rc_parse(input, type)
}

/** @deprecated use rc_unwrap_or_null instead */
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

  return { data: result.value, errors: false, warnings: result.warnings }
}

export function rc_unwrap_or_null<R>(result: RcParseResult<R>): {
  value: R | null
  errors: string[] | false
  warnings: string[] | false
} {
  return rc_unwrap_or(result, null)
}

export function rc_unwrap_or<R, F = NoInfer<R>>(
  result: RcParseResult<R>,
  fallback: F,
): {
  value: R | F
  errors: string[] | false
  warnings: string[] | false
} {
  if (result.error) {
    return {
      value: fallback,
      errors: result.errors,
      warnings: false,
    }
  }

  return { value: result.value, errors: false, warnings: result.warnings }
}

export class RcValidationError extends Error {
  constructor(public readonly errors: string[]) {
    super(errors.join('\n'))
  }
}

export function rc_unwrap<R>(result: RcParseResult<R>): {
  value: R
  warnings: string[] | false
} {
  if (result.error) {
    throw new RcValidationError(result.errors)
  }

  return result
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

  return type._parse_(input, ctx).ok
}

export function rc_validator<S>(type: RcType<S>) {
  return (input: any): input is S => rc_is_valid(input, type)
}

export function rc_recursive<T extends RcBase<any, any>>(type: () => T): T {
  let recursiveType: { -readonly [K in keyof T]: T[K] } | undefined = undefined

  return {
    ...defaultProps,
    _kind_: 'recursive',
    _parse_(input, ctx) {
      if (!recursiveType) {
        recursiveType = {
          ...type(),
        }

        if (this._optional_) {
          recursiveType._optional_ = this._optional_
        }

        if (this._orNullish_) {
          recursiveType._orNullish_ = this._orNullish_
        }

        if (this._orNull_) {
          recursiveType._orNull_ = this._orNull_
        }

        if (this._autoFix_) {
          recursiveType._autoFix_ = this._autoFix_
        }

        if (this._fallback_) {
          recursiveType._fallback_ = this._fallback_
        }

        if (this._alternative_key_) {
          recursiveType._alternative_key_ = this._alternative_key_
        }
      }

      return recursiveType._parse_(input, ctx)
    },
  } as T
}

type TransformOptions<T> = {
  /**
   * @deprecated will be removed in the next major version
   *
   * if the input type is invalid, the transform will be ignore
   * schema will be used to validate the input
   */
  outputSchema?: RcType<T>
  /** @deprecated will be removed in the next major version */
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
    _kind_: `${type._kind_}_transform`,
    _parse_(input, ctx) {
      return parse(this, input, ctx, () => {
        let outputResultErrors: ErrorWithPath[] | null = null

        if (outputSchema) {
          const parseResult = validateTransformOutput(
            ctx,
            outputSchema,
            input,
            disableStrictOutputSchema,
          )

          if (parseResult.ok) {
            return {
              data: parseResult.data,
              errors: false,
            }
          } else {
            outputResultErrors = parseResult.errors
          }
        }

        // TODO: optimize this
        const newType = {
          ...type,
          _kind_: this._kind_,
        }

        const parseResult = newType._parse_(input, ctx)

        if (parseResult.ok) {
          return {
            errors: false,
            data: transform(parseResult.data, type),
          }
        } else {
          return {
            errors: [...(outputResultErrors || []), ...parseResult.errors],
            data: undefined,
          }
        }
      })
    },
  }
}

/** Create transforms which result can be validated with the same schema */
export function rc_narrow<Input, Narrowed extends Input>(
  type: RcType<Input>,
  narrow: (input: Input, inputSchema: RcType<Input>) => Narrowed,
): RcType<Narrowed> {
  return rc_transform(type, narrow)
}

/** Allows the transform function to return a error if transformation is invalid */
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
    _kind_: `${type._kind_}_transform`,
    _parse_(input, ctx) {
      return parse(this, input, ctx, (): IsValid<Transformed> => {
        let outputResultErrors: ErrorWithPath[] | null = null

        if (outputSchema) {
          const parseResult = validateTransformOutput(
            ctx,
            outputSchema,
            input,
            disableStrictOutputSchema,
          )

          if (parseResult.ok) {
            return {
              errors: false,
              data: parseResult.data,
            }
          } else {
            outputResultErrors = parseResult.errors
          }
        }

        // TODO: optimize this
        const newType = {
          ...type,
          _kind_: this._kind_,
        }

        const parseResult = newType._parse_(input, ctx)

        if (parseResult.ok) {
          const transformResult = transform(parseResult.data, type)

          if (transformResult.ok) {
            return { errors: false, data: transformResult.data }
          } else {
            return {
              errors:
                typeof transformResult.errors === 'string' ?
                  [getWarningOrErrorWithPath(ctx, transformResult.errors)]
                : transformResult.errors.map((error) =>
                    getWarningOrErrorWithPath(ctx, error),
                  ),
              data: undefined,
            }
          }
        }

        return {
          errors: [...(outputResultErrors || []), ...parseResult.errors],
          data: undefined,
        }
      })
    },
  }
}

export function normalizedTypeOf(
  input: unknown,
  showValueInError: boolean,
): string {
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

    if (typeof input === 'number' && Number.isNaN(input)) {
      return 'NaN'
    }

    return typeOf
  })()

  return (
      showValueInError &&
        (type === 'string' || type === 'number' || type === 'boolean')
    ) ?
      `${type}(${input})`
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
  errors: false
  data: S
  value: S
  warnings: string[] | false
} {
  if (result.error) {
    throw new Error(`invalid input: ${result.errors.join(', ')}`)
  }
}

/** @internal */
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

export type Prettify<T> =
  T extends Record<string, any> ?
    {
      [K in keyof T]: Prettify<T[K]>
    }
  : T

export type RcPrettyInferType<T extends RcType<any>> = Prettify<RcInferType<T>>

export function isRcType(value: any): value is RcType<any> {
  return isObject(value) && '__rc_type' in value
}

/** workaround for the typescript limitation: https://github.com/microsoft/TypeScript/issues/52295 */
export function joinAsRcTypeUnion<T>(
  type: T,
): RcType<T extends RcType<infer U> ? U : never> {
  return type as any
}

export function getSchemaKind(schema: RcType<any>): string {
  return schema._kind_
}

export function rc_to_standard<T>(
  schemaOrResult: RcType<T> | RcParseResult<T>,
  {
    errorOnWarnings = false,
  }: {
    errorOnWarnings?: boolean
  } = {},
): StandardSchemaV1<T> {
  return {
    '~standard': {
      validate(value) {
        const result =
          'ok' in schemaOrResult ? schemaOrResult : (
            rc_parse(value, schemaOrResult)
          )

        return parseResultToStandard(result, errorOnWarnings)
      },
      vendor: 'runcheck',
      version: 1,
    },
  }
}

function parseResultToStandard<T>(
  result: RcParseResult<T>,
  errorOnWarnings: boolean,
): StandardSchemaV1.Result<T> {
  if (errorOnWarnings && result.ok && result.warnings) {
    return {
      issues: result.warnings.map((warning) => ({
        message: warning,
      })),
    }
  }

  if (result.ok) {
    return { value: result.value }
  }

  return {
    issues: result.errors.map((error) => ({
      message: error,
    })),
  }
}
