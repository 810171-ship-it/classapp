class ClassroomAudio {
  private ctx: AudioContext | null = null;
  private enabled = true;

  private getContext(): AudioContext | null {
    if (!this.enabled || typeof window === 'undefined') {
      return null;
    }
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Subtle tactile UI click
   */
  public playClick() {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(280, now + 0.035);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.045);
  }

  /**
   * Wooden marimba tick played on each name transition during random draw.
   * Pitch rises slightly as progress approaches 1.0 to build anticipation.
   */
  public playTick(progress: number) {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    // Pentatonic-inspired pitch rise from ~420Hz to ~740Hz
    const baseFreq = 420 + Math.min(1, Math.max(0, progress)) * 320;
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.65, now + 0.055);

    const volume = 0.14 + progress * 0.06;
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.07);
  }

  /**
   * Joyful classroom chime fanfare when a student is selected.
   */
  public playWinnerFanfare() {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    // C5 - E5 - G5 - C6 - E6 bright ascending chime
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51];

    notes.forEach((freq, idx) => {
      const start = now + idx * 0.075;
      const osc = ctx.createOscillator();
      const overtone = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      overtone.type = 'triangle';
      overtone.frequency.setValueAtTime(freq * 2, start);

      const overtoneGain = ctx.createGain();
      overtoneGain.gain.setValueAtTime(0.03, start);
      overtoneGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.28);

      const peak = idx === notes.length - 1 ? 0.22 : 0.15;
      const decay = idx === notes.length - 1 ? 0.95 : 0.45;

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(peak, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0005, start + decay);

      osc.connect(gain);
      overtone.connect(overtoneGain);
      overtoneGain.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      overtone.start(start);
      osc.stop(start + decay + 0.05);
      overtone.stop(start + decay + 0.05);
    });
  }

  /**
   * Brisk ascending cascade when groups are generated.
   */
  public playGroupShuffle() {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [392.0, 493.88, 587.33, 783.99];

    notes.forEach((freq, idx) => {
      const start = now + idx * 0.06;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.13, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0005, start + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + 0.38);
    });
  }
}

export const classroomAudio = new ClassroomAudio();
