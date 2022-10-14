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
}

type InternalParseResult<T> =
  | [success: true, data: T]
  | [success: false, errors: string[]]

export type RcType<T> = {
  readonly withFallback: (fallback: T) => RcType<T>
  readonly where: (predicate: (input: T) => boolean) => RcType<T>
  readonly optional: () => RcOptional<T>
  readonly nullable: () => RcType<T | null>
  readonly nullish: () => RcType<T | null | undefined>
  readonly withAutofix: (
    customAutofix: (input: unknown) => false | { fixed: T },
  ) => RcType<T>

  /** %remove-declaration-start  */
  readonly _parse_: (
    input: unknown,
    ctx: ParseResultCtx,
  ) => InternalParseResult<T>
  readonly _kind_: string
  readonly _getErrorMsg_: (input: unknown) => string
  readonly _fallback_?: T
  readonly _predicate_?: (input: T) => boolean
  readonly _optional_?: true
  readonly _orNullish_?: true
  readonly _orNullable_?: true
  readonly _useAutFix_?: true
  readonly _obj_shape_?: Record<string, RcType<any>>
  readonly _array_shape_?: Record<string, RcType<any>>
  readonly _autoFix_?: (input: unknown) => false | { fixed: T }
  ___remove_declaration_end?: never
}

function withFallback(this: RcType<any>, fallback: any): RcType<any> {
  return { ...this, _fallback_: fallback }
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

  if (type._orNullable_) {
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
    ctx.warnings.push(`Fallback used, ${type._getErrorMsg_(input)}`)

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

      ctx.warnings.push(`Autofixed from, ${type._getErrorMsg_(input)}`)

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
  return `Type '${normalizedTypeOf(input)}' is not assignable to '${
    this._kind_
  }'`
}

function nullable(this: RcType<any>): RcType<any | null | undefined> {
  return {
    ...this,
    _orNullable_: true,
    _kind_: `${this._kind_}_or_nullable`,
  }
}

function nullish(this: RcType<any>): RcType<any | null | undefined> {
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
  nullable,
  withAutofix,
  nullish,
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
    _kind_:
      literals.length == 1
        ? `${normalizedTypeOf(literals[0])}_literal`
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
  [K in keyof T]: RcInferType<T[K]>
}

type RcObjType<T extends RcObject> = RcType<TypeOfObjectType<T>>

export function rc_object<T extends RcObject>(shape: T): RcObjType<T> {
  return {
    ...defaultProps,
    _obj_shape_: shape,
    _kind_: 'object',
    _parse_(inputObj, ctx) {
      return parse<TypeOfObjectType<T>>(this, inputObj, ctx, () => {
        if (!isObject(inputObj)) return false

        const excessKeys = new Set<string>(Object.keys(inputObj))

        const resultObj: Record<any, string> = {} as any
        const resultErrors: string[] = []

        for (const [key, type] of Object.entries(shape)) {
          const typekey = key as keyof T

          const input = inputObj[key]

          excessKeys.delete(key)

          const [isValid, result] = type._parse_(input, ctx)

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
          return { data: inputObj as any }
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
  return rc_object({ ...a._obj_shape_, ...b._obj_shape_ }) as any
}
type RcRecord<V extends RcType<any>> = Record<string, V>

type RcRecordType<V extends RcType<any>> = RcType<TypeOfObjectType<RcRecord<V>>>

export function rc_record<V extends RcType<any>>(
  valueType: V,
): RcRecordType<V> {
  return {
    ...defaultProps,
    _kind_: `record<string, ${valueType._kind_}>`,
    _parse_(inputObj, ctx) {
      return parse<TypeOfObjectType<RcRecord<V>>>(this, inputObj, ctx, () => {
        if (!isObject(inputObj)) return false

        const resultObj: Record<any, string> = {} as any
        const resultErrors: string[] = []

        for (const [key, inputValue] of Object.entries(inputObj)) {
          const input = inputObj[key]

          const [isValid, result] = valueType._parse_(inputValue, ctx)

          if (isValid) {
            resultObj[key] = input
          }
          //
          else {
            const errors = result

            for (const subError of errors) {
              resultErrors.push(normalizeSubError(subError, `.${key}`))
            }
          }
        }

        if (resultErrors.length > 0) {
          return { errors: resultErrors }
        }

        return { data: resultObj as any }
      })
    },
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

    const [isValid, result] = type._parse_(item, ctx)

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
): RcType<RcInferType<T>[]> {
  return {
    ...defaultProps,
    _kind_: `${type._kind_}[]`,
    _parse_(input, ctx) {
      return parse(this, input, ctx, () => {
        if (!Array.isArray(input)) return false

        if (input.length === 0) return true

        return checkArrayItems.call(this, input, type, ctx)
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

        return checkArrayItems.call(this, input, types, ctx)
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

export function rc_parser<S>(type: RcType<S>): RcParser<S> {
  return (input: any) => rc_parse(input, type)
}

export function rc_is_valid<S>(input: any, type: RcType<S>): input is S {
  const ctx: ParseResultCtx = {
    warnings: [],
  }

  return !!type._parse_(input, ctx)[0]
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

function isObject(value: any): value is NonArrayObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
