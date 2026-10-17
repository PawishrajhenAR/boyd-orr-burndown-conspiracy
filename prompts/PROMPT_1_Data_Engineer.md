# PROMPT FOR PERSON 1: DATA ENGINEER

> Paste this whole file into your AI coding assistant (Cursor, Claude Code, Copilot, etc.) with the
> `boyd-orr-burndown-conspiracy` repo open as the workspace. Also attach `docs/design_reference.png` if your tool supports images.

You are my pair-programming assistant for a 24-hour hackathon. I am **Person 1 (Data Engineer)** in a 5-person team that
shares **one GitHub repo**. Read the shared context and my role below carefully, then help me build my part.

How to work with me:
- First, restate in 5 bullet points what you will build and which files you own. Then propose a short step plan.
- Work in small steps. For each step: say **which question it answers / why it matters**, write the code, explain every
  new function or library call in simple words, and tell me the exact command to run and the output to expect.
- Only create or edit files that my role owns (section 5). If something outside my files must change, write me a short
  message I can send to the owner instead.
- Follow the data contract (section 6) **exactly**: same field names, types and time units. Never hard-code student
  names/IDs in logic (only in tests).
- Commit after each working step on a branch `p1-<topic>`, with a clear message, and remind me to open a PR at the checkpoints.
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

## 3. The data (in `data/raw/` — already in this repo)

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

This repo is already on GitHub with **data + docs + prompts on `main`**. Do **not** move, rename, or duplicate
`data/raw/`, `docs/`, `prompts/`, `AGENTS.md`, or `README.md`. Everyone clones the same tree and works the same way.

How onboarding works for every role:
1. `git pull origin main`
2. Open this repo in your AI coding agent
3. Paste **your** `prompts/PROMPT_N_*.md` in full (this file)
4. Attach `docs/design_reference.png` if the tool accepts images
5. Only create/edit files your role owns below. If you need another area changed, message that owner.

```
boyd-orr-burndown-conspiracy/
├── README.md                         team onboarding (keep; P3 may append run commands only)
├── AGENTS.md                         rules for AI agents (shared — do not rewrite casually)
├── .gitignore                        Python / Node / .env / zips (already set)
├── prompts/                          team pack (already on main — paste these into your AI agent)
│   ├── 00_START_HERE.md              everyone reads first
│   ├── PROMPT_1_Data_Engineer.md     P1
│   ├── PROMPT_2_Detective_Analyst.md P2
│   ├── PROMPT_3_Backend_Lead.md      P3
│   ├── PROMPT_4_Front_end_Lead.md    P4
│   └── PROMPT_5_Visualisation_Developer.md  P5
├── data/raw/                         challenge data (already on main — pipeline reads from here)
│   ├── people_data.csv
│   ├── location_data.csv
│   ├── security_logs.csv
│   └── student_statements.txt
├── docs/
│   ├── design_reference.png          UI look (already on main)
│   └── challenge-brief.pdf           official organiser brief (already on main)
├── backend/                          P3 scaffolds first (Hour 0–1), then P1/P2 fill their folders
│   ├── requirements.txt              P3
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                   P3  FastAPI app + routes
│   │   ├── models.py                 P3  Pydantic contract (section 6), the single source of truth
│   │   ├── config.py                 P3  settings + rule weights (section 7)
│   │   ├── export.py                 P3  writes frontend/public/case.json
│   │   ├── pipeline/                 P1
│   │   │   ├── __init__.py
│   │   │   ├── load.py               read data/raw → raw DataFrames
│   │   │   ├── buildings.py          parse buildings, opening hours, lectures, restrictions, aliases
│   │   │   ├── clean.py              normalise IDs/names/locations/times/societies, identity resolution
│   │   │   ├── statements.py         parse statement blocks
│   │   │   ├── quality.py            DataQualityIssue list
│   │   │   └── run.py                run_pipeline(raw_dir) -> CleanData
│   │   └── analysis/                 P2
│   │       ├── __init__.py
│   │       ├── rules.py              each rule = function returning list[Flag]
│   │       ├── testimony.py          claim extraction from statements (+ hypothetical detection)
│   │       ├── meetings.py           co-location overlaps
│   │       ├── scoring.py            scores, verdicts, mastermind
│   │       ├── oddities.py           extra strange data
│   │       └── build_case.py         build_case(clean, config) -> Case
│   └── tests/                        test_pipeline.py P1 · test_analysis.py P2 · test_api.py P3
└── frontend/                         P4 creates the Vite project (Hour 0–1)
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

- One repo (`boyd-orr-burndown-conspiracy`), branch `main`. Each person works on `p<N>-<topic>` branches
  (e.g. `p1-clean-ids`) and opens small PRs into `main`.
- **Never edit a file you don't own.** Changes to `models.py` / `case.ts` go through P3 (post in team chat first).
- **Never move** `data/raw/`, `docs/`, or `prompts/` — every role must see the same paths.
- Default raw path for the pipeline/API: `data/raw` (relative to the repo root). Do not invent a second data folder.
- Pull `main` before starting each task. Commit often with clear messages.
- Checkpoints: **H1** contract + sample JSON on main · **H6** real clean data · **H12** real `case.json` in the UI
  (most important) · **H18** feature freeze · **H22** pitch rehearsal.
- Run locally: `cd backend && uvicorn app.main:app --reload --port 8000` and `cd frontend && npm run dev`
  (Vite proxies `/api` → 8000).


---

# YOUR ROLE: PERSON 1, DATA ENGINEER (pipeline: load, clean, resolve)

You own `backend/app/pipeline/*` and `backend/tests/test_pipeline.py`. Your output, `CleanData`, is what everyone else
builds on, so correctness matters more than speed. Do not edit any other file.

## What to build

`run_pipeline(raw_dir: Path) -> CleanData` where `CleanData` is a small dataclass (define it in `pipeline/run.py`):
```python
@dataclass
class CleanData:
    buildings: list[Building]        # Pydantic models from app.models (P3 writes them in hour 1; until then use the spec in section 6)
    students: list[Student]          # lecture fields filled by you (see step 4)
    visits: list[Visit]
    statements: list[Statement]      # claims=[] (P2 fills claims)
    data_quality: list[DataQualityIssue]
    aliases: dict[str, list[str]]    # lowercase alias -> list of building_ids (list because "the union" is ambiguous)
```

### Step 1: `load.py` (question it answers: *can we read every file safely?*)
- Read from repo-root `data/raw/` (paths: `people_data.csv`, `location_data.csv`, `security_logs.csv`,
  `student_statements.txt`). Do not copy the files elsewhere.
- Read the CSVs with `dtype=str` (so IDs and times keep leading zeros) and strip whitespace from every cell.
- Parse `student_statements.txt` with a regex that splits on `Student Number:`. Accept both `Name:` and `Student Name:`.
  The testimony runs until the next `Statement` header or the end of the file. Expect **25** statements.

### Step 2: `buildings.py` (question: *when is each building open, and which lectures does it host?*)
- `slug(name)`: lowercase, non-alphanumerics → `-`.
- Geolocation `"{55.87 -4.29}"` → lat, lon floats.
- Opening `"HHMM-HHMM"` → minutes. If end ≤ start, add 1440 (wrap past midnight). `"0000-0000"` → `always_open=True`, `0..2880`.
- **Lectures from text:** regex over `Description` for patterns like
  `(?P<subj>[A-Za-z ]+?) lectures (?:every day )?from (?P<s>\d{4}) (?:to|until) (?P<e>\d{4})`.
  The Main Building sentence contains 3 subjects, so use `finditer`. The captured text has extra words in front
  ("This section of the university hosts Philosophy"), so pick the **people-data subject name that the captured text
  ends with** (case-insensitive, longest match wins: "Veterinary Medicine" before "Medicine"), e.g. "mathematics" → "Mathematics".
  Subjects with no match are kept as-is (e.g. "Business" also exists in the data, which is fine).
  Store `Lecture(source="description")`.
- **Age restriction:** if the description contains `over (\d+)s? only` → `min_age = int`. (The Hive → 18.)
- **Aliases** (generic plus a small hand list, kept in one dict in this file): full name, name without "Building",
  initials (QMU, GUU), and common nicknames: `"boydy"`, `"the boyd orr"`, `"kg"`, `"kelvin grove"`, `"kelvingrove"`,
  `"the park"`, `"park"`, `"hive"`, `"the hive"`, `"medicine building"` → wolfson, `"the union"`/`"union"` →
  **both** GUU and QMU, `"st andrews"`, `"sir alwyn"`, `"adam smith"`, `"james watt"`, `"main building"`,
  `"joseph black"`, `"the library"`, `"library"`, `"wolfson"`, `"kelvin building"`.
  **Careful:** `"kelvin"` alone must not match "kelvingrove".

### Step 3: `clean.py` (question: *is every record linked to the right person, place and time?*)
- **IDs:** uppercase all IDs. If a change happened → `DataQualityIssue(issue="id_format")`.
- **Identity resolution:** if a log or statement ID is not in people data, look for an exact (case-insensitive) name match
  → use the people ID as `student_id` and keep the original in `raw_student_id` and in the student's `raw_ids`.
  Record `issue="id_mismatch"`. Expected: `2912324G → 2712324G` (logs), `2656431B → 2456431B` (statement).
  If there is no match at all, keep the record with `student_id = raw` and an issue `"unknown_id"`.
- **Locations:** exact match to a building name, else `difflib.get_close_matches(cutoff=0.6)` against names, else alias
  lookup. Record each fix (`"Queen Maragret Building" → "Queen Margaret Union"`).
- **Times:** `"HHMM-HHMM"` → start, end minutes, with the midnight wrap. Keep `raw_time`.
- **Visit IDs:** `v0001…` in file order.
- **Societies:** `ast.literal_eval` safely. List or set → sorted unique list. NaN → `[]`. Record set-syntax rows,
  duplicates and empties as issues (one issue per row, not per society).
- **Student.has_statement** = a statement resolves to this student.

### Step 4: Lecture assignment and inference (question: *which lecture should each student attend, and when does it really happen?*)
- `subject → (building, Lecture)` from step 2. If a subject has no lecture anywhere (Pharmacy) → `lecture=None`.
- **Inferred slot:** for each subject, among visits to its lecture building that overlap the documented slot, take the
  **most common (start, end)** pair. If it differs from the description (Physics: 09:00–10:00 vs 09:00–11:00),
  use the inferred one for `Student.lecture` with `source="inferred"`, and add a `DataQualityIssue`
  (`file="location_data.csv", column="Description", issue="lecture_time_differs_from_logs"`).

### Step 5: `quality.py` + `run.py`
- Collect every issue with `file`, `row` (1-based data row), `column`, `issue`, `original`, `fixed`.
- `run_pipeline()` returns `CleanData`. Add `python -m app.pipeline.run` to print counts and the issue summary.

## Acceptance tests (`tests/test_pipeline.py`, pytest)
- 14 buildings, 163 students, 662 visits, 25 statements.
- Boyd Orr `open_end == 1260`. Library `open_end == 1560`. Kelvingrove `always_open`. The Hive `min_age == 18`.
- Main Building has 3 lectures (Philosophy 540–660, Veterinary Medicine 600–720, Mathematics 660–780).
- Physics student lecture = 540–600 (`source="inferred"`). Pharmacy student `lecture is None`.
- Visit `"2208-0048"` → start 1328, end 1488.
- No visit has an unknown `building_id`. The typo row maps to `queen-margaret-union`.
- Jonny Craig's 4 visits have `student_id == "2712324G"` and `raw_student_id == "2912324G"`.
- Oscar Brown's statement `student_id == "2456431B"`. Stuart Wands's visits use `"2813225B"`.
- `data_quality` contains at least: 2 id_mismatch, ≥1 id_format, 1 location typo, 3 set-syntax societies, 1 lecture-time difference.

## Hand-offs
- **H1:** push stubs with the final function signatures so P2 can import them.
- **H6:** `run_pipeline()` works on real data with tests green. Tell P2 and P3.
- Afterwards: help P2 with `oddities.py` ideas from your issue list, and test with a deliberately broken copy of the data
  (extra columns, other time formats) to prove reusability. Give P3 a 3-sentence "how we cleaned it" summary for the pitch.
