"""End-to-end smoke test for the Investigation File flow (Python Playwright).

Run with the dev server up (and optionally the API on :8000):

    cd frontend && npm run dev
    python3 e2e/smoke.py                      # expects the app at http://127.0.0.1:5173/

Environment variables:
    FLOW_URL        app URL (default http://127.0.0.1:5173/)
    BROWSER_PATH    Chromium-based browser binary (default: Playwright's bundled Chromium)
    EXPECT_API=1    require the case to come from /api/case (backend running), not the /case.json fallback
    SCREENSHOT_DIR  save a screenshot of every page here
    VIEWPORT        WIDTHxHEIGHT (default 1280x800)

Expected answers are read from the case data itself, never hard-coded.
Sounds are checked through `window.__sfx` (every sound the manager actually played) — the test can't hear them.
"""
import os
import sys
import time

from playwright.sync_api import sync_playwright

URL = os.environ.get("FLOW_URL", "http://127.0.0.1:5173/")
BROWSER = os.environ.get("BROWSER_PATH")
EXPECT_API = os.environ.get("EXPECT_API") == "1"
SHOTS = os.environ.get("SCREENSHOT_DIR")
W, H = (int(x) for x in os.environ.get("VIEWPORT", "1280x800").split("x"))
ID, PASSCODE = "investigator", "bonfire1105"
TITLE_S = 2.3
NEUTRAL = {"#9a948a", "rgb(154, 148, 138)"}
OXBLOOD = {"#5c0000", "rgb(92, 0, 0)"}

results: list[tuple[str, bool]] = []


def check(label: str, ok: bool, extra: object = "") -> None:
    results.append((label, ok))
    print(("PASS " if ok else "FAIL ") + label, "" if ok else extra)


def shot(page, name: str) -> None:
    if SHOTS:
        os.makedirs(SHOTS, exist_ok=True)
        page.screenshot(path=os.path.join(SHOTS, f"{W}-{name}.png"))


def minutes(label: str) -> int:
    hh, mm = label.split()[0].split(":")
    return int(hh) * 60 + int(mm)


def sfx(page) -> list[str]:
    return page.evaluate("window.__sfx ? [...window.__sfx] : []")


def basis_has(section, before: int, after: int) -> bool:
    return section.locator("aside[aria-label='Filter basis'] li").filter(has_text=f"{before} → {after}").count() > 0


with sync_playwright() as p:
    launch = {"executable_path": BROWSER, "args": ["--headless=new", "--autoplay-policy=user-gesture-required"]} if BROWSER else {}
    browser = p.chromium.launch(**launch)
    ctx = browser.new_context(viewport={"width": W, "height": H})
    page = ctx.new_page()
    errors: list[str] = []
    sources: list[str] = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: m.type == "error" and errors.append(m.text))
    page.on("console", lambda m: "Investigation case loaded from" in m.text and sources.append(m.text.split()[-1]))

    case = page.request.get(URL + ("api/case" if EXPECT_API else "case.json")).json()
    name = {s["id"]: s["name"] for s in case["students"]}
    six = {name[s["student_id"]] for s in case["suspects"] if s["verdict"] == "conspirator"}
    boss_id = next(s["student_id"] for s in case["suspects"] if s["verdict"] == "mastermind")
    boss = name[boss_id]
    total = len(case["students"])
    has_watch = any(s["verdict"] == "suspicious" for s in case["suspects"])

    # ---------- Page 0: envelope ----------
    page.goto(URL)
    page.wait_for_selector("text=Open the file")
    time.sleep(1.2)
    page.fill("input >> nth=0", ID)
    page.fill("input >> nth=1", "wrong")
    check("no sound before the first click", sfx(page) == [], sfx(page))
    shot(page, "0-envelope")
    page.click("text=Open the file")
    check("wrong credentials -> Access denied + buzz", page.locator("text=Access denied").is_visible() and "buzz" in sfx(page), sfx(page))
    page.fill("input >> nth=1", PASSCODE)
    page.click("text=Open the file")

    # ---------- Briefing scene: cast, one linear conversation, hand-over ----------
    page.wait_for_selector("[aria-label='Case briefing']", timeout=10000)
    check("file opens: stamp, string slide, page turn", "stamp" in sfx(page) and "slide" in sfx(page) and "pageturn" in sfx(page), sfx(page))
    time.sleep(1.2)
    brief = page.locator("[aria-label='Case briefing']")
    check("briefing: both characters on stage + location", brief.locator(".cast-sprite").count() == 2 and "case file #1105" in brief.locator(".briefing-location").inner_text().lower())
    def advance_until(cond, limit=40):
        for _ in range(limit):
            if cond():
                return True
            page.keyboard.press("Enter")
            time.sleep(0.35)
        return cond()
    seen_text = []
    def gone():
        if page.locator("[aria-label='Case briefing']").count() == 0:
            return True
        seen_text.append(brief.locator(".briefing-box__text").inner_text())
        return False
    lines_total = int(brief.locator(".briefing-box__count").inner_text().split("/")[1])
    choices_seen = []
    def gone_and_watch():
        if page.locator("[aria-label='Case briefing']").count():
            choices_seen.append(brief.locator(".briefing-choice").count())
        return gone()
    advance_until(gone_and_watch, limit=lines_total * 3 + 6)
    no_choices = sum(choices_seen) == 0
    check("briefing: one linear conversation, no choices", no_choices and lines_total >= 6, lines_total)
    check("briefing: lines are filled from the case data", any(f"{len(case['visits'])} door swipes" in x for x in seen_text), seen_text[-3:])
    page.wait_for_selector("section[data-step='1'] h2:text-is('The Register')", timeout=10000)
    check("briefing hands over to the register", page.locator("[aria-label='Case briefing']").count() == 0)
    check("case source", sources[:1] == ["/api/case"] if EXPECT_API else bool(sources), sources)

    # ---------- Page 1: register + auto-flip wave ----------
    time.sleep(TITLE_S)
    check("title card typewriter clicks", "key" in sfx(page))
    cards = page.locator("section[data-step='1'] button[aria-pressed]").filter(has=page.locator(".flip-inner"))
    check("register shows every student", cards.count() == total, cards.count())
    time.sleep(total * 0.015 + 0.35 + 1.6)  # appear stagger + wave
    flipped = page.locator("section[data-step='1'] .flip[aria-pressed='true']").count()
    check("auto-flip wave flipped every tile", flipped == total, flipped)
    check("one shuffle sound for the whole wave", sfx(page).count("shuffle") == 1, sfx(page).count("shuffle"))
    shot(page, "1-register-flipped")
    first = page.locator("section[data-step='1'] .flip").first
    first.click()
    time.sleep(0.4)
    check("click flips a tile back + flick", first.get_attribute("aria-pressed") == "false" and "flick" in sfx(page))

    # ---------- Page 2: Level 1 driven by dialogue ----------
    page.keyboard.press("ArrowRight")  # page 1 has no dialogue → next page
    time.sleep(TITLE_S + 0.3)
    sec2 = page.locator("section[data-step='2']")
    check("page turn sound", "pageturn" in sfx(page))
    sec2.get_by_role("button", name="Auto").click()  # pause auto-play
    page.mouse.click(5, H // 2)  # move focus off the button: Space on a focused button presses that button
    h2 = sec2.locator("h2")
    t_before = h2.inner_text()
    time.sleep(4.2)
    check("level 1 waits for the dialogue (auto off)", h2.inner_text() == t_before, (t_before, h2.inner_text()))
    progress = sec2.locator(".comic-progress")
    for _ in range(8):  # first Space finishes the typing, the next advances
        if progress.inner_text().startswith("3 /"):
            break
        page.keyboard.press("Space"); time.sleep(0.5)
    time.sleep(0.6)
    check("Space advances the dialogue → red stage", "rule" in h2.inner_text().lower() and "whoosh" in sfx(page), h2.inner_text())
    check("speaker change is voiced (swish) and the speaker is lit", "swish" in sfx(page) and sec2.locator(".cast-sprite.is-speaking").count() == 1)
    check("basis: rule-breakers before → after", basis_has(sec2, total, sum(1 for s in case["suspects"] if s["score"] > 0)))
    shot(page, "2a-breakers")
    sec2.get_by_role("button", name="Skip ⏭").click()
    time.sleep(2.5)
    counter = sec2.locator("p.font-type.text-5xl").inner_text()
    check("level 1 ends at 25 with basis 163 → 25", counter == "25" and basis_has(sec2, total, 25), counter)
    check("counter ticking", "ticking" in sfx(page))
    check("mastermind is in the shortlist", sec2.locator(f"text={boss}").count() >= 1)
    shot(page, "2b-shortlist")

    # ---------- Page 3: Level 2 ----------
    sec2.get_by_role("button", name="Next →").click()
    time.sleep(TITLE_S + 0.5)
    sec3 = page.locator("section[data-step='3']")
    sec3.get_by_role("button", name="Skip ⏭").click()
    time.sleep(2.5)
    stamps = sec3.locator("span:text-is('CONSPIRATOR')").count()
    shown = {n for n in six if sec3.locator(f"text={n}").count()}
    check("level 2 shows exactly the conspirators", stamps == len(six) and shown == six, (stamps, len(shown)))
    check("level 2 basis 25 → 6", basis_has(sec3, 25, len(six)))
    check("watch list only if a suspicious student exists", (sec3.locator("span:text-is('WATCH')").count() == 1) == has_watch)
    check("stamp thuds", sfx(page).count("stamp") >= 1, sfx(page).count("stamp"))
    shot(page, "3-six")

    # ---------- Page 4: movement graph + analysis ----------
    sec3.get_by_role("button", name="Next →").click()
    time.sleep(TITLE_S + 0.6)
    sec4 = page.locator("section[data-step='4']")
    fills = set(page.eval_on_selector_all("circle.node", "els => els.map(e => e.getAttribute('fill'))"))
    strokes = set(page.eval_on_selector_all("path.student-line", "els => els.map(e => e.getAttribute('stroke'))"))
    check("all nodes + lines start neutral", fills <= NEUTRAL and strokes <= NEUTRAL, (fills, strokes))
    check("25 lines with a node per visit", sec4.locator("path.student-line").count() == 25 and sec4.locator("circle.node").count() > 25)
    clock = sec4.locator("span.w-24")
    t0 = clock.inner_text()
    time.sleep(3)
    t1 = clock.inner_text()
    check("playback ≈ 1 s per hour", 150 <= minutes(t1) - minutes(t0) <= 210, (t0, t1))
    sec4.get_by_role("button", name="Next line ▸").click()  # → analyse
    time.sleep(0.8)
    check("analysing label shows", "Analysing pattern" in sec4.locator("[data-testid='analysis-progress']").inner_text())
    shot(page, "4a-analysing")
    time.sleep(6.5)
    boss_line = sec4.locator(f"path.student-line[data-id='{boss_id}']")
    darkest = boss_line.get_attribute("stroke") in OXBLOOD and boss_line.get_attribute("stroke-width") == "3"
    others_dark = [e for e in page.eval_on_selector_all("path.student-line", "els => els.map(e => [e.dataset.id, e.getAttribute('stroke')])") if e[1] in OXBLOOD and e[0] != boss_id]
    check("only the mastermind is darkest red (3 px)", darkest and not others_dark, (boss_line.get_attribute("stroke"), others_dark))
    rings = page.eval_on_selector_all("g.meeting-ring", "els => els.filter(e => e.getAttribute('opacity') === '1').length")
    counter = sec4.locator("[data-testid='meeting-counter']").inner_text()
    check("6 gold meeting pulses, counter 6", rings == len(six) and counter.strip().endswith(f"{len(six)} / {len(six)}"), (rings, counter))
    centres = page.eval_on_selector_all("g.meeting-ring", "els => els.map(e => { const r = e.querySelector('circle').getBoundingClientRect(); return [Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2)] })")
    apart = all(((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2) ** 0.5 >= 14 for i, a in enumerate(centres) for b in centres[i + 1:])
    check("every meeting ring is visible on its own (none stacked)", len(centres) == len(six) and apart, centres)
    check("reveal line states real places and times", "same place" not in sec4.locator(".comic-dialogue__text").inner_text().lower())
    check("node ticks + one heartbeat per meeting", "nodetick" in sfx(page) and sfx(page).count("heartbeat") == len(six), sfx(page).count("heartbeat"))
    page.hover(f"circle.node[data-id='{boss_id}'] >> nth=0")
    time.sleep(0.3)
    check("node hover tooltip: name · building · time", boss in sec4.locator("div.pointer-events-none.absolute.z-10").inner_text())
    shot(page, "4b-analysed")

    # ---------- rewinding: findings follow the clock, the officers react ----------
    slider = sec4.locator("input[type=range]")
    first_meeting = min(m["start"] for m in case["meetings"] if boss_id in (m["a"], m["b"]) and (name.get(m["b"] if m["a"] == boss_id else m["a"]) in six))
    slider.fill(str(first_meeting + 10))
    page.wait_for_function("() => [...document.querySelectorAll('[aria-live=polite]')].some(e => e.textContent.toLowerCase().includes('rewind'))")
    rings_now = page.eval_on_selector_all("g.meeting-ring", "els => els.filter(e => e.getAttribute('opacity') === '1').length")
    counter_now = sec4.locator("[data-testid='meeting-counter']").inner_text()
    check("rewind hides meetings that haven't happened yet", 0 < rings_now < len(six) and not counter_now.strip().endswith(f"{len(six)} / {len(six)}"), (rings_now, counter_now))
    check("rewind: mastermind no longer darkest", boss_line.get_attribute("stroke") not in OXBLOOD, boss_line.get_attribute("stroke"))
    check("rewind: 'Pattern found' caption gone", sec4.locator("text=One clean student was with all six.").count() == 0)
    check("officers react to the rewind", "rewind" in sec4.locator("[aria-live='polite']").inner_text().lower())
    t_a = minutes(clock.inner_text())
    sec4.get_by_role("button", name="Rewind", exact=True).click(); time.sleep(1.2)
    t_b = minutes(clock.inner_text())
    check("◀ plays the day in reverse", t_b < t_a, (t_a, t_b))
    slider.fill(str(case["meta"]["time_max"]))
    page.wait_for_function("() => [...document.querySelectorAll('[aria-live=polite]')].some(e => e.textContent.toLowerCase().includes('again'))")
    counter_end = sec4.locator("[data-testid='meeting-counter']").inner_text()
    check("back at the end: all meetings + caption again", counter_end.strip().endswith(f"{len(six)} / {len(six)}") and sec4.locator("text=One clean student was with all six.").count() == 1, counter_end)
    check("investigator confirms after the replay", "again" in sec4.locator("[aria-live='polite']").inner_text().lower())
    shot(page, "4c-replayed")

    # ---------- Page 5: case closed ----------
    page.mouse.move(5, H // 2)
    sec4.get_by_role("button", name="Next →").click()
    time.sleep(TITLE_S + 5.5)  # cards drop → strings → flip reveal
    sec5 = page.locator("section[data-step='5']")
    labels = sec5.locator("span.font-mono.text-alarm").count()
    check("final: mastermind + labelled links", sec5.locator("span:text-is('MASTERMIND')").count() == 1 and sec5.locator(f"text={boss}").count() >= 1 and labels == len(six), labels)
    check("case-closed sting", "sting" in sfx(page))
    shot(page, "5-final")

    # ---------- mute persists ----------
    page.click("button[aria-label='Mute sound']")
    n = len(sfx(page))
    sec5.locator("text=Replay investigation").click()
    time.sleep(TITLE_S + 0.5)
    check("muted: nothing plays", len(sfx(page)) == n, sfx(page)[n:])
    page.reload()
    page.wait_for_selector("text=Open the file")
    check("mute remembered after reload", page.locator("button[aria-label='Unmute sound']").count() == 1)
    page.click("button[aria-label='Unmute sound']")

    real_errors = errors if EXPECT_API else [e for e in errors if "502" not in e and "500" not in e]
    check("no console errors", not real_errors, real_errors[:3])

    # ---------- ?judge=1 + reduced motion ----------
    rm = browser.new_context(viewport={"width": W, "height": H}, reduced_motion="reduce")
    jp = rm.new_page()
    jp.add_init_script("localStorage.setItem('investigation-flow-muted', '1')")
    jp.goto(URL + "?judge=1")
    jp.wait_for_selector("text=The Register", timeout=8000)
    check("?judge=1 skips login and starts unmuted", jp.locator("text=Open the file").count() == 0 and jp.locator("button[aria-label='Mute sound']").count() == 1)
    time.sleep(1.0)
    check("reduced motion: tiles cross-fade to the back side", jp.locator(".flip[aria-pressed='true']").count() == total)
    jp.keyboard.press("ArrowRight")
    time.sleep(0.6)
    jp.locator("section[data-step='2'] button:has-text('Skip')").click()
    time.sleep(0.8)
    check("reduced motion: level 1 still reaches 25", jp.locator("section[data-step='2'] p.font-type.text-5xl").inner_text() == "25")
    browser.close()

passed = sum(ok for _, ok in results)
print(f"\n{passed}/{len(results)} passed at {W}x{H}")
sys.exit(0 if passed == len(results) else 1)
