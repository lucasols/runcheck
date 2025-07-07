import { describe, expect, test } from 'vitest'
import {
  rc_number,
  rc_object,
  rc_parse,
  rc_string,
  rc_to_standard,
} from '../src/runcheck'

describe('rc_to_standard', () => {
  describe('with schema input', () => {
    test('should convert schema to standard schema', () => {
      const standardSchema = rc_to_standard(rc_string)

      expect(standardSchema).toMatchInlineSnapshot(`
        {
          "~standard": {
            "validate": [Function],
            "vendor": "runcheck",
            "version": 1,
          },
        }
      `)
    })

    test('should validate valid input correctly', () => {
      const standardSchema = rc_to_standard(rc_string)
      const result = standardSchema['~standard'].validate('hello')

      expect(result).toMatchInlineSnapshot(`
        {
          "value": "hello",
        }
      `)
    })

    test('should validate invalid input correctly', () => {
      const standardSchema = rc_to_standard(rc_string)
      const result = standardSchema['~standard'].validate(123)

      expect(result).toMatchInlineSnapshot(`
        {
          "issues": [
            {
              "message": "Type 'number' is not assignable to 'string'",
            },
          ],
        }
      `)
    })

    test('should handle complex schema validation', () => {
      const schema = rc_object({
        name: rc_string,
        age: rc_number,
      })
      const standardSchema = rc_to_standard(schema)

      const validResult = standardSchema['~standard'].validate({
        name: 'John',
        age: 30,
      })
      expect(validResult).toMatchInlineSnapshot(`
        {
          "value": {
            "age": 30,
            "name": "John",
          },
        }
      `)

      const invalidResult = standardSchema['~standard'].validate({
        name: 'John',
        age: 'thirty',
      })
      expect(invalidResult).toMatchInlineSnapshot(`
        {
          "issues": [
            {
              "message": "$.age: Type 'string' is not assignable to 'number'",
            },
          ],
        }
      `)
    })

    test('should handle warnings without errorOnWarnings option', () => {
      const standardSchema = rc_to_standard(rc_string.withFallback('default'))
      const result = standardSchema['~standard'].validate(123)

      expect(result).toMatchInlineSnapshot(`
        {
          "value": "default",
        }
      `)
    })

    test('should convert warnings to errors with errorOnWarnings option', () => {
      const standardSchema = rc_to_standard(rc_string.withFallback('default'), {
        errorOnWarnings: true,
      })
      const result = standardSchema['~standard'].validate(123)

      expect(result).toMatchInlineSnapshot(`
        {
          "issues": [
            {
              "message": "Fallback used, errors -> Type 'number' is not assignable to 'string'",
            },
          ],
        }
      `)
    })
  })

  describe('with parse result input', () => {
    test('should convert successful parse result', () => {
      const parseResult = rc_parse('hello', rc_string)
      const standardSchema = rc_to_standard(parseResult)
      const result = standardSchema['~standard'].validate('any input')

      expect(result).toMatchInlineSnapshot(`
        {
          "value": "hello",
        }
      `)
    })

    test('should convert successful parse result with warnings', () => {
      const parseResult = rc_parse(123, rc_string.withFallback('fallback'))
      const standardSchema = rc_to_standard(parseResult)
      const result = standardSchema['~standard'].validate('any input')

      expect(result).toMatchInlineSnapshot(`
        {
          "value": "fallback",
        }
      `)
    })

    test('should convert successful parse result with warnings to errors when errorOnWarnings is true', () => {
      const parseResult = rc_parse(123, rc_string.withFallback('fallback'))
      const standardSchema = rc_to_standard(parseResult, {
        errorOnWarnings: true,
      })
      const result = standardSchema['~standard'].validate('any input')

      expect(result).toMatchInlineSnapshot(`
        {
          "issues": [
            {
              "message": "Fallback used, errors -> Type 'number' is not assignable to 'string'",
            },
          ],
        }
      `)
    })

    test('should convert failed parse result', () => {
      const parseResult = rc_parse(123, rc_string)
      const standardSchema = rc_to_standard(parseResult)
      const result = standardSchema['~standard'].validate('any input')

      expect(result).toMatchInlineSnapshot(`
        {
          "issues": [
            {
              "message": "Type 'number' is not assignable to 'string'",
            },
          ],
        }
      `)
    })

    test('should convert failed parse result with multiple errors', () => {
      const schema = rc_object({
        name: rc_string,
        age: rc_number,
      })
      const parseResult = rc_parse({ name: 123, age: 'invalid' }, schema)
      const standardSchema = rc_to_standard(parseResult)
      const result = standardSchema['~standard'].validate('any input')

      expect(result).toMatchInlineSnapshot(`
        {
          "issues": [
            {
              "message": "$.name: Type 'number' is not assignable to 'string'",
            },
            {
              "message": "$.age: Type 'string' is not assignable to 'number'",
            },
          ],
        }
      `)
    })
  })

  describe('edge cases', () => {
    test('should handle successful result without warnings', () => {
      const parseResult = rc_parse(42, rc_number)
      const standardSchema = rc_to_standard(parseResult)
      const result = standardSchema['~standard'].validate('ignored')

      expect(result).toMatchInlineSnapshot(`
        {
          "value": 42,
        }
      `)
    })

    test('should handle successful result with empty warnings array', () => {
      const parseResult = rc_parse(42, rc_number)
      const standardSchema = rc_to_standard(parseResult, {
        errorOnWarnings: true,
      })
      const result = standardSchema['~standard'].validate('ignored')

      expect(result).toMatchInlineSnapshot(`
        {
          "value": 42,
        }
      `)
    })

    test('should maintain vendor and version information', () => {
      const standardSchema = rc_to_standard(rc_number)

      expect(standardSchema['~standard'].vendor).toBe('runcheck')
      expect(standardSchema['~standard'].version).toBe(1)
    })

    test('should call onWarnings callback when warnings are present', () => {
      const capturedWarnings: string[][] = []
      const standardSchema = rc_to_standard(rc_string.withFallback('default'), {
        onWarnings: (warnings) => {
          capturedWarnings.push(warnings)
        },
      })

      const result1 = standardSchema['~standard'].validate(123)
      const result2 = standardSchema['~standard'].validate('valid')
      const result3 = standardSchema['~standard'].validate([])

      expect(result1).toEqual({ value: 'default' })
      expect(result2).toEqual({ value: 'valid' })
      expect(result3).toEqual({ value: 'default' })

      expect(capturedWarnings).toEqual([
        ["Fallback used, errors -> Type 'number' is not assignable to 'string'"],
        ["Fallback used, errors -> Type 'array' is not assignable to 'string'"],
      ])
    })

    test('should not call onWarnings callback when no warnings', () => {
      const capturedWarnings: string[][] = []
      const standardSchema = rc_to_standard(rc_string, {
        onWarnings: (warnings) => {
          capturedWarnings.push(warnings)
        },
      })

      const result1 = standardSchema['~standard'].validate('valid')
      const result2 = standardSchema['~standard'].validate('another')

      expect(result1).toEqual({ value: 'valid' })
      expect(result2).toEqual({ value: 'another' })
      expect(capturedWarnings).toEqual([])
    })

    test('should not call onWarnings callback when errorOnWarnings is true', () => {
      const capturedWarnings: string[][] = []
      const standardSchema = rc_to_standard(rc_string.withFallback('default'), {
        errorOnWarnings: true,
        onWarnings: (warnings) => {
          capturedWarnings.push(warnings)
        },
      })

      const result = standardSchema['~standard'].validate(123)

      expect(result).toEqual({
        issues: [
          {
            message: "Fallback used, errors -> Type 'number' is not assignable to 'string'",
          },
        ],
      })
      expect(capturedWarnings).toEqual([])
    })

    test('should call onWarnings with parse result input', () => {
      const capturedWarnings: string[][] = []
      const parseResult = rc_parse(123, rc_string.withFallback('fallback'))
      const standardSchema = rc_to_standard(parseResult, {
        onWarnings: (warnings) => {
          capturedWarnings.push(warnings)
        },
      })

      const result = standardSchema['~standard'].validate('ignored')

      expect(result).toEqual({ value: 'fallback' })
      expect(capturedWarnings).toEqual([
        ["Fallback used, errors -> Type 'number' is not assignable to 'string'"],
      ])
    })

    test('should not call onWarnings with failed parse result', () => {
      const capturedWarnings: string[][] = []
      const parseResult = rc_parse(123, rc_string)
      const standardSchema = rc_to_standard(parseResult, {
        onWarnings: (warnings) => {
          capturedWarnings.push(warnings)
        },
      })

      const result = standardSchema['~standard'].validate('ignored')

      expect(result).toEqual({
        issues: [
          {
            message: "Type 'number' is not assignable to 'string'",
          },
        ],
      })
      expect(capturedWarnings).toEqual([])
    })
  })
})
