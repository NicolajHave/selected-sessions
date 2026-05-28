/**
 * Pre-game intro question used to decide which team picks the first category.
 * Not part of the Jeopardy board; lives entirely in code + game_state flags.
 */

export const INTRO_QUESTION = {
  title: 'Fastest Fit First',
  prompt: 'Put the Selected Sessions game flow in the correct order.',
  options: [
    'Pick a category',
    'Hear the cue',
    'Lock your answer',
    'Reveal the answer',
  ] as const,
  correctOrder: [
    'Pick a category',
    'Hear the cue',
    'Lock your answer',
    'Reveal the answer',
  ] as const,
  timerSeconds: 30,
};

export function isCorrectIntroOrder(submitted: string[]): boolean {
  if (!Array.isArray(submitted) || submitted.length !== 4) return false;
  return INTRO_QUESTION.correctOrder.every((v, i) => submitted[i] === v);
}
