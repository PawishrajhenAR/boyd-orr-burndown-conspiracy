import type { Student } from '../types/case'

interface AvatarProps {
  hair: string
  size?: number
  className?: string
}

/** Flat female silhouette: long hair behind the head, rounded shoulders. */
export function FemaleAvatar({ hair, size = 64, className }: AvatarProps) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className} aria-hidden="true">
      <path d="M14 34 Q12 10 32 9 Q52 10 50 34 L52 50 L12 50 Z" fill={hair} />
      <circle cx="32" cy="26" r="11" fill="#d9b79a" />
      <path d="M20 24 Q24 12 32 13 Q41 12 44 24 Q36 18 28 19 Q23 20 20 24 Z" fill={hair} />
      <path d="M10 64 Q12 44 32 42 Q52 44 54 64 Z" fill="#1d1a17" />
    </svg>
  )
}

/** Flat male silhouette: short hair cap, broader shoulders. */
export function MaleAvatar({ hair, size = 64, className }: AvatarProps) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className} aria-hidden="true">
      <circle cx="32" cy="27" r="11" fill="#d9b79a" />
      <path d="M21 26 Q20 13 32 13 Q44 13 43 26 Q40 19 32 19 Q24 19 21 26 Z" fill={hair} />
      <path d="M6 64 Q8 43 32 41 Q56 43 58 64 Z" fill="#1d1a17" />
    </svg>
  )
}

/** Picks the silhouette from `sex` and tints the hair with `hair_colour`. */
export function StudentAvatar({ student, size, className }: { student: Student; size?: number; className?: string }) {
  const hair = student.hair_colour || '#6b4a2f'
  return student.sex === 'Female' ? (
    <FemaleAvatar hair={hair} size={size} className={className} />
  ) : (
    <MaleAvatar hair={hair} size={size} className={className} />
  )
}
