import fs from 'fs'

const filePath = './dist/runcheck.d.ts'

const content = fs.readFileSync(filePath, 'utf8')

const lines = content.split('\n')

const newLines: string[] = []
let skipLines = false

for (const line of lines) {
  if (line.includes('/** %remove-declaration-start')) {
    skipLines = true
    continue
  }

  if (line.includes('___remove_declaration_end?: never')) {
    skipLines = false
    continue
  }

  if (skipLines) {
    continue
  }

  newLines.push(line)
}

const newContent = newLines.join('\n')

fs.writeFileSync(filePath, newContent)
