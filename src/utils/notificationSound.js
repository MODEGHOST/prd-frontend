let audioContext;
let pendingSound = false;

function getContext() {
  if (typeof window === "undefined") return null;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return null;
  if (audioContext?.state === "closed") audioContext = null;
  audioContext ||= new AudioContext();
  return audioContext;
}

function emitNotificationTone(context) {
  const now = context.currentTime;
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.55, now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.35, now + 0.18);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);
  gain.connect(context.destination);

  [
    { delay: 0, freq: 740 },
    { delay: 0.14, freq: 990 },
    { delay: 0.28, freq: 1180 },
  ].forEach(({ delay, freq }) => {
    const oscillator = context.createOscillator();
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(freq, now + delay);
    oscillator.connect(gain);
    oscillator.start(now + delay);
    oscillator.stop(now + delay + 0.28);
  });
}

function playPendingSound(context) {
  if (context?.state !== "running" || !pendingSound) return;
  pendingSound = false;
  emitNotificationTone(context);
}

export async function unlockNotificationSound() {
  const context = getContext();
  if (context?.state === "suspended") {
    try {
      await context.resume();
    } catch {
      // Browser ยังไม่อนุญาตให้เล่นเสียงจนกว่าจะมี interaction
    }
  }
  playPendingSound(context);
}

export function playNotificationSound() {
  const context = getContext();
  if (!context) return;
  if (context.state === "running") {
    emitNotificationTone(context);
    return;
  }
  pendingSound = true;
  if (context.state === "suspended") {
    context.resume()
      .then(() => playPendingSound(context))
      .catch(() => {
        // จะลองอีกครั้งจาก pointer/keyboard interaction ถัดไป
      });
  }
}
