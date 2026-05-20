/** Normalized audio clip the Big Screen player understands. */
export interface AudioClipSpec {
  /** Public path. May contain spaces / parentheses; encoded at playback. */
  src: string;
  /** Where in the file to start, in seconds. */
  startAt: number;
  /** Total playback duration in seconds before the clip is stopped. */
  duration: number;
  /** Optional fade-out duration in seconds, counted off the END of `duration`. */
  fadeOut?: number;
}
