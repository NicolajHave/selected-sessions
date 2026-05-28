/**
 * Pre-game intro question used to decide which team picks the first category.
 * Not part of the Jeopardy board; lives entirely in code + game_state flags.
 */

export const INTRO_QUESTION = {
  title: 'Fastest Fit First',
  prompt: 'Put these audiences in order from smallest to largest.',
  options: [
    'Selected Summer Party',
    'Solo Shower Concert',
    'Hede Rytmer Crowd',
    'Selected Team Day Car Singalong',
  ] as const,
  correctOrder: [
    'Solo Shower Concert',
    'Selected Team Day Car Singalong',
    'Selected Summer Party',
    'Hede Rytmer Crowd',
  ] as const,
  timerSeconds: 20,
};

export function isCorrectIntroOrder(submitted: string[]): boolean {
  if (!Array.isArray(submitted) || submitted.length !== 4) return false;
  return INTRO_QUESTION.correctOrder.every((v, i) => submitted[i] === v);
}
