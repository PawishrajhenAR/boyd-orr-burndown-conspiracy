"""Small time helpers shared by every analysis module.

Time convention (from the contract): integer minutes since 00:00 of the
investigation day. Values >= 1440 are after midnight (00:48 next day = 1488).
"""


def hhmm(minutes: int) -> str:
    """Turn minutes into a clock label, e.g. 1328 -> '22:08', 1488 -> '00:48 (+1)'."""
    day, rest = divmod(minutes, 1440)
    hours, mins = divmod(rest, 60)
    label = f"{hours:02d}:{mins:02d}"
    return f"{label} (+{day})" if day else label


def overlap(a_start: int, a_end: int, b_start: int, b_end: int) -> int:
    """How many minutes two time windows share. 0 means they don't overlap."""
    return max(0, min(a_end, b_end) - max(a_start, b_start))