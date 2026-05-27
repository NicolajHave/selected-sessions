/**
 * IMPORTANT FOR CLAUDE / AI ASSISTANTS:
 * Do not edit, replace, rewrite, remove, shorten, normalize or regenerate
 * any lyricLines, correctAnswer or revealAnimation.text values in this file.
 * These have been manually entered by the user and must remain untouched.
 *
 * Only edit timing metadata, audio paths, scoring config or structural code
 * when explicitly asked.
 */

import type { AudioClipSpec } from '@/lib/audio/types';

export interface FtoAudioSegment {
  src: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  fadeOutSeconds?: number;
  hardStopAtEnd?: boolean;
  autoOpenAnswersOnEnd?: boolean;
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

export interface FtoRevealAnimation {
  type: string;
  text: string;
}

export interface FtoScoring {
  mode: string;
  correctPoints: number;
}

export interface FtoEntry {
  points: number;
  title: string;
  track: string;
  prompt: string;
  /** Display lines shown one at a time on the Big Screen. */
  lyricLines: string[];
  /** Optional: seconds (from audio start) at which each lyricLines[i] appears. */
  lyricTimings?: number[];
  /** Masked pattern shown at the hard stop (dashes / punctuation only). */
  maskedAnswer: string;
  /** Optional: second at which the masked answer appears / answers open. */
  maskedAnswerTime?: number;
  /** Final accepted lyric, shown on reveal. */
  correctAnswer: string;
  questionAudio: FtoAudioSegment;
  revealAudio: FtoAudioSegment;
  revealAnimation?: FtoRevealAnimation;
  scoring?: FtoScoring;
  bonus?: FtoBonus;
  hint?: FtoHint;
}

export const FINISH_THE_OUTFIT_CATEGORY_NAME = 'Finish the (Out)fit';

const A = '/audio/finish-the-outfit';

export const FINISH_THE_OUTFIT: Record<number, FtoEntry> = {
  100: {
    points: 100,
    title: 'The Easy Fit',
    track: 'Backstreet Boys — I Want It That Way',
    prompt: 'Finish the next line.',
    lyricLines: [
      'You are my fire',
      'The one desire',
      'Believe when I say',
      'I want it that way',
      'But we are two worlds apart',
      "Can't reach to your heart",
      'When you say',
      'That I want it that way',
      'Tell me why',
    ],
    lyricTimings: [10, 15, 19, 25, 29, 36, 41, 45, 49],
    maskedAnswer: "---'- ------' --- - ---------",
    maskedAnswerTime: 50.5,
    correctAnswer: "Ain't nothin' but a heartache",
    questionAudio: {
      src: `${A}/backstreet-boys-i-want-it-that-way.mp3`,
      startTime: 0,
      endTime: 50.5,
      fadeOutSeconds: 0,
      hardStopAtEnd: true,
      autoOpenAnswersOnEnd: true,
    },
    revealAudio: {
      src: `${A}/backstreet-boys-i-want-it-that-way.mp3`,
      startTime: 49,
      duration: 15,
      fadeOutSeconds: 5,
    },
    revealAnimation: {
      type: 'typewriter',
      text: "Ain't nothin' but a heartache",
    },
    scoring: {
      mode: 'host',
      correctPoints: 100,
    },
  },
  200: {
    points: 200,
    title: 'The Mid-Verse Cut',
    track: 'Spice Girls — Wannabe',
    prompt: 'Finish the next line.',
    lyricLines: [
      "Yo, I'll tell you what I want, what I really, really want",
      'So tell me what you want, what you really, really want',
      "I'll tell you what I want, what I really, really want",
      'So tell me what you want, what you really, really want',
      'I wanna, (ha) I wanna, (ha) I wanna, (ha) I wanna, (ha)',
      'I wanna really, really, really wanna zigazig ah',
      'If you want my future, forget my past',
      'If you wanna get with me, better make it fast',
      "Now don't go wasting my precious time",
      'Get your act together we could be just fine',
      "I'll tell you what I want, what I really, really want",
      'So tell me what you want, what you really, really want',
      'I wanna, (ha) I wanna, (ha) I wanna, (ha) I wanna, (ha)',
      'I wanna really, really, really wanna zigazig ah',
      'If you wanna be my lover, you gotta get with my friends',
      'Make it last forever, friendship never ends',
      'If you wanna be my lover, you have got to give',
      "Taking is too easy, but that's the way it is",
      'Oh, what do you think about that?',
      'Now you know how I feel',
      'Say you can handle my love, are you for real?',
      "I won't be hasty, I'll give you a try",
      'If you really bug me',
    ],
    lyricTimings: [
      4, 7, 9, 11, 13, 15, 18, 22, 26, 31, 35, 37, 39, 41, 43, 48, 52, 56, 61,
      63, 66, 70, 74,
    ],
    maskedAnswer: "-'-- ---- --- -------",
    maskedAnswerTime: 76,
    correctAnswer: "Then I'll Say GoodBye",
    questionAudio: {
      src: `${A}/spice-girls-wannabe.mp3`,
      startTime: 0,
      endTime: 76,
      fadeOutSeconds: 0,
      hardStopAtEnd: true,
      autoOpenAnswersOnEnd: true,
    },
    revealAudio: {
      src: `${A}/spice-girls-wannabe.mp3`,
      startTime: 75,
      duration: 15,
      fadeOutSeconds: 5,
    },
    revealAnimation: {
      type: 'typewriter',
      text: "Then I'll Say GoodBye",
    },
    scoring: {
      mode: 'host',
      correctPoints: 200,
    },
  },

  300: {
    points: 300,
    title: 'The Nordic Fit',
    track: 'Lukas Graham — Drunk In The Morning',
    prompt: 'Finish the next line.',
    lyricLines: [
      'Girl, I got one question',
      'Are you still awake?',
      'Awake enough for me to see you, see you',
      "Please just listen, yes I know it's late",
      'But better late than never',
      "I know it's five in the morning, morning",
      "Not sure who I'm calling, calling",
      "You haven't heard from me in some time",
      'Girl I hope you want me, want me',
      'When you hear me talking, talking',
      "You know I've been out and is it OK I stop by",
      "When I'm drunk in the morning,",
      "I'm calling you,",
    ],
    maskedAnswer: '--- ----- -- ------, ------',
    correctAnswer: 'you might be lonely, lonely',
    questionAudio: {
      src: `${A}/lukas-graham-drunk-in-the-morning.mp3`,
      startTime: 0,
      endTime: 69,
      fadeOutSeconds: 0,
      hardStopAtEnd: true,
      autoOpenAnswersOnEnd: true,
    },
    revealAudio: {
      src: `${A}/lukas-graham-drunk-in-the-morning.mp3`,
      startTime: 69,
      duration: 15,
      fadeOutSeconds: 5,
    },
    revealAnimation: {
      type: 'typewriter',
      text: 'you might be lonely, lonely',
    },
    scoring: {
      mode: 'host',
      correctPoints: 300,
    },
  },

  400: {
    points: 400,
    title: 'The Express Fit',
    track: 'David Guetta — When Love Takes Over feat. Kelly Rowland',
    prompt: 'Finish the next line.',
    lyricLines: [
      "It's complicated, it always is",
      "That's just the way it goes",
      "Feels like I've waited so long for this",
      'I wonder if it shows',
      "Head underwater, now I can't breathe",
      'It never felt so good',
      'Cause I can feel it coming over me',
      "I wouldn't stop it if I could",
      'When love takes over, yeah',
      "You know you can't deny",
      'When love takes over, yeah',
      "Cause something's here tonight",
      'Give me a reason, I gotta know',
      'Do you feel it too?',
      "Can't you see me here on overload?",
    ],
    maskedAnswer: '-- ---- ---- - ----- ---',
    correctAnswer: 'And this time I blame you',
    questionAudio: {
      src: `${A}/david-guetta-kelly-rowland-when-love-takes-over.mp3`,
      startTime: 0,
      endTime: 62,
      fadeOutSeconds: 0,
      hardStopAtEnd: true,
      autoOpenAnswersOnEnd: true,
    },
    revealAudio: {
      src: `${A}/david-guetta-kelly-rowland-when-love-takes-over.mp3`,
      startTime: 62,
      duration: 15,
      fadeOutSeconds: 5,
    },
    revealAnimation: {
      type: 'typewriter',
      text: 'And this time I blame you',
    },
    scoring: {
      mode: 'host',
      correctPoints: 400,
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
    lyricLines: [
      'Ooga-Chaka, Ooga-Ooga',
      'Ooga-Chaka, Ooga-Ooga',
      'Ooga-Chaka, Ooga-Ooga',
      'Ooga-Chaka, Ooga-Ooga',
      "I can't stop this feelin'",
      'Deep inside of me',
      "Girl, you just don't realize",
      'What you do to me',
      'When you hold me',
      'In your arms so tight',
      'You let me know',
      "Everything's alright",
      "I'm hooked on a feelin'",
      "I'm high on believin'",
      "That you're in love with me",
      'Lips as sweet as candy',
      'Its taste is on my mind',
      'Girl, you got me thirsty',
      'For another cup of wine',
      'Got a bug from you, girl',
      "But I don't need no cure",
      'I just stay a victim',
      'If I can for sure',
      'All the good love',
      "When we're all alone",
      'Keep it up, girl',
      'Yeah, you turn me on',
      "I'm hooked on a feelin'",
      "I'm high on believin'",
    ],
    maskedAnswer: "---- ---'-- -- ---- ---- --",
    correctAnswer: "That you're in love with me",
    questionAudio: {
      src: `${A}/blue-swede-hooked-on-a-feeling.mp3`,
      startTime: 0,
      endTime: 100,
      fadeOutSeconds: 0,
      hardStopAtEnd: true,
      autoOpenAnswersOnEnd: true,
    },
    revealAudio: {
      src: `${A}/blue-swede-hooked-on-a-feeling.mp3`,
      startTime: 100,
      duration: 15,
      fadeOutSeconds: 5,
    },
    revealAnimation: {
      type: 'typewriter',
      text: "That you're in love with me",
    },
    scoring: {
      mode: 'host',
      correctPoints: 500,
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
