# The Boyd Orr Burndown Conspiracy

GUTS hackathon challenge dataset: campus security needs help spotting a plot to set off fireworks in the Boyd Orr Building on Bonfire Night.

## Brief

Security at the University of Glasgow received an anonymous tip about a plan to set off 1000 fireworks in the Boyd Orr Building. Officers collected security logs from the day before and interviewed a sample of students.

Rumour has it there are **six conspirators** with data irregularities, plus a **seventh mastermind** who met every conspirator that day but whose own data looks clean.

**Scoring focus:** creative visualisation of the CSVs beats fully solving the case without visuals. A generalisable, clear visualisation that surfaces suspicious students scores higher than a pure text solution.

## Datasets

| File | Description |
|------|-------------|
| `people_data.csv` | Student profiles (ID, name, age, subject, societies, etc.) |
| `location_data.csv` | Campus buildings, geolocation, opening times, lecture schedules |
| `security_logs.csv` | Student location / time logs from the day prior |
| `student_statements.txt` | Interview testimonies (also available as `[PDF] Student Statements.pdf`) |
| `readme.pdf` | Official challenge brief |

## Game logic

- Students attend their mandatory lectures once during the day
- Students do not have out-of-hours access to buildings
- The ringleader’s day looks consistent — airtight alibi — except that they met fellow conspirators

## Suggested visualisation angles

- **Location data** — buildings, geolocation, opening hours
- **Timeline data** — security log sequences and overlaps
- **People data** — subjects, societies, demographics
- Or a mix of the above

Use inconsistencies between logs, statements, and building rules to pitch who stands out (and who might be the kingpin).

## Subjects in the dataset

Philosophy, Veterinary Medicine, Biomechanical Engineering, Medicine, Computer Science, English Lit, Mathematics, Physics, Chemistry, Education

## Societies in the dataset

Bad Movie Society, Glasgow Students' Nightline, Accapella Society, Astrology Society, Astronomy Society, Big Band Society, Back to Yoga Society, Brunei Society, Clash Of Clans Society, Esports Society, Cymdeithas Cymry Glasgow, Dr Who Society, FemEng Society, Extinction Rebellion, Grim Reaper Quidditch Club, Italian Society, Juggling Society, Glasgow Latin America Society, Volleyball Society, LGBTQ+ Students Association, Marxist Society, Minecraft Society, Motorcycling Society, pHd Society, Philosophy Society, Pole Dancing Club, Sexpression, Shrek Society, Soup Society, Rising Stars, Glasgow Uni Tech Society, Skate Society

## Getting started

```bash
git clone https://github.com/PawishrajhenAR/boyd-orr-burndown-conspiracy.git
cd boyd-orr-burndown-conspiracy
```

Load the CSVs with your preferred stack (Python/pandas, R, Observable, etc.) and start visualising.

Good luck — protect the Boyd Orr!
