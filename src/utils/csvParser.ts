import { Group, ParsedCsvPreview } from '../types';

export const SAMPLE_STUDENT_NAMES = [
  '林宇軒',
  '陳思穎',
  '張哲維',
  '王宥希',
  '李承恩',
  '黃品妍',
  '吳柏翰',
  '劉子晴',
  '蔡宗諺',
  '楊芷瑄',
  '許睿宸',
  '鄭羽彤',
  '謝翔宇',
  '郭語晨',
  '洪楷翔',
  '曾依柔',
  '邱柏諺',
  '周宥彤',
  '廖子豪',
  '徐詠晴',
  '蘇冠廷',
  '葉庭瑜',
  '莊秉融',
  '呂采潔',
];

const HEADER_NAME_KEYWORDS = [
  '姓名',
  '名字',
  '學生姓名',
  '學生',
  'name',
  'student',
  'student name',
  'fullname',
  'full name',
];

const NON_NAME_HEADER_KEYWORDS = [
  '座號',
  '學號',
  '編號',
  '班級',
  '組別',
  '性別',
  'id',
  'no',
  'number',
  'seat',
  'class',
  'gender',
  'email',
];

/**
 * Parse raw pasted text (supports newline, comma, Chinese comma, semicolon, tab).
 */
export function parsePastedNames(rawText: string): string[] {
  if (!rawText.trim()) return [];
  const tokens = rawText
    .split(/[\r\n,，;；\t]+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  return tokens;
}

/**
 * Parse a single CSV line handling RFC 4180 quotes.
 */
function parseCsvRow(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function detectDelimiter(lines: string[]): string {
  const sample = lines.slice(0, 5).join('\n');
  const commas = (sample.match(/,/g) || []).length;
  const tabs = (sample.match(/\t/g) || []).length;
  const semis = (sample.match(/;/g) || []).length;
  if (tabs > commas && tabs > semis) return '\t';
  if (semis > commas && semis > tabs) return ';';
  return ',';
}

export function parseCsvFileContent(
  rawContent: string,
  fileName: string
): ParsedCsvPreview {
  const cleaned = rawContent.replace(/^\uFEFF/, '');
  const lines = cleaned
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return {
      headers: [],
      rows: [],
      hasHeader: false,
      suggestedColumnIndex: 0,
      fileName,
    };
  }

  const delimiter = detectDelimiter(lines);
  const matrix = lines.map((line) => parseCsvRow(line, delimiter));
  const maxCols = Math.max(...matrix.map((row) => row.length));
  const normalizedRows = matrix.map((row) => {
    const padded = [...row];
    while (padded.length < maxCols) padded.push('');
    return padded;
  });

  const firstRow = normalizedRows[0];
  let suggestedColumnIndex = 0;
  let headerMatchFound = false;

  // Check if first row looks like header
  firstRow.forEach((cell, idx) => {
    const lower = cell.toLowerCase();
    if (HEADER_NAME_KEYWORDS.some((kw) => lower === kw || lower.includes(kw))) {
      suggestedColumnIndex = idx;
      headerMatchFound = true;
    }
  });

  const firstRowHasNonNameHeaders = firstRow.some((cell) => {
    const lower = cell.toLowerCase();
    return NON_NAME_HEADER_KEYWORDS.some((kw) => lower === kw);
  });

  // Heuristic: if first row matches known header keywords or has numeric data in row 2 but text in row 1
  const hasHeader =
    normalizedRows.length > 1 &&
    (headerMatchFound ||
      firstRowHasNonNameHeaders ||
      (maxCols > 1 && firstRow.every((c) => c.length > 0 && !/^\d+$/.test(c))));

  if (hasHeader && !headerMatchFound && maxCols > 1) {
    // Pick first non-numeric column in row 1 (body)
    const bodyRow = normalizedRows[1];
    const textColIdx = bodyRow.findIndex(
      (cell) => cell.length > 0 && !/^\d+$/.test(cell)
    );
    if (textColIdx >= 0) {
      suggestedColumnIndex = textColIdx;
    }
  }

  const headers = hasHeader
    ? firstRow.map((h, i) => h || `第 ${i + 1} 欄`)
    : firstRow.map((_, i) => `第 ${i + 1} 欄`);

  const dataRows = hasHeader ? normalizedRows.slice(1) : normalizedRows;

  return {
    headers,
    rows: dataRows,
    hasHeader,
    suggestedColumnIndex,
    fileName,
  };
}

export function extractNamesFromCsvPreview(
  preview: ParsedCsvPreview,
  columnIndex: number,
  skipFirstRowOverride?: boolean
): string[] {
  let rows = preview.rows;
  if (skipFirstRowOverride === false && preview.hasHeader) {
    rows = [preview.headers, ...preview.rows];
  }
  return rows
    .map((row) => (row[columnIndex] ?? '').trim())
    .filter((name) => name.length > 0);
}

export function exportGroupsToCsv(groups: Group[]) {
  const header = ['組別', '成員序號', '學生姓名'];
  const lines = [header.join(',')];

  groups.forEach((group) => {
    group.members.forEach((member, idx) => {
      const escapedGroup = `"${group.name.replace(/"/g, '""')}"`;
      const escapedName = `"${member.name.replace(/"/g, '""')}"`;
      lines.push(`${escapedGroup},${idx + 1},${escapedName}`);
    });
  });

  const csvContent = '\uFEFF' + lines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  const dateStr = new Date().toISOString().slice(0, 10);
  link.download = `課堂分組結果_${dateStr}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
