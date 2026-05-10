import Image from 'next/image';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'black' | 'white';
  showSessions?: boolean;
  align?: 'left' | 'center';
}

const sizes = {
  sm: { logoWidth: 110, sessionsText: 'text-[9px]' },
  md: { logoWidth: 180, sessionsText: 'text-[11px]' },
  lg: { logoWidth: 280, sessionsText: 'text-sm' },
  xl: { logoWidth: 480, sessionsText: 'text-base' },
};

export function Logo({
  size = 'md',
  variant = 'black',
  showSessions = true,
  align = 'left',
}: LogoProps) {
  const { logoWidth, sessionsText } = sizes[size];
  const src = variant === 'white' ? '/logo-white.png' : '/logo-black.png';
  const sessionsColor = variant === 'white' ? 'text-paper' : 'text-ink';

  return (
    <div
      className={`inline-flex flex-col ${
        align === 'center' ? 'items-center' : 'items-start'
      }`}
    >
      <Image
        src={src}
        alt="Selected"
        width={logoWidth}
        height={Math.round(logoWidth * (622 / 2902))}
        priority
        style={{ width: logoWidth, height: 'auto' }}
      />
      {showSessions && (
        <span
          className={`${sessionsText} ${sessionsColor} uppercase tracking-[0.4em] mt-2 font-sans block`}
          style={{
            width: logoWidth,
            textAlign: align === 'center' ? 'center' : 'left',
          }}
        >
          Sessions
        </span>
      )}
    </div>
  );
}
