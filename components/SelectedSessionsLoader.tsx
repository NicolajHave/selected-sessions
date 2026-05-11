'use client';

import Image from 'next/image';

interface SelectedSessionsLoaderProps {
  /**
   * When true (default), the loader covers the full viewport with a fixed
   * white overlay (intro / page-transition use). When false, it renders
   * inline within its parent — suitable for embedded "waiting" states.
   */
  fullScreen?: boolean;
  /**
   * When true (default), show the centered SELECTED logo + "Sessions" label.
   * Set to false when the parent already shows the brand (e.g. in a header)
   * and you only want the motion accent.
   */
  showLogo?: boolean;
  /**
   * Visual size. 'lg' (default) for intro / full-screen use.
   * 'sm' for inline / embedded use beneath other copy.
   */
  size?: 'sm' | 'lg';
  /**
   * Background. 'white' (default) for true overlay; 'transparent' lets the
   * loader sit on top of the existing page background (e.g. paper).
   */
  background?: 'white' | 'transparent';
  /**
   * Optional accessible label describing the current loading context.
   * Screen-reader only.
   */
  srLabel?: string;
}

const SIZES = {
  sm: {
    stage: 'w-[200px] h-[200px] sm:w-[260px] sm:h-[260px]',
    logo: 'w-[140px] sm:w-[180px]',
    sessionsText: 'text-[9px] sm:text-[10px]',
    wave: 'mt-6 sm:mt-8 w-[140px] sm:w-[180px]',
  },
  lg: {
    stage: 'w-[320px] h-[320px] sm:w-[440px] sm:h-[440px]',
    logo: 'w-[220px] sm:w-[300px]',
    sessionsText: 'text-[10px] sm:text-[11px]',
    wave: 'mt-10 sm:mt-14 w-[180px] sm:w-[240px]',
  },
};

export function SelectedSessionsLoader({
  fullScreen = true,
  showLogo = true,
  size = 'lg',
  background = 'white',
  srLabel = 'Selected Sessions',
}: SelectedSessionsLoaderProps) {
  const dims = SIZES[size];
  const bgClass = background === 'white' ? 'bg-white' : 'bg-transparent';
  const wrapperClass = fullScreen
    ? `fixed inset-0 z-50 flex items-center justify-center ${bgClass}`
    : `relative w-full flex items-center justify-center ${bgClass}`;

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
        <div className={`relative flex items-center justify-center ${dims.stage}`}>
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

          {showLogo ? (
            <div className="relative z-10 flex flex-col items-center">
              <Image
                src="/logo-black.png"
                alt="Selected"
                width={600}
                height={Math.round(600 * (622 / 2902))}
                priority
                className={`${dims.logo} h-auto select-none`}
                draggable={false}
              />
              <span
                className={`mt-3 ${dims.sessionsText} uppercase tracking-[0.4em] text-ink/80`}
              >
                Sessions
              </span>
            </div>
          ) : (
            // Quiet center mark — keeps eye anchored without competing with arcs
            <span
              className="relative z-10 block w-[6px] h-[6px] rounded-full bg-ink/70"
              aria-hidden="true"
            />
          )}
        </div>

        {/* Subtle waveform pulsing below */}
        <div className={dims.wave}>
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
