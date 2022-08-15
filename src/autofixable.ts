import { rc_boolean, rc_number, rc_string } from './runcheck'

export const rc_boolean_autofix = rc_boolean.withAutofix((input) => {
  if (input === 0 || input === 1) {
    return { fixed: !!input }
  }

  if (input === 'true' || input === 'false') {
    return { fixed: input === 'true' }
  }

  return false
})

export const rc_string_autofix = rc_string.withAutofix((input) => {
  if (typeof input === 'number' && !Number.isNaN(input)) {
    return { fixed: input.toString() }
  }

  return false
})

export const rc_number_autofix = rc_number.withAutofix((input) => {
  if (typeof input === 'string') {
    const parsed = Number(input)

    if (!Number.isNaN(parsed)) {
      return { fixed: parsed }
    }
  }

  return false
})
