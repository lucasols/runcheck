import { rc_boolean, rc_number, rc_string } from './runcheck'

/** Equivalent to ts type: `boolean`. Autofixes `0 | 1 | 'true' | 'false' | null | undefined` inputs. */
export const rc_boolean_autofix = rc_boolean.withAutofix((input) => {
  if (input === null || input === undefined || input === 0 || input === 1) {
    return { fixed: !!input }
  }

  if (input === 'true' || input === 'false') {
    return { fixed: input === 'true' }
  }

  return false
})

/** Equivalent to ts type: `string`. Autofixes valid `number` inputs. */
export const rc_string_autofix = rc_string.withAutofix((input) => {
  if (typeof input === 'number' && !Number.isNaN(input)) {
    return { fixed: input.toString() }
  }

  return false
})

/** Equivalent to ts type: `number`. Autofixes valid numeric `string` inputs. */
export const rc_number_autofix = rc_number.withAutofix((input) => {
  if (typeof input === 'string') {
    const parsed = Number(input)

    if (!Number.isNaN(parsed)) {
      return { fixed: parsed }
    }
  }

  return false
})
