// Palette icon for the Meme element (frog emoji style)

export function MemeIcon({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      {/* Frog face */}
      <circle cx="16" cy="18" r="11" fill="#6B8E23" stroke="#3d5213" strokeWidth="1.5" />
      {/* Eyes */}
      <circle cx="11" cy="14" r="4.5" fill="white" stroke="#3d5213" strokeWidth="1" />
      <circle cx="21" cy="14" r="4.5" fill="white" stroke="#3d5213" strokeWidth="1" />
      <circle cx="11" cy="14" r="2" fill="black" />
      <circle cx="21" cy="14" r="2" fill="black" />
      {/* Smile */}
      <path d="M10 22 Q16 26 22 22" stroke="#3d5213" strokeWidth="1.5" fill="none" />
    </svg>
  );
}
