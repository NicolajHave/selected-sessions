'use client';

import Image from 'next/image';

interface SelectedSessionsLoaderProps {
  /**
   * When true (default), the loader covers the full viewport with a fixed
   * white overlay (intro / page-transition use). When false, it renders
   * inline at full container height (suitable for in-flow loading blocks).
   */
  fullScreen?: boolean;
  /**
   * Optional accessible label describing the current loading context,
   * e.g. "Starting the session", "Preparing next round". Not shown
   * visually — used for screen readers only.
   */
  srLabel?: string;
}

export function SelectedSessionsLoader({
  fullScreen = true,
  srLabel = 'Selected Sessions',
}: SelectedSessionsLoaderProps) {
  const wrapperClass = fullScreen
    ? 'fixed inset-0 z-50 flex items-center justify-center bg-white'
    : 'relative w-full min-h-screen flex items-center justify-center bg-white';

  return (
    <div
      className={wrapperClass}
      role="status"
      aria-live="polite"
      aria-label={srLabel}
    >
      <span className="sr-only">{srLabel}</span>

      <div className="relative flex flex-col items-center justify-center px-8">
        {/* Composition stage: arcs orbit around the centered logo */}
        <div className="relative flex items-center justify-center w-[320px] h-[320px] sm:w-[440px] sm:h-[440px]">
          {/* Outer ring with broken segments */}
          <svg
            viewBox="0 0 480 480"
            className="absolute inset-0 w-full h-full ss-spin-slow"
            aria-hidden="true"
          >
            <circle
              cx="240"
              cy="240"
              r="232"
              fill="none"
              stroke="#0E0E0E"
              strokeOpacity="0.2"
              vectorEffect="non-scaling-stroke"
              strokeWidth="1"
            />
            <circle
              cx="240"
              cy="240"
              r="232"
              fill="none"
              stroke="#0E0E0E"
              strokeOpacity="0.55"
              vectorEffect="non-scaling-stroke"
              strokeWidth="1"
              strokeDasharray="140 380 60 1000"
              strokeLinecap="round"
            />
          </svg>

          {/* Mid dotted arc — slow reverse rotation, gentle fade */}
          <svg
            viewBox="0 0 480 480"
            className="absolute inset-0 w-full h-full ss-spin-reverse-slow ss-fade-pulse"
            aria-hidden="true"
          >
            <circle
              cx="240"
              cy="240"
              r="200"
              fill="none"
              stroke="#0E0E0E"
              strokeOpacity="0.55"
              vectorEffect="non-scaling-stroke"
              strokeWidth="1"
              strokeDasharray="1 9"
              strokeLinecap="round"
            />
          </svg>

          {/* Inner accent quarter-arc — very slow rotation */}
          <svg
            viewBox="0 0 480 480"
            className="absolute inset-0 w-full h-full ss-spin-very-slow"
            aria-hidden="true"
          >
            <path
              d="M 240 65 A 175 175 0 0 1 415 240"
              fill="none"
              stroke="#0E0E0E"
              strokeOpacity="0.4"
              vectorEffect="non-scaling-stroke"
              strokeWidth="1"
              strokeLinecap="round"
            />
          </svg>

          {/* Logo + Sessions label, centered above arcs */}
          <div className="relative z-10 flex flex-col items-center">
            <Image
              src="/logo-black.png"
              alt="Selected"
              width={600}
              height={Math.round(600 * (622 / 2902))}
              priority
              className="w-[220px] sm:w-[300px] h-auto select-none"
              draggable={false}
            />
            <span className="mt-3 text-[10px] sm:text-[11px] uppercase tracking-[0.4em] text-ink/80">
              Sessions
            </span>
          </div>
        </div>

        {/* Subtle waveform pulsing below */}
        <div className="mt-10 sm:mt-14 w-[180px] sm:w-[240px]">
          <svg
            viewBox="0 0 240 28"
            className="w-full h-7 ss-wave-pulse"
            aria-hidden="true"
          >
            <path
              d="M 0 14 Q 15 4, 30 14 T 60 14 T 90 14 T 120 14 T 150 14 T 180 14 T 210 14 T 240 14"
              fill="none"
              stroke="#0E0E0E"
              strokeOpacity="0.55"
              strokeWidth="1"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}

export default SelectedSessionsLoader;
