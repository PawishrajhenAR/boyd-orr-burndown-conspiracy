/** Case contract — snake_case JSON (P3 owns; stub for local P5 demo). */

export type RuleId =
  | 'missing_lecture'
  | 'multiple_lectures'
  | 'left_lecture_early'
  | 'out_of_hours'
  | 'impossible_overlap'
  | 'age_restricted_venue'
  | 'id_mismatch'
  | 'id_format'
  | 'statement_contradiction'
  | 'statement_omission'
  | 'false_society_claim'
  | 'subject_without_lecture'

export type Verdict = 'conspirator' | 'mastermind' | 'suspicious' | 'clear'

export interface Lecture {
  subject: string
  start: number
  end: number
  source: 'description' | 'inferred'
}

export interface Building {
  id: string
  name: string
  lat: number
  lon: number
  open_start: number
  open_end: number
  always_open: boolean
  open_label: string
  lectures: Lecture[]
  min_age: number | null
  description: string
  aliases: string[]
}

export interface Student {
  id: string
  name: string
  age: number
  sex: string
  year: number
  subject: string
  height: number
  hair_colour: string
  societies: string[]
  has_statement: boolean
  raw_ids: string[]
  lecture: Lecture | null
  lecture_building_id: string | null
}

export interface Visit {
  id: string
  student_id: string
  building_id: string
  start: number
  end: number
  raw_time: string
  raw_student_id: string
  raw_location: string
}

export interface Claim {
  building_id: string
  text: string
  char_start: number
  char_end: number
  hypothetical: boolean
  matched_visit_id: string | null
}

export interface Statement {
  student_id: string
  raw_student_id: string
  name: string
  text: string
  claims: Claim[]
}

export interface Flag {
  id: string
  student_id: string
  rule: RuleId
  severity: number
  title: string
  detail: string
  visit_ids: string[]
  building_id: string | null
  time: number | null
  statement_span: [number, number] | null
}

export interface Meeting {
  id: string
  a: string
  b: string
  building_id: string
  start: number
  end: number
  minutes: number
}

export interface Suspect {
  student_id: string
  score: number
  flag_count: number
  rank: number
  verdict: Verdict
  conspirators_met: string[]
  meeting_ids_with_conspirators: string[]
}

export interface DataQualityIssue {
  file: string
  row: number | null
  column: string
  issue: string
  original: string
  fixed: string
}

export interface Oddity {
  id: string
  title: string
  detail: string
  student_ids: string[]
  building_ids: string[]
}

export interface CaseMeta {
  case_name: string
  generated_at: string
  day_label: string
  source_files: string[]
  counts: Record<string, number>
  conspirator_count: number
  time_min: number
  time_max: number
}

export interface Case {
  meta: CaseMeta
  buildings: Building[]
  students: Student[]
  visits: Visit[]
  statements: Statement[]
  flags: Flag[]
  meetings: Meeting[]
  suspects: Suspect[]
  data_quality: DataQualityIssue[]
  oddities: Oddity[]
}
