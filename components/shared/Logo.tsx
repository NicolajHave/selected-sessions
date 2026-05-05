export function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = {
    sm: 'text-xl',
    md: 'text-2xl',
    lg: 'text-4xl',
  };

  return (
    <div className={`font-serif italic ${sizes[size]} tracking-tight`}>
      Selected{' '}
      <span className="not-italic font-sans uppercase tracking-widest text-sm align-middle ml-1">
        Sessions
      </span>
    </div>
  );
}
