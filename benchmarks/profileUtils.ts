import fs from 'fs'
import v8Profiler from 'v8-profiler-next'

v8Profiler.setGenerateType(1)
export function generateProfile(
  name: string,
  test: () => void,
  {
    heatup = 10,
    iterations = 1000,
  }: { heatup?: number; iterations?: number } = {},
) {
  for (let i = 0; i < heatup; i++) {
    test()
  }

  const start = Date.now()

  v8Profiler.startProfiling(name, true)

  for (let i = 0; i < iterations; i++) {
    test()
  }

  const profile = v8Profiler.stopProfiling(name)

  const elapsed = Date.now() - start

  console.log(`${name} elapsed:`, elapsed / iterations, 'ms')

  profile.export((err, result) => {
    fs.writeFileSync(`benchmarks/profiles/${name}.cpuprofile`, result!)
  })
}
