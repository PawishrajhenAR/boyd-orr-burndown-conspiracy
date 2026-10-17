# PROMPT FOR PERSON 2: DETECTIVE ANALYST

> Paste this whole file into your AI coding assistant (Claude Code, Cursor, etc.) inside your clone of the
> `boyd-orr-case` repo. Also attach `docs/design_reference.png` if your tool supports images.

You are my pair-programming assistant for a 24-hour hackathon. I am **Person 2 (Detective Analyst)** in a 5-person team that
shares **one GitHub repo**. Read the shared context and my role below carefully, then help me build my part.

How to work with me:
- First, restate in 5 bullet points what you will build and which files you own. Then propose a short step plan.
- Work in small steps. For each step: say **which question it answers / why it matters**, write the code, explain every
  new function or library call in simple words, and tell me the exact command to run and the output to expect.
- Only create or edit files that my role owns (section 5). If something outside my files must change, write me a short
  message I can send to the owner instead.
- Follow the data contract (section 6) **exactly**: same field names, types and time units. Never hard-code student
  names/IDs in logic (only in tests).
- Commit after each working step on a branch `p2-<topic>`, with a clear message, and remind me to open a PR at the checkpoints.
- If anything in the data or the contract seems wrong, stop and tell me rather than guessing.

---

# SHARED PROJECT CONTEXT (identical in all 5 prompts, do not change it alone)

## 1. The project

We are a 5-person team at the GUTS 2026 hackathon doing the **SAS challenge "The Boyd Orr Burndown Conspiracy"**.
Story: security got a tip that students plan to set off 1000 fireworks in the Boyd Orr Building on Bonfire Night.
They collected one day of building-access logs, interviewed some students, and need software that **visualises the
messy data creatively** and helps find **6 conspirators** (students with data irregularities) and **1 mastermind**
(clean, airtight record, but met all 6 conspirators at some point in the day).

Judging (from the brief and SAS slides):
- The bulk of the points is for **visualisation**, not for solving the case.
- The solution must be **generalisable / reusable for future cases**: no hard-coded names, everything derived from rules.
- Extra points for finding and explaining **other strange data**.
- SAS listed: interactive movement, timeline filtering, threat graphs, a high-level dashboard, entity info
  (students and buildings), **testimony annotation**, reusability, extra tools for a guard, and "solutions should have character".

Game rules from the brief:
1. Students attend their mandatory lecture **once** during the day.
2. Students do **not** have out-of-hours access to buildings.
3. The ring leader has nothing inconsistent, except that they met the conspirators.

## 2. Our product: "Case File #1105: The Boyd Orr Firework Plot"

A detective case game (cartoon corkboard style, see `docs/design_reference.png`). The player, helped by
**Inspector Ember** (detective), **PC Morag** (security officer) and **Pip** (kid helper), checks students one by one.
Every check is one rule shown as its own visualisation. LIAR / CONSPIRATOR / CLEARED stamps and red strings are
**generated from the analysis**, never drawn by hand. A **Judge Mode** reveals everything instantly.

Stack: **Python 3.11 + pandas + NetworkX** (analysis) → **FastAPI + Pydantic** (API) → **React + Vite + TypeScript +
Tailwind + Zustand + Framer Motion + D3.js** (front end). One GitHub repo.

## 3. The data (in `data/raw/`, from the organisers' zip)

| File | Rows | Columns / format |
|---|---|---|
| `people_data.csv` | 163 | `Student ID, Name, Age, Sex, Year of Study, Subject, Height, Hair colour, Societies` |
| `security_logs.csv` | 662 | `Student ID, Name, Location, Time`. Time is `"HHMM-HHMM"`, e.g. `"2208-0048"` crosses midnight |
| `location_data.csv` | 14 | `Building Name, Geolocation, Opening Times, Description`. Geolocation is `"{55.8735737 -4.2926741}"`, opening `"0800-2100"` |
| `student_statements.txt` | 25 statements | blocks of `Statement N / Student Number: X / Name: Y / Testimony: ...` (one uses `Student Name:`) |

Known messiness that the pipeline must handle **generically** (detect, fix, and report in `data_quality`):
1. Student IDs with lowercase letters (`2813225b` in logs and in a statement). Normalise to uppercase.
2. IDs that don't exist in people data: log ID `2912324G` (name Jonny Craig, real ID `2712324G`) and statement ID
   `2656431B` (name Oscar Brown, real ID `2456431B`). Resolve by exact name match and record the mismatch.
3. Location typo: `"Queen Maragret Building"` → `"Queen Margaret Union"` (fuzzy-match to the building list).
4. Societies are Python-literal strings: mostly lists `"['A', 'B']"`, 3 rows as sets `"{'A', 'B'}"`, 38 empty (NaN),
   one with a duplicate entry. README spells "Assoication", the data spells "Association".
5. Times cross midnight (end < start → end + 1440). Opening `0000-0000` means always open (Kelvingrove Park).
   Wrap-around hours: Library `0700-0200`, The Hive `2200-0200`.
6. **Lecture timetables exist only in free text** in `Description`, e.g. *"This building hosts Computing Science
   lectures from 1000 to 1200"*. Main Building lists three subjects in one sentence ("from 0900 to 1100",
   "from 1000 until 1200"). Parse with regex, don't hard-code.
7. The Hive description says *"strictly over 18s only"*. Parse it as an age restriction (min_age 18).
8. Subjects in the data differ from the README list: the data has Business, Engineering, Pharmacy (Pharmacy has
   **no** lecture anywhere). "Engineering lectures" are in James Watt.
9. Physics lecture is described as 0900–1100, but **every** Physics log is 0900–1000. So infer the real lecture slot
   from the data (most common slot per subject) and report the doc-vs-data difference as an oddity.

## 4. Reference findings (our manual analysis, used as ACCEPTANCE TESTS, never hard-code them in the logic)

Hard-rule irregularities found:
| Student (canonical ID) | Evidence |
|---|---|
| Oscar Brown `2456431B` | Logs overlap, so he is in two places at once (James Watt 10:00–13:00 vs Boyd Orr 11:16–12:32; Kelvingrove 12:10–15:32 vs QMU 13:43–16:43). Statement ID `2656431B` is wrong. Hostile statement |
| Alice Patterson `2774868P` | Engineering student but **no** James Watt lecture. Was in the Boyd Orr CS lecture 10–12 instead, while saying "my Engineering lecture". St Andrews 16:25–17:00 overlaps Library 16:35–17:50 |
| Abdul Murphy `2786843M` | Boyd Orr **22:08–22:19**, but Boyd Orr closes 21:00. Statement claims the Wolfson (no log) and omits the Library and Boyd Orr. Has the typo row |
| Eric Parkin `2546112P` | Studies "Pharmacy", which has no lecture on campus, so no lecture attended. Claims a Philosophy Society committee meeting but has no societies |
| Jonny Craig `2712324G` | His logs are filed under an unknown ID `2912324G`. Left the lecture early (10:00–10:45 vs 10:00–11:00 for everyone else). Claims Adam Smith Building (no log) |
| Stuart Wands `2813225B` | Age **17** at The Hive (strictly 18+) 22:08–00:48. ID typed in lowercase in the logs and statement |
| Paul Butler `2729563B` | Weaker: Kelvingrove 08:24–10:37 overlaps his James Watt lecture 10:00–13:00. Ranked 7th → "suspicious", not a conspirator |

**Mastermind: Scott Johnston `2453876J`** (Computing Science, 24). Zero flags (one lecture, all within opening hours,
no overlaps, no statement), and he is the **only** student who met all 6 (in fact all 7). He met Eric Parkin at Kelvingrove
07:55–08:37; Alice Patterson, Stuart Wands and Oscar Brown at the Boyd Orr 10:00–12:00; Alice Patterson, Jonny Craig and
Abdul Murphy at the Library 17:03–19:33; and Stuart Wands at The Hive 22:31–00:48. The next best student met only 5 of 6.
Curiosity: Scott, Alice and Russell Dixon are the 3 rows whose Societies use set `{}` syntax.

Other oddities worth showing: README vs data subject mismatch; Mandy Howell age 37; Melanie Patterson at Kelvingrove
03:01–05:33; Danny Thomas's "five minutes" in the Boyd Orr was 11 minutes (19:53–20:04); Beth Jones and Russell
Matthews' statements corroborate each other; Russell Dixon has only 1 log; 38 students with no societies.

## 5. Repo structure and FILE OWNERSHIP (only edit files you own; ask the owner for changes)

```
boyd-orr-case/
├── README.md                         P3
├── data/raw/                         P3 adds the 4 data files (not the pptx/pdf)
├── docs/design_reference.png         P3
├── backend/
│   ├── requirements.txt              P3
│   ├── app/
│   │   ├── main.py                   P3  FastAPI app + routes
│   │   ├── models.py                 P3  Pydantic contract (section 6), the single source of truth
│   │   ├── config.py                 P3  settings + rule weights (section 7)
│   │   ├── export.py                 P3  writes frontend/public/case.json
│   │   ├── pipeline/                 P1
│   │   │   ├── load.py               read raw files → raw DataFrames
│   │   │   ├── buildings.py          parse buildings, opening hours, lectures, restrictions, aliases
│   │   │   ├── clean.py              normalise IDs/names/locations/times/societies, identity resolution
│   │   │   ├── statements.py         parse statement blocks
│   │   │   ├── quality.py            DataQualityIssue list
│   │   │   └── run.py                run_pipeline(paths) -> CleanData
│   │   └── analysis/                 P2
│   │       ├── rules.py              each rule = function returning list[Flag]
│   │       ├── testimony.py          claim extraction from statements (+ hypothetical detection)
│   │       ├── meetings.py           co-location overlaps
│   │       ├── scoring.py            scores, verdicts, mastermind
│   │       ├── oddities.py           extra strange data
│   │       └── build_case.py         build_case(clean, config) -> Case
│   └── tests/  test_pipeline.py P1 · test_analysis.py P2 · test_api.py P3
└── frontend/                         P4 creates the Vite project
    ├── public/case.sample.json       P3 (hand-made fake, available in hour 1)
    ├── public/case.json              generated by P3's export (committed at checkpoints)
    └── src/
        ├── types/case.ts             P3  (mirrors models.py exactly)
        ├── api/client.ts             P3  loadCase(): try /api/case, fall back to /case.json, then /case.sample.json
        ├── store/useCaseStore.ts     P4  Zustand store (section 9)
        ├── theme/tokens.ts, index.css P4 (section 10)
        ├── content/story.ts           P4 (dialogue text supplied by P3)
        ├── App.tsx, router            P4
        ├── pages/                     P4: Title, Briefing, Evidence, Board, Interrogation, HQ, Accuse, CaseClosed
        │                              P5: MapPage.tsx, TimelinePage.tsx, NetworkPage.tsx
        ├── components/game/           P4
        └── components/viz/            P5: TimeSlider, RedStrings, DayTimeline, Clock24, FlagHeatmap,
                                           RuleBars, StorylineMini, NetworkMini, util.ts
```

## 6. DATA CONTRACT (`backend/app/models.py` ⇄ `frontend/src/types/case.ts`)

Time convention: **integer minutes since 00:00 of the investigation day**. Values ≥ 1440 are after midnight
(e.g. 00:48 next day = 1488). Building IDs are slugs (`"boyd-orr-building"`). Student IDs are canonical uppercase people-data IDs.

```python
class Lecture(BaseModel):          subject: str; start: int; end: int; source: Literal["description","inferred"]
class Building(BaseModel):
    id: str; name: str; lat: float; lon: float
    open_start: int; open_end: int; always_open: bool; open_label: str      # "08:00–21:00"
    lectures: list[Lecture]; min_age: int | None; description: str; aliases: list[str]
class Student(BaseModel):
    id: str; name: str; age: int; sex: str; year: int; subject: str; height: int; hair_colour: str
    societies: list[str]; has_statement: bool; raw_ids: list[str]            # every ID seen for this person
    lecture: Lecture | None; lecture_building_id: str | None
class Visit(BaseModel):
    id: str; student_id: str; building_id: str; start: int; end: int; raw_time: str; raw_student_id: str; raw_location: str
class Claim(BaseModel):
    building_id: str; text: str; char_start: int; char_end: int; hypothetical: bool; matched_visit_id: str | None
class Statement(BaseModel):
    student_id: str; raw_student_id: str; name: str; text: str; claims: list[Claim]
class Flag(BaseModel):
    id: str; student_id: str
    rule: Literal["missing_lecture","multiple_lectures","left_lecture_early","out_of_hours","impossible_overlap",
                  "age_restricted_venue","id_mismatch","id_format","statement_contradiction","statement_omission",
                  "false_society_claim","subject_without_lecture"]
    severity: int                      # 1 low · 2 medium · 3 high
    title: str                         # short, for cards: "After hours in Boyd Orr"
    detail: str                        # one plain-English sentence with times
    visit_ids: list[str]; building_id: str | None; time: int | None
    statement_span: tuple[int,int] | None
class Meeting(BaseModel):
    id: str; a: str; b: str; building_id: str; start: int; end: int; minutes: int
class Suspect(BaseModel):
    student_id: str; score: int; flag_count: int; rank: int
    verdict: Literal["conspirator","mastermind","suspicious","clear"]
    conspirators_met: list[str]; meeting_ids_with_conspirators: list[str]
class DataQualityIssue(BaseModel):
    file: str; row: int | None; column: str; issue: str; original: str; fixed: str
class Oddity(BaseModel):  id: str; title: str; detail: str; student_ids: list[str]; building_ids: list[str]
class CaseMeta(BaseModel):
    case_name: str; generated_at: str; day_label: str; source_files: list[str]
    counts: dict[str,int]; conspirator_count: int; time_min: int; time_max: int
class Case(BaseModel):
    meta: CaseMeta; buildings: list[Building]; students: list[Student]; visits: list[Visit]
    statements: list[Statement]; flags: list[Flag]; meetings: list[Meeting]; suspects: list[Suspect]
    data_quality: list[DataQualityIssue]; oddities: list[Oddity]
```
`suspects` contains **every** student (verdict "clear" for most). P3 writes `case.ts` with identical names (camelCase is NOT used; keep snake_case in JSON).

## 7. Rules config (`backend/app/config.py`, owned by P3, values agreed with P2)

```python
CONSPIRATOR_COUNT = 6               # from the brief; must be configurable for future cases
SEVERITY = {"missing_lecture":3,"multiple_lectures":2,"left_lecture_early":2,"out_of_hours":3,
            "impossible_overlap":3,"age_restricted_venue":3,"id_mismatch":2,"id_format":1,
            "statement_contradiction":2,"statement_omission":0,"false_society_claim":2,"subject_without_lecture":1}
MIN_MEETING_MINUTES = 1             # overlap needed to count as "met"
```
Score = **sum over the distinct rules a student breaks of that rule's severity** (each rule counts once per student,
so 4 overlapping visits don't outweigh 3 different kinds of irregularity). Ties → more flags first, then name.
Verdicts: rank by score; top `CONSPIRATOR_COUNT` with score ≥ 3 → "conspirator"; other flagged students with
score ≥ 3 → "suspicious"; mastermind = the student with **zero** flags of severity ≥ 2 who met the most distinct
conspirators (must meet all of them to be "mastermind", otherwise mark the best as "suspicious").

## 8. API (FastAPI, prefix `/api`, owned by P3)

| Method | Path | Returns |
|---|---|---|
| GET | `/api/health` | `{"status":"ok"}` |
| GET | `/api/case` | full `Case` (cached in memory; computed at startup from `data/raw`) |
| GET | `/api/students/{id}` | `{student, visits, statement, flags, suspect, meetings}` for one student |
| GET | `/api/buildings/{id}` | `{building, visits}` |
| GET | `/api/meetings?until=<min>&student=<id>` | filtered `list[Meeting]` |
| POST | `/api/upload` | multipart, the 4 files → re-runs the pipeline, replaces the cached case, returns `Case` |
| GET | `/api/config` / PUT `/api/config` | rule weights + conspirator count (re-scores) |

Front end loads `/api/case` once and does all filtering client-side. Other endpoints are for the demo, Swagger `/docs` and reuse.

## 9. Front-end shared state (Zustand, `src/store/useCaseStore.ts`, owned by P4; P5 only uses the selectors and actions)

```ts
case: Case | null; loadCase(): Promise<void>
selectedStudentId: string | null; selectStudent(id: string | null)
selectedBuildingId: string | null; selectBuilding(id: string | null)
replayTime: number; setReplayTime(min: number); isPlaying: boolean; togglePlay()
judgeMode: boolean; setJudgeMode(b: boolean)
examined: Record<string, {lecture: boolean; hours: boolean; alibi: boolean}>; markExamined(id, check)
revealedFlagIds: Set<string>   // flags become visible on cards only after the player examines that check (all in judge mode)
badges: number; accusation: {conspirators: string[]; mastermind: string | null}
hint: string; setHint(text: string)
// derived helpers (exported functions): studentById, buildingById, visitsFor(id), flagsFor(id), suspectFor(id),
// meetingsUntil(t), visibleFlagsFor(id), boardStudents()  // top 12 by (score + 2*conspirators_met), always incl. mastermind
```

## 10. Design system (match `docs/design_reference.png`)

Layout of the Board (1440×900 target, works down to 1280 wide): top bar 72px · three columns `300px | 1fr | 320px`
with 16px gaps · bottom "Replay the day" bar 88px. Rounded panels (radius 16px) with a 2px border.

| Token | Value | Use |
|---|---|---|
| `bg` | `#1a1410` | page background |
| `panel` | `#2a1f17` · border `#4a3524` | side panels, bars |
| `panelInner` | `#3b2c20` | boxes inside panels |
| `accent` | `#ffb347` | titles, stat-box borders, slider |
| `cork` | `#b07a45` · frame `#5a3a1e` · speckle `#8d5f33` | suspect board |
| `card` | `#fbf7ee` · photo bg `#d9e4ea` | polaroids |
| `pin`/`string` | `#d62828` | pins and red strings |
| `danger` | `#c0392b` | LIAR stamps, ACCUSE button, lies |
| `ok` | `#2e8b57` | "Alibi checks out" |
| `warn` | `#d35400` | "Seen with …" |
| `muted` | `#d9c3a5` / `#a8927a` | body / small text |
| `sticky` | `#fff59d`, `#ffcc80` | evidence sticky notes |
Fonts (Google Fonts): **Fredoka** (headings, 600) and **Inter** (body); **JetBrains Mono** for logs.
Characters are simple flat SVG (circle head, half-circle hair, rectangle shirt), with colours derived from student
data (`hair_colour` from people data!). Stamps are rotated (−12°…+18°) bordered red text.
**Network page only:** a dark "link-analysis" look: background `#0b1020`, nodes as dark circles with a glowing ring
(teal `#2ec4b6` students, violet `#9b5de5` buildings), conspirators red `#ff4d5e`, mastermind gold `#ffd166`,
thin glowing cyan edges, labels under nodes, search box top-right, zoom controls top-left, floating details panel
with collapsible sections on the right, and labelled group boxes ("Conspirators").

## 11. Git workflow

- One repo, branch `main`. Each person works on `p<N>-<topic>` branches (e.g. `p1-clean-ids`) and opens small PRs.
- **Never edit a file you don't own.** Changes to `models.py` / `case.ts` go through P3 (post in team chat first).
- Pull `main` before starting each task. Commit often with clear messages.
- Checkpoints: **H1** contract + sample JSON on main · **H6** real clean data · **H12** real `case.json` in the UI
  (most important) · **H18** feature freeze · **H22** pitch rehearsal.
- Run locally: `cd backend && uvicorn app.main:app --reload --port 8000` and `cd frontend && npm run dev` (Vite proxies `/api` → 8000).

---

# YOUR ROLE: PERSON 2, DETECTIVE ANALYST (rules, testimony, meetings, scoring)

You own `backend/app/analysis/*` and `backend/tests/test_analysis.py`. You turn P1's `CleanData` into the final
`Case` (section 6). **Every** stamp, string and score in the game comes from your code, so every flag needs a clear,
human-readable `title` and `detail` with times (e.g. *"Swiped into Boyd Orr Building at 22:08, but it closes at 21:00."*).
Never hard-code student names or IDs in logic. They may appear only in tests.

Until P1 is ready (around H6), develop against a tiny hand-made `CleanData` fixture in your tests.

## Step 1: `rules.py` (question: *who broke which rule from the brief?*)
One function per rule: `def rule_x(clean: CleanData) -> list[Flag]`, plus `ALL_RULES = [...]` and `run_rules(clean)`.
Flag IDs `f0001…`. Format times with a helper `hhmm(minutes)` (handles ≥1440 → `"00:48 (+1)"`).

| Rule | Logic | Sev |
|---|---|---|
| `missing_lecture` | No visit to the student's lecture building overlapping their lecture slot. Also fire it when the subject has **no** lecture anywhere ("Pharmacy has no lecture on campus") | 3 |
| `multiple_lectures` | 2+ separate visits overlapping the slot | 2 |
| `left_lecture_early` | Attended, but arrived >10 min late or left >10 min early vs the (inferred) slot | 2 |
| `out_of_hours` | Visit not fully inside opening hours (skip `always_open`). Take care with wrap-around (Library till 02:00) | 3 |
| `impossible_overlap` | Two of the same student's visits in **different** buildings overlap by >0 min | 3 |
| `age_restricted_venue` | Visit to a building with `min_age` while `student.age < min_age` | 3 |
| `id_mismatch` | Student has a `raw_id` that is not their canonical ID (letters/digits differ, not just case) | 2 |
| `id_format` | A raw ID differs only by letter case | 1 |
| `subject_without_lecture` | The subject has no lecture in any building (data oddity) | 1 |
| `statement_contradiction` | From step 2: a non-hypothetical claim with no matching visit, or a statement that says "my … lecture" while `missing_lecture` fired | 2 |
| `statement_omission` | Visits to campus buildings that a statement never mentions. Informational only, **only** for statements that list places explicitly (≥3 claims) | 0 |
| `false_society_claim` | Statement names a society (fuzzy match ≥0.85 against all society names in the data) that the student is not a member of | 2 |

## Step 2: `testimony.py` (question: *does what they say match where they were?* This is SAS's "testimony annotation")
- For each statement, find every alias occurrence (from `clean.aliases`, longest alias first, word boundaries, no
  overlapping matches) → `Claim(building_id, text, char_start, char_end)`. For an ambiguous alias (GUU/QMU) the claim
  matches if **either** building was visited. Store the first building actually visited, else the first candidate.
- **Hypothetical detection:** a claim is `hypothetical=True` if its sentence contains cue words such as `tempted`,
  `plan`, `planned`, `wanted me`, `tried to get me`, `instead`, `didn't`, `did not`, `wasn't`, `never`, `want to launch`,
  `take out`, `promised he would`, `before … opened` (keep the list in one constant and test it).
- Non-hypothetical claims get `matched_visit_id` = a visit by that student to that building (any time). Claims with no
  match are contradictions.
- Expected: Abdul Murphy claims the Wolfson (no visit) → contradiction. Jonny Craig claims Adam Smith (no visit) →
  contradiction. Russell Matthews (QMU, HIVE) and Angela Jones (Hive) → hypothetical, **no** flags.
- Off-campus places (Tesco, Nandos, town, home, bagel mania) are simply not aliases, so they are ignored.

## Step 3: `meetings.py` (question: *who was with whom?*)
For every building, sort visits and sweep: two **different** students with overlapping visits in the same building
(≥ `MIN_MEETING_MINUTES`) → `Meeting(a, b, building_id, start=max, end=min, minutes)`, with `a < b` by ID.
Avoid O(n²) over all visits by grouping by building first. Expect several thousand meetings.

## Step 4: `scoring.py` (question: *who are the 6 and who is the boss?*)
Implement section 7 exactly (score = sum of severities of distinct rules). Then:
- `conspirators` = top `CONSPIRATOR_COUNT` with score ≥ 3.
- For each student with no flag of severity ≥ 2: `conspirators_met` = distinct conspirators they share a meeting with.
  The max is `mastermind` only if they met **all** conspirators. Fill `meeting_ids_with_conspirators`.
- Also fill `conspirators_met` for conspirators themselves (other conspirators they met), which the network uses.
- `rank` 1..N over everyone.

## Step 5: `oddities.py` (question: *what else is strange?*, which earns bonus points)
Generic detectors, each producing an `Oddity` with a clear `detail`:
documented vs inferred lecture time differences · students with only 1 log · visits to always-open places at night
(e.g. 03:01–05:33) · ages > 30 or < 18 · subjects missing from any timetable · statements that corroborate each other
(two statements naming each other, like Beth Jones and Russell Matthews) · statement times that disagree with logs
(stretch goal: parse "five minutes", "about 4 o'clock", "half 7") · societies-format quirk rows.

## Step 6: `build_case.py`
`build_case(clean: CleanData, config) -> Case`: run the rules → testimony (fill `statement.claims`) → contradiction
flags → meetings → scoring → oddities → `CaseMeta` (counts, `time_min`/`time_max` over visits, `day_label="4 November"`).

## Acceptance tests (`tests/test_analysis.py`, on the real data via `run_pipeline`)
- Conspirators (exact set): `2456431B` Oscar Brown, `2774868P` Alice Patterson, `2786843M` Abdul Murphy,
  `2546112P` Eric Parkin, `2712324G` Jonny Craig, `2813225B` Stuart Wands.
- Mastermind: `2453876J` Scott Johnston, with `len(conspirators_met) == 6` and no flags at all.
- `2729563B` Paul Butler → verdict `"suspicious"`, rank 7.
- Flags exist: Abdul `out_of_hours` (22:08 Boyd Orr), Stuart `age_restricted_venue` (The Hive), Oscar `impossible_overlap`,
  Alice `missing_lecture` + `impossible_overlap`, Eric `missing_lecture` + `false_society_claim`, Jonny `id_mismatch` +
  `left_lecture_early` + `statement_contradiction`.
- No `statement_contradiction` for Russell Matthews `2797619M`, Angela Jones `2425599J`, Danny Thomas `2527287T`, Lee James `2522391J`.
- Changing `CONSPIRATOR_COUNT` changes the number of conspirators (proves configurability).
- Print a pretty summary table: `python -m app.analysis.build_case`.

## Hand-offs
- **H1:** agree severities with P3 (config) and confirm the flag `title` style with P4.
- **H8–H12:** `build_case()` on real data with tests green → P3 wires it into the API and export.
- Afterwards: write the "why each of the 7 stands out" one-liners (for the Case Closed page and pitch) and give them to P3 and P4.
