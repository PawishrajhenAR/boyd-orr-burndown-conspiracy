# Step 8 — Real Gilmorehill satellite map (3D + fallback)

**Who:** Pawish  
**Branch:** `P5-PAWISH`  
**Date:** 2026-10-17

## Goal
Replace the abstract D3-only campus dots with a **real University of Glasgow / Gilmorehill** map and make it feel 3D.

## Dependencies added
- `maplibre-gl@4.7.1` — pitched WebGL 3D map
- `leaflet` + `@types/leaflet` — fallback when WebGL is missing
- `@types/geojson`

## Files
| Path | Role |
|------|------|
| `frontend/src/pages/MapPage.tsx` | MapLibre satellite + extruded case buildings, path, occupants |
| `frontend/src/components/viz/CampusMapFallback.tsx` | Leaflet satellite + CSS isometric building blocks |

## Behaviour
1. **Preferred (Chrome/Firefox with WebGL):** MapLibre, Esri World Imagery + place labels, pitch ~58°, fill-extrusion buildings (height ∝ visits), gold path, occupant dots, reset camera.
2. **Fallback (no WebGL / headless):** Leaflet + same Esri satellite tiles + isometric CSS blocks on real lat/lon.

Basemap: Esri World Imagery (no API key). Case building coords still come from `case.json` — not hard-coded conspirator names.

## Verify
```bash
cd frontend && npm run dev
# open /map — badge shows SATELLITE 3D or SATELLITE ISO
```
