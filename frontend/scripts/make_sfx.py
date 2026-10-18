"""Synthesise the flow's sound effects (original, CC0) into public/sfx/*.mp3.

    python3 scripts/make_sfx.py        # needs numpy + ffmpeg

Every sound is generated from noise / sine waves here, so there is no third-party licence to track.
To use recorded sounds instead (e.g. Kenney.nl CC0 packs), drop files with the same names into public/sfx/
and update public/sfx/CREDITS.md.
"""
import subprocess
import tempfile
import wave
from pathlib import Path

import numpy as np

SR = 44100
OUT = Path(__file__).resolve().parents[1] / "public" / "sfx"
rng = np.random.default_rng(1105)


def t(sec: float) -> np.ndarray:
    return np.arange(int(SR * sec)) / SR


def noise(sec: float) -> np.ndarray:
    return rng.uniform(-1, 1, int(SR * sec))


def lowpass(x: np.ndarray, cutoff) -> np.ndarray:
    """One-pole low-pass; `cutoff` may be a number or a per-sample array (Hz)."""
    cut = np.broadcast_to(np.asarray(cutoff, dtype=float), x.shape)
    a = np.exp(-2 * np.pi * cut / SR)
    y = np.zeros_like(x)
    prev = 0.0
    for i, v in enumerate(x):
        prev = (1 - a[i]) * v + a[i] * prev
        y[i] = prev
    return y


def highpass(x: np.ndarray, cutoff: float) -> np.ndarray:
    return x - lowpass(x, cutoff)


def env(n: int, attack: float, release: float) -> np.ndarray:
    """Attack/decay envelope over n samples (seconds)."""
    e = np.ones(n)
    a = max(1, int(SR * attack))
    r = max(1, int(SR * release))
    e[:a] = np.linspace(0, 1, a)
    e[-r:] *= np.linspace(1, 0, r)
    return e


def decay(n: int, rate: float) -> np.ndarray:
    return np.exp(-rate * np.arange(n) / SR)


def place(total: float, clips: list[tuple[float, np.ndarray]]) -> np.ndarray:
    out = np.zeros(int(SR * total))
    for start, clip in clips:
        i = int(SR * start)
        j = min(len(out), i + len(clip))
        out[i:j] += clip[: j - i]
    return out


def norm(x: np.ndarray, peak: float = 0.8) -> np.ndarray:
    m = np.max(np.abs(x)) or 1
    return x / m * peak


def flick(sec: float = 0.06) -> np.ndarray:
    n = noise(sec)
    return highpass(lowpass(n, 6000), 1200) * decay(len(n), 70)


def thump(freq: float, sec: float, rate: float) -> np.ndarray:
    tt = t(sec)
    sweep = freq * (1 + 0.6 * np.exp(-tt * 30))
    return np.sin(2 * np.pi * np.cumsum(sweep) / SR) * decay(len(tt), rate)


def click(sec: float = 0.018, tone: float = 2200) -> np.ndarray:
    tt = t(sec)
    return (0.6 * noise(sec) + np.sin(2 * np.pi * tone * tt)) * decay(len(tt), 260)


SOUNDS = {
    # paper swish: band-limited noise that swells and fades
    "swish": lambda: norm(highpass(lowpass(noise(0.5), np.linspace(1500, 5000, int(SR * 0.5))), 400) * env(int(SR * 0.5), 0.18, 0.3), 0.6),
    # low buzz for a wrong passcode
    "buzz": lambda: norm(np.sign(np.sin(2 * np.pi * 110 * t(0.32))) * lowpass(np.ones(int(SR * 0.32)), 900) * env(int(SR * 0.32), 0.01, 0.08), 0.45),
    # wax crack: sharp noise burst + a couple of tiny clicks
    "crack": lambda: norm(place(0.3, [(0, highpass(noise(0.12), 800) * decay(int(SR * 0.12), 45)), (0.05, click(0.02, 1500)), (0.09, click(0.02, 1100))]), 0.75),
    # paper sliding out: soft, low-passed noise
    "slide": lambda: norm(lowpass(noise(0.7), 2500) * env(int(SR * 0.7), 0.15, 0.35), 0.5),
    # typewriter key
    "key": lambda: norm(click(0.03, 2600), 0.35),
    # one card-shuffle for the whole flip wave
    "shuffle": lambda: norm(place(1.0, [(i * 0.07 + rng.uniform(0, 0.02), flick(0.05) * rng.uniform(0.6, 1)) for i in range(13)]), 0.55),
    # single card flick
    "flick": lambda: norm(flick(0.07), 0.5),
    # dialogue blip (pitch is changed per speaker at play time)
    "blip": lambda: norm(np.sin(2 * np.pi * 660 * t(0.09)) * env(int(SR * 0.09), 0.005, 0.06), 0.35),
    # filter whoosh: noise with a sweeping low-pass
    "whoosh": lambda: norm(lowpass(noise(0.6), np.concatenate([np.linspace(300, 4000, int(SR * 0.3)), np.linspace(4000, 300, int(SR * 0.3))])) * env(int(SR * 0.6), 0.2, 0.3), 0.55),
    # counter ticking
    "ticking": lambda: norm(place(1.3, [(i * 0.1, click(0.015, 3000) * (1 - i * 0.04)) for i in range(13)]), 0.35),
    # rubber stamp thud
    "stamp": lambda: norm(thump(70, 0.3, 14) + 0.4 * lowpass(noise(0.3), 700) * decay(int(SR * 0.3), 30), 0.85),
    # very soft node tick
    "nodetick": lambda: norm(np.sin(2 * np.pi * 2400 * t(0.03)) * decay(int(SR * 0.03), 140), 0.2),
    # heartbeat: lub-dub
    "heartbeat": lambda: norm(place(0.7, [(0, thump(55, 0.25, 16)), (0.22, 0.7 * thump(50, 0.25, 18))]), 0.8),
    # case-closed sting: minor chord swell
    "sting": lambda: norm(sum(np.sin(2 * np.pi * f * t(1.4)) * w for f, w in [(110, 1), (130.8, 0.7), (164.8, 0.6), (220, 0.4)]) * env(int(SR * 1.4), 0.04, 0.9) + 0.6 * thump(60, 1.4, 5), 0.7),
    # page turn: short brighter paper noise
    "pageturn": lambda: norm(highpass(lowpass(noise(0.35), 7000), 900) * env(int(SR * 0.35), 0.06, 0.25), 0.45),
}


def write_mp3(name: str, samples: np.ndarray) -> None:
    pcm = (np.clip(samples, -1, 1) * 32767).astype(np.int16)
    with tempfile.TemporaryDirectory() as tmp:
        wav_path = Path(tmp) / f"{name}.wav"
        with wave.open(str(wav_path), "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(SR)
            w.writeframes(pcm.tobytes())
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav_path), "-codec:a", "libmp3lame", "-b:a", "96k", str(OUT / f"{name}.mp3")],
            check=True,
        )


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for name, make in SOUNDS.items():
        write_mp3(name, make())
        print("wrote", name)
