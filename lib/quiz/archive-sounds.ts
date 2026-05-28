/**
 * Code-resident config for the "Archive Sounds" category (decade-based).
 *
 * All five questions are host-scored manually (no automatic scoring beyond
 * the existing buy_hint flow for Q500). Media segments support audio (with
 * optional manuallyTriggered cues) and video (with optional background
 * opacity + fade-to-opacity).
 *
 * Keyed by points within the category named exactly "Archive Sounds".
 */

import type { AudioClipSpec } from '@/lib/audio/types';

export interface AsAudioSegment {
  src: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  fadeOutSeconds?: number;
  /** When true, the clip plays automatically when the question opens. */
  autoPlayOnOpen?: boolean;
  /** When true, the host triggers playback via a control panel button. */
  manuallyTriggered?: boolean;
}

export interface AsVideoSegment {
  src: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  /** Display opacity while playing (default 1). */
  opacity?: number;
  /** When true (default), play the video's audio track. */
  includeAudio?: boolean;
  /** Optional fade duration in seconds at the end of the segment. */
  fadeOutSeconds?: number;
  /** Target opacity at the end of the fade (null = don't fade opacity). */
  fadeOutVideoToOpacity?: number | null;
}

export interface AsHint {
  cost: number;
  image: string;
  alt?: string;
}

export interface AsEntry {
  points: number;
  title: string;
  /** Optional — leave undefined to hide the track subtitle (e.g. Q100 where
   *  the song title is the answer and must not be revealed early). */
  track?: string;
  prompt: string;
  answer: string;
  acceptedGuidance?: string;
  /** Optional image shown on the Big Screen when the answer is revealed. */
  revealImage?: string;
  questionAudio?: AsAudioSegment;
  revealAudio?: AsAudioSegment;
  questionVideo?: AsVideoSegment;
  revealVideo?: AsVideoSegment;
  hint?: AsHint;
}

export const ARCHIVE_SOUNDS_CATEGORY_NAME = 'Archive Sounds';

const A = '/audio/archive-sounds';
const V = '/video/archive-sounds';

export const ARCHIVE_SOUNDS: Record<number, AsEntry> = {
  100: {
    points: 100,
    title: 'The 90s File',
    // track intentionally omitted — the song title is the answer and must not be revealed via the subtitle.
    prompt: 'Hvad hedder denne sang?',
    answer: 'Stupid Man',
    questionAudio: {
      src: `${A}/thomas-helmig-stupid-man.mp3`,
      startTime: 0,
      duration: 2,
      fadeOutSeconds: 0,
      autoPlayOnOpen: false,
      manuallyTriggered: true,
    },
    revealAudio: {
      src: `${A}/thomas-helmig-stupid-man.mp3`,
      startTime: 55,
      duration: 15,
      fadeOutSeconds: 5,
    },
  },
  200: {
    points: 200,
    title: 'The 80s File',
    track: 'GNAGS — Når Jeg Bli’r Gammel',
    prompt: 'GNAGS udgav denne sang i 1989. Hvilket album var den en del af?',
    answer: 'Mr. Swing King',
    questionAudio: {
      src: `${A}/gnags-naar-jeg-blir-gammel.mp3`,
      startTime: 0,
      duration: 60,
      fadeOutSeconds: 5,
      autoPlayOnOpen: true,
    },
    revealAudio: {
      src: `${A}/gnags-naar-jeg-blir-gammel.mp3`,
      startTime: 196,
      duration: 15,
      fadeOutSeconds: 5,
    },
  },
  300: {
    points: 300,
    title: 'The 70s File',
    track: 'Grease — You’re The One That I Want',
    prompt:
      'Hvad hedder de to grupper i filmen som Sandy og Danny er en del af?',
    answer: 'The Pink Ladies and the T-Birds',
    acceptedGuidance:
      'Accept any answer that clearly includes both Pink Ladies and T-Birds.',
    questionVideo: {
      src: `${V}/grease-youre-the-one-that-i-want.mp4`,
      startTime: 45,
      endTime: 120,
      opacity: 0.45,
      includeAudio: true,
      fadeOutSeconds: 5,
      fadeOutVideoToOpacity: 0,
    },
    revealVideo: {
      src: `${V}/grease-youre-the-one-that-i-want.mp4`,
      startTime: 156,
      duration: 15,
      includeAudio: true,
      fadeOutSeconds: 5,
      fadeOutVideoToOpacity: 0,
    },
  },
  400: {
    points: 400,
    title: 'The 60s File',
    track: 'Neil Diamond — Sweet Caroline',
    prompt: 'Hvilken ikonisk publikumsrespons forbindes med denne sang?',
    answer: 'Oh Oh Oh! [Åh Åh Åh]',
    acceptedGuidance:
      'Accept Oh Oh Oh, Åh Åh Åh, or similar phonetic variants.',
    questionAudio: {
      src: `${A}/neil-diamond-sweet-caroline.mp3`,
      startTime: 0,
      duration: 60,
      fadeOutSeconds: 5,
      autoPlayOnOpen: true,
    },
    revealVideo: {
      src: `${V}/sweet-caroline-video.mp4`,
      startTime: 16,
      duration: 15,
      includeAudio: true,
      fadeOutSeconds: 0,
      fadeOutVideoToOpacity: null,
    },
  },
  500: {
    points: 500,
    title: 'The 50s File',
    track: 'Big Mama Thornton — Hound Dog',
    prompt:
      'I 1952 indspillede og udgav Big Mama Thornton denne sang. Nogle år senere, i 1956, blev den udødeliggjort af hvilken artist?',
    answer: 'Elvis Presley',
    revealImage: '/images/reveals/elvis-presley.jpg',
    questionAudio: {
      src: `${A}/big-mama-thornton-hound-dog.mp3`,
      startTime: 0,
      duration: 60,
      fadeOutSeconds: 5,
      autoPlayOnOpen: true,
    },
    revealAudio: {
      src: `${A}/elvis-presley-hound-dog.mp3`,
      startTime: 0,
      duration: 15,
      fadeOutSeconds: 5,
    },
    hint: {
      cost: 100,
      image: '/images/hints/memphis-mansion.jpg',
      alt: 'Memphis Mansion hint',
    },
  },
};

export function getArchiveSoundsEntry(
  categoryName: string | undefined,
  points: number,
): AsEntry | null {
  if (categoryName !== ARCHIVE_SOUNDS_CATEGORY_NAME) return null;
  return ARCHIVE_SOUNDS[points] ?? null;
}

export function asAudioDuration(seg: AsAudioSegment): number {
  if (seg.endTime != null) return Math.max(0, seg.endTime - seg.startTime);
  return Math.max(0, seg.duration ?? 0);
}

export function asVideoDuration(seg: AsVideoSegment): number {
  if (seg.endTime != null) return Math.max(0, seg.endTime - seg.startTime);
  return Math.max(0, seg.duration ?? 0);
}

export function asAudioToClip(seg: AsAudioSegment): AudioClipSpec {
  return {
    src: seg.src,
    startAt: seg.startTime,
    duration: asAudioDuration(seg),
    fadeOut: seg.fadeOutSeconds,
  };
}
