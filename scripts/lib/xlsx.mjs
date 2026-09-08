/**
 * A minimal .xlsx reader — a zip container plus two XML files.
 *
 * Extracted so the roster importers share ONE parser. A spreadsheet is the
 * syndicate's own format for its membership records, and two slightly
 * different readers would eventually disagree about a cell.
 *
 * Deliberately dependency-free: pulling a spreadsheet library into a
 * government project to read three columns is a supply-chain cost with no
 * matching benefit.
 */
import zlib from 'node:zlib'

/** Reads a zip container without pulling in a dependency. */
export function readZip(buf) {
  const files = {}
  let end = buf.length - 22
  while (end >= 0 && buf.readUInt32LE(end) !== 0x06054b50) end--
  if (end < 0) throw new Error('Not a valid .xlsx (no zip end-of-central-directory)')

  const count = buf.readUInt16LE(end + 10)
  let off = buf.readUInt32LE(end + 16)

  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) break
    const nameLen = buf.readUInt16LE(off + 28)
    const extraLen = buf.readUInt16LE(off + 30)
    const commentLen = buf.readUInt16LE(off + 32)
    const localOff = buf.readUInt32LE(off + 42)
    const compSize = buf.readUInt32LE(off + 20)
    const name = buf.slice(off + 46, off + 46 + nameLen).toString('utf8')

    const lNameLen = buf.readUInt16LE(localOff + 26)
    const lExtraLen = buf.readUInt16LE(localOff + 28)
    const method = buf.readUInt16LE(localOff + 8)
    const start = localOff + 30 + lNameLen + lExtraLen
    const raw = buf.slice(start, start + compSize)

    files[name] = method === 0 ? raw : zlib.inflateRawSync(raw)
    off += 46 + nameLen + extraLen + commentLen
  }
  return files
}

const unescapeXml = (s) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')

export function readSheetRows(zip) {
  const shared = []
  const ssXml = zip['xl/sharedStrings.xml']?.toString('utf8') ?? ''
  for (const si of ssXml.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
    let text = ''
    for (const t of si[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)) text += t[1]
    shared.push(unescapeXml(text))
  }

  const sheetXml = zip['xl/worksheets/sheet1.xml'].toString('utf8')
  const rows = []
  for (const row of sheetXml.matchAll(/<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = {}
    /*
     * An EMPTY cell is written self-closing — `<c r="C51" s="27"/>` — with no
     * closing tag. Matching `>...</c>` unconditionally makes such a cell scan
     * forward to the NEXT cell's `</c>` and swallow it whole, so the column
     * after every blank one is silently lost. That is not hypothetical: it
     * dropped the mobile number of all 13 roster members whose file-number
     * cell was blank. The alternation below stops at `/>` instead.
     */
    for (const c of row[2].matchAll(
      /<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g,
    )) {
      const col = c[1]
      const type = c[2].match(/t="([^"]*)"/)?.[1]
      const body = c[3] ?? ''
      const inline = body.match(/<t[^>]*>([\s\S]*?)<\/t>/)
      const value = body.match(/<v>([\s\S]*?)<\/v>/)
      let out = inline ? inline[1] : value ? value[1] : ''
      if (type === 's') out = shared[Number(out)] ?? ''
      cells[col] = unescapeXml(String(out)).trim()
    }
    rows.push({ row: Number(row[1]), cells })
  }
  return rows
}
