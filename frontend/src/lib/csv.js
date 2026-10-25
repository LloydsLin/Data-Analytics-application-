export const CSV_LIMITS = { files: 10, bytes: 50 * 1024 * 1024, rows: 250000, columns: 250 };

function parseCsv(text) {
  const rows = [];
  let row = [], value = '', quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { value += '"'; i += 1; }
      else quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(value); value = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      row.push(value); value = '';
      if (row.some(cell => cell.trim() !== '')) rows.push(row);
      row = [];
    } else value += char;
  }
  if (value || row.length) { row.push(value); if (row.some(cell => cell.trim() !== '')) rows.push(row); }
  return rows;
}

// Validate the full file and retain only ten rows for the preview.
export function inspectCsv(file) {
  return file.text().then(text => {
    const parsed = parseCsv(text);
    if (parsed.length < 2) throw new Error('Add a header and at least one data row.');
    const columns = parsed[0].map(value => value.replace(/^\uFEFF/, '').trim());
    if (columns.length > CSV_LIMITS.columns) throw new Error('Use up to 250 columns.');
    if (columns.some(value => !value)) throw new Error('Each column needs a name.');
    if (new Set(columns.map(value => value.toLowerCase())).size !== columns.length) throw new Error('Column names must be unique.');
    const rows = parsed.slice(1);
    if (rows.length > CSV_LIMITS.rows) throw new Error('Use up to 250,000 rows.');
    const invalid = rows.findIndex(row => row.length !== columns.length);
    if (invalid >= 0) throw new Error(`Row ${invalid + 2} has ${rows[invalid].length} values; expected ${columns.length}.`);
    return { columns, rows: rows.slice(0, 10), rowCount: rows.length };
  });
}
