import { describe, expect, test } from 'vitest'
import {
  rc_number,
  rc_object,
  rc_parse,
  rc_string,
  rc_unwrap_or_null,
  RcValidationError,
} from '../src/runcheck'
import { errorResult, successResult } from './testUtils'

describe('loose parsing', () => {
  test('pass', () => {
    const result = rc_unwrap_or_null(rc_parse(1, rc_number))

    expect(result).toEqual({
      value: 1,
      errors: false,
      warnings: false,
    })
  })

  test('fail', () => {
    const result = rc_unwrap_or_null(rc_parse('1', rc_number))

    expect(result).toEqual({
      value: null,
      errors: ["Type 'string' is not assignable to 'number'"],
      warnings: false,
    })
  })
})

describe('strict parsing', () => {
  const schema = rc_object({
    withAutofix: rc_number.withAutofix(() => ({
      fixed: 1,
    })),
    withFallback: rc_number.withFallback(1),
  })

  test('pass', () => {
    const result = rc_parse(
      {
        withAutofix: '1',
        withFallback: '1',
      },
      schema,
    )

    expect(result).toEqual(
      successResult({ withAutofix: 1, withFallback: 1 }, [
        "$.withAutofix: Autofixed from error \"Type 'string' is not assignable to 'number'\"",
        "$.withFallback: Fallback used, errors -> Type 'string' is not assignable to 'number'",
      ]),
    )
  })

  test('do not pass with noWarnings: true', () => {
    const result = rc_parse(
      {
        withAutofix: '1',
        withFallback: '1',
      },
      schema,
      { noWarnings: true },
    )

    expect(result).toEqual(
      errorResult(
        "$.withAutofix: Type 'string' is not assignable to 'number'",
        "$.withFallback: Type 'string' is not assignable to 'number'",
      ),
    )
  })
})

describe('parse methods', () => {
  describe('unwrap', () => {
    test('should return data when parsing succeeds', () => {
      const result = rc_parse(42, rc_number)
      const unwrapped = result.unwrap()

      expect(unwrapped).toBe(42)
    })

    test('should throw RcValidationError when parsing fails', () => {
      const result = rc_parse('invalid', rc_number)

      expect(() => result.unwrap()).toThrow()
      expect(() => result.unwrap()).toThrow(
        "Type 'string' is not assignable to 'number'",
      )
    })

    test('should return data even when there are warnings', () => {
      const result = rc_parse(
        '42',
        rc_number.withAutofix(() => ({ fixed: 42 })),
      )
      const unwrapped = result.unwrap()

      expect(unwrapped).toBe(42)
    })
  })

  describe('unwrapOr', () => {
    test('should return data when parsing succeeds', () => {
      const result = rc_parse(42, rc_number)
      const unwrapped = result.unwrapOr(0)

      expect(unwrapped).toBe(42)
    })

    test('should return default value when parsing fails', () => {
      const result = rc_parse('invalid', rc_number)
      const unwrapped = result.unwrapOr(99)

      expect(unwrapped).toBe(99)
    })

    test('should return data even when there are warnings', () => {
      const result = rc_parse(
        '42',
        rc_number.withAutofix(() => ({ fixed: 42 })),
      )
      const unwrapped = result.unwrapOr(0)

      expect(unwrapped).toBe(42)
    })

    test('should work with complex default values', () => {
      const schema = rc_object({ name: rc_string, age: rc_number })
      const result = rc_parse('invalid', schema)
      const defaultValue = { name: 'default', age: 0 }
      const unwrapped = result.unwrapOr(defaultValue)

      expect(unwrapped).toEqual(defaultValue)
    })
  })

  describe('unwrapOrNull', () => {
    test('should return data when parsing succeeds', () => {
      const result = rc_parse(42, rc_number)
      const unwrapped = result.unwrapOrNull()

      expect(unwrapped).toBe(42)
    })

    test('should return null when parsing fails', () => {
      const result = rc_parse('invalid', rc_number)
      const unwrapped = result.unwrapOrNull()

      expect(unwrapped).toBeNull()
    })

    test('should return data even when there are warnings', () => {
      const result = rc_parse(
        '42',
        rc_number.withAutofix(() => ({ fixed: 42 })),
      )
      const unwrapped = result.unwrapOrNull()

      expect(unwrapped).toBe(42)
    })

    test('should work with complex objects', () => {
      const schema = rc_object({ name: rc_string, age: rc_number })
      const validData = { name: 'John', age: 30 }
      const result = rc_parse(validData, schema)
      const unwrapped = result.unwrapOrNull()

      expect(unwrapped).toEqual(validData)
    })

    test('should return null for complex object parsing failures', () => {
      const schema = rc_object({ name: rc_string, age: rc_number })
      const result = rc_parse('invalid', schema)
      const unwrapped = result.unwrapOrNull()

      expect(unwrapped).toBeNull()
    })
  })
})

describe('schema.parse(...).unwrap()', () => {
  test('should return data when parsing succeeds', () => {
    const result = rc_string.parse('42').unwrap()

    expect(result).toBe('42')
  })

  test('should throw RcValidationError when parsing fails', () => {
    const result = rc_string.parse(42)

    expect(() => result.unwrap()).toThrow()
    expect(() => result.unwrap()).toThrow(
      new RcValidationError(["Type 'number' is not assignable to 'string'"]),
    )
  })
})
