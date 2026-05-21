/**
 * Code-resident metadata for the "Selected Bangers" category.
 *
 * Same philosophy as guess-the-artist.ts: the DB holds prompt/answer/type;
 * everything behavioral (audio segments, slider config, bonus, paid hint)
 * lives here so it can be tuned without DB changes.
 *
 * Keyed by points (100..500) within the category named "Selected Bangers".
 */

import type { AudioClipSpec } from '@/lib/audio/types';

export interface AudioSegment {
  src: string;
  startTime: number;
  /** Provide endTime OR duration. endTime wins if both are present. */
  endTime?: number;
  duration?: number;
  fadeOutSeconds?: number;
  /** When true, the Big Screen reports clip-end so submissions can auto-close. */
  autoCloseOnEnd?: boolean;
}

export type SelectedBangersType =
  | 'audio'
  | 'year-slider'
  | 'audio-with-private-hint';

export interface SelectedBangersEntry {
  points: number;
  title: string;
  prompt: string;
  answer: string;
  type: SelectedBangersType;
  /** Visible track info shown in the question view (e.g. Q400). */
  trackInfo?: string;
  /** Manual-scoring guidance for the host panel. */
  acceptedGuidance?: string;
  questionAudio?: AudioSegment;
  revealAudio?: AudioSegment;
  /** Q300: host can award a fixed bonus. */
  bonus?: { points: number; label: string };
  /** Q400: player answers with a year slider. */
  slider?: { min: number; max: number; step: number };
  /** Q500: a team can buy a private hint image for `cost` points. */
  hint?: { cost: number; image: string };
}

export const SELECTED_BANGERS_CATEGORY_NAME = 'Selected Bangers';

const A = '/audio/selected-bangers';

export const SELECTED_BANGERS: Record<number, SelectedBangersEntry> = {
  100: {
    points: 100,
    title: 'The Drop',
    prompt: 'Name the track and artist before the drop hits.',
    answer: 'Levels — Avicii',
    type: 'audio',
    questionAudio: {
      src: `${A}/levels-radio-edit.mp3`,
      startTime: 84,
      endTime: 144,
      fadeOutSeconds: 5,
      autoCloseOnEnd: true,
    },
    revealAudio: {
      src: `${A}/levels-radio-edit.mp3`,
      startTime: 160,
      duration: 15,
      fadeOutSeconds: 5,
    },
  },
  200: {
    points: 200,
    title: 'The Groove',
    prompt:
      'Who made this song, and who is featured on it? Name at least one featured artist.',
    answer:
      'Daft Punk — Get Lucky. Featured artists: Pharrell Williams and Nile Rodgers.',
    acceptedGuidance:
      'Award the points if the team says Daft Punk AND at least one of: Pharrell Williams or Nile Rodgers.',
    type: 'audio',
    questionAudio: {
      src: `${A}/get-lucky-radio-edit.mp3`,
      startTime: 0,
      duration: 45,
      fadeOutSeconds: 5,
      autoCloseOnEnd: true,
    },
    revealAudio: {
      src: `${A}/get-lucky-radio-edit.mp3`,
      startTime: 49,
      duration: 15,
      fadeOutSeconds: 5,
    },
  },
  300: {
    points: 300,
    title: 'The Mashup',
    prompt:
      'Which two songs are mixed in this track? Name either the song titles or the artists.',
    answer: 'I Like To Move It — Reel 2 Real  &  Temperature — Sean Paul',
    acceptedGuidance:
      'Song titles only = OK. Artists only = OK. Both titles + both artists = perfect → use the +50 Bonus button.',
    type: 'audio',
    bonus: { points: 50, label: '+50 Bonus' },
    questionAudio: {
      src: `${A}/i-like-to-move-it-temperature-mashup.mp3`,
      startTime: 130,
      endTime: 155,
      fadeOutSeconds: 5,
      autoCloseOnEnd: true,
    },
    revealAudio: {
      src: `${A}/i-like-to-move-it-temperature-mashup.mp3`,
      startTime: 45,
      endTime: 60,
      fadeOutSeconds: 5,
      autoCloseOnEnd: true,
    },
  },
  400: {
    points: 400,
    title: 'The Night Club Banger',
    trackInfo: 'I Gotta Feeling — Black Eyed Peas',
    prompt: 'What year was this song released?',
    answer: '2009',
    type: 'year-slider',
    slider: { min: 2000, max: 2010, step: 1 },
    questionAudio: {
      src: `${A}/i-gotta-feeling.mp3`,
      startTime: 0,
      duration: 60,
      fadeOutSeconds: 5,
      autoCloseOnEnd: true,
    },
    revealAudio: {
      src: `${A}/i-gotta-feeling.mp3`,
      startTime: 218,
      duration: 15,
      fadeOutSeconds: 5,
    },
  },
  500: {
    points: 500,
    title: 'The Origin',
    prompt: 'Which country is this song from?',
    answer: 'Italy',
    type: 'audio-with-private-hint',
    hint: { cost: 100, image: '/images/hints/colosseum-sketch.jpg' },
    questionAudio: {
      src: `${A}/freed-from-desire.mp3`,
      startTime: 0,
      endTime: 58,
      fadeOutSeconds: 5,
      autoCloseOnEnd: true,
    },
    revealAudio: {
      src: `${A}/freed-from-desire.mp3`,
      startTime: 58,
      duration: 15,
      fadeOutSeconds: 5,
    },
  },
};

export function getSelectedBangersEntry(
  categoryName: string | undefined,
  points: number,
): SelectedBangersEntry | null {
  if (categoryName !== SELECTED_BANGERS_CATEGORY_NAME) return null;
  return SELECTED_BANGERS[points] ?? null;
}

/** Resolve a segment's effective duration (endTime - startTime, or duration). */
export function segmentDuration(seg: AudioSegment): number {
  if (seg.endTime != null) return Math.max(0, seg.endTime - seg.startTime);
  return Math.max(0, seg.duration ?? 0);
}

/** Convert a Selected Bangers segment into the player's normalized clip shape. */
export function toClip(seg: AudioSegment): AudioClipSpec {
  return {
    src: seg.src,
    startAt: seg.startTime,
    duration: segmentDuration(seg),
    fadeOut: seg.fadeOutSeconds,
  };
}
