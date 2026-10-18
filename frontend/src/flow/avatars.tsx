import { createAvatar } from '@dicebear/core'
import * as avataaars from '@dicebear/avataaars'
import type { Options } from '@dicebear/avataaars'
import type { Student } from '../types/case'

/*
 * Cartoon faces from DiceBear "Avataaars" (design: Pablo Stanley, free for personal & commercial use; code: MIT).
 * `createAvatar(style, options)` draws an SVG in the browser — no network. The student ID is the `seed`,
 * so every student always gets the same, individual face; `sex` picks the hairstyle family and
 * `hair_colour` from the data tints the hair. Only friendly, realistic-looking parts are allowed.
 */
type Top = NonNullable<Options['top']>

const FEMALE_HAIR: Top = [
  'bob', 'bun', 'curly', 'curvy', 'frida', 'fro', 'froBand', 'longButNotTooLong', 'miaWallace',
  'straight01', 'straight02', 'straightAndStrand', 'bigHair', 'dreads',
]
const MALE_HAIR: Top = [
  'shortFlat', 'shortRound', 'shortWaved', 'shortCurly', 'sides', 'theCaesar', 'theCaesarAndSidePart',
  'dreads01', 'dreads02', 'frizzle', 'shaggy', 'shaggyMullet', 'fro', 'shavedSides',
]

const COMMON: Partial<Options> = {
  skinColor: ['614335', 'd08b5b', 'ae5d29', 'edb98a', 'ffdbb4'],
  eyes: ['default', 'happy', 'side', 'squint', 'surprised', 'wink'],
  eyebrows: ['defaultNatural', 'flatNatural', 'raisedExcitedNatural', 'upDownNatural', 'angryNatural', 'frownNatural'],
  mouth: ['default', 'smile', 'serious', 'twinkle', 'concerned', 'disbelief'],
  clothing: ['blazerAndShirt', 'blazerAndSweater', 'collarAndSweater', 'hoodie', 'overall', 'shirtCrewNeck', 'shirtScoopNeck', 'shirtVNeck'],
  accessories: ['prescription01', 'prescription02', 'round', 'wayfarers', 'kurt'],
  accessoriesProbability: 18,
  style: ['circle'],
  backgroundColor: ['d9cbb0', 'c9d6c4', 'cfc6dc', 'e2c7bd', 'c7d3dd'],
}

const cache = new Map<string, string>()

/** Data-URI of the student's face (cached: each face is built once). */
export function avatarUri(student: Student): string {
  let uri = cache.get(student.id)
  if (!uri) {
    const female = student.sex === 'Female'
    const hair = (student.hair_colour || '#6b4a2f').replace('#', '')
    uri = createAvatar(avataaars, {
      ...COMMON,
      seed: student.id,
      top: female ? FEMALE_HAIR : MALE_HAIR,
      hairColor: [hair],
      facialHair: ['beardLight', 'beardMedium', 'moustacheFancy'],
      facialHairColor: [hair],
      facialHairProbability: female ? 0 : 25,
    }).toDataUri()
    cache.set(student.id, uri)
  }
  return uri
}

/** The student's cartoon face. Decorative: the name is always shown next to it. */
export function StudentAvatar({ student, size = 64, className }: { student: Student; size?: number; className?: string }) {
  return (
    <img
      src={avatarUri(student)}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={`shrink-0 select-none ${className ?? ''}`}
    />
  )
}
