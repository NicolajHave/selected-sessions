/**
 * Code-resident config for the "Finish the (Out)fit" category.
 *
 * IMPORTANT: contains no copyrighted lyrics. `lyricLines` are placeholder
 * display strings ("Line 1"...) for you to replace manually later, and
 * `correctAnswer` is intentionally left blank — fill it in when needed.
 * Only masked answer patterns, timestamps and audio metadata live here.
 *
 * Keyed by points within the category named exactly "Finish the (Out)fit".
 * The main lyric answer is HOST-SCORED (manual). Only the Q400 bonus is
 * auto-scored.
 */

import type { AudioClipSpec } from '@/lib/audio/types';

export interface FtoAudioSegment {
  src: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  fadeOutSeconds?: number;
}

export interface FtoBonus {
  prompt: string;
  options: string[];
  correct: string;
  /** The option that means "no answer" (scores 0). */
  abstainOption: string;
  correctPoints: number;
  wrongPoints: number;
}

export interface FtoHint {
  cost: number;
  /** Private hint text shown on the buying team's own screen. */
  text: string;
}

export interface FtoEntry {
  points: number;
  title: string;
  track: string;
  prompt: string;
  /** Placeholder display lines — replace with real text manually later. */
  lyricLines: string[];
  /** Masked pattern shown at the hard stop (dashes / punctuation only). */
  maskedAnswer: string;
  /** Final accepted lyric — left blank; fill manually if you want it shown on reveal. */
  correctAnswer: string;
  questionAudio: FtoAudioSegment;
  revealAudio: FtoAudioSegment;
  bonus?: FtoBonus;
  hint?: FtoHint;
}

export const FINISH_THE_OUTFIT_CATEGORY_NAME = 'Finish the (Out)fit';

const A = '/audio/finish-the-outfit';

// Placeholder lines you can edit later (no copyrighted text).
const placeholderLines = ['Line 1', 'Line 2', 'Line 3', 'Line 4'];

export const FINISH_THE_OUTFIT: Record<number, FtoEntry> = {
  100: {
    points: 100,
    title: 'The Easy Fit',
    track: 'Backstreet Boys — I Want It That Way',
    prompt: 'Finish the next line.',
    lyricLines: [...placeholderLines],
    maskedAnswer: "---'- ------' --- - ---------",
    correctAnswer: '',
    questionAudio: {
      src: `${A}/backstreet-boys-i-want-it-that-way.mp3`,
      startTime: 0,
      endTime: 48,
      fadeOutSeconds: 0,
    },
    revealAudio: {
      src: `${A}/backstreet-boys-i-want-it-that-way.mp3`,
      startTime: 48,
      duration: 15,
      fadeOutSeconds: 5,
    },
  },
  200: {
    points: 200,
    title: 'The Mid-Verse Cut',
    track: 'Spice Girls — Wannabe',
    prompt: 'Finish the next line.',
    lyricLines: [...placeholderLines],
    maskedAnswer: "-'-- ---- --- -------",
    correctAnswer: '',
    questionAudio: {
      src: `${A}/spice-girls-wannabe.mp3`,
      startTime: 0,
      endTime: 75,
      fadeOutSeconds: 0,
    },
    revealAudio: {
      src: `${A}/spice-girls-wannabe.mp3`,
      startTime: 75,
      duration: 15,
      fadeOutSeconds: 5,
    },
  },
  300: {
    points: 300,
    title: 'The Nordic Fit',
    track: 'Lukas Graham — Drunk In The Morning',
    prompt: 'Finish the next line.',
    lyricLines: [...placeholderLines],
    maskedAnswer: '--- ----- -- ------, ------',
    correctAnswer: '',
    questionAudio: {
      src: `${A}/lukas-graham-drunk-in-the-morning.mp3`,
      startTime: 0,
      endTime: 69,
      fadeOutSeconds: 0,
    },
    revealAudio: {
      src: `${A}/lukas-graham-drunk-in-the-morning.mp3`,
      startTime: 69,
      duration: 15,
      fadeOutSeconds: 5,
    },
  },
  400: {
    points: 400,
    title: 'The Express Fit',
    track: 'David Guetta — When Love Takes Over feat. Kelly Rowland',
    prompt: 'Finish the next line.',
    lyricLines: [...placeholderLines],
    maskedAnswer: '-- ---- ---- - ----- ---',
    correctAnswer: '',
    questionAudio: {
      src: `${A}/david-guetta-kelly-rowland-when-love-takes-over.mp3`,
      startTime: 0,
      endTime: 62,
      fadeOutSeconds: 0,
    },
    revealAudio: {
      src: `${A}/david-guetta-kelly-rowland-when-love-takes-over.mp3`,
      startTime: 62,
      duration: 15,
      fadeOutSeconds: 5,
    },
    bonus: {
      prompt: 'Which Girl Power group was Kelly Rowland part of?',
      options: [
        'Atomic Kitten',
        'The Pussycat Dolls',
        "Destiny's Child",
        'I do not want to answer',
      ],
      correct: "Destiny's Child",
      abstainOption: 'I do not want to answer',
      correctPoints: 100,
      wrongPoints: -100,
    },
  },
  500: {
    points: 500,
    title: 'The Full Look',
    track: 'Blue Swede / Björn Skifs — Hooked On A Feeling',
    prompt: 'Finish the next line.',
    lyricLines: [...placeholderLines],
    maskedAnswer: "---- ---'-- -- ---- ---- --",
    correctAnswer: '',
    questionAudio: {
      src: `${A}/blue-swede-hooked-on-a-feeling.mp3`,
      startTime: 0,
      endTime: 100,
      fadeOutSeconds: 0,
    },
    revealAudio: {
      src: `${A}/blue-swede-hooked-on-a-feeling.mp3`,
      startTime: 100,
      duration: 15,
      fadeOutSeconds: 5,
    },
    hint: {
      cost: 100,
      text: "That ---'-- -- ---- With Me",
    },
  },
};

export function getFinishTheOutfitEntry(
  categoryName: string | undefined,
  points: number,
): FtoEntry | null {
  if (categoryName !== FINISH_THE_OUTFIT_CATEGORY_NAME) return null;
  return FINISH_THE_OUTFIT[points] ?? null;
}

export function ftoSegmentDuration(seg: FtoAudioSegment): number {
  if (seg.endTime != null) return Math.max(0, seg.endTime - seg.startTime);
  return Math.max(0, seg.duration ?? 0);
}

export function ftoToClip(seg: FtoAudioSegment): AudioClipSpec {
  return {
    src: seg.src,
    startAt: seg.startTime,
    duration: ftoSegmentDuration(seg),
    fadeOut: seg.fadeOutSeconds,
  };
}
