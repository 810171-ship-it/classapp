import React, { useMemo, useRef, useState } from 'react';
import {
  FileSpreadsheet,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Upload,
  UserPlus,
  Users,
  Check,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';
import { AppTab, ParsedCsvPreview, Student } from '../types';
import {
  SAMPLE_STUDENT_NAMES,
  extractNamesFromCsvPreview,
  parseCsvFileContent,
  parsePastedNames,
} from '../utils/csvParser';
import { classroomAudio } from '../utils/sound';

interface RosterPanelProps {
  students: Student[];
  onReplaceStudents: (names: string[]) => void;
  onAppendStudents: (names: string[]) => void;
  onRemoveStudent: (id: string) => void;
  onClearStudents: () => void;
  onNavigate: (tab: AppTab) => void;
}

export const RosterPanel: React.FC<RosterPanelProps> = ({
  students,
  onReplaceStudents,
  onAppendStudents,
  onRemoveStudent,
  onClearStudents,
  onNavigate,
}) => {
  const [pasteText, setPasteText] = useState('');
  const [importMode, setImportMode] = useState<'replace' | 'append'>('replace');
  const [deduplicate, setDeduplicate] = useState(true);
  const [dragActive, setDragActive] = useState(false);
  const [csvPreview, setCsvPreview] = useState<ParsedCsvPreview | null>(null);
  const [selectedCsvCol, setSelectedCsvCol] = useState(0);
  const [skipHeaderRow, setSkipHeaderRow] = useState(true);
  const [quickName, setQuickName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const parsedPreviewNames = useMemo(() => {
    const raw = parsePastedNames(pasteText);
    return deduplicate ? Array.from(new Set(raw)) : raw;
  }, [pasteText, deduplicate]);

  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => s.name.toLowerCase().includes(q));
  }, [students, searchQuery]);

  const applyNames = (names: string[], sourceLabel: string) => {
    const finalNames = deduplicate ? Array.from(new Set(names)) : names;
    if (finalNames.length === 0) {
      setFeedback({
        type: 'error',
        message: '未偵測到有效的學生姓名，請確認內容後再試。',
      });
      return;
    }

    if (importMode === 'replace') {
      onReplaceStudents(finalNames);
      setFeedback({
        type: 'success',
        message: `已從${sourceLabel}匯入 ${finalNames.length} 位學生名單。`,
      });
    } else {
      onAppendStudents(finalNames);
      setFeedback({
        type: 'success',
        message: `已從${sourceLabel}新增 ${finalNames.length} 位學生至現有名單。`,
      });
    }
    classroomAudio.playClick();
  };

  const handlePasteSubmit = () => {
    applyNames(parsedPreviewNames, '貼上文字');
    setPasteText('');
  };

  const handleFile = async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      let text = new TextDecoder('utf-8').decode(buffer);
      // Simple fallback check if Big5 CSV produces replacement characters
      if (text.includes('\uFFFD')) {
        try {
          text = new TextDecoder('big5').decode(buffer);
        } catch {
          // Keep UTF-8 if Big5 decoder is unavailable
        }
      }

      const parsed = parseCsvFileContent(text, file.name);
      if (parsed.rows.length === 0 && parsed.headers.length === 0) {
        setFeedback({
          type: 'error',
          message: `檔案「${file.name}」內容為空，請確認格式。`,
        });
        return;
      }

      if (parsed.headers.length === 1) {
        const names = extractNamesFromCsvPreview(parsed, 0, parsed.hasHeader);
        applyNames(names, `CSV (${file.name})`);
        setCsvPreview(null);
      } else {
        setCsvPreview(parsed);
        setSelectedCsvCol(parsed.suggestedColumnIndex);
        setSkipHeaderRow(parsed.hasHeader);
        setFeedback(null);
      }
    } catch {
      setFeedback({
        type: 'error',
        message: '讀取檔案失敗，請確認檔案為 UTF-8 或標準 CSV / TXT 格式。',
      });
    }
  };

  const handleConfirmCsvPreview = () => {
    if (!csvPreview) return;
    const names = extractNamesFromCsvPreview(
      csvPreview,
      selectedCsvCol,
      skipHeaderRow
    );
    applyNames(names, `CSV (${csvPreview.fileName})`);
    setCsvPreview(null);
  };

  const handleLoadSample = () => {
    onReplaceStudents(SAMPLE_STUDENT_NAMES);
    setCsvPreview(null);
    setFeedback({
      type: 'success',
      message: `已載入 ${SAMPLE_STUDENT_NAMES.length} 位範例學生名單，可直接體驗抽籤與分組！`,
    });
    classroomAudio.playClick();
  };

  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = quickName.trim();
    if (!trimmed) return;
    if (deduplicate && students.some((s) => s.name === trimmed)) {
      setFeedback({
        type: 'error',
        message: `「${trimmed}」已在名單中。`,
      });
      return;
    }
    onAppendStudents([trimmed]);
    setQuickName('');
    setFeedback(null);
    classroomAudio.playClick();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Column: Roster Import Sources (7 cols) */}
      <div className="lg:col-span-7 space-y-6">
        <section className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-100">
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                匯入學生名單
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                上傳 CSV 檔案或直接貼上學生姓名，系統會自動整理為課堂名單。
              </p>
            </div>
            <button
              type="button"
              onClick={handleLoadSample}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              載入範例班級 (24人)
            </button>
          </div>

          {/* Import Mode & Deduplication Controls */}
          <div className="flex flex-wrap items-center justify-between gap-4 py-4 border-b border-slate-100">
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => setImportMode('replace')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  importMode === 'replace'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                覆蓋現有名單
              </button>
              <button
                type="button"
                onClick={() => setImportMode('append')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  importMode === 'append'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                附加至現有名單
              </button>
            </div>

            <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={deduplicate}
                onChange={(e) => setDeduplicate(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              自動排除重複姓名
            </label>
          </div>

          {feedback && (
            <div
              role="status"
              className={`mt-4 flex items-center gap-2.5 px-4 py-3 rounded-lg text-sm border ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              {feedback.type === 'success' ? (
                <Check className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
          )}

          {/* CSV Upload Zone */}
          <div className="mt-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-slate-800">
                方式一：上傳 CSV / TXT 名單檔案
              </span>
              <span className="text-xs text-slate-500">
                支援 UTF-8 與 Big5 編碼
              </span>
            </div>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragActive(false);
                const file = e.dataTransfer.files?.[0];
                if (file) handleFile(file);
              }}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              className={`border-2 border-dashed rounded-xl px-6 py-7 text-center transition-colors cursor-pointer ${
                dragActive
                  ? 'border-blue-500 bg-blue-50/70'
                  : 'border-slate-200 hover:border-blue-400 hover:bg-slate-50/60'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt,text/csv,text/plain"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                  e.target.value = '';
                }}
              />
              <div className="mx-auto w-11 h-11 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700 mb-3">
                <Upload className="w-5 h-5" />
              </div>
              <p className="text-sm font-medium text-slate-800">
                點擊選擇 CSV 檔案，或將檔案拖曳至此處
              </p>
              <p className="text-xs text-slate-500 mt-1">
                可包含座號、班級等多個欄位，系統會自動辨識「姓名」欄位
              </p>
            </div>

            {/* Multi-column CSV Selector */}
            {csvPreview && (
              <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                    <span>選擇要匯入的姓名欄位：{csvPreview.fileName}</span>
                  </div>
                  <label className="inline-flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={skipHeaderRow}
                      onChange={(e) => setSkipHeaderRow(e.target.checked)}
                      className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600"
                    />
                    第一列為欄位標題（不匯入）
                  </label>
                </div>

                <div className="flex flex-wrap gap-2 mb-3">
                  {csvPreview.headers.map((header, idx) => (
                    <button
                      key={`${header}-${idx}`}
                      type="button"
                      onClick={() => setSelectedCsvCol(idx)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                        selectedCsvCol === idx
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {header}
                    </button>
                  ))}
                </div>

                <div className="text-xs text-slate-500 mb-3">
                  欄位預覽：
                  {extractNamesFromCsvPreview(
                    csvPreview,
                    selectedCsvCol,
                    skipHeaderRow
                  )
                    .slice(0, 5)
                    .join('、') || '無資料'}
                  {extractNamesFromCsvPreview(
                    csvPreview,
                    selectedCsvCol,
                    skipHeaderRow
                  ).length > 5 && ' …'}
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setCsvPreview(null)}
                    className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-lg cursor-pointer"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmCsvPreview}
                    className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer"
                  >
                    確認匯入此欄位 (
                    {
                      extractNamesFromCsvPreview(
                        csvPreview,
                        selectedCsvCol,
                        skipHeaderRow
                      ).length
                    }{' '}
                    筆)
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Paste Text Zone */}
          <div className="mt-6 pt-6 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <label
                htmlFor="paste-names-input"
                className="text-sm font-semibold text-slate-800"
              >
                方式二：直接貼上學生姓名
              </label>
              <span className="text-xs text-slate-500 tabular-nums">
                {parsedPreviewNames.length > 0
                  ? `已辨識 ${parsedPreviewNames.length} 位學生`
                  : '支援換行、逗號或 Tab 分隔'}
              </span>
            </div>

            <textarea
              id="paste-names-input"
              rows={6}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={`請從 Excel、Word 或記事本複製貼上學生姓名，例如：\n林宇軒\n陳思穎\n張哲維\n或以逗號分隔：林宇軒, 陳思穎, 張哲維`}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
            />

            <div className="mt-3 flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => setPasteText('')}
                disabled={!pasteText}
                className="text-xs font-medium text-slate-500 hover:text-slate-800 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              >
                清除輸入框
              </button>
              <button
                type="button"
                onClick={handlePasteSubmit}
                disabled={parsedPreviewNames.length === 0}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
                {importMode === 'replace' ? '套用為班級名單' : '加入至現有名單'}
                {parsedPreviewNames.length > 0 && (
                  <span className="tabular-nums">({parsedPreviewNames.length})</span>
                )}
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Right Column: Current Active Roster (5 cols) */}
      <div className="lg:col-span-5">
        <section className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-bold text-slate-900">目前班級名單</h2>
              <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                共 {students.length} 位學生 · 自動儲存於本機瀏覽器
              </p>
            </div>

            {students.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  onClearStudents();
                  classroomAudio.playClick();
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                清空名單
              </button>
            )}
          </div>

          {/* Quick Single Add */}
          <form onSubmit={handleQuickAdd} className="mt-4 flex gap-2">
            <input
              type="text"
              value={quickName}
              onChange={(e) => setQuickName(e.target.value)}
              placeholder="新增單一學生姓名…"
              className="flex-1 min-w-0 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <button
              type="submit"
              disabled={!quickName.trim()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:cursor-not-allowed"
            >
              <UserPlus className="w-4 h-4" />
              新增
            </button>
          </form>

          {/* Search Filter */}
          {students.length > 6 && (
            <div className="mt-3 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜尋學生姓名…"
                className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
              />
            </div>
          )}

          {/* Student List */}
          {students.length === 0 ? (
            <div className="py-12 text-center">
              <div className="mx-auto w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                <Users className="w-6 h-6" />
              </div>
              <p className="text-sm font-medium text-slate-700">
                尚未匯入任何學生名單
              </p>
              <p className="text-xs text-slate-500 mt-1">
                請從左側上傳 CSV、貼上姓名，或點選「載入範例班級」
              </p>
            </div>
          ) : (
            <div className="mt-4 max-h-[380px] overflow-y-auto pr-1 divide-y divide-slate-100">
              {filteredStudents.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">
                  找不到符合「{searchQuery}」的學生
                </p>
              ) : (
                filteredStudents.map((student) => {
                  const seatIndex =
                    students.findIndex((s) => s.id === student.id) + 1;
                  return (
                    <div
                      key={student.id}
                      className="flex items-center justify-between py-2.5 px-2 rounded-lg hover:bg-slate-50 transition-colors group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-7 text-xs font-mono-nums text-slate-400 tabular-nums shrink-0">
                          {String(seatIndex).padStart(2, '0')}
                        </span>
                        <span className="text-sm font-medium text-slate-800 truncate">
                          {student.name}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onRemoveStudent(student.id)}
                        aria-label={`移除 ${student.name}`}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md opacity-70 group-hover:opacity-100 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Quick Jump Actions */}
          {students.length > 0 && (
            <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => onNavigate('draw')}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                前往隨機抽籤
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onNavigate('group')}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                前往自動分組
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
