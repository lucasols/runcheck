import { isNotUndefined, isObject } from './utils'

export type RcParseResult<T> = {
  error: false | string
  data: T
}

type RcTypeOf<T extends RcType<any>> = T extends RcType<infer U> ? U : never

type NestedError = { path: string; error: string }

export type RcType<T, C = {}> = {
  withFallback: (fallback: T) => RcType<T>

  readonly _isValid: (input: unknown) => boolean
  _fallback: T
  readonly _kind: string
  readonly _getErrorMsg: (input: unknown) => string | NestedError[]
  _parent?: RcType<any>
  _errorCollector?: NestedError[]
  _usingCustomFallback?: boolean
} & C

function withFallback(this: RcType<any>, fallback: any): RcType<any> {
  this._usingCustomFallback = true

  return { ...this, _fallback: fallback }
}

function _getErrorMsg(this: RcType<any>, input: unknown): string {
  return `Type '${typeof input}' is not assignable to '${this._kind}'`
}

export const rc_string: RcType<
  string,
  {
    where: (conditions: {
      has_lenght?: number
      starts_with?: string
      ends_with?: string
    }) => RcType<string>
  }
> = {
  withFallback,
  _getErrorMsg,
  _isValid: (input) => typeof input === 'string',
  _fallback: '',
  _kind: 'string',
  where(conditions): RcType<string> {
    return {
      ...this,
      _isValid: (input) => {
        if (typeof input !== 'string') return false

        if (
          isNotUndefined(conditions.has_lenght) &&
          input.length !== conditions.has_lenght
        ) {
          return false
        }

        if (
          isNotUndefined(conditions.starts_with) &&
          !input.startsWith(conditions.starts_with)
        ) {
          return false
        }

        if (
          isNotUndefined(conditions.ends_with) &&
          !input.endsWith(conditions.ends_with)
        ) {
          return false
        }

        return true
      },
      _kind: `string_${Object.keys(conditions).join('_and_')}`,
    }
  },
}

function isNumber(input: unknown): input is number {
  return typeof input === 'number' && !Number.isNaN(input)
}

export const rc_number: RcType<
  number,
  {
    int: () => RcType<number>
    where: (
      conditions: Partial<
        Record<
          | 'greater_than'
          | 'greater_than_or_equal'
          | 'less_than'
          | 'less_than_or_equal',
          number
        >
      >,
    ) => RcType<number>
  }
> = {
  withFallback,
  _getErrorMsg,
  _isValid: isNumber,
  _fallback: 0,
  _kind: 'number',
  int() {
    return {
      ...this,
      _isValid: (input) => isNumber(input) && input % 1 === 0,
      _kind: 'int_number',
    }
  },
  where(conditions) {
    return {
      ...this,
      _isValid: (input) => {
        if (!isNumber(input)) return false

        if (
          isNotUndefined(conditions['greater_than']) &&
          input <= conditions['greater_than']
        ) {
          return false
        }

        if (
          isNotUndefined(conditions['greater_than_or_equal']) &&
          input < conditions['greater_than_or_equal']
        ) {
          return false
        }

        if (
          isNotUndefined(conditions['less_than']) &&
          input >= conditions['less_than']
        ) {
          return false
        }

        if (
          isNotUndefined(conditions['less_than_or_equal']) &&
          input > conditions['less_than_or_equal']
        ) {
          return false
        }

        return true
      },
      _kind: `number_${Object.keys(conditions).join('_and_')}`,
    }
  },
}

export function rc_union<T extends RcType<any>[]>(
  ...types: T
): RcType<RcTypeOf<T[number]>> {
  if (types.length === 0) {
    throw new Error('Unions should have at least one type')
  }

  return {
    withFallback,
    _getErrorMsg,
    _isValid: (input) => {
      for (const type of types) {
        if (type._isValid(input)) {
          return true
        }
      }

      return false
    },
    _fallback: types[0]!._fallback,
    _kind: types.map((type) => type._kind).join(' | '),
  }
}

export function rc_object<T extends Record<string, RcType<any>>>(
  shape: T,
): RcType<{ [K in keyof T]: RcTypeOf<T[K]> }> {
  return {
    withFallback,
    _getErrorMsg(input) {
      if (this._errorCollector!.length > 0) {
        return this._parent
          ? this._errorCollector!
          : errorCollectorFormatter(this._errorCollector!)
      }

      return _getErrorMsg.call(this, input)
    },
    _isValid(input) {
      if (!isObject(input)) return false

      let isValid = true

      for (const [key, type] of Object.entries(shape)) {
        type._parent = this._parent ? this._parent : this

        if (type._isValid(input[key])) {
          this._fallback[key as keyof T] = input[key]
        }
        //
        else {
          isValid = false

          if (type._kind === 'object') {
            let typeErrors = type._getErrorMsg(input[key]) as NestedError[]

            typeErrors = typeErrors.map((error) => ({
              ...error,
              path: `${key}.${error.path}`,
            }))

            this._errorCollector!.push(...typeErrors)
          } else {
            this._errorCollector!.push({
              path: key,
              error: type._getErrorMsg(input[key]) as string,
            })
          }

          if (!this._usingCustomFallback) {
            this._fallback[key as keyof T] = type._fallback
          }
        }
      }

      return isValid
    },
    _fallback: {} as any,
    _kind: 'object',
    _errorCollector: [],
  }
}

export function rc_parse<S>(input: any, type: RcType<S>): RcParseResult<S> {
  if (type._isValid(input)) {
    return { error: false, data: input as any }
  }

  return {
    error: type._getErrorMsg(input) as string,
    data: type._fallback,
  }
}

function errorCollectorFormatter(errors: NestedError[]): string {
  let result = 'Errors:'

  for (const error of errors) {
    result += `\n  - $.` + `${error.path}: ${error.error}`
  }

  return result
}
