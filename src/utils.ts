export function isNotUndefined<T>(input: T): input is Exclude<T, undefined> {
  return input !== undefined
}

type NonArrayObject = {
  [x: string]: any
  [y: number]: never
}

export function isObject(value: any): value is NonArrayObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
