/**
 * Code-resident config for the "Selected or Rejected" category.
 *
 * Audio segments + scoring rules live here; the DB only holds prompt/answer
 * for fallback. Keyed by points within the category named exactly
 * "Selected or Rejected".
 *
 * Scoring for this category is AUTOMATIC on reveal (see the API's set_revealed
 * handler). The host only intervenes for the Q300 tie-break and Q400 CHANCEN
 * start.
 */

import type { AudioClipSpec } from '@/lib/audio/types';

export interface SorAudioSegment {
  src: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  fadeOutSeconds?: number;
  autoCloseOnEnd?: boolean;
  loop?: boolean;
  playUntilReveal?: boolean;
}

export type SorChoice = 'Selected' | 'Rejected';

export type SorType =
  | 'truefact' // Q100
  | 'tworound' // Q200
  | 'majority' // Q300
  | 'chance' // Q400
  | 'multiselect'; // Q500

export interface SorRound {
  statement: string;
  correct: SorChoice;
  explanation: string;
  timerSeconds: number;
  questionAudio?: SorAudioSegment;
  revealAudio?: SorAudioSegment;
}

export interface SorEntry {
  points: number;
  title: string;
  prompt: string;
  /** Secondary line, e.g. "Selected (True) or Rejected (False)?" */
  subPrompt?: string;
  type: SorType;
  /** truefact / chance: the correct Selected/Rejected answer. */
  correct?: SorChoice;
  revealExplanation?: string;
  questionAudio?: SorAudioSegment;
  revealAudio?: SorAudioSegment;

  // tworound (Q200)
  rounds?: SorRound[];

  // majority (Q300)
  track?: string;

  // chance (Q400)
  minWager?: number;

  // multiselect (Q500)
  songs?: string[];
  /** 0-based indices into `songs` that are correct. */
  correctSongs?: number[];
  /** Map of correct-count -> points. */
  multiSelectTiers?: Record<number, number>;
}

export const SELECTED_OR_REJECTED_CATEGORY_NAME = 'Selected or Rejected';

const A = '/audio/selected-or-rejected';

export const SELECTED_OR_REJECTED: Record<number, SorEntry> = {
  100: {
    points: 100,
    title: 'The Songbook Check',
    prompt:
      'Shu-Bi-Dua’s song was previously part of Højskolesangbogen, but was removed again due to debate about whether it belonged there.',
    subPrompt: 'Selected (True) or Rejected (False)?',
    type: 'truefact',
    correct: 'Selected',
    questionAudio: {
      src: `${A}/shu-bi-dua-danmark.mp3`,
      startTime: 0,
      duration: 30,
      fadeOutSeconds: 5,
      autoCloseOnEnd: true,
    },
    revealAudio: {
      src: `${A}/shu-bi-dua-danmark.mp3`,
      startTime: 102,
      duration: 15,
      fadeOutSeconds: 5,
    },
  },
  200: {
    points: 200,
    title: 'The Lyric Check',
    prompt: 'Real lyric or fake lyric?',
    type: 'tworound',
    rounds: [
      {
        statement: 'Oops, We Did It Again',
        correct: 'Rejected',
        explanation: 'Rejected — the real lyric is “Oops!... I Did It Again”.',
        timerSeconds: 15,
        questionAudio: {
          src: `${A}/britney-spears-oops-i-did-it-again.mp3`,
          startTime: 0,
          duration: 15,
          fadeOutSeconds: 5,
          autoCloseOnEnd: true,
        },
        revealAudio: {
          src: `${A}/britney-spears-oops-i-did-it-again.mp3`,
          startTime: 19,
          duration: 15,
          fadeOutSeconds: 5,
        },
      },
      {
        statement: 'Sweet dreams (Are Made For This)',
        correct: 'Rejected',
        explanation:
          'Rejected — the real lyric is “Sweet dreams are made of this” from Eurythmics — Sweet Dreams (Are Made of This).',
        timerSeconds: 15,
        questionAudio: {
          src: `${A}/eurythmics-sweet-dreams.mp3`,
          startTime: 0,
          duration: 15,
          fadeOutSeconds: 5,
          autoCloseOnEnd: true,
        },
        revealAudio: {
          src: `${A}/eurythmics-sweet-dreams.mp3`,
          startTime: 26,
          duration: 15,
          fadeOutSeconds: 5,
        },
      },
    ],
  },
  300: {
    points: 300,
    title: 'The Summer Party Vote',
    prompt:
      'Vil denne sang være Selected nok til at blive spillet til Selected Summer Party?',
    subPrompt: 'Selected or Rejected?',
    type: 'majority',
    track: 'Journey — Don’t Stop Believin’',
    questionAudio: {
      src: `${A}/journey-dont-stop-believin.mp3`,
      startTime: 0,
      endTime: 76,
      fadeOutSeconds: 5,
      autoCloseOnEnd: true,
    },
    revealAudio: {
      src: `${A}/journey-dont-stop-believin.mp3`,
      startTime: 200,
      duration: 15,
      fadeOutSeconds: 5,
    },
  },
  400: {
    points: 400,
    title: 'CHANCEN',
    prompt: 'Céline Dion deltog engang i Eurovision.',
    subPrompt: 'Selected (True) or Rejected (False)?',
    type: 'chance',
    correct: 'Selected',
    minWager: 400,
    revealExplanation:
      'Selected — in 1988, despite being Canadian, Celine Dion represented Switzerland and won Eurovision with “Ne partez pas sans moi.”',
    // No question audio before reveal.
    revealAudio: {
      src: `${A}/celine-dion-ne-partez-pas-sans-moi.mp3`,
      startTime: 53,
      duration: 15,
      fadeOutSeconds: 5,
    },
  },
  500: {
    points: 500,
    title: 'Nicolaj’s Playlist',
    prompt:
      'Hvilke 3 af disse sange ville Nicolaj 100% synge med på i bilen eller i bruseren?',
    type: 'multiselect',
    songs: [
      'Alesso — Heroes (We Could Be) feat. Tove Lo',
      'Drake — Controlla',
      'Jonah Blacksmith — Yellow Bike',
      'Panic! At The Disco — But It’s Better If You Do',
      'Phil Collins — Strangers Like Me',
      'Justin Timberlake — Rock Your Body',
      'Dua Lipa — Houdini',
      'Nephew & Nik & Jay — Rejsekammerater',
      'Adele — Hello',
      'Ellie Goulding — Lights',
    ],
    correctSongs: [1, 3, 9], // Drake, Panic!, Ellie Goulding
    multiSelectTiers: { 0: 0, 1: 100, 2: 300, 3: 500 },
    questionAudio: {
      src: `${A}/lost-coconut-rise-again.mp3`,
      startTime: 0,
      loop: true,
      playUntilReveal: true,
      fadeOutSeconds: 5,
    },
    revealAudio: {
      src: `${A}/panic-at-the-disco-but-its-better-if-you-do.mp3`,
      startTime: 55,
      duration: 15,
      fadeOutSeconds: 5,
    },
  },
};

export function getSelectedOrRejectedEntry(
  categoryName: string | undefined,
  points: number,
): SorEntry | null {
  if (categoryName !== SELECTED_OR_REJECTED_CATEGORY_NAME) return null;
  return SELECTED_OR_REJECTED[points] ?? null;
}

export function sorSegmentDuration(seg: SorAudioSegment): number {
  if (seg.endTime != null) return Math.max(0, seg.endTime - seg.startTime);
  return Math.max(0, seg.duration ?? 0);
}

export function sorToClip(seg: SorAudioSegment): AudioClipSpec {
  const looping = !!seg.loop || !!seg.playUntilReveal;
  return {
    src: seg.src,
    startAt: seg.startTime,
    // Looping clips ignore duration; give a nominal value.
    duration: looping ? 0 : sorSegmentDuration(seg),
    fadeOut: seg.fadeOutSeconds,
    loop: looping,
  };
}
