import { useEffect, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { RosterPanel } from './components/RosterPanel';
import { LuckyDrawStage } from './components/LuckyDrawStage';
import {
  GroupingStage,
  buildBalancedGroups,
} from './components/GroupingStage';
import { AppTab, DrawRecord, Group, RemainderMode, Student } from './types';
import { classroomAudio } from './utils/sound';

const STORAGE_KEY = 'classroom_picker_grouper_v1';

interface SavedState {
  students: Student[];
  allowRepeat: boolean;
  drawHistory: DrawRecord[];
  groupSize: number;
  remainderMode: RemainderMode;
  soundEnabled: boolean;
}

function loadSavedState(): SavedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SavedState>;
      return {
        students: Array.isArray(parsed.students) ? parsed.students : [],
        allowRepeat:
          typeof parsed.allowRepeat === 'boolean' ? parsed.allowRepeat : false,
        drawHistory: Array.isArray(parsed.drawHistory)
          ? parsed.drawHistory
          : [],
        groupSize:
          typeof parsed.groupSize === 'number' && parsed.groupSize >= 2
            ? parsed.groupSize
            : 4,
        remainderMode:
          parsed.remainderMode === 'separate' ? 'separate' : 'distribute',
        soundEnabled:
          typeof parsed.soundEnabled === 'boolean' ? parsed.soundEnabled : true,
      };
    }
  } catch {
    // Ignore malformed localStorage
  }

  return {
    students: [],
    allowRepeat: false,
    drawHistory: [],
    groupSize: 4,
    remainderMode: 'distribute',
    soundEnabled: true,
  };
}

function makeStudentId(index: number): string {
  return `stu-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`;
}

export default function App() {
  const [initial] = useState<SavedState>(() => loadSavedState());

  const [students, setStudents] = useState<Student[]>(initial.students);
  const [allowRepeat, setAllowRepeat] = useState<boolean>(initial.allowRepeat);
  const [drawHistory, setDrawHistory] = useState<DrawRecord[]>(
    initial.drawHistory
  );
  const [groupSize, setGroupSize] = useState<number>(initial.groupSize);
  const [remainderMode, setRemainderMode] = useState<RemainderMode>(
    initial.remainderMode
  );
  const [groups, setGroups] = useState<Group[]>([]);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(
    initial.soundEnabled
  );
  const [activeTab, setActiveTab] = useState<AppTab>(() =>
    initial.students.length > 0 ? 'draw' : 'roster'
  );

  useEffect(() => {
    classroomAudio.setEnabled(soundEnabled);
  }, [soundEnabled]);

  useEffect(() => {
    try {
      const payload: SavedState = {
        students,
        allowRepeat,
        drawHistory,
        groupSize,
        remainderMode,
        soundEnabled,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage quota errors
    }
  }, [
    students,
    allowRepeat,
    drawHistory,
    groupSize,
    remainderMode,
    soundEnabled,
  ]);

  const handleReplaceStudents = (names: string[]) => {
    const nextStudents: Student[] = names.map((name, idx) => ({
      id: makeStudentId(idx),
      name,
    }));
    setStudents(nextStudents);
    setDrawHistory([]);
    setGroups(
      nextStudents.length > 0
        ? buildBalancedGroups(nextStudents, groupSize, remainderMode)
        : []
    );
  };

  const handleAppendStudents = (names: string[]) => {
    const nextAdditions: Student[] = names.map((name, idx) => ({
      id: makeStudentId(idx),
      name,
    }));
    const updated = [...students, ...nextAdditions];
    setStudents(updated);
    if (groups.length > 0) {
      setGroups(buildBalancedGroups(updated, groupSize, remainderMode));
    }
  };

  const handleRemoveStudent = (id: string) => {
    const updated = students.filter((s) => s.id !== id);
    setStudents(updated);
    setDrawHistory((prev) => prev.filter((r) => r.studentId !== id));
    setGroups((prev) =>
      prev
        .map((g) => ({
          ...g,
          members: g.members.filter((m) => m.id !== id),
        }))
        .filter((g) => g.members.length > 0)
    );
  };

  const handleClearStudents = () => {
    setStudents([]);
    setDrawHistory([]);
    setGroups([]);
  };

  const handleRecordDraw = (student: Student) => {
    setDrawHistory((prev) => [
      {
        id: `draw-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        studentId: student.id,
        studentName: student.name,
        timestamp: Date.now(),
        roundNumber: prev.length + 1,
      },
      ...prev,
    ]);
  };

  const handleRemoveDrawRecord = (recordId: string) => {
    setDrawHistory((prev) => prev.filter((r) => r.id !== recordId));
    classroomAudio.playClick();
  };

  const handleResetHistory = () => {
    setDrawHistory([]);
  };

  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    classroomAudio.setEnabled(next);
    if (next) {
      classroomAudio.playClick();
    }
  };

  const handleNavigate = (tab: AppTab) => {
    setActiveTab(tab);
    if (tab === 'group' && groups.length === 0 && students.length > 0) {
      setGroups(buildBalancedGroups(students, groupSize, remainderMode));
    }
    classroomAudio.playClick();
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* 3-Zone Single-Row Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Wordmark */}
          <button
            type="button"
            onClick={() => handleNavigate('roster')}
            className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer text-left"
          >
            課堂抽籤分組系統
          </button>

          {/* Zone 2: Concise single-line Navigation Links */}
          <nav
            aria-label="主要功能切換"
            className="flex items-center gap-6 sm:gap-8 text-sm font-semibold"
          >
            <button
              type="button"
              onClick={() => handleNavigate('roster')}
              className={`py-5 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'roster'
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              名單來源
            </button>
            <button
              type="button"
              onClick={() => handleNavigate('draw')}
              className={`py-5 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'draw'
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              隨機抽籤
            </button>
            <button
              type="button"
              onClick={() => handleNavigate('group')}
              className={`py-5 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'group'
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              自動分組
            </button>
          </nav>

          {/* Zone 3: 1 Primary Action */}
          <div className="shrink-0 hidden sm:block">
            <button
              type="button"
              onClick={handleToggleSound}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {soundEnabled ? (
                <>
                  <Volume2 className="w-3.5 h-3.5" />
                  音效：開啟
                </>
              ) : (
                <>
                  <VolumeX className="w-3.5 h-3.5" />
                  音效：靜音
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Subtle unboxed context strip */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <div className="flex items-center gap-2 tabular-nums">
            <span>目前名單：{students.length} 位學生</span>
            <span aria-hidden="true">·</span>
            <span>
              抽籤模式：{allowRepeat ? '可重複抽取' : '不重複抽取'}
            </span>
            <span aria-hidden="true">·</span>
            <span>預設分組：每組 {groupSize} 人</span>
          </div>
          <button
            type="button"
            onClick={handleToggleSound}
            className="sm:hidden inline-flex items-center gap-1.5 text-slate-600 hover:text-slate-900 font-medium cursor-pointer"
          >
            {soundEnabled ? (
              <>
                <Volume2 className="w-3.5 h-3.5 text-blue-600" />
                音效開啟
              </>
            ) : (
              <>
                <VolumeX className="w-3.5 h-3.5" />
                音效靜音
              </>
            )}
          </button>
        </div>

        {activeTab === 'roster' && (
          <RosterPanel
            students={students}
            onReplaceStudents={handleReplaceStudents}
            onAppendStudents={handleAppendStudents}
            onRemoveStudent={handleRemoveStudent}
            onClearStudents={handleClearStudents}
            onNavigate={handleNavigate}
          />
        )}

        {activeTab === 'draw' && (
          <LuckyDrawStage
            students={students}
            allowRepeat={allowRepeat}
            onChangeAllowRepeat={setAllowRepeat}
            drawHistory={drawHistory}
            onRecordDraw={handleRecordDraw}
            onRemoveDrawRecord={handleRemoveDrawRecord}
            onResetHistory={handleResetHistory}
            soundEnabled={soundEnabled}
            onToggleSound={handleToggleSound}
            onNavigate={handleNavigate}
          />
        )}

        {activeTab === 'group' && (
          <GroupingStage
            students={students}
            groupSize={groupSize}
            onChangeGroupSize={setGroupSize}
            remainderMode={remainderMode}
            onChangeRemainderMode={setRemainderMode}
            groups={groups}
            onSetGroups={setGroups}
            onNavigate={handleNavigate}
          />
        )}
      </main>
    </div>
  );
}
