import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import type {
  GeoJSONSource,
  Map as MapLibreMap,
  MapLayerMouseEvent,
  SkySpecification,
} from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Feature, FeatureCollection, Polygon } from 'geojson'
import TimeSlider from '../components/viz/TimeSlider'
import StoryChapter from '../components/viz/StoryChapter'
import VizPageShell from '../components/viz/VizPageShell'
import CampusMapFallback from '../components/viz/CampusMapFallback'
import { hhmm, verdictColor } from '../components/viz/util'
import '../components/viz/viz-story.css'
import {
  buildingById,
  studentById,
  suspectFor,
  useCaseStore,
  visitsFor,
} from '../store/useCaseStore'
import type { Building, Flag, Student } from '../types/case'

/** Metres → lon/lat offsets at Glasgow latitude. */
function offsetLonLat(
  lat: number,
  lon: number,
  eastM: number,
  northM: number,
): [number, number] {
  const dLat = northM / 111_320
  const dLon = eastM / (111_320 * Math.cos((lat * Math.PI) / 180))
  return [lon + dLon, lat + dLat]
}

/** Rectangular footprint (metres), axis-aligned in local ENU. */
function buildingPolygon(
  lat: number,
  lon: number,
  halfW: number,
  halfH: number,
): Polygon {
  const corners: [number, number][] = [
    offsetLonLat(lat, lon, -halfW, -halfH),
    offsetLonLat(lat, lon, halfW, -halfH),
    offsetLonLat(lat, lon, halfW, halfH),
    offsetLonLat(lat, lon, -halfW, halfH),
    offsetLonLat(lat, lon, -halfW, -halfH),
  ]
  return { type: 'Polygon', coordinates: [corners] }
}

function studentDotColor(studentId: string, judgeMode: boolean): string {
  const c = useCaseStore.getState().case
  const sus = suspectFor(c, studentId)
  if (!sus) return '#a1a1aa'
  if (sus.verdict === 'mastermind') {
    return judgeMode ? verdictColor('mastermind') : '#a1a1aa'
  }
  if (sus.verdict === 'conspirator') return verdictColor('conspirator')
  return verdictColor(sus.verdict)
}

function flagsAtBuilding(
  flags: Flag[],
  buildingId: string,
  t: number,
  revealed: Set<string>,
  judgeMode: boolean,
): Flag[] {
  return flags.filter((f) => {
    if (f.building_id !== buildingId) return false
    if (!judgeMode && !revealed.has(f.id)) return false
    if (f.time == null) return false
    return Math.abs(f.time - t) <= 30
  })
}

function buildingFeatures(
  buildings: Building[],
  visitCounts: Map<string, number>,
  selectedId: string | null,
  flaggedIds: Set<string>,
): FeatureCollection {
  const maxV = Math.max(1, ...visitCounts.values())
  return {
    type: 'FeatureCollection',
    features: buildings.map((b) => {
      const visits = visitCounts.get(b.id) ?? 0
      const size = 18 + (visits / maxV) * 22
      const height = 14 + (visits / maxV) * 48 + (b.id === selectedId ? 12 : 0)
      let color = '#3d4f6f'
      if (flaggedIds.has(b.id)) color = '#c0392b'
      else if (b.id === selectedId) color = '#e3af35'
      else if (b.min_age && b.min_age >= 18) color = '#6b4c9a'
      return {
        type: 'Feature' as const,
        properties: {
          id: b.id,
          name: b.name,
          open: b.open_label,
          height,
          color,
          base: 0,
        },
        geometry: buildingPolygon(b.lat, b.lon, size, size * 0.75),
      }
    }),
  }
}

function occupantFeatures(
  occupantsByBuilding: Map<string, Student[]>,
  buildings: Building[],
  judgeMode: boolean,
  selectedStudentId: string | null,
): FeatureCollection {
  const byId = new Map(buildings.map((b) => [b.id, b]))
  const features: Feature[] = []
  for (const [bid, students] of occupantsByBuilding) {
    const b = byId.get(bid)
    if (!b) continue
    const n = students.length
    students.forEach((st, i) => {
      const angle = (i / Math.max(n, 1)) * Math.PI * 2 - Math.PI / 2
      const r = 12 + Math.min(n, 8) * 2
      const [lon, lat] = offsetLonLat(
        b.lat,
        b.lon,
        Math.cos(angle) * r,
        Math.sin(angle) * r,
      )
      features.push({
        type: 'Feature',
        properties: {
          id: st.id,
          name: st.name,
          color: studentDotColor(st.id, judgeMode),
          selected: st.id === selectedStudentId ? 1 : 0,
          buildingId: bid,
        },
        geometry: { type: 'Point', coordinates: [lon, lat] },
      })
    })
  }
  return { type: 'FeatureCollection', features }
}

function pathFeature(
  c: NonNullable<ReturnType<typeof useCaseStore.getState>['case']>,
  studentId: string | null,
): FeatureCollection {
  if (!studentId) return { type: 'FeatureCollection', features: [] }
  const visits = visitsFor(c, studentId)
    .slice()
    .sort((a, b) => a.start - b.start)
  const byId = new Map(c.buildings.map((b) => [b.id, b]))
  const coords: [number, number][] = []
  for (const v of visits) {
    const b = byId.get(v.building_id)
    if (b) coords.push([b.lon, b.lat])
  }
  if (coords.length < 2) return { type: 'FeatureCollection', features: [] }
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: coords },
      },
    ],
  }
}

const CAMPUS: [number, number] = [-4.2895, 55.8723]

/** Esri World Imagery + labels — free raster satellite, no API key. */
const SATELLITE_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  name: 'UofG Satellite',
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  sources: {
    esri_sat: {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      attribution:
        'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
      maxzoom: 19,
    },
    esri_ref: {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      attribution: '',
      maxzoom: 19,
    },
  },
  layers: [
    { id: 'satellite', type: 'raster', source: 'esri_sat' },
    { id: 'places', type: 'raster', source: 'esri_ref', paint: { 'raster-opacity': 0.9 } },
  ],
}

export default function MapPage() {
  const c = useCaseStore((s) => s.case)
  const replayTime = useCaseStore((s) => s.replayTime)
  const selectedBuildingId = useCaseStore((s) => s.selectedBuildingId)
  const selectedStudentId = useCaseStore((s) => s.selectedStudentId)
  const selectBuildingRaw = useCaseStore((s) => s.selectBuilding)
  const selectBuilding = useCallback(
    (id: string | null) => {
      selectBuildingRaw(id)
    },
    [selectBuildingRaw],
  )
  const selectStudent = useCaseStore((s) => s.selectStudent)
  const judgeMode = useCaseStore((s) => s.judgeMode)
  const revealedFlagIds = useCaseStore((s) => s.revealedFlagIds)

  const wrapRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const [mapError, setMapError] = useState<string | null>(null)

  const visitCounts = useMemo(() => {
    const m = new Map<string, number>()
    if (!c) return m
    for (const v of c.visits) m.set(v.building_id, (m.get(v.building_id) ?? 0) + 1)
    return m
  }, [c])

  const occupantsByBuilding = useMemo(() => {
    const m = new Map<string, Student[]>()
    if (!c) return m
    const byId = new Map(c.students.map((s) => [s.id, s]))
    for (const v of c.visits) {
      if (v.start <= replayTime && replayTime < v.end) {
        const st = byId.get(v.student_id)
        if (!st) continue
        const list = m.get(v.building_id) ?? []
        if (!list.some((x) => x.id === st.id)) list.push(st)
        m.set(v.building_id, list)
      }
    }
    return m
  }, [c, replayTime])

  const flaggedBuildingIds = useMemo(() => {
    const ids = new Set<string>()
    if (!c) return ids
    for (const b of c.buildings) {
      if (flagsAtBuilding(c.flags, b.id, replayTime, revealedFlagIds, judgeMode).length) {
        ids.add(b.id)
      }
    }
    return ids
  }, [c, replayTime, revealedFlagIds, judgeMode])

  const selectedBuilding = buildingById(c, selectedBuildingId)
  const selectedStudent = studentById(c, selectedStudentId)
  const sideOccupants = selectedBuildingId
    ? (occupantsByBuilding.get(selectedBuildingId) ?? [])
    : []
  const sideFlags =
    c && selectedBuildingId
      ? flagsAtBuilding(c.flags, selectedBuildingId, replayTime, revealedFlagIds, judgeMode)
      : []

  const pathCoords = useMemo(() => {
    if (!c || !selectedStudentId) return [] as [number, number][]
    const visits = visitsFor(c, selectedStudentId)
      .slice()
      .sort((a, b) => a.start - b.start)
    const byId = new Map(c.buildings.map((b) => [b.id, b]))
    const coords: [number, number][] = []
    for (const v of visits) {
      const b = byId.get(v.building_id)
      if (b) coords.push([b.lon, b.lat])
    }
    return coords
  }, [c, selectedStudentId])

  // Create MapLibre 3D once the case is loaded (needs WebGL; Leaflet fallback if it fails)
  useEffect(() => {
    if (!c || mapError) return
    const el = wrapRef.current
    if (!el || mapRef.current) return

    let cancelled = false
    let ro: ResizeObserver | null = null
    let map: MapLibreMap | null = null

    const MapCtor = maplibregl.Map ?? (maplibregl as unknown as { default: typeof maplibregl }).default?.Map
    if (!MapCtor) {
      setMapError('MapLibre Map constructor missing from bundle')
      return
    }

    const start = () => {
      if (cancelled || mapRef.current) return
      const { width, height } = el.getBoundingClientRect()
      if (width < 40 || height < 40) {
        requestAnimationFrame(start)
        return
      }

      try {
        map = new MapCtor({
          container: el,
          style: SATELLITE_STYLE,
          center: CAMPUS,
          zoom: 15.8,
          pitch: 58,
          bearing: -28,
          attributionControl: { compact: true },
          maxPitch: 70,
          fadeDuration: 0,
        })
        setMapError(null)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('MapLibre failed to start', err)
        setMapError(msg)
        return
      }

      const Nav = maplibregl.NavigationControl ?? (maplibregl as unknown as { default: typeof maplibregl }).default?.NavigationControl
      if (Nav) map.addControl(new Nav({ visualizePitch: true }), 'top-left')
      mapRef.current = map

      map.on('error', (e) => {
        console.error('MapLibre error', e.error ?? e)
        const msg = e.error?.message ?? 'Map failed to load tiles'
        if (/webgl/i.test(msg)) setMapError(msg)
      })

      map.on('load', () => {
        if (!map || cancelled) return
        try {
          map.setSky({
            'sky-color': '#6ec6ff',
            'horizon-color': '#c9e7ff',
            'fog-color': '#8eb4c9',
            'sky-horizon-blend': 0.5,
            'horizon-fog-blend': 0.6,
            'fog-ground-blend': 0.35,
          } as SkySpecification)
        } catch {
          /* style without sky */
        }

        map.addSource('case-buildings', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        })
        map.addSource('case-occupants', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        })
        map.addSource('case-path', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        })

        map.addLayer({
          id: 'case-buildings-3d',
          type: 'fill-extrusion',
          source: 'case-buildings',
          paint: {
            'fill-extrusion-color': ['get', 'color'],
            'fill-extrusion-height': ['get', 'height'],
            'fill-extrusion-base': ['get', 'base'],
            'fill-extrusion-opacity': 0.92,
            'fill-extrusion-vertical-gradient': true,
          },
        })

        map.addLayer({
          id: 'case-building-labels',
          type: 'symbol',
          source: 'case-buildings',
          layout: {
            'text-field': ['get', 'name'],
            'text-size': 11,
            'text-offset': [0, 1.2],
            'text-anchor': 'top',
            'text-max-width': 10,
          },
          paint: {
            'text-color': '#f0e6d4',
            'text-halo-color': '#0b1020',
            'text-halo-width': 1.4,
          },
        })

        map.addLayer({
          id: 'case-path-glow',
          type: 'line',
          source: 'case-path',
          paint: {
            'line-color': '#e3af35',
            'line-width': 8,
            'line-opacity': 0.25,
            'line-blur': 4,
          },
        })
        map.addLayer({
          id: 'case-path-line',
          type: 'line',
          source: 'case-path',
          paint: {
            'line-color': '#e3af35',
            'line-width': 3,
            'line-opacity': 0.95,
          },
        })

        map.addLayer({
          id: 'case-occupants-halo',
          type: 'circle',
          source: 'case-occupants',
          paint: {
            'circle-radius': ['case', ['==', ['get', 'selected'], 1], 14, 10],
            'circle-color': ['get', 'color'],
            'circle-opacity': 0.25,
            'circle-blur': 0.6,
          },
        })
        map.addLayer({
          id: 'case-occupants',
          type: 'circle',
          source: 'case-occupants',
          paint: {
            'circle-radius': ['case', ['==', ['get', 'selected'], 1], 8, 5.5],
            'circle-color': ['get', 'color'],
            'circle-stroke-width': ['case', ['==', ['get', 'selected'], 1], 2.5, 1],
            'circle-stroke-color': '#fff8e7',
          },
        })

        map.on('click', 'case-buildings-3d', (e: MapLayerMouseEvent) => {
          const id = e.features?.[0]?.properties?.id as string | undefined
          if (!id) return
          const cur = useCaseStore.getState().selectedBuildingId
          selectBuilding(cur === id ? null : id)
        })
        map.on('click', 'case-occupants', (e: MapLayerMouseEvent) => {
          const id = e.features?.[0]?.properties?.id as string | undefined
          if (!id) return
          e.originalEvent.stopPropagation()
          const cur = useCaseStore.getState().selectedStudentId
          selectStudent(cur === id ? null : id)
        })
        map.on('mouseenter', 'case-buildings-3d', () => {
          map!.getCanvas().style.cursor = 'pointer'
        })
        map.on('mouseleave', 'case-buildings-3d', () => {
          map!.getCanvas().style.cursor = ''
        })
        map.on('mouseenter', 'case-occupants', () => {
          map!.getCanvas().style.cursor = 'pointer'
        })
        map.on('mouseleave', 'case-occupants', () => {
          map!.getCanvas().style.cursor = ''
        })

        map.resize()
        setMapReady(true)
      })

      ro = new ResizeObserver(() => map?.resize())
      ro.observe(el)
    }

    start()

    return () => {
      cancelled = true
      setMapReady(false)
      ro?.disconnect()
      map?.remove()
      mapRef.current = null
    }
  }, [c, mapError, selectBuilding, selectStudent])

  // Push case geometry / occupants / path into the live map
  useEffect(() => {
    const map = mapRef.current
    if (!map || !c || !mapReady) return

    const bSrc = map.getSource('case-buildings') as GeoJSONSource | undefined
    const oSrc = map.getSource('case-occupants') as GeoJSONSource | undefined
    const pSrc = map.getSource('case-path') as GeoJSONSource | undefined
    if (!bSrc || !oSrc || !pSrc) return

    bSrc.setData(
      buildingFeatures(c.buildings, visitCounts, selectedBuildingId, flaggedBuildingIds),
    )
    oSrc.setData(
      occupantFeatures(occupantsByBuilding, c.buildings, judgeMode, selectedStudentId),
    )
    pSrc.setData(pathFeature(c, selectedStudentId))
  }, [
    c,
    mapReady,
    visitCounts,
    selectedBuildingId,
    selectedStudentId,
    occupantsByBuilding,
    flaggedBuildingIds,
    judgeMode,
  ])

  // Fly to selected building
  useEffect(() => {
    const map = mapRef.current
    if (!map || !selectedBuilding) return
    map.easeTo({
      center: [selectedBuilding.lon, selectedBuilding.lat],
      zoom: Math.max(map.getZoom(), 16.2),
      duration: 700,
      pitch: 62,
    })
  }, [selectedBuilding])

  if (!c) {
    return (
      <div className="page">
        <h2 className="page-title">Map — where it happened</h2>
        <p className="caption">Loading case…</p>
      </div>
    )
  }

  return (
    <VizPageShell className="map-3d-page">
      <style>{`
        .map-3d-page .map-stage {
          flex: 1; min-height: 420px; height: 100%; position: relative;
          border-radius: 16px; overflow: hidden;
          border: 1px solid var(--panel-border);
          background: #09090b;
          box-shadow: inset 0 0 60px rgba(0,0,0,0.45), 0 18px 50px rgba(0,0,0,0.4);
        }
        .map-3d-page .map-host {
          position: absolute; inset: 0; z-index: 0;
        }
        .map-3d-page .map-host .maplibregl-canvas,
        .map-3d-page .map-host canvas {
          outline: none;
        }
        .map-3d-page .maplibregl-ctrl-attrib {
          background: rgba(16,16,19,0.85) !important;
          color: #a1a1aa !important;
          font-size: 10px;
        }
        .map-3d-page .maplibregl-ctrl-group {
          background: #17171b !important;
          border: 1px solid rgba(255,255,255,0.08) !important;
        }
        .map-3d-page .maplibregl-ctrl-group button {
          background-color: #17171b !important;
        }
        .map-3d-badge {
          position: absolute; top: 12px; right: 12px; z-index: 2;
          background: rgba(16,16,19,0.9); border: 1px solid rgba(227,175,53,0.35);
          color: #e3af35; font-family: var(--font-display); font-size: 12px;
          padding: 6px 10px; border-radius: 10px; pointer-events: none;
          letter-spacing: 0.04em;
        }
        .map-3d-legend {
          position: absolute; left: 12px; bottom: 28px; z-index: 2;
          background: rgba(16,16,19,0.92); border: 1px solid rgba(255,255,255,0.08);
          border-radius: 10px; padding: 8px 12px; font-size: 11px; color: #e4e4e7;
          display: flex; flex-direction: column; gap: 4px; pointer-events: none;
        }
        .map-3d-legend span { display: flex; align-items: center; gap: 8px; }
        .map-3d-legend i {
          width: 10px; height: 10px; border-radius: 3px; display: inline-block;
        }
      `}</style>

      <StoryChapter
        chapter="map"
        subtitle={`${c.meta.day_label} · Gilmorehill · University of Glasgow`}
      />

      <div className="row">
        <div className="map-stage story-stage">
          {!mapError ? <div className="map-host" ref={wrapRef} /> : null}
          {mapError && c ? (
            <CampusMapFallback
              buildings={c.buildings}
              visitCounts={visitCounts}
              occupantsByBuilding={occupantsByBuilding}
              flaggedBuildingIds={flaggedBuildingIds}
              selectedBuildingId={selectedBuildingId}
              selectedStudentId={selectedStudentId}
              studentColor={(id) => studentDotColor(id, judgeMode)}
              onSelectBuilding={selectBuilding}
              onSelectStudent={selectStudent}
              pathCoords={pathCoords}
              replayLabel={hhmm(replayTime)}
            />
          ) : null}
          <div className="map-3d-badge">
            UofG · SATELLITE {mapError ? 'ISO' : '3D'} · {hhmm(replayTime)}
          </div>
          <div className="map-3d-legend">
            <span>
              <i style={{ background: '#3d4f6f' }} /> case building
            </span>
            <span>
              <i style={{ background: '#c0392b' }} /> flagged now
            </span>
            <span>
              <i style={{ background: '#ef4444', borderRadius: '50%' }} /> conspirator
            </span>
            <span>
              <i style={{ background: '#e3af35', borderRadius: '50%' }} /> mastermind
            </span>
          </div>
        </div>

        <aside className="side-panel story-dossier">
          {selectedBuilding ? (
            <>
              <span className="story-dossier__stamp">LOCATION</span>
              <h3
                style={{
                  margin: '0 0 8px',
                  fontFamily: 'var(--font-display)',
                  color: 'var(--accent)',
                }}
              >
                {selectedBuilding.name}
              </h3>
              <p className="caption" style={{ marginBottom: 8 }}>
                {selectedBuilding.open_label}
                {selectedBuilding.min_age
                  ? ` · ${selectedBuilding.min_age}+ only`
                  : ''}
              </p>
              <p style={{ fontSize: 13, margin: '0 0 12px', lineHeight: 1.45 }}>
                {selectedBuilding.description}
              </p>
              <p className="caption" style={{ marginBottom: 12, fontFamily: 'var(--font-mono)' }}>
                {selectedBuilding.lat.toFixed(5)}°N · {Math.abs(selectedBuilding.lon).toFixed(5)}°W
              </p>

              {selectedBuilding.lectures.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <strong style={{ fontSize: 12, color: 'var(--muted-dark)' }}>Lectures</strong>
                  <ul style={{ margin: '4px 0 0', paddingLeft: 18, fontSize: 13 }}>
                    {selectedBuilding.lectures.map((lec) => (
                      <li key={`${lec.subject}-${lec.start}`}>
                        {lec.subject} · {hhmm(lec.start)}–{hhmm(lec.end)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div style={{ marginBottom: 12 }}>
                <strong style={{ fontSize: 12, color: 'var(--muted-dark)' }}>
                  Inside now ({hhmm(replayTime)})
                </strong>
                {sideOccupants.length === 0 ? (
                  <p className="caption">Nobody here — scrub the day.</p>
                ) : (
                  <ul style={{ margin: '4px 0 0', paddingLeft: 18, fontSize: 13 }}>
                    {sideOccupants.map((s) => (
                      <li key={s.id}>
                        <button
                          type="button"
                          className="btn"
                          style={{ padding: '2px 8px', marginBottom: 4 }}
                          onClick={() => selectStudent(s.id)}
                        >
                          {s.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <strong style={{ fontSize: 12, color: 'var(--muted-dark)' }}>Flags near now</strong>
                {sideFlags.length === 0 ? (
                  <p className="caption">None at this time.</p>
                ) : (
                  <ul style={{ margin: '4px 0 0', paddingLeft: 18, fontSize: 13 }}>
                    {sideFlags.map((f) => (
                      <li key={f.id} style={{ color: 'var(--danger)' }}>
                        {f.title}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          ) : (
            <>
              <span className="story-dossier__stamp story-dossier__stamp--clear">SCENE</span>
              <h3
                style={{
                  margin: '0 0 8px',
                  fontFamily: 'var(--font-display)',
                  color: 'var(--accent)',
                }}
              >
                Campus dossier
              </h3>
              <p className="caption" style={{ lineHeight: 1.45 }}>
                The fireworks plot starts here — Gilmorehill under satellite light. Click a building
                to open hours, lectures, and who is inside at {hhmm(replayTime)}. Press play and watch
                the campus breathe.
              </p>
              {selectedStudent && (
                <p style={{ fontSize: 13, marginTop: 12 }}>
                  Tracing <strong>{selectedStudent.name}</strong>
                  <button
                    type="button"
                    className="btn"
                    style={{ marginLeft: 8 }}
                    onClick={() => selectStudent(null)}
                  >
                    Clear
                  </button>
                </p>
              )}
              {!mapError && (
                <button
                  type="button"
                  className="btn accent"
                  style={{ marginTop: 16, width: '100%' }}
                  onClick={() => {
                    mapRef.current?.easeTo({
                      center: CAMPUS,
                      zoom: 15.6,
                      pitch: 58,
                      bearing: -28,
                      duration: 900,
                    })
                  }}
                >
                  Reset camera
                </button>
              )}
            </>
          )}
        </aside>
      </div>

      <TimeSlider />
    </VizPageShell>
  )
}
