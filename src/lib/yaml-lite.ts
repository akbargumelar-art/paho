export function validateBasicYaml(text: string): { ok: boolean; message: string } {
  const lines = text.split(/\r?\n/)
  let prevIndent = 0
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const line = raw.replace(/\t/g, '    ')
    if (!line.trim() || line.trim().startsWith('#')) continue

    const indent = line.match(/^\s*/)?.[0].length || 0
    if (indent % 2 !== 0) {
      return { ok: false, message: `Indentasi ganjil di baris ${i + 1}. Gunakan kelipatan 2 spasi.` }
    }

    const trimmed = line.trim()
    if (trimmed.startsWith('- ')) {
      prevIndent = indent
      continue
    }

    const colonIndex = trimmed.indexOf(':')
    if (colonIndex === -1) {
      return { ok: false, message: `Baris ${i + 1} tidak mengandung ':' yang valid untuk YAML.` }
    }

    if (indent - prevIndent > 2) {
      return { ok: false, message: `Lonjakan indentasi terlalu jauh di baris ${i + 1}.` }
    }

    prevIndent = indent
  }
  return { ok: true, message: 'YAML dasar terlihat valid.' }
}
