'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { AudioClipSpec } from '@/lib/audio/types';

/**
 * Hook for the Big Screen to play short audio clips with:
 *   - precise startAt offset
 *   - capped total duration
 *   - linear fade-out covering the last `fadeOut` seconds
 *   - automatic teardown of previous clip when a new one starts
 *   - safe cleanup on unmount
 *
 * Returns { play, stop, primeAudio }. `primeAudio` should be called once
 * from a user gesture (button click) to unlock browser autoplay policies.
 */
export function useAudioClip() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const unlockedRef = useRef(false);

  const clearTimers = useCallback(() => {
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    if (fadeTimerRef.current) {
      clearInterval(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    clearTimers();
    const a = audioRef.current;
    if (a) {
      try {
        a.pause();
      } catch {
        /* noop */
      }
      a.src = '';
      a.removeAttribute('src');
      a.load();
      audioRef.current = null;
    }
  }, [clearTimers]);

  const play = useCallback(
    (clip: AudioClipSpec) => {
      stop();

      const audio = new Audio();
      audio.preload = 'auto';
      audio.crossOrigin = 'anonymous';
      // Spaces / parentheses in filenames must be percent-encoded.
      audio.src = encodeURI(clip.src);
      audio.volume = clip.volume ?? 1;
      audio.loop = !!clip.loop;
      audioRef.current = audio;

      const startAt = Math.max(0, clip.startAt ?? 0);
      const fadeOutSec = Math.max(0, clip.fadeOut ?? 0);
      const totalSec = Math.max(0.1, clip.duration);
      const fadeStartMs = Math.max(0, (totalSec - fadeOutSec) * 1000);

      const start = () => {
        try {
          audio.currentTime = startAt;
        } catch {
          /* ignore — some browsers throw before metadata is ready */
        }
        audio.play().catch((err) => {
          // Most likely autoplay blocked. The screen page primes audio with
          // a user gesture; if this still fires, surface for debugging.
          console.warn('[useAudioClip] play() rejected:', err);
        });

        // Looping clips (ambient/waiting music) play until stop() is called.
        if (clip.loop) return;

        if (fadeOutSec > 0) {
          stopTimerRef.current = setTimeout(() => {
            const steps = 25;
            const stepMs = (fadeOutSec * 1000) / steps;
            const startVolume = audio.volume;
            let i = 0;
            fadeTimerRef.current = setInterval(() => {
              i += 1;
              audio.volume = Math.max(0, startVolume * (1 - i / steps));
              if (i >= steps) {
                stop();
              }
            }, stepMs);
          }, fadeStartMs);
        } else {
          stopTimerRef.current = setTimeout(() => stop(), totalSec * 1000);
        }
      };

      if (audio.readyState >= 1) {
        start();
      } else {
        audio.addEventListener('loadedmetadata', start, { once: true });
        audio.addEventListener(
          'error',
          () => console.warn('[useAudioClip] failed to load', clip.src),
          { once: true },
        );
      }
    },
    [stop],
  );

  /**
   * Call once from a user gesture (e.g. button click on the Big Screen
   * "Enable audio" overlay) so subsequent programmatic .play() calls
   * are allowed by the browser.
   */
  const primeAudio = useCallback(() => {
    if (unlockedRef.current) return;
    const a = new Audio();
    // 1-frame silent buffer: data URI of an empty wav-ish, but simplest is a
    // brief paused play() on an empty Audio — this is sufficient on most
    // browsers to flip the autoplay permission for the document.
    a.muted = true;
    a.play()
      .then(() => {
        a.pause();
        unlockedRef.current = true;
      })
      .catch(() => {
        // Even priming can fail in private modes; subsequent gestures help.
        unlockedRef.current = true;
      });
  }, []);

  useEffect(() => {
    return () => stop();
  }, [stop]);

  return { play, stop, primeAudio };
}
