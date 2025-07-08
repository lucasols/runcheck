import type { StandardSchemaV1 } from '@standard-schema/spec'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { rc_from_standard, rc_object, rc_parse } from '../src/runcheck'

describe('rc_from_standard', () => {
  it('should convert a Zod schema to RcType natively', () => {
    const zodSchema = z.string()
    const rcType = rc_from_standard(zodSchema)

    expect(rcType._kind_).toBe('standard_schema_zod@1')

    const validResult = rc_parse('hello', rcType)
    expect(validResult.ok).toBe(true)
    if (validResult.ok) {
      expect(validResult.value).toBe('hello')
    }

    const invalidResult = rc_parse(123, rcType)
    expect(invalidResult.ok).toBe(false)
    if (!invalidResult.ok) {
      expect(invalidResult.errors[0]).toContain('Expected string')
    }
  })

  it('should handle Zod object schema with multiple validation errors', () => {
    const zodSchema = z.object({
      name: z.string(),
      age: z.number(),
    })
    const rcType = rc_from_standard(zodSchema)

    const validResult = rc_parse({ name: 'John', age: 30 }, rcType)
    expect(validResult.ok).toBe(true)
    if (validResult.ok) {
      expect(validResult.value).toEqual({ name: 'John', age: 30 })
    }

    const invalidResult = rc_parse({ name: 123, age: 'thirty' }, rcType)
    expect(invalidResult.ok).toBe(false)
    if (!invalidResult.ok) {
      expect(invalidResult.errors.length).toBeGreaterThan(0)
    }
  })

  it('should handle Zod nullable schema', () => {
    const zodSchema = z.string().nullable()
    const rcType = rc_from_standard(zodSchema)

    const validStringResult = rc_parse('hello', rcType)
    expect(validStringResult.ok).toBe(true)
    if (validStringResult.ok) {
      expect(validStringResult.value).toBe('hello')
    }

    const validNullResult = rc_parse(null, rcType)
    expect(validNullResult.ok).toBe(true)
    if (validNullResult.ok) {
      expect(validNullResult.value).toBe(null)
    }

    const invalidResult = rc_parse(123, rcType)
    expect(invalidResult.ok).toBe(false)
    if (!invalidResult.ok) {
      expect(invalidResult.errors[0]).toContain('Expected string')
    }
  })

  it('should work with fallback values', () => {
    const zodSchema = z.string()
    const rcType = rc_from_standard(zodSchema).withFallback('default')

    const validResult = rc_parse('hello', rcType)
    expect(validResult.ok).toBe(true)
    if (validResult.ok) {
      expect(validResult.value).toBe('hello')
    }

    const fallbackResult = rc_parse(123, rcType)
    expect(fallbackResult.ok).toBe(true)
    if (fallbackResult.ok) {
      expect(fallbackResult.value).toBe('default')
      expect(fallbackResult.warnings).toBeTruthy()
    }
  })

  it('should work with Zod array schemas', () => {
    const zodSchema = z.array(z.string())
    const rcType = rc_from_standard(zodSchema)

    const validResult = rc_parse(['hello', 'world'], rcType)
    expect(validResult.ok).toBe(true)
    if (validResult.ok) {
      expect(validResult.value).toEqual(['hello', 'world'])
    }

    const invalidResult = rc_parse(['hello', 123], rcType)
    expect(invalidResult.ok).toBe(false)
    if (!invalidResult.ok) {
      expect(invalidResult.errors.length).toBeGreaterThan(0)
    }
  })

  it('should work with nested Zod schemas', () => {
    const zodSchema = z.object({
      users: z.array(
        z.object({
          name: z.string(),
          age: z.number(),
        }),
      ),
    })
    const rcType = rc_from_standard(zodSchema)

    const validResult = rc_parse({ users: [{ name: 'John', age: 30 }] }, rcType)
    expect(validResult.ok).toBe(true)
    if (validResult.ok) {
      expect(validResult.value).toEqual({ users: [{ name: 'John', age: 30 }] })
    }

    const invalidResult = rc_parse(
      { users: [{ name: 123, age: 'thirty' }] },
      rcType,
    )
    expect(invalidResult.ok).toBe(false)
    if (!invalidResult.ok) {
      expect(invalidResult.errors.length).toBeGreaterThan(0)
    }
  })

  it('should preserve error paths in validation context', () => {
    const zodSchema = z.string()
    const rcType = rc_from_standard(zodSchema)
    const objectType = rc_object({ name: rcType })

    const result = rc_parse({ name: 123 }, objectType)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors[0]).toContain('$.name:')
    }
  })

  it('should work with Zod enum schemas', () => {
    const zodSchema = z.enum(['red', 'green', 'blue'])
    const rcType = rc_from_standard(zodSchema)

    const validResult = rc_parse('red', rcType)
    expect(validResult.ok).toBe(true)
    if (validResult.ok) {
      expect(validResult.value).toBe('red')
    }

    const invalidResult = rc_parse('yellow', rcType)
    expect(invalidResult.ok).toBe(false)
    if (!invalidResult.ok) {
      expect(invalidResult.errors.length).toBeGreaterThan(0)
    }
  })

  it('should work with Zod optional fields', () => {
    const zodSchema = z.object({
      name: z.string(),
      age: z.number().optional(),
    })
    const rcType = rc_from_standard(zodSchema)

    const validWithOptional = rc_parse({ name: 'John', age: 30 }, rcType)
    expect(validWithOptional.ok).toBe(true)
    if (validWithOptional.ok) {
      expect(validWithOptional.value).toEqual({ name: 'John', age: 30 })
    }

    const validWithoutOptional = rc_parse({ name: 'John' }, rcType)
    expect(validWithoutOptional.ok).toBe(true)
    if (validWithoutOptional.ok) {
      expect(validWithoutOptional.value).toEqual({ name: 'John' })
    }
  })

  it('should work with pure Standard Schema V1 (non-Zod)', () => {
    const standardSchema: StandardSchemaV1<number> = {
      '~standard': {
        validate: (input) => {
          if (typeof input === 'number' && !isNaN(input)) {
            return { value: input }
          }
          return {
            issues: [{ message: 'Expected a valid number' }],
          }
        },
        vendor: 'custom',
        version: 1,
      },
    }

    const rcType = rc_from_standard(standardSchema)
    expect(rcType._kind_).toBe('standard_schema_custom@1')

    const validResult = rc_parse(42, rcType)
    expect(validResult.ok).toBe(true)
    if (validResult.ok) {
      expect(validResult.value).toBe(42)
    }

    const invalidResult = rc_parse('not a number', rcType)
    expect(invalidResult.ok).toBe(false)
    if (!invalidResult.ok) {
      expect(invalidResult.errors[0]).toContain('Expected a valid number')
    }
  })

  it('should work with Zod transform schemas', () => {
    const zodSchema = z.string().transform((val) => val.toUpperCase())
    const rcType = rc_from_standard(zodSchema)

    const validResult = rc_parse('hello', rcType)
    expect(validResult.ok).toBe(true)
    if (validResult.ok) {
      expect(validResult.value).toBe('HELLO')
    }

    const invalidResult = rc_parse(123, rcType)
    expect(invalidResult.ok).toBe(false)
    if (!invalidResult.ok) {
      expect(invalidResult.errors.length).toBeGreaterThan(0)
    }
  })

  it('should work with Zod transform schemas that changes the type', () => {
    const zodSchema = z.string().transform((val) => ({ value: val }))
    const rcType = rc_from_standard(zodSchema)

    const validResult = rc_parse('hello', rcType)
    expect(validResult.ok).toBe(true)
  })

  it('should work with Zod refinements', () => {
    const zodSchema = z.string().refine((val) => val.length > 5, {
      message: 'String must be longer than 5 characters',
    })
    const rcType = rc_from_standard(zodSchema)

    const validResult = rc_parse('hello world', rcType)
    expect(validResult.ok).toBe(true)
    if (validResult.ok) {
      expect(validResult.value).toBe('hello world')
    }

    const invalidResult = rc_parse('hi', rcType)
    expect(invalidResult.ok).toBe(false)
    if (!invalidResult.ok) {
      expect(invalidResult.errors[0]).toContain(
        'String must be longer than 5 characters',
      )
    }
  })
})
