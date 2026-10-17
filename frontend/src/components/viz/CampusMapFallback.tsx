import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Building, Student } from '../../types/case'
interface Props {
  buildings: Building[]
  visitCounts: Map<string, number>
  occupantsByBuilding: Map<string, Student[]>
  flaggedBuildingIds: Set<string>
  selectedBuildingId: string | null
  selectedStudentId: string | null
  studentColor: (id: string) => string
  onSelectBuilding: (id: string | null) => void
  onSelectStudent: (id: string | null) => void
  pathCoords: [number, number][]
  replayLabel: string
}

/** Real OSM Gilmorehill map with CSS-extruded building markers when WebGL is unavailable. */
export default function CampusMapFallback({
  buildings,
  visitCounts,
  occupantsByBuilding,
  flaggedBuildingIds,
  selectedBuildingId,
  selectedStudentId,
  studentColor,
  onSelectBuilding,
  onSelectStudent,
  pathCoords,
  replayLabel,
}: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    const el = hostRef.current
    if (!el || mapRef.current) return

    const map = L.map(el, {
      zoomControl: true,
      attributionControl: true,
      preferCanvas: true,
    }).setView([55.8723, -4.2895], 16)

    // Esri World Imagery (satellite) + place names — no API key
    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        attribution:
          'Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
        maxZoom: 19,
      },
    ).addTo(map)
    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: '',
        maxZoom: 19,
        opacity: 0.95,
      },
    ).addTo(map)

    layerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map

    const ro = new ResizeObserver(() => map.invalidateSize())
    ro.observe(el)
    requestAnimationFrame(() => map.invalidateSize())

    return () => {
      ro.disconnect()
      map.remove()
      mapRef.current = null
      layerRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const layer = layerRef.current
    if (!map || !layer) return
    layer.clearLayers()

    const maxV = Math.max(1, ...visitCounts.values())

    if (pathCoords.length >= 2) {
      L.polyline(
        pathCoords.map(([lon, lat]) => [lat, lon] as [number, number]),
        { color: '#ffb347', weight: 3, opacity: 0.9 },
      ).addTo(layer)
    }

    for (const b of buildings) {
      const visits = visitCounts.get(b.id) ?? 0
      const h = 28 + (visits / maxV) * 56
      const flagged = flaggedBuildingIds.has(b.id)
      const selected = b.id === selectedBuildingId
      let face = '#3d4f6f'
      if (flagged) face = '#c0392b'
      else if (selected) face = '#ffb347'
      else if (b.min_age && b.min_age >= 18) face = '#6b4c9a'

      const html = `
        <div class="iso-bldg ${selected ? 'sel' : ''}" style="--h:${h}px;--face:${face}">
          <div class="iso-top"></div>
          <div class="iso-side"></div>
          <div class="iso-front"></div>
          <div class="iso-label">${b.name.length > 16 ? b.name.slice(0, 14) + '…' : b.name}</div>
        </div>`

      const icon = L.divIcon({
        className: 'iso-wrap',
        html,
        iconSize: [64, h + 24],
        iconAnchor: [32, h + 8],
      })

      L.marker([b.lat, b.lon], { icon })
        .on('click', () => onSelectBuilding(selected ? null : b.id))
        .bindTooltip(`${b.name}<br/>${b.open_label}<br/>replay ${replayLabel}`, {
          direction: 'top',
          opacity: 0.95,
        })
        .addTo(layer)

      const occ = occupantsByBuilding.get(b.id) ?? []
      occ.forEach((st, i) => {
        const ang = (i / Math.max(occ.length, 1)) * Math.PI * 2
        const dLat = (Math.sin(ang) * 18) / 111_320
        const dLon =
          (Math.cos(ang) * 18) / (111_320 * Math.cos((b.lat * Math.PI) / 180))
        const color = studentColor(st.id)
        const ring = st.id === selectedStudentId ? '#fff' : 'transparent'
        const dot = L.divIcon({
          className: 'iso-dot-wrap',
          html: `<div class="iso-dot" style="background:${color};box-shadow:0 0 0 2px ${ring},0 0 12px ${color}"></div>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        })
        L.marker([b.lat + dLat, b.lon + dLon], { icon: dot, zIndexOffset: 500 })
          .on('click', () => onSelectStudent(st.id === selectedStudentId ? null : st.id))
          .bindTooltip(st.name)
          .addTo(layer)
      })
    }
  }, [
    buildings,
    visitCounts,
    occupantsByBuilding,
    flaggedBuildingIds,
    selectedBuildingId,
    selectedStudentId,
    studentColor,
    onSelectBuilding,
    onSelectStudent,
    pathCoords,
    replayLabel,
  ])

  useEffect(() => {
    const b = buildings.find((x) => x.id === selectedBuildingId)
    if (b && mapRef.current) {
      mapRef.current.panTo([b.lat, b.lon], { animate: true })
    }
  }, [selectedBuildingId, buildings])

  return (
    <>
      <style>{`
        .iso-wrap { background: transparent !important; border: none !important; }
        .iso-bldg {
          position: relative; width: 44px; height: var(--h);
          transform-style: preserve-3d;
          transform: rotateX(55deg) rotateZ(-25deg);
          cursor: pointer;
          filter: drop-shadow(0 8px 10px rgba(0,0,0,0.55));
        }
        .iso-bldg.sel { filter: drop-shadow(0 0 12px #ffb347); }
        .iso-front, .iso-side, .iso-top {
          position: absolute; left: 0; bottom: 0;
        }
        .iso-front {
          width: 44px; height: var(--h);
          background: linear-gradient(180deg, color-mix(in srgb, var(--face) 85%, white), var(--face));
          border: 1px solid rgba(255,255,255,0.15);
        }
        .iso-side {
          width: 18px; height: var(--h); left: 44px;
          background: color-mix(in srgb, var(--face) 65%, black);
          transform: rotateY(90deg); transform-origin: left bottom;
          border: 1px solid rgba(0,0,0,0.25);
        }
        .iso-top {
          width: 44px; height: 18px;
          background: color-mix(in srgb, var(--face) 75%, white);
          transform: rotateX(90deg); transform-origin: top left;
          top: 0; border: 1px solid rgba(255,255,255,0.2);
        }
        .iso-label {
          position: absolute; left: 50%; bottom: -18px; transform: translateX(-50%) rotateZ(25deg) rotateX(-55deg);
          white-space: nowrap; font-size: 10px; color: #f0e6d4;
          text-shadow: 0 1px 3px #000; pointer-events: none;
          font-family: Inter, system-ui, sans-serif;
        }
        .iso-dot-wrap { background: transparent !important; border: none !important; }
        .iso-dot {
          width: 12px; height: 12px; border-radius: 50%;
        }
        .leaflet-container { background: #1a1510; font: 12px Inter, system-ui, sans-serif; }
        .leaflet-tooltip {
          background: #12182a; color: #e8eefc; border: 1px solid #ffb34755;
          border-radius: 8px; box-shadow: none;
        }
      `}</style>
      <div ref={hostRef} style={{ position: 'absolute', inset: 0 }} />
      <div
        style={{
          position: 'absolute',
          top: 12,
          left: 12,
          zIndex: 500,
          background: 'rgba(14,18,28,0.88)',
          border: '1px solid #2ec4b655',
          color: '#2ec4b6',
          fontSize: 11,
          padding: '4px 8px',
          borderRadius: 8,
          pointerEvents: 'none',
        }}
      >
        Satellite · isometric blocks · {replayLabel}
      </div>
    </>
  )
}
