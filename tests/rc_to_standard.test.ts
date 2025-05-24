import { describe, expect, test } from 'vitest'
import {
  rc_number,
  rc_object,
  rc_parse,
  rc_string,
  rc_to_standard,
  RcParseResult,
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
      const parseResult: RcParseResult<string> = {
        error: false,
        errors: false,
        ok: true,
        data: 'hello',
        value: 'hello',
        warnings: false,
      }
      const standardSchema = rc_to_standard(parseResult)
      const result = standardSchema['~standard'].validate('any input')

      expect(result).toMatchInlineSnapshot(`
        {
          "value": "hello",
        }
      `)
    })

    test('should convert successful parse result with warnings', () => {
      const parseResult: RcParseResult<string> = {
        error: false,
        errors: false,
        ok: true,
        data: 'fallback',
        value: 'fallback',
        warnings: [
          "Fallback used, errors -> Type 'number' is not assignable to 'string'",
        ],
      }
      const standardSchema = rc_to_standard(parseResult)
      const result = standardSchema['~standard'].validate('any input')

      expect(result).toMatchInlineSnapshot(`
        {
          "value": "fallback",
        }
      `)
    })

    test('should convert successful parse result with warnings to errors when errorOnWarnings is true', () => {
      const parseResult: RcParseResult<string> = {
        error: false,
        errors: false,
        ok: true,
        data: 'fallback',
        value: 'fallback',
        warnings: [
          "Fallback used, errors -> Type 'number' is not assignable to 'string'",
        ],
      }
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
      const parseResult: RcParseResult<string> = {
        ok: false,
        error: true,
        errors: ["Type 'number' is not assignable to 'string'"],
      }
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
      const parseResult: RcParseResult<string> = {
        ok: false,
        error: true,
        errors: ['First error', 'Second error'],
      }
      const standardSchema = rc_to_standard(parseResult)
      const result = standardSchema['~standard'].validate('any input')

      expect(result).toMatchInlineSnapshot(`
        {
          "issues": [
            {
              "message": "First error",
            },
            {
              "message": "Second error",
            },
          ],
        }
      `)
    })
  })

  describe('edge cases', () => {
    test('should handle successful result without warnings', () => {
      const parseResult: RcParseResult<number> = {
        error: false,
        errors: false,
        ok: true,
        data: 42,
        value: 42,
        warnings: false,
      }
      const standardSchema = rc_to_standard(parseResult)
      const result = standardSchema['~standard'].validate('ignored')

      expect(result).toMatchInlineSnapshot(`
        {
          "value": 42,
        }
      `)
    })

    test('should handle successful result with empty warnings array', () => {
      const parseResult: RcParseResult<number> = {
        error: false,
        errors: false,
        ok: true,
        data: 42,
        value: 42,
        warnings: [],
      }
      const standardSchema = rc_to_standard(parseResult, {
        errorOnWarnings: true,
      })
      const result = standardSchema['~standard'].validate('ignored')

      expect(result).toMatchInlineSnapshot(`
        {
          "issues": [],
        }
      `)
    })

    test('should maintain vendor and version information', () => {
      const standardSchema = rc_to_standard(rc_number)

      expect(standardSchema['~standard'].vendor).toBe('runcheck')
      expect(standardSchema['~standard'].version).toBe(1)
    })
  })

  describe('integration with actual parsing', () => {
    test('should work with actual rc_parse results', () => {
      const schema = rc_object({
        id: rc_number,
        name: rc_string,
      })

      const validParseResult = rc_parse({ id: 1, name: 'test' }, schema)
      const standardSchema = rc_to_standard(validParseResult)
      const result = standardSchema['~standard'].validate('ignored')

      expect(result).toMatchInlineSnapshot(`
        {
          "value": {
            "id": 1,
            "name": "test",
          },
        }
      `)

      const invalidParseResult = schema.parse({ id: 'invalid', name: 123 })
      const standardSchemaError = rc_to_standard(invalidParseResult)
      const errorResult = standardSchemaError['~standard'].validate('ignored')

      expect(errorResult).toMatchInlineSnapshot(`
        {
          "issues": [
            {
              "message": "$.id: Type 'string' is not assignable to 'number'",
            },
            {
              "message": "$.name: Type 'number' is not assignable to 'string'",
            },
          ],
        }
      `)
    })
  })
})
