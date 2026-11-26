import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  History,
  Play,
  RotateCcw,
  Sparkles,
  UserCheck,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { AppTab, DrawRecord, Student } from '../types';
import { classroomAudio } from '../utils/sound';

interface LuckyDrawStageProps {
  students: Student[];
  allowRepeat: boolean;
  onChangeAllowRepeat: (val: boolean) => void;
  drawHistory: DrawRecord[];
  onRecordDraw: (student: Student) => void;
  onRemoveDrawRecord: (recordId: string) => void;
  onResetHistory: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onNavigate: (tab: AppTab) => void;
}

interface ConfettiParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  vRot: number;
  alpha: number;
}

const CONFETTI_COLORS = [
  '#2563EB',
  '#D97706',
  '#059669',
  '#E11D48',
  '#0284C7',
  '#F59E0B',
];

export const LuckyDrawStage: React.FC<LuckyDrawStageProps> = ({
  students,
  allowRepeat,
  onChangeAllowRepeat,
  drawHistory,
  onRecordDraw,
  onRemoveDrawRecord,
  onResetHistory,
  soundEnabled,
  onToggleSound,
  onNavigate,
}) => {
  const [isDrawing, setIsDrawing] = useState(false);
  const [spotlightName, setSpotlightName] = useState<string | null>(null);
  const [prevNeighbor, setPrevNeighbor] = useState<string | null>(null);
  const [nextNeighbor, setNextNeighbor] = useState<string | null>(null);
  const [winner, setWinner] = useState<Student | null>(null);
  const [revealKey, setRevealKey] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawFrameRef = useRef<number | null>(null);
  const confettiFrameRef = useRef<number | null>(null);

  const drawnIds = useMemo(
    () => new Set(drawHistory.map((r) => r.studentId)),
    [drawHistory]
  );

  const availableStudents = useMemo(() => {
    if (allowRepeat) return students;
    return students.filter((s) => !drawnIds.has(s.id));
  }, [students, allowRepeat, drawnIds]);

  useEffect(() => {
    return () => {
      if (drawFrameRef.current) cancelAnimationFrame(drawFrameRef.current);
      if (confettiFrameRef.current) cancelAnimationFrame(confettiFrameRef.current);
    };
  }, []);

  const launchConfetti = () => {
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const centerX = rect.width / 2;
    const centerY = rect.height * 0.48;

    const particles: ConfettiParticle[] = Array.from({ length: 72 }, () => {
      const angle = Math.random() * Math.PI * 2;
      const speed = 3 + Math.random() * 8;
      return {
        x: centerX,
        y: centerY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 3.5,
        size: 5 + Math.random() * 6,
        color:
          CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 0.25,
        alpha: 1,
      };
    });

    if (confettiFrameRef.current) {
      cancelAnimationFrame(confettiFrameRef.current);
    }

    const animate = () => {
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, rect.width, rect.height);

      let alive = false;
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.22; // gravity
        p.vx *= 0.985;
        p.rotation += p.vRot;
        p.alpha -= 0.012;

        if (p.alpha > 0.02) {
          alive = true;
          ctx.save();
          ctx.globalAlpha = Math.max(0, p.alpha);
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 3, p.size, (p.size * 2) / 3);
          ctx.restore();
        }
      }

      ctx.restore();
      if (alive) {
        confettiFrameRef.current = requestAnimationFrame(animate);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };

    confettiFrameRef.current = requestAnimationFrame(animate);
  };

  const handleStartDraw = () => {
    if (isDrawing || availableStudents.length === 0) return;

    const chosenIndex = Math.floor(Math.random() * availableStudents.length);
    const chosenStudent = availableStudents[chosenIndex];

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion || students.length === 1) {
      setWinner(chosenStudent);
      setSpotlightName(chosenStudent.name);
      setPrevNeighbor(null);
      setNextNeighbor(null);
      setRevealKey((k) => k + 1);
      onRecordDraw(chosenStudent);
      classroomAudio.playWinnerFanfare();
      return;
    }

    setIsDrawing(true);
    setWinner(null);

    // Build a pool of cycling names for visual suspense (use full roster for smoother reel if pool is small)
    const reelPool =
      availableStudents.length >= 4 ? availableStudents : students;

    // Generate decelerating step timestamps over ~2550ms
    const totalDuration = 2550;
    const totalSteps = 26;
    const stepTimes: number[] = [];
    for (let i = 0; i < totalSteps; i++) {
      // Inverse cubic-out spacing: fast at start, dramatic slowdown near end
      const t = i / (totalSteps - 1);
      const eased = 1 - Math.pow(1 - t, 2.6);
      stepTimes.push(eased * totalDuration);
    }

    let currentStep = 0;
    let lastPoolIdx = -1;
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;

      while (
        currentStep < totalSteps &&
        elapsed >= stepTimes[currentStep]
      ) {
        const isFinalStep = currentStep === totalSteps - 1;
        let displayStudent: Student;

        if (isFinalStep) {
          displayStudent = chosenStudent;
        } else {
          let nextIdx = Math.floor(Math.random() * reelPool.length);
          if (reelPool.length > 1 && nextIdx === lastPoolIdx) {
            nextIdx = (nextIdx + 1) % reelPool.length;
          }
          lastPoolIdx = nextIdx;
          displayStudent = reelPool[nextIdx];
        }

        const idxInPool = reelPool.findIndex((s) => s.id === displayStudent.id);
        const safeIdx = idxInPool >= 0 ? idxInPool : 0;
        const prev =
          reelPool[(safeIdx - 1 + reelPool.length) % reelPool.length];
        const next = reelPool[(safeIdx + 1) % reelPool.length];

        setSpotlightName(displayStudent.name);
        setPrevNeighbor(reelPool.length > 2 ? prev.name : null);
        setNextNeighbor(reelPool.length > 2 ? next.name : null);

        if (!isFinalStep) {
          classroomAudio.playTick(currentStep / (totalSteps - 1));
        }

        currentStep++;
      }

      if (currentStep < totalSteps) {
        drawFrameRef.current = requestAnimationFrame(tick);
      } else {
        setIsDrawing(false);
        setWinner(chosenStudent);
        setSpotlightName(chosenStudent.name);
        setRevealKey((k) => k + 1);
        onRecordDraw(chosenStudent);
        classroomAudio.playWinnerFanfare();
        launchConfetti();
      }
    };

    drawFrameRef.current = requestAnimationFrame(tick);
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
          請先前往「名單來源」上傳 CSV 或貼上學生姓名，即可開始使用隨機抽籤功能。
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

  const poolExhausted = !allowRepeat && availableStudents.length === 0;

  return (
    <div className="space-y-6">
      {/* Two-Zone Sandbox Layout: Stage (8 cols) + Controls & History (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Main Interactive Stage */}
        <section className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-6 sm:p-8 flex flex-col justify-between relative overflow-hidden min-h-[460px]">
          <canvas
            ref={canvasRef}
            className="pointer-events-none absolute inset-0 w-full h-full z-20"
            aria-hidden="true"
          />

          {/* Top Stage Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 relative z-10">
            <div>
              <h1 className="text-xl font-bold text-slate-900">課堂隨機抽籤</h1>
              <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                全班共 {students.length} 人
                <span aria-hidden="true" className="mx-1.5">
                  ·
                </span>
                {allowRepeat
                  ? '可重複抽取模式'
                  : `剩餘 ${availableStudents.length} 位未抽`}
              </p>
            </div>

            <button
              type="button"
              onClick={onToggleSound}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {soundEnabled ? (
                <>
                  <Volume2 className="w-4 h-4 text-blue-600" />
                  音效開啟中
                </>
              ) : (
                <>
                  <VolumeX className="w-4 h-4 text-slate-400" />
                  目前靜音
                </>
              )}
            </button>
          </div>

          {/* Center Spotlight Reel */}
          <div className="my-auto py-10 flex flex-col items-center justify-center text-center relative z-10">
            {poolExhausted && !isDrawing && !winner ? (
              <div className="max-w-md space-y-4">
                <div className="mx-auto w-14 h-14 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900">
                  全班 {students.length} 位學生皆已抽過！
                </h2>
                <p className="text-sm text-slate-500">
                  目前設定為「不重複抽取」，您可以重置抽籤紀錄展開新一輪，或切換為「可重複抽取」。
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onResetHistory();
                    setWinner(null);
                    setSpotlightName(null);
                    classroomAudio.playClick();
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  重置並開始新一輪
                </button>
              </div>
            ) : (
              <div className="w-full max-w-xl">
                {/* Reel Neighbor Top */}
                <div className="h-7 flex items-center justify-center">
                  {isDrawing && prevNeighbor && (
                    <span className="text-lg font-medium text-slate-300 select-none transition-opacity">
                      {prevNeighbor}
                    </span>
                  )}
                  {!isDrawing && winner && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                      <Sparkles className="w-3.5 h-3.5" />
                      第 {drawHistory[0]?.roundNumber ?? 1} 位中選學生
                    </span>
                  )}
                </div>

                {/* Main Spotlight Card */}
                <div
                  key={winner ? `win-${revealKey}` : 'idle'}
                  className={`mt-2 mb-2 px-8 py-10 rounded-2xl border transition-all duration-200 ${
                    winner && !isDrawing
                      ? 'bg-blue-50/70 border-blue-300 shadow-sm animate-pop-in'
                      : isDrawing
                      ? 'bg-slate-50 border-slate-300'
                      : 'bg-slate-50/70 border-slate-200'
                  }`}
                >
                  <div
                    className={`font-bold tracking-tight text-slate-900 break-words leading-tight ${
                      spotlightName
                        ? 'text-4xl sm:text-6xl'
                        : 'text-2xl sm:text-3xl text-slate-400 font-semibold'
                    }`}
                  >
                    {spotlightName ?? '準備就緒，點擊下方按鈕開始抽籤'}
                  </div>

                  {winner && !isDrawing && (
                    <p className="mt-3 text-sm text-slate-600 tabular-nums">
                      座號 #
                      {String(
                        students.findIndex((s) => s.id === winner.id) + 1
                      ).padStart(2, '0')}
                      <span aria-hidden="true" className="mx-2">
                        ·
                      </span>
                      {allowRepeat
                        ? '可重複抽取'
                        : `抽後剩餘 ${availableStudents.length} 人`}
                    </p>
                  )}
                </div>

                {/* Reel Neighbor Bottom */}
                <div className="h-7 flex items-center justify-center">
                  {isDrawing && nextNeighbor && (
                    <span className="text-lg font-medium text-slate-300 select-none transition-opacity">
                      {nextNeighbor}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Primary Action Bar */}
          <div className="flex flex-wrap items-center justify-center gap-3 relative z-10 pt-2">
            <button
              type="button"
              onClick={handleStartDraw}
              disabled={isDrawing || poolExhausted}
              className="inline-flex items-center justify-center gap-2.5 px-8 py-3.5 text-base font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.99] disabled:bg-slate-200 disabled:text-slate-400 rounded-xl transition-all whitespace-nowrap shrink-0 cursor-pointer disabled:cursor-not-allowed min-w-[200px]"
            >
              <Play className="w-5 h-5 fill-current" />
              {isDrawing
                ? '隨機抽選中…'
                : poolExhausted
                ? '名單已全數抽完'
                : winner
                ? '再抽下一位'
                : '開始隨機抽籤'}
            </button>

            {!allowRepeat && drawHistory.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  onResetHistory();
                  setWinner(null);
                  setSpotlightName(null);
                  classroomAudio.playClick();
                }}
                disabled={isDrawing}
                className="inline-flex items-center gap-2 px-4 py-3.5 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                重置已抽名單
              </button>
            )}
          </div>
        </section>

        {/* Right Control & History Deck */}
        <aside className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between gap-6">
          <div className="space-y-6">
            {/* Repeatability Setting */}
            <div>
              <h2 className="text-sm font-bold text-slate-900 mb-3">
                抽取規則設定
              </h2>
              <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => {
                    onChangeAllowRepeat(false);
                    classroomAudio.playClick();
                  }}
                  disabled={isDrawing}
                  className={`px-3 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    !allowRepeat
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  不重複抽取
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onChangeAllowRepeat(true);
                    classroomAudio.playClick();
                  }}
                  disabled={isDrawing}
                  className={`px-3 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    allowRepeat
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  可重複抽取
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-2.5 leading-relaxed">
                {allowRepeat
                  ? '每次抽籤皆從全班名單隨機選出，同一位學生可能再次被抽中。'
                  : '每位學生被抽中後會暫時移出待抽池，直到全部抽完或手動重置。'}
              </p>
            </div>

            {/* Pool Progress */}
            {!allowRepeat && (
              <div className="pt-5 border-t border-slate-100">
                <div className="flex items-center justify-between text-xs font-medium text-slate-600 mb-2 tabular-nums">
                  <span>本輪進度</span>
                  <span>
                    已抽 {drawnIds.size} / {students.length} 人
                  </span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 transition-all duration-300"
                    style={{
                      width: `${
                        students.length > 0
                          ? Math.min(100, (drawnIds.size / students.length) * 100)
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* History List */}
            <div className="pt-5 border-t border-slate-100">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
                  <History className="w-4 h-4 text-slate-500" />
                  <span>抽籤紀錄</span>
                  <span className="text-xs font-normal text-slate-500 tabular-nums">
                    ({drawHistory.length})
                  </span>
                </div>
                {drawHistory.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      onResetHistory();
                      setWinner(null);
                      classroomAudio.playClick();
                    }}
                    disabled={isDrawing}
                    className="text-xs font-medium text-slate-500 hover:text-slate-900 cursor-pointer"
                  >
                    全部清除
                  </button>
                )}
              </div>

              {drawHistory.length === 0 ? (
                <p className="py-8 text-center text-xs text-slate-400">
                  尚未進行抽籤
                </p>
              ) : (
                <ul className="max-h-[260px] overflow-y-auto divide-y divide-slate-100 pr-1">
                  {drawHistory.map((record) => (
                    <li
                      key={record.id}
                      className="flex items-center justify-between py-2 text-sm"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-xs font-mono-nums text-slate-400 tabular-nums w-6 shrink-0">
                          #{record.roundNumber}
                        </span>
                        <span className="font-medium text-slate-800 truncate">
                          {record.studentName}
                        </span>
                      </div>
                      {!allowRepeat && (
                        <button
                          type="button"
                          onClick={() => onRemoveDrawRecord(record.id)}
                          className="text-xs text-slate-400 hover:text-blue-600 whitespace-nowrap shrink-0 cursor-pointer"
                          title="將此學生放回待抽名單"
                        >
                          放回名單
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* Glanceable Student Pool Grid */}
      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-slate-600" />
            <h2 className="text-sm font-bold text-slate-900">
              全班名單狀態一覽
            </h2>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span>未抽中：可參與抽籤</span>
            <span aria-hidden="true">·</span>
            <span>已抽中：標示完成記號</span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5">
          {students.map((student, idx) => {
            const isDrawn = !allowRepeat && drawnIds.has(student.id);
            const isCurrentWinner = winner?.id === student.id && !isDrawing;
            return (
              <div
                key={student.id}
                className={`px-3 py-2 rounded-lg border text-sm flex items-center justify-between gap-1.5 transition-colors ${
                  isCurrentWinner
                    ? 'bg-blue-600 text-white border-blue-600 font-semibold'
                    : isDrawn
                    ? 'bg-slate-50 text-slate-400 border-slate-100 line-through'
                    : 'bg-white text-slate-800 border-slate-200'
                }`}
              >
                <span className="truncate">
                  <span
                    className={`text-[11px] font-mono-nums mr-1.5 ${
                      isCurrentWinner ? 'text-blue-100' : 'text-slate-400'
                    }`}
                  >
                    {idx + 1}
                  </span>
                  {student.name}
                </span>
                {isDrawn && !isCurrentWinner && (
                  <CheckCircle2
                    className="w-3.5 h-3.5 text-emerald-600 shrink-0"
                    aria-label="已抽中"
                  />
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
