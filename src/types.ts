export interface Student {
  id: string;
  name: string;
}

export interface DrawRecord {
  id: string;
  studentId: string;
  studentName: string;
  timestamp: number;
  roundNumber: number;
}

export interface Group {
  id: string;
  index: number;
  name: string;
  members: Student[];
}

export type RemainderMode = 'distribute' | 'separate';

export type AppTab = 'roster' | 'draw' | 'group';

export interface ParsedCsvPreview {
  headers: string[];
  rows: string[][];
  hasHeader: boolean;
  suggestedColumnIndex: number;
  fileName: string;
}
