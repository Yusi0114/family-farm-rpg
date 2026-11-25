// js/sound-fx.js

class SoundFXManager {
  constructor() {
    this.ctx = null;
    this.muted = localStorage.getItem('farm_sound_muted') === 'true';
  }

  initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  // 在使用者第一次觸碰手機螢幕時解鎖音效引擎
  unlock() {
    this.initContext();
  }

  isMuted() {
    return this.muted;
  }

  toggleMute() {
    this.muted = !this.muted;
    localStorage.setItem('farm_sound_muted', String(this.muted));
    if (!this.muted) {
      this.unlock();
      this.playCoin(); // 取消靜音時叮一聲提示
    }
    return this.muted;
  }

  // 1. 骰子滾動木頭敲擊聲（每次數字跳動呼叫）
  playDiceTick() {
    if (this.muted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    // 隨機微調音高模擬骰子碰撞桌面的不規則感
    const baseFreq = 260 + Math.random() * 140;
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.045);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.05);
  }

  // 2. 檢定成功清脆和弦
  playSuccess() {
    if (this.muted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    const notes = [523.25, 659.25]; // C5 -> E5
    notes.forEach((freq, idx) => {
      const start = ctx.currentTime + idx * 0.09;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.18, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.28);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.3);
    });
  }

  // 3. 大成功（Natural 20）勝利號角琶音
  playCritSuccess() {
    if (this.muted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 - E5 - G5 - C6
    notes.forEach((freq, idx) => {
      const start = ctx.currentTime + idx * 0.08;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.22, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.36);
    });
  }

  // 4. 檢定失敗／大失敗滑稽下降音
  playFail(isCrit = false) {
    if (this.muted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = isCrit ? 'sawtooth' : 'triangle';

    osc.frequency.setValueAtTime(310, now);
    osc.frequency.linearRampToValueAtTime(isCrit ? 110 : 195, now + (isCrit ? 0.45 : 0.25));

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + (isCrit ? 0.46 : 0.26));

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.48);
  }

  // 5. 經典雙音金幣聲（買賣、賺取公款、刮刮樂中獎）
  playCoin() {
    if (this.muted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    // B5 (987.77Hz) 瞬間跳到 E6 (1318.51Hz)
    osc.frequency.setValueAtTime(987.77, now);
    osc.frequency.setValueAtTime(1318.51, now + 0.075);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.setValueAtTime(0.2, now + 0.075);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.44);
  }

  // 6. 換日早晨公雞叫聲（「喔－喔－喔－喔——」四音節模擬）
  playRooster() {
    if (this.muted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    // 使用鋸齒波搭配低通濾波器，模擬接近真實禽鳥的泛音質感
    osc.type = 'sawtooth';
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(950, now);
    filter.Q.setValueAtTime(2.5, now);

    // 四個音節的音高變化：短-短-短-長拉高再滑落
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.linearRampToValueAtTime(560, now + 0.12);

    osc.frequency.setValueAtTime(480, now + 0.16);
    osc.frequency.linearRampToValueAtTime(640, now + 0.28);

    osc.frequency.setValueAtTime(520, now + 0.32);
    osc.frequency.linearRampToValueAtTime(680, now + 0.44);

    osc.frequency.setValueAtTime(660, now + 0.48);
    osc.frequency.linearRampToValueAtTime(790, now + 0.62);
    osc.frequency.exponentialRampToValueAtTime(340, now + 1.15);

    // 音量包絡線控制音節斷點
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.22, now + 0.03);
    gain.gain.linearRampToValueAtTime(0.02, now + 0.14);

    gain.gain.linearRampToValueAtTime(0.24, now + 0.18);
    gain.gain.linearRampToValueAtTime(0.02, now + 0.30);

    gain.gain.linearRampToValueAtTime(0.25, now + 0.34);
    gain.gain.linearRampToValueAtTime(0.02, now + 0.46);

    gain.gain.linearRampToValueAtTime(0.28, now + 0.52);
    gain.gain.setValueAtTime(0.25, now + 0.85);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.18);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 1.2);
  }
}

export const soundFX = new SoundFXManager();