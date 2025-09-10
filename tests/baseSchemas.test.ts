import { describe, expect, test } from 'vitest'
import {
  RcParseResult,
  getSchemaKind,
  rc_any,
  rc_boolean,
  rc_date,
  rc_instanceof,
  rc_is_valid,
  rc_literals,
  rc_null,
  rc_number,
  rc_object,
  rc_parse,
  rc_parser,
  rc_string,
  rc_undefined,
  rc_unknown,
  rc_validator,
} from '../src/runcheck'
import { errorResult, successResult } from './testUtils'

describe('rc_string', () => {
  test('pass', () => {
    const result: RcParseResult<string> = rc_parse('hello', rc_string)

    expect(result).toEqual(successResult('hello'))
  })

  test('fail', () => {
    const result = rc_parse(1, rc_string)

    expect(result).toEqual(
      errorResult(`Type 'number' is not assignable to 'string'`),
    )
  })

  test('with fallback', () => {
    expect(rc_parse(1, rc_string.withFallback('world'))).toEqual(
      successResult('world', [
        "Fallback used, errors -> Type 'number' is not assignable to 'string'",
      ]),
    )
  })

  test('extra checks', () => {
    expect(
      rc_parse(
        'hello',
        rc_string.where((input) => input.length === 6),
      ),
    ).toEqual(errorResult(`Predicate failed for type 'string'`))
  })
})

describe('rc_number', () => {
  test('pass', () => {
    const result: RcParseResult<number> = rc_parse(1, rc_number)

    expect(result).toEqual(successResult(1))
  })

  test('fail', () => {
    expect(rc_parse('1', rc_number)).toEqual(
      errorResult(`Type 'string' is not assignable to 'number'`),
    )

    expect(rc_parse(NaN, rc_number)).toEqual(
      errorResult(`Type 'NaN' is not assignable to 'number'`),
    )

    expect(rc_parse(Number('not a number'), rc_number)).toEqual(
      errorResult(`Type 'NaN' is not assignable to 'number'`),
    )

    expect(rc_parse(NaN, rc_number.withFallback(5))).toEqual(
      successResult(5, [
        "Fallback used, errors -> Type 'NaN' is not assignable to 'number'",
      ]),
    )
  })

  test('extra checks', () => {
    expect(
      rc_parse(
        2,
        rc_number.where((input) => input < 2),
      ),
    ).toEqual(errorResult(`Predicate failed for type 'number'`))
  })
})

describe('rc_undefined or optional', () => {
  test('rc_undefined', () => {
    expect(rc_is_valid(undefined, rc_undefined)).toBeTruthy()
    expect(rc_is_valid('sdf', rc_undefined)).toBeFalsy()
  })

  test('optional', () => {
    expect(rc_is_valid(undefined, rc_string.optional())).toBeTruthy()
    expect(rc_is_valid('sdf', rc_string.optional())).toBeTruthy()

    expect(rc_is_valid(2, rc_string.optional())).toBeFalsy()
  })
})

describe('rc_null or nullish or nullable', () => {
  test('rc_null', () => {
    expect(rc_is_valid(null, rc_null)).toBeTruthy()
    expect(rc_is_valid('sdf', rc_null)).toBeFalsy()
  })

  test('orNullish', () => {
    const validator = rc_validator(rc_string.orNullish())

    expect(validator(null)).toBeTruthy()
    expect(validator(undefined)).toBeTruthy()
    expect(validator('sdf')).toBeTruthy()

    expect(validator(2)).toBeFalsy()
  })

  test('or Nullable', () => {
    const validator = rc_validator(rc_string.orNull())

    expect(validator(null)).toBeTruthy()
    expect(validator(undefined)).toBeFalsy()
    expect(validator('sdfs')).toBeTruthy()

    expect(validator(2)).toBeFalsy()
  })
})

test('rc_any', () => {
  expect(rc_is_valid(null, rc_any)).toBeTruthy()
  expect(rc_is_valid(undefined, rc_any)).toBeTruthy()
  expect(rc_is_valid('sdf', rc_any)).toBeTruthy()
})

test('rc_unknown', () => {
  expect(rc_is_valid(null, rc_unknown)).toBeTruthy()
  expect(rc_is_valid(undefined, rc_unknown)).toBeTruthy()
  expect(rc_is_valid('sdf', rc_unknown)).toBeTruthy()
})

test('rc_boolean', () => {
  expect(rc_is_valid(true, rc_boolean)).toBeTruthy()
  expect(rc_is_valid(undefined, rc_boolean)).toBeFalsy()
})

test('rc_date', () => {
  expect(rc_is_valid(new Date(), rc_date)).toBeTruthy()

  expect(rc_is_valid(true, rc_date)).toBeFalsy()
})

describe('rc_instanceof', () => {
  class MyClass {
    constructor(public value?: string) {}
  }

  class ChildClass extends MyClass {
    constructor(
      value?: string,
      public extra?: number,
    ) {
      super(value)
    }
  }

  test('basic instanceof validation', () => {
    const validator = rc_parser(rc_instanceof(MyClass))

    // Valid instances
    expect(validator(new MyClass()).error).toBeFalsy()
    expect(validator(new MyClass('test')).error).toBeFalsy()

    // Invalid inputs
    expect(validator(true)).toEqual(
      errorResult(`Type 'boolean' is not assignable to 'instanceof_MyClass'`),
    )
    expect(validator('string')).toEqual(
      errorResult(`Type 'string' is not assignable to 'instanceof_MyClass'`),
    )
    expect(validator(123)).toEqual(
      errorResult(`Type 'number' is not assignable to 'instanceof_MyClass'`),
    )
    expect(validator({})).toEqual(
      errorResult(`Type 'object' is not assignable to 'instanceof_MyClass'`),
    )
    expect(validator([])).toEqual(
      errorResult(`Type 'array' is not assignable to 'instanceof_MyClass'`),
    )
  })

  test('null and undefined inputs', () => {
    const validator = rc_parser(rc_instanceof(MyClass))

    expect(validator(null)).toEqual(
      errorResult(`Type 'null' is not assignable to 'instanceof_MyClass'`),
    )
    expect(validator(undefined)).toEqual(
      errorResult(`Type 'undefined' is not assignable to 'instanceof_MyClass'`),
    )
  })

  test('inheritance support', () => {
    const parentValidator = rc_parser(rc_instanceof(MyClass))
    const childValidator = rc_parser(rc_instanceof(ChildClass))

    const parent = new MyClass('parent')
    const child = new ChildClass('child', 42)

    // Child is instance of parent class
    expect(parentValidator(child).error).toBeFalsy()

    // Parent is not instance of child class
    expect(childValidator(parent)).toEqual(
      errorResult(`Type 'object' is not assignable to 'instanceof_ChildClass'`),
    )

    // Child is instance of child class
    expect(childValidator(child).error).toBeFalsy()
  })

  test('built-in classes', () => {
    const dateSchema = rc_instanceof(Date)
    const regexSchema = rc_instanceof(RegExp)
    const arraySchema = rc_instanceof(Array)
    const errorSchema = rc_instanceof(Error)

    // Valid instances
    expect(rc_parse(new Date(2022, 8), dateSchema)).toEqual(
      successResult(new Date(2022, 8)),
    )
    expect(rc_parse(/abc/, regexSchema)).toEqual(successResult(/abc/))
    expect(rc_parse([], arraySchema)).toEqual(successResult([]))
    expect(rc_parse(new Error('test'), errorSchema)).toEqual(
      successResult(new Error('test')),
    )

    // Invalid instances
    expect(rc_is_valid('2022-09-01', dateSchema)).toBeFalsy()
    expect(rc_is_valid('abc', regexSchema)).toBeFalsy()
    expect(rc_is_valid('[]', arraySchema)).toBeFalsy()
    expect(rc_is_valid('test', errorSchema)).toBeFalsy()
  })

  test('anonymous classes', () => {
    const AnonymousClass = class {
      value = 'anonymous'
    }

    // Clear the name to simulate truly anonymous class
    Object.defineProperty(AnonymousClass, 'name', { value: '' })

    const validator = rc_parser(rc_instanceof(AnonymousClass))
    const instance = new AnonymousClass()

    expect(validator(instance).error).toBeFalsy()
    expect(validator({})).toEqual(
      errorResult(
        `Type 'object' is not assignable to 'instanceof_AnonymousClass'`,
      ),
    )
  })

  test('with optional modifier', () => {
    const optionalSchema = rc_instanceof(MyClass).optional()
    const validator = rc_parser(optionalSchema)

    // Valid cases
    expect(validator(new MyClass()).error).toBeFalsy()
    expect(validator(undefined).error).toBeFalsy()

    // Invalid cases
    expect(validator(null)).toEqual(
      errorResult(
        `Type 'null' is not assignable to 'undefined | instanceof_MyClass'`,
      ),
    )
    expect(validator('string')).toEqual(
      errorResult(
        `Type 'string' is not assignable to 'undefined | instanceof_MyClass'`,
      ),
    )
  })

  test('with nullable modifiers', () => {
    const nullableSchema = rc_instanceof(MyClass).orNull()
    const nullishSchema = rc_instanceof(MyClass).orNullish()

    const nullableValidator = rc_parser(nullableSchema)
    const nullishValidator = rc_parser(nullishSchema)

    // Valid cases for nullable
    expect(nullableValidator(new MyClass()).error).toBeFalsy()
    expect(nullableValidator(null).error).toBeFalsy()
    expect(nullableValidator(undefined)).toEqual(
      errorResult(
        `Type 'undefined' is not assignable to 'null | instanceof_MyClass'`,
      ),
    )

    // Valid cases for nullish
    expect(nullishValidator(new MyClass()).error).toBeFalsy()
    expect(nullishValidator(null).error).toBeFalsy()
    expect(nullishValidator(undefined).error).toBeFalsy()
  })

  test('with fallback', () => {
    const fallbackInstance = new MyClass('fallback')
    const schemaWithFallback =
      rc_instanceof(MyClass).withFallback(fallbackInstance)

    // Valid input returns original
    const validInstance = new MyClass('valid')
    const validResult = rc_parse(validInstance, schemaWithFallback)
    expect(validResult).toEqual(successResult(validInstance))

    // Invalid input uses fallback
    const invalidResult = rc_parse('invalid', schemaWithFallback)
    expect(invalidResult.ok).toBeTruthy()
    if (invalidResult.ok) {
      expect(invalidResult.data).toBe(fallbackInstance)
      expect(invalidResult.warnings).toEqual([
        "Fallback used, errors -> Type 'string' is not assignable to 'instanceof_MyClass'",
      ])
    }
  })

  test('error message consistency', () => {
    const schema = rc_instanceof(MyClass)

    const testCases = [
      { input: 'string', expectedType: 'string' },
      { input: 123, expectedType: 'number' },
      { input: true, expectedType: 'boolean' },
      { input: {}, expectedType: 'object' },
      { input: [], expectedType: 'array' },
      { input: null, expectedType: 'null' },
      { input: undefined, expectedType: 'undefined' },
    ]

    testCases.forEach(({ input, expectedType }) => {
      const result = rc_parse(input, schema)
      expect(result).toEqual(
        errorResult(
          `Type '${expectedType}' is not assignable to 'instanceof_MyClass'`,
        ),
      )
    })
  })

  test('type inference works correctly', () => {
    const schema = rc_instanceof(MyClass)

    // This should compile without type errors
    const result = rc_parse(new MyClass('test'), schema)
    if (result.ok) {
      // result.data should be inferred as MyClass instance
      expect(result.data).toBeInstanceOf(MyClass)
      // This should work without type errors - accessing the property
      expect(result.data.value).toBe('test')
    }
  })
})

describe('rc_literal', () => {
  test('simple input', () => {
    const helloParser = rc_parser(rc_literals('hello'))

    const result: RcParseResult<'hello'> = helloParser('hello')

    expect(result).toEqual(successResult('hello'))

    expect(helloParser('world')).toEqual(
      errorResult("Type 'string(world)' is not assignable to 'string(hello)'"),
    )
  })

  test('multiple inputs', () => {
    const helloParser = rc_parser(rc_literals('hello', 'world'))

    const result: RcParseResult<'hello' | 'world'> = helloParser('hello')

    expect(result).toEqual(successResult('hello'))

    expect(helloParser('world')).toEqual(successResult('world'))

    expect(helloParser('worlds')).toEqual(
      errorResult(
        "Type 'string(worlds)' is not assignable to 'string(hello) | string(world)'",
      ),
    )

    expect(helloParser(undefined)).toEqual(
      errorResult(
        "Type 'undefined' is not assignable to 'string(hello) | string(world)'",
      ),
    )
  })

  test('literal types', () => {
    expect(rc_parse(1, rc_literals(1))).toEqual(successResult(1))

    expect(rc_parse(2, rc_literals(1))).toEqual(
      errorResult("Type 'number(2)' is not assignable to 'number(1)'"),
    )

    expect(rc_parse(2, rc_literals(1, 2))).toEqual(successResult(2))

    expect(rc_parse(true, rc_literals(true))).toEqual(successResult(true))

    expect(rc_parse(false, rc_literals(true))).toEqual(
      errorResult("Type 'boolean(false)' is not assignable to 'boolean(true)'"),
    )
  })
})

describe('rc_type.where', () => {
  test('pass', () => {
    const result = rc_parse(
      'hello',
      rc_string.where((input) => input.length === 5),
    )

    expect(result).toEqual(successResult('hello'))
  })

  test('fail', () => {
    const result = rc_parse(
      'hello',
      rc_string.where((input) => input.length === 6),
    )

    expect(result).toEqual(errorResult(`Predicate failed for type 'string'`))
  })

  test('fail with custom msg', () => {
    const result = rc_parse(
      'h',
      rc_string.where((input) =>
        input.length < 4 ? { error: 'too short' } : true,
      ),
    )

    expect(result).toEqual(errorResult(`Predicate failed: too short`))
  })
})

test('getSchemaKind', () => {
  expect(getSchemaKind(rc_string)).toBe('string')
  expect(getSchemaKind(rc_number)).toBe('number')
  expect(getSchemaKind(rc_number.optional())).toBe('undefined | number')
  expect(getSchemaKind(rc_number.orNull())).toBe('null | number')
  expect(getSchemaKind(rc_number.orNullish())).toBe('null | undefined | number')
})

test('schema.parse', () => {
  expect(rc_string.parse('hello')).toEqual(successResult('hello'))
  expect(rc_string.parse(1)).toEqual(
    errorResult(`Type 'number' is not assignable to 'string'`),
  )

  expect(rc_string.parse(5)).toEqual(
    errorResult(`Type 'number' is not assignable to 'string'`),
  )

  expect(
    rc_string.withFallback('world').parse(5, { noWarnings: true }),
  ).toEqual(errorResult(`Type 'number' is not assignable to 'string'`))
})

test('schema.parseJson', () => {
  expect(rc_string.parseJson('"hello"')).toEqual(successResult('hello'))
  expect(rc_string.parseJson('1')).toEqual(
    errorResult(`Type 'number' is not assignable to 'string'`),
  )

  expect(rc_number.parseJson('42')).toEqual(successResult(42))
  expect(rc_number.parseJson('"hello"')).toEqual(
    errorResult(`Type 'string' is not assignable to 'number'`),
  )

  const objSchema = rc_object({
    name: rc_string,
    age: rc_number,
  })

  expect(objSchema.parseJson('{"name": "John", "age": 30}')).toEqual(
    successResult({ name: 'John', age: 30 }),
  )

  expect(objSchema.parseJson('{"name": "John", "age": "30"}')).toEqual(
    errorResult(`$.age: Type 'string' is not assignable to 'number'`),
  )

  expect(objSchema.parseJson('{"name": "John"}')).toEqual(
    errorResult(`$.age: Type 'undefined' is not assignable to 'number'`),
  )

  expect(rc_string.parseJson('invalid json')).toEqual(
    errorResult(
      `json parsing error: Unexpected token 'i', "invalid json" is not valid JSON`,
    ),
  )
})
