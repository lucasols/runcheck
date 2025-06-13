import { expect } from 'vitest'
import { RcType, rc_parse } from '../src/runcheck'

export function pipe<T1, R>(input: T1, fn1: (a: T1) => R): R
export function pipe<T1, T2, R>(
  input: T1,
  fn1: (a: T1) => T2,
  fn2: (a: T2) => R,
): R
export function pipe<T1, T2, T3, R>(
  input: T1,
  fn1: (a: T1) => T2,
  fn2: (a: T2) => T3,
  fn3: (a: T3) => R,
): R
export function pipe<T1, T2, T3, T4, R>(
  input: T1,
  fn1: (a: T1) => T2,
  fn2: (a: T2) => T3,
  fn3: (a: T3) => T4,
  fn4: (a: T4) => R,
): R
export function pipe<T1, T2, T3, T4, T5, R>(
  input: T1,
  fn1: (a: T1) => T2,
  fn2: (a: T2) => T3,
  fn3: (a: T3) => T4,
  fn4: (a: T4) => T5,
  fn5: (a: T5) => R,
): R
export function pipe(
  input: unknown,
  ...fns: ((a: unknown) => unknown)[]
): unknown {
  let result = input

  for (const func of fns) {
    result = func(result)
  }

  return result
}

// fork of https://github.com/dmnd/dedent

export function dedent(strings: TemplateStringsArray, ...values: string[]) {
  // $FlowFixMe: Flow doesn't undestand .raw
  const raw = typeof strings === 'string' ? [strings] : strings.raw

  // first, perform interpolation
  let result = ''
  for (let i = 0; i < raw.length; i++) {
    result += raw[i]! // join lines when there is a suppressed newline
      .replace(/\\\n[ \t]*/g, '')
      // handle escaped backticks
      .replace(/\\`/g, '`')

    if (i < values.length) {
      result += values[i]
    }
  }

  // now strip indentation
  const lines = result.split('\n')
  let mindent: number | null = null
  lines.forEach((l) => {
    const m = l.match(/^(\s+)\S+/)
    if (m) {
      const indent = m[1]!.length
      if (!mindent) {
        // this is the first indented line
        mindent = indent
      } else {
        mindent = Math.min(mindent, indent)
      }
    }
  })

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (mindent !== null) {
    const m = mindent // appease Flow
    result = lines.map((l) => (l[0] === ' ' ? l.slice(m) : l)).join('\n')
  }

  return (
    result
      // dedent eats leading and trailing whitespace too
      .trim()
      // handle escaped newlines at the end to ensure they don't get stripped too
      .replace(/\\n/g, '\n')
  )
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function typeIsEqualTo<Expected>(value: Expected) {}

export function expectParse<T extends RcType<any>>({
  input,
  type,
}: {
  input: any
  type: T
}) {
  return rc_parse(input, type)
}

export function successResult(data: any, warnings: string[] | false = false) {
  return {
    error: false,
    errors: false,
    value: data,
    data,
    warnings,
    ok: true,
    unwrap: expect.any(Function),
    unwrapOr: expect.any(Function),
    unwrapOrNull: expect.any(Function),
  }
}

export function errorResult(...errorMsg: string[]) {
  return {
    error: true,
    ok: false,
    errors: errorMsg,
    unwrap: expect.any(Function),
    unwrapOr: expect.any(Function),
    unwrapOrNull: expect.any(Function),
  }
}

export function typeIsValid<T>(_value: T) {
  return true
}
