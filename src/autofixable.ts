import { rc_boolean, rc_number, rc_string } from './runcheck'

/** autofixes a boolean type if input is 0 | 1 | 'true' | 'false' | undefined | null,
 * returning error otherwise */
export const rc_boolean_autofix = rc_boolean.withAutofix((input) => {
  if (input === null || input === undefined || input === 0 || input === 1) {
    return { fixed: !!input }
  }

  if (input === 'true' || input === 'false') {
    return { fixed: input === 'true' }
  }

  return false
})

/** autofixes a string type if input is a number, returning error otherwise */
export const rc_string_autofix = rc_string.withAutofix((input) => {
  if (typeof input === 'number' && !Number.isNaN(input)) {
    return { fixed: input.toString() }
  }

  return false
})

/** autofixes a number type if input is a a valid number string, returning error otherwise */
export const rc_number_autofix = rc_number.withAutofix((input) => {
  if (typeof input === 'string') {
    const parsed = Number(input)

    if (!Number.isNaN(parsed)) {
      return { fixed: parsed }
    }
  }

  return false
})
