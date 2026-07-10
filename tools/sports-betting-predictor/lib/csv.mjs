// Minimal dependency-free CSV reader. Supports a header row, comma
// separators and double-quoted fields (with "" as an escaped quote).
// Good enough for the small, simple match/odds files this tool consumes.

export function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0)
  if (lines.length === 0) return []

  const parseLine = (line) => {
    const fields = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (inQuotes) {
        if (char === '"' && line[i + 1] === '"') { current += '"'; i++ }
        else if (char === '"') inQuotes = false
        else current += char
      } else if (char === '"') inQuotes = true
      else if (char === ',') { fields.push(current); current = '' }
      else current += char
    }
    fields.push(current)
    return fields.map(f => f.trim())
  }

  const header = parseLine(lines[0])
  return lines.slice(1).map(line => {
    const values = parseLine(line)
    const row = {}
    header.forEach((key, i) => { row[key] = values[i] })
    return row
  })
}
