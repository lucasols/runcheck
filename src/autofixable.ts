import { rc_boolean, rc_number, rc_string } from './runcheck'

/**
 * Runtime type validator for boolean values with automatic fixing.
 * Automatically converts:
 * - 0, null, undefined → false
 * - 1 → true
 * - 'true' → true
 * - 'false' → false
 * 
 * Returns error for any other input.
 * @example
 * ```typescript
 * const result = rc_boolean_autofix.parse(1) // returns true (with autofix warning)
 * const result2 = rc_boolean_autofix.parse('true') // returns true (with autofix warning)
 * const result3 = rc_boolean_autofix.parse('invalid') // error
 * ```
 */
export const rc_boolean_autofix = rc_boolean.withAutofix((input) => {
  if (input === null || input === undefined || input === 0 || input === 1) {
    return { fixed: !!input }
  }

  if (input === 'true' || input === 'false') {
    return { fixed: input === 'true' }
  }

  return false
})

/**
 * Runtime type validator for string values with automatic fixing.
 * Automatically converts valid numbers to strings.
 * Returns error for any other input type.
 * @example
 * ```typescript
 * const result = rc_string_autofix.parse(42) // returns '42' (with autofix warning)
 * const result2 = rc_string_autofix.parse(3.14) // returns '3.14' (with autofix warning)
 * const result3 = rc_string_autofix.parse(NaN) // error
 * const result4 = rc_string_autofix.parse(true) // error
 * ```
 */
export const rc_string_autofix = rc_string.withAutofix((input) => {
  if (typeof input === 'number' && !Number.isNaN(input)) {
    return { fixed: input.toString() }
  }

  return false
})

/**
 * Runtime type validator for number values with automatic fixing.
 * Automatically converts valid numeric strings to numbers.
 * Returns error for invalid strings or other input types.
 * @example
 * ```typescript
 * const result = rc_number_autofix.parse('42') // returns 42 (with autofix warning)
 * const result2 = rc_number_autofix.parse('3.14') // returns 3.14 (with autofix warning)
 * const result3 = rc_number_autofix.parse('invalid') // error
 * const result4 = rc_number_autofix.parse(true) // error
 * ```
 */
export const rc_number_autofix = rc_number.withAutofix((input) => {
  if (typeof input === 'string') {
    const parsed = Number(input)

    if (!Number.isNaN(parsed)) {
      return { fixed: parsed }
    }
  }

  return false
})
