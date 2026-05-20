/**
 * Static, code-resident metadata for the "Guess the Artist" category.
 *
 * The DB only stores the basics (prompt/answer/type/host_note). Rich behavior
 * — initial vs. revealed image, exact audio start times, durations, fades —
 * lives here so we can edit timestamps without touching the database.
 *
 * Keyed by points (100 / 200 / 300 / 400 / 500) within the category named
 * exactly "Guess the Artist".
 */

import type { AudioClipSpec } from '@/lib/audio/types';

export type { AudioClipSpec };

export interface GuessTheArtistEntry {
  points: number;
  prompt: string;
  answer: string;
  /** UI behavior type. Independent from the DB's `question_type` enum. */
  type: 'image' | 'audio' | 'text';
  initialImage?: string;
  revealedImage?: string;
  /** Played when the question opens (only if defined). Big Screen only. */
  openAudio?: AudioClipSpec;
  /** Played when the answer is revealed (only if defined). Big Screen only. */
  revealAudio?: AudioClipSpec;
}

export const GUESS_THE_ARTIST_CATEGORY_NAME = 'Guess the Artist';

export const GUESS_THE_ARTIST: Record<number, GuessTheArtistEntry> = {
  100: {
    points: 100,
    prompt: 'Hvem er dette?',
    answer: 'Kato',
    type: 'image',
    initialImage: '/quiz-assets/images/Kato_Billede1.jpg',
    revealedImage: '/quiz-assets/images/Kato_Billede2.jpg',
    revealAudio: {
      src: '/quiz-assets/audio/Kato - Hey Shorty (Yeah Yeah Part II) (SPOTISAVER).mp3',
      startAt: 145,
      duration: 15,
      fadeOut: 5,
    },
  },
  200: {
    points: 200,
    prompt: 'Hvem lavede dette nummer?',
    answer: 'Elton John - Tiny Dancer',
    type: 'audio',
    openAudio: {
      src: '/quiz-assets/audio/Elton John - Tiny Dancer (SPOTISAVER).mp3',
      startAt: 0,
      duration: 120,
    },
    revealAudio: {
      src: '/quiz-assets/audio/Elton John - Tiny Dancer (SPOTISAVER).mp3',
      startAt: 153,
      duration: 15,
      fadeOut: 5,
    },
  },
  300: {
    points: 300,
    prompt: 'Hvem åbnede Orange Scene i 2025?',
    answer: 'Annika',
    type: 'text',
    revealAudio: {
      src: '/quiz-assets/audio/Blodigt (feat. Annika).mp3',
      startAt: 58,
      duration: 15,
      fadeOut: 5,
    },
  },
  400: {
    points: 400,
    prompt: 'Who did this song?',
    answer: 'Swedish House Mafia & Coldplay - Every Teardrop is a Waterfall',
    type: 'audio',
    openAudio: {
      src: '/quiz-assets/audio/Every Teardrop Is A Waterfall (Coldplay Vs. Swedish House Mafia).mp3',
      startAt: 68,
      duration: 60,
      fadeOut: 5,
    },
    revealAudio: {
      src: '/quiz-assets/audio/Every Teardrop Is A Waterfall (Coldplay Vs. Swedish House Mafia).mp3',
      startAt: 283,
      duration: 15,
      fadeOut: 5,
    },
  },
  500: {
    points: 500,
    prompt: 'Who did this song?',
    answer: 'Queen - Fat Bottomed Girls',
    type: 'audio',
    openAudio: {
      src: '/quiz-assets/audio/Fat Bottomed Girls - Remastered 2011.mp3',
      startAt: 0,
      duration: 95,
      fadeOut: 5,
    },
    revealAudio: {
      src: '/quiz-assets/audio/Fat Bottomed Girls - Remastered 2011.mp3',
      startAt: 135,
      duration: 15,
      fadeOut: 5,
    },
  },
};

export function getGuessTheArtistEntry(
  categoryName: string | undefined,
  points: number,
): GuessTheArtistEntry | null {
  if (categoryName !== GUESS_THE_ARTIST_CATEGORY_NAME) return null;
  return GUESS_THE_ARTIST[points] ?? null;
}
