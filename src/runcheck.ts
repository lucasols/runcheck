export type RcParseResult<T> =
  | {
      error: false
      data: T
      warningMsgs: string[] | false
    }
  | {
      error: true
      errors: string[]
    }

type TypeOfRcType<T extends RcType<any>> = T extends RcType<infer U> ? U : never

type RcOptional<T> = RcType<T | undefined>

type ParseResultCtx = {
  warnings: string[]
}

type InternalParseResult<T> =
  | [success: true, data: T]
  | [success: false, errors: string[]]

export type RcType<T> = {
  readonly withFallback: (fallback: T) => RcType<T>
  readonly where: (predicate: (input: T) => boolean) => RcType<T>
  readonly optional: () => RcOptional<T>
  readonly orNullish: () => RcType<T | null | undefined>
  readonly withAutofix: (
    customAutofix?: (input: unknown) => false | { fixed: T },
  ) => RcType<T>

  readonly _parse: (
    input: unknown,
    ctx: ParseResultCtx,
  ) => InternalParseResult<T>
  readonly _kind: string
  readonly _getErrorMsg: (input: unknown) => string
  readonly _fallback?: T
  readonly _predicate?: (input: T) => boolean
  readonly _optional?: true
  readonly _orNullish?: true
  readonly _useAutFix?: true
  readonly _autoFix?: (input: unknown) => false | { fixed: T }
}

function withFallback(this: RcType<any>, fallback: any): RcType<any> {
  return { ...this, _fallback: fallback }
}

function parseWithFallback<T>(
  type: RcType<T>,
  input: unknown,
  ctx: ParseResultCtx,
  checkIfIsValid: () => boolean | { data: T } | { errors: string[] },
): InternalParseResult<T> {
  if (type._optional) {
    if (input === undefined) {
      return [true, input as T]
    }
  }

  if (type._orNullish) {
    if (input === null || input === undefined) {
      return [true, input as T]
    }
  }

  const isValid = checkIfIsValid()

  if (isValid) {
    if (isValid === true || 'data' in isValid) {
      const validResult = isValid === true ? (input as T) : isValid.data

      if (type._predicate) {
        if (!type._predicate(validResult)) {
          return [false, [type._getErrorMsg(validResult)]]
        }
      }

      return [true, validResult]
    }
  }

  if (type._fallback !== undefined) {
    ctx.warnings.push(`Fallback used, ${type._getErrorMsg(input)}`)

    return [true, type._fallback]
  }

  if (type._useAutFix && type._autoFix) {
    const autofixed = type._autoFix(input)

    if (autofixed) {
      if (type._predicate) {
        if (!type._predicate(autofixed.fixed)) {
          return [false, [type._getErrorMsg(autofixed.fixed)]]
        }
      }

      return [true, autofixed.fixed]
    }
  }

  return [
    false,
    isValid && 'errors' in isValid
      ? isValid.errors
      : [type._getErrorMsg(input)],
  ]
}

function withAutofix(
  this: RcType<any>,
  customAutofix?: (input: unknown) => any,
): RcType<any> {
  if (!this._autoFix && !customAutofix) {
    throw new Error(
      "This type don't have a default autofix and no custom one was provided",
    )
  }

  return {
    ...this,
    _useAutFix: true,
    _autoFix: customAutofix || this._autoFix,
  }
}

function where(
  this: RcType<any>,
  predicate: (input: any) => boolean,
): RcType<any> {
  return {
    ...this,
    _predicate: predicate,
    _kind: `${this._kind}_with_predicate`,
  }
}

function optional(this: RcType<any>): RcOptional<any> {
  return {
    ...this,
    _optional: true,
  }
}

function _getErrorMsg(this: RcType<any>, input: unknown): string {
  return `Type '${normalizedTypeOf(input)}' is not assignable to '${
    this._kind
  }'`
}

function orNullish(this: RcType<any>): RcType<any | null | undefined> {
  return {
    ...this,
    _orNullish: true,
    _kind: `${this._kind}_or_nullish`,
  }
}

const defaultProps = {
  withFallback,
  where,
  optional,
  _getErrorMsg,
  orNullish,
  withAutofix,
}

export const rc_undefined: RcType<undefined> = {
  ...defaultProps,
  _parse(input, ctx) {
    return parseWithFallback(this, input, ctx, () => input === undefined)
  },
  _kind: 'undefined',
}

export const rc_null: RcType<null> = {
  ...defaultProps,
  _parse(input, ctx) {
    return parseWithFallback(this, input, ctx, () => input === null)
  },
  _kind: 'null',
}

export const rc_any: RcType<any> = {
  ...defaultProps,
  _parse(input, ctx) {
    return parseWithFallback(this, input, ctx, () => true)
  },
  _kind: 'any',
}

export const rc_boolean: RcType<boolean> = {
  ...defaultProps,
  _parse(input, ctx) {
    return parseWithFallback(this, input, ctx, () => typeof input === 'boolean')
  },
  _kind: 'boolean',
  _autoFix(input) {
    if (input === 0 || input === 1) {
      return { fixed: !!input }
    }

    if (input === 'true' || input === 'false') {
      return { fixed: input === 'true' }
    }

    return false
  },
}

export const rc_string: RcType<string> = {
  ...defaultProps,
  _parse(input, ctx) {
    return parseWithFallback(this, input, ctx, () => typeof input === 'string')
  },
  _kind: 'string',
  _autoFix(input) {
    if (typeof input === 'number' && !Number.isNaN(input)) {
      return { fixed: input.toString() }
    }

    return false
  },
}

export const rc_number: RcType<number> = {
  ...defaultProps,
  _parse(input, ctx) {
    return parseWithFallback(
      this,
      input,
      ctx,
      () => typeof input === 'number' && !Number.isNaN(input),
    )
  },
  _kind: 'number',
  _autoFix(input) {
    if (typeof input === 'string') {
      const parsed = Number(input)

      if (!Number.isNaN(parsed)) {
        return { fixed: parsed }
      }
    }

    return false
  },
}

export const rc_date: RcType<Date> = {
  ...defaultProps,
  _parse(input, ctx) {
    return parseWithFallback(this, input, ctx, () => {
      return (
        typeof input === 'object' &&
        input instanceof Date &&
        !Number.isNaN(input.getTime())
      )
    })
  },
  _kind: 'date',
}

// eslint-disable-next-line @typescript-eslint/ban-types
export function rc_instanceof<T extends Function>(classToCheck: T): RcType<T> {
  return {
    ...defaultProps,
    _parse(input, ctx) {
      return parseWithFallback(this, input, ctx, () => {
        return input instanceof classToCheck
      })
    },
    _kind: `instanceof_${classToCheck.name ? `_${classToCheck.name}` : ''}`,
  }
}

export function rc_literals<T extends string | number | boolean>(
  ...literals: T[]
): RcType<T> {
  if (literals.length === 0) {
    throw new Error('rc_literal requires at least one literal')
  }

  return {
    ...defaultProps,
    _parse(input, ctx) {
      return parseWithFallback(this, input, ctx, () => {
        for (const literal of literals) {
          if (input === literal) {
            return true
          }
        }

        return false
      })
    },
    _kind:
      literals.length == 1
        ? `${normalizedTypeOf(literals[0])}_literal`
        : 'literals',
  }
}

export function rc_union<T extends RcType<any>[]>(
  ...types: T
): RcType<TypeOfRcType<T[number]>> {
  if (types.length === 0) {
    throw new Error('Unions should have at least one type')
  }

  return {
    ...defaultProps,
    _parse(input, ctx) {
      return parseWithFallback(this, input, ctx, () => {
        for (const type of types) {
          if (type._parse(input, ctx)[0]) {
            return true
          }
        }

        return false
      })
    },
    _kind: types.map((type) => type._kind).join(' | '),
  }
}

function normalizeSubError(error: string, currentPath: string): string {
  if (error.startsWith('$[') || error.startsWith('$.')) {
    const [keyPart = '', errorPart] = error.split(': ')

    const subKey = keyPart.slice(1)

    return `$${currentPath}${subKey}: ${errorPart}`
  }

  return `$${currentPath}: ${error}`
}

type RcObject = Record<string, RcType<any>>

type TypeOfObjectType<T extends RcObject> = {
  [K in keyof T]: TypeOfRcType<T[K]>
}

export function rc_object<T extends RcObject>(
  shape: T,
): RcType<TypeOfObjectType<T>> {
  return {
    ...defaultProps,
    _kind: 'object',
    _parse(inputObj, ctx) {
      return parseWithFallback<TypeOfObjectType<T>>(this, inputObj, ctx, () => {
        if (!isObject(inputObj)) return false

        const excessKeys = new Set<string>(Object.keys(inputObj))

        const resultObj: Record<any, string> = {} as any
        const resultErrors: string[] = []

        for (const [key, type] of Object.entries(shape)) {
          const typekey = key as keyof T

          const input = inputObj[key]

          excessKeys.delete(key)

          const [isValid, result] = type._parse(input, ctx)

          if (isValid) {
            resultObj[typekey] = input
          }
          //
          else {
            const errors = result

            for (const subError of errors) {
              resultErrors.push(normalizeSubError(subError, `.${key}`))
            }
          }
        }

        if (this._kind === 'strict_obj') {
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

        if (this._kind.startsWith('extends_object')) {
          return { data: inputObj as any }
        }

        return { data: resultObj as any }
      })
    },
  }
}

export function rc_extends_obj<T extends RcObject>(
  shape: T,
): RcType<TypeOfObjectType<T>> {
  return {
    ...rc_object(shape),
    _kind: `extends_object`,
  }
}

export function rc_strict_obj<T extends RcObject>(
  shape: T,
): RcType<TypeOfObjectType<T>> {
  return {
    ...rc_object(shape),
    _kind: `strict_obj`,
  }
}

function checkArrayItems(
  this: RcType<any>,
  input: any[],
  types: RcType<any> | readonly RcType<any>[],
  ctx: ParseResultCtx,
): { errors: string[] } | true {
  let index = -1
  for (const item of input) {
    index++

    const type: RcType<any> = Array.isArray(types) ? types[index] : types

    const [isValid, result] = type._parse(item, ctx)

    if (!isValid) {
      return {
        errors: result.map((error) => normalizeSubError(error, `[${index}]`)),
      }
    }
  }

  return true
}

export function rc_array<T extends RcType<any>>(
  type: T,
): RcType<TypeOfRcType<T>[]> {
  return {
    ...defaultProps,
    _kind: `${type._kind}[]`,
    _parse(input, ctx) {
      return parseWithFallback(this, input, ctx, () => {
        if (!Array.isArray(input)) return false

        if (input.length === 0) return true

        return checkArrayItems.call(this, input, type, ctx)
      })
    },
  }
}

type MapTupleToTypes<T extends readonly [...any[]]> = {
  -readonly [K in keyof T]: TypeOfRcType<T[K]>
}

export function rc_tuple<T extends readonly RcType<any>[]>(
  types: T,
): RcType<MapTupleToTypes<T>> {
  return {
    ...defaultProps,
    _kind: `[${types.map((type) => type._kind).join(', ')}]`,
    _parse(input, ctx) {
      return parseWithFallback(this, input, ctx, () => {
        if (!Array.isArray(input)) return false

        if (input.length !== types.length) return false

        return checkArrayItems.call(this, input, types, ctx)
      })
    },
  }
}

export function rc_parse<S>(input: any, type: RcType<S>): RcParseResult<S> {
  const ctx: ParseResultCtx = {
    warnings: [],
  }

  const [success, dataOrError] = type._parse(input, ctx)

  if (success) {
    return {
      error: false,
      data: dataOrError,
      warningMsgs: ctx.warnings.length > 0 ? ctx.warnings : false,
    }
  }

  return {
    error: true,
    errors: dataOrError,
  }
}

export function rc_parser<S>(type: RcType<S>) {
  return (input: any) => rc_parse(input, type)
}

export function rc_is_valid<S>(input: any, type: RcType<S>): input is S {
  const ctx: ParseResultCtx = {
    warnings: [],
  }

  return !!type._parse(input, ctx)[0]
}

export function rc_validator<S>(type: RcType<S>) {
  return (input: any): input is S => rc_is_valid(input, type)
}

function normalizedTypeOf(input: unknown): string {
  if (typeof input === 'object') {
    if (Array.isArray(input)) {
      return 'array'
    }

    if (!input) {
      return 'null'
    }
  }

  return typeof input
}

type NonArrayObject = {
  [x: string]: any
  [y: number]: never
}

export function isObject(value: any): value is NonArrayObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
