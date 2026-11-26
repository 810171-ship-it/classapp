import React, { useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  Check,
  Copy,
  Download,
  Minus,
  Plus,
  Shuffle,
  Users,
} from 'lucide-react';
import { AppTab, Group, RemainderMode, Student } from '../types';
import { exportGroupsToCsv } from '../utils/csvParser';
import { classroomAudio } from '../utils/sound';

interface GroupingStageProps {
  students: Student[];
  groupSize: number;
  onChangeGroupSize: (size: number) => void;
  remainderMode: RemainderMode;
  onChangeRemainderMode: (mode: RemainderMode) => void;
  groups: Group[];
  onSetGroups: (groups: Group[]) => void;
  onNavigate: (tab: AppTab) => void;
}

interface TeamTheme {
  accentText: string;
  accentBg: string;
  tileHover: string;
  shape: 'circle' | 'triangle' | 'square' | 'diamond' | 'hexagon' | 'star';
}

const TEAM_THEMES: TeamTheme[] = [
  {
    accentText: 'text-blue-700',
    accentBg: 'bg-blue-50',
    tileHover: 'hover:bg-blue-50/70',
    shape: 'circle',
  },
  {
    accentText: 'text-emerald-700',
    accentBg: 'bg-emerald-50',
    tileHover: 'hover:bg-emerald-50/70',
    shape: 'triangle',
  },
  {
    accentText: 'text-amber-700',
    accentBg: 'bg-amber-50',
    tileHover: 'hover:bg-amber-50/70',
    shape: 'square',
  },
  {
    accentText: 'text-rose-700',
    accentBg: 'bg-rose-50',
    tileHover: 'hover:bg-rose-50/70',
    shape: 'diamond',
  },
  {
    accentText: 'text-cyan-700',
    accentBg: 'bg-cyan-50',
    tileHover: 'hover:bg-cyan-50/70',
    shape: 'hexagon',
  },
  {
    accentText: 'text-indigo-700',
    accentBg: 'bg-indigo-50',
    tileHover: 'hover:bg-indigo-50/70',
    shape: 'star',
  },
];

const TeamEmblem: React.FC<{
  shape: TeamTheme['shape'];
  className?: string;
}> = ({ shape, className = 'w-4 h-4' }) => {
  switch (shape) {
    case 'circle':
      return (
        <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true">
          <circle cx="10" cy="10" r="7" />
        </svg>
      );
    case 'triangle':
      return (
        <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true">
          <path d="M10 3L17.5 16.5H2.5L10 3Z" />
        </svg>
      );
    case 'square':
      return (
        <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true">
          <rect x="3.5" y="3.5" width="13" height="13" rx="2" />
        </svg>
      );
    case 'diamond':
      return (
        <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true">
          <path d="M10 2L18 10L10 18L2 10L10 2Z" />
        </svg>
      );
    case 'hexagon':
      return (
        <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true">
          <path d="M10 2L17 6V14L10 18L3 14V6L10 2Z" />
        </svg>
      );
    case 'star':
      return (
        <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true">
          <path d="M10 2L12.4 7.2L18 7.9L13.8 11.7L14.9 17.3L10 14.5L5.1 17.3L6.2 11.7L2 7.9L7.6 7.2L10 2Z" />
        </svg>
      );
  }
};

function shuffleArray<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function buildBalancedGroups(
  students: Student[],
  groupSize: number,
  remainderMode: RemainderMode
): Group[] {
  if (students.length === 0) return [];
  const safeSize = Math.max(1, Math.min(groupSize, students.length));
  const shuffled = shuffleArray(students);

  if (remainderMode === 'separate') {
    const groups: Group[] = [];
    for (let i = 0; i < shuffled.length; i += safeSize) {
      const idx = groups.length + 1;
      groups.push({
        id: `group-${idx}-${Date.now()}`,
        index: idx,
        name: `第 ${idx} 組`,
        members: shuffled.slice(i, i + safeSize),
      });
    }
    return groups;
  }

  // Distribute remainder evenly across base groups
  const baseGroupCount = Math.max(1, Math.floor(shuffled.length / safeSize));
  const groups: Student[][] = Array.from({ length: baseGroupCount }, () => []);

  let cursor = 0;
  for (let g = 0; g < baseGroupCount; g++) {
    groups[g].push(...shuffled.slice(cursor, cursor + safeSize));
    cursor += safeSize;
  }

  // Distribute remaining students one-by-one from group 0
  let remIdx = 0;
  while (cursor < shuffled.length) {
    groups[remIdx % baseGroupCount].push(shuffled[cursor]);
    cursor++;
    remIdx++;
  }

  return groups.map((members, idx) => ({
    id: `group-${idx + 1}-${Date.now()}`,
    index: idx + 1,
    name: `第 ${idx + 1} 組`,
    members,
  }));
}

export const GroupingStage: React.FC<GroupingStageProps> = ({
  students,
  groupSize,
  onChangeGroupSize,
  remainderMode,
  onChangeRemainderMode,
  groups,
  onSetGroups,
  onNavigate,
}) => {
  const [selectedForSwap, setSelectedForSwap] = useState<{
    groupId: string;
    studentId: string;
    studentName: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [shuffleKey, setShuffleKey] = useState(0);

  const previewSummary = useMemo(() => {
    const total = students.length;
    if (total === 0) return { groupCount: 0, breakdown: '' };
    const safeSize = Math.max(1, Math.min(groupSize, total));
    const fullGroups = Math.floor(total / safeSize);
    const remainder = total % safeSize;

    if (remainder === 0) {
      return {
        groupCount: fullGroups,
        breakdown: `共 ${fullGroups} 組，每組剛好 ${safeSize} 人`,
      };
    }

    if (remainderMode === 'separate') {
      return {
        groupCount: fullGroups + 1,
        breakdown: `共 ${fullGroups + 1} 組（${fullGroups} 組 ${safeSize} 人 · 最後 1 組 ${remainder} 人）`,
      };
    }

    if (fullGroups === 0) {
      return {
        groupCount: 1,
        breakdown: `共 1 組，共 ${total} 人`,
      };
    }

    const extraPerGroup = Math.floor(remainder / fullGroups);
    const extraCount = remainder % fullGroups;
    const minSize = safeSize + extraPerGroup;
    return {
      groupCount: fullGroups,
      breakdown: `共 ${fullGroups} 組，每組 ${minSize}${
        extraCount > 0 ? `–${minSize + 1}` : ''
      } 人`,
    };
  }, [students.length, groupSize, remainderMode]);

  const handleGenerateGroups = (
    overrideSize?: number,
    overrideMode?: RemainderMode
  ) => {
    const targetSize = overrideSize ?? groupSize;
    const targetMode = overrideMode ?? remainderMode;
    const nextGroups = buildBalancedGroups(students, targetSize, targetMode);
    onSetGroups(nextGroups);
    setSelectedForSwap(null);
    setShuffleKey((k) => k + 1);
    classroomAudio.playGroupShuffle();
  };

  const handleSizeChange = (nextSize: number) => {
    const clamped = Math.max(2, Math.min(20, nextSize));
    onChangeGroupSize(clamped);
    classroomAudio.playClick();
  };

  const handleStudentClick = (groupId: string, student: Student) => {
    if (!selectedForSwap) {
      setSelectedForSwap({
        groupId,
        studentId: student.id,
        studentName: student.name,
      });
      classroomAudio.playClick();
      return;
    }

    if (selectedForSwap.studentId === student.id) {
      setSelectedForSwap(null);
      classroomAudio.playClick();
      return;
    }

    // Perform swap across groups
    const nextGroups = groups.map((g) => ({
      ...g,
      members: [...g.members],
    }));

    const sourceGroup = nextGroups.find((g) => g.id === selectedForSwap.groupId);
    const targetGroup = nextGroups.find((g) => g.id === groupId);

    if (sourceGroup && targetGroup) {
      const sourceIdx = sourceGroup.members.findIndex(
        (m) => m.id === selectedForSwap.studentId
      );
      const targetIdx = targetGroup.members.findIndex(
        (m) => m.id === student.id
      );

      if (sourceIdx >= 0 && targetIdx >= 0) {
        const temp = sourceGroup.members[sourceIdx];
        sourceGroup.members[sourceIdx] = targetGroup.members[targetIdx];
        targetGroup.members[targetIdx] = temp;
        onSetGroups(nextGroups);
        classroomAudio.playClick();
      }
    }

    setSelectedForSwap(null);
  };

  const handleCopyText = async () => {
    if (groups.length === 0) return;
    const text = groups
      .map(
        (g) =>
          `${g.name} (${g.members.length}人)：${g.members
            .map((m) => m.name)
            .join('、')}`
      )
      .join('\n');

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      classroomAudio.playClick();
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard fallback ignored if blocked
    }
  };

  if (students.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center max-w-2xl mx-auto">
        <div className="mx-auto w-14 h-14 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 mb-4">
          <Users className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">
          尚未建立學生名單
        </h2>
        <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">
          請先前往「名單來源」上傳 CSV 或貼上學生姓名，即可進行課堂自動分組。
        </p>
        <button
          type="button"
          onClick={() => onNavigate('roster')}
          className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer"
        >
          前往匯入名單
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Main Visual Group Board (8 cols) */}
      <section className="lg:col-span-8 space-y-4">
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-100">
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                視覺化分組結果
              </h1>
              <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                {groups.length > 0
                  ? `已分成 ${groups.length} 組 · 共 ${students.length} 位學生 · 點選任兩位學生可互換組別`
                  : `全班共 ${students.length} 人 · 請設定每組人數後點擊「開始自動分組」`}
              </p>
            </div>

            <button
              type="button"
              onClick={() => handleGenerateGroups()}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Shuffle className="w-4 h-4" />
              {groups.length > 0 ? '重新隨機分組' : '開始自動分組'}
            </button>
          </div>

          {/* Swap Mode Helper Banner */}
          {selectedForSwap && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-900">
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="w-4 h-4 text-blue-600 shrink-0" />
                <span>
                  已選取 <strong>{selectedForSwap.studentName}</strong>
                  ，請點選另一位學生進行組別互換
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedForSwap(null)}
                className="text-xs font-semibold text-blue-700 hover:text-blue-900 cursor-pointer"
              >
                取消選取
              </button>
            </div>
          )}

          {/* Visual Group Cards Grid */}
          {groups.length === 0 ? (
            <div className="py-16 text-center">
              <div className="mx-auto w-14 h-14 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 mb-4">
                <Users className="w-7 h-7" />
              </div>
              <p className="text-base font-semibold text-slate-800">
                準備為 {students.length} 位學生分組
              </p>
              <p className="text-sm text-slate-500 mt-1">
                {previewSummary.breakdown}
              </p>
              <button
                type="button"
                onClick={() => handleGenerateGroups()}
                className="mt-5 inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer"
              >
                <Shuffle className="w-4 h-4" />
                立即產生分組
              </button>
            </div>
          ) : (
            <div
              key={shuffleKey}
              className="mt-5 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"
            >
              {groups.map((group, idx) => {
                const theme = TEAM_THEMES[idx % TEAM_THEMES.length];
                return (
                  <div
                    key={group.id}
                    style={{ animationDelay: `${Math.min(idx * 35, 280)}ms` }}
                    className="rounded-xl border border-slate-200 bg-white overflow-hidden animate-pop-in"
                  >
                    {/* Group Header */}
                    <div
                      className={`px-4 py-3 ${theme.accentBg} flex items-center justify-between gap-2 border-b border-slate-100`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={theme.accentText}>
                          <TeamEmblem shape={theme.shape} className="w-4 h-4" />
                        </span>
                        <h3 className="text-sm font-bold text-slate-900 truncate">
                          {group.name}
                        </h3>
                      </div>
                      <span className="text-xs font-medium text-slate-600 tabular-nums shrink-0">
                        {group.members.length} 人
                      </span>
                    </div>

                    {/* Member Tiles (clean borderless tonal items, no nested card clutter) */}
                    <div className="p-3 space-y-1.5">
                      {group.members.map((member, mIdx) => {
                        const isSelected =
                          selectedForSwap?.studentId === member.id;
                        return (
                          <button
                            key={member.id}
                            type="button"
                            onClick={() => handleStudentClick(group.id, member)}
                            className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-left text-sm transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-blue-600 text-white font-semibold'
                                : `bg-slate-50 text-slate-800 ${theme.tileHover}`
                            }`}
                          >
                            <span className="flex items-center gap-2.5 min-w-0">
                              <span
                                className={`text-xs font-mono-nums tabular-nums w-4 shrink-0 ${
                                  isSelected
                                    ? 'text-blue-100'
                                    : 'text-slate-400'
                                }`}
                              >
                                {mIdx + 1}
                              </span>
                              <span className="truncate font-medium">
                                {member.name}
                              </span>
                            </span>
                            {isSelected && (
                              <ArrowLeftRight className="w-3.5 h-3.5 text-blue-100 shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Right Control Deck (4 cols) */}
      <aside className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-6 space-y-6">
        <div>
          <h2 className="text-sm font-bold text-slate-900 mb-3">
            分組人數設定
          </h2>

          {/* Stepper */}
          <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
            <button
              type="button"
              onClick={() => handleSizeChange(groupSize - 1)}
              disabled={groupSize <= 2}
              aria-label="減少每組人數"
              className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              <Minus className="w-4 h-4" />
            </button>

            <div className="text-center">
              <div className="text-2xl font-bold text-slate-900 tabular-nums leading-none">
                {groupSize} 人
              </div>
              <div className="text-xs text-slate-500 mt-1">每組目標人數</div>
            </div>

            <button
              type="button"
              onClick={() => handleSizeChange(groupSize + 1)}
              disabled={groupSize >= Math.max(2, students.length)}
              aria-label="增加每組人數"
              className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Size Presets */}
          <div className="mt-3 grid grid-cols-5 gap-1.5">
            {[2, 3, 4, 5, 6].map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => {
                  handleSizeChange(size);
                  handleGenerateGroups(size, remainderMode);
                }}
                className={`py-2 text-xs font-semibold rounded-lg border transition-colors tabular-nums cursor-pointer ${
                  groupSize === size
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                }`}
              >
                {size} 人
              </button>
            ))}
          </div>
        </div>

        {/* Remainder Handling */}
        <div className="pt-5 border-t border-slate-100">
          <h3 className="text-sm font-bold text-slate-900 mb-2.5">
            無法整除時的處理方式
          </h3>
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => {
                onChangeRemainderMode('distribute');
                if (groups.length > 0) {
                  handleGenerateGroups(groupSize, 'distribute');
                }
              }}
              className={`px-2.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                remainderMode === 'distribute'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              餘數平均分配
            </button>
            <button
              type="button"
              onClick={() => {
                onChangeRemainderMode('separate');
                if (groups.length > 0) {
                  handleGenerateGroups(groupSize, 'separate');
                }
              }}
              className={`px-2.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                remainderMode === 'separate'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              獨立成最後一組
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-2.5 tabular-nums">
            預估結果：{previewSummary.breakdown}
          </p>
        </div>

        {/* Visual Distribution Bar */}
        {groups.length > 0 && (
          <div className="pt-5 border-t border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 mb-3">
              各組人數視覺分布
            </h3>
            <div className="space-y-2">
              {groups.map((g, idx) => {
                const maxMembers = Math.max(
                  ...groups.map((item) => item.members.length),
                  1
                );
                const pct = (g.members.length / maxMembers) * 100;
                const theme = TEAM_THEMES[idx % TEAM_THEMES.length];
                return (
                  <div
                    key={g.id}
                    className="flex items-center gap-2.5 text-xs tabular-nums"
                  >
                    <span className={`shrink-0 ${theme.accentText}`}>
                      <TeamEmblem shape={theme.shape} className="w-3.5 h-3.5" />
                    </span>
                    <span className="w-12 text-slate-600 font-medium shrink-0">
                      {g.name}
                    </span>
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-slate-700 rounded-full transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-8 text-right font-mono-nums text-slate-700">
                      {g.members.length}人
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Export Actions */}
        {groups.length > 0 && (
          <div className="pt-5 border-t border-slate-100 space-y-2.5">
            <button
              type="button"
              onClick={handleCopyText}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600" />
                  已複製分組結果
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  複製分組名單文字
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                exportGroupsToCsv(groups);
                classroomAudio.playClick();
              }}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              匯出分組 CSV 檔
            </button>
          </div>
        )}
      </aside>
    </div>
  );
};
