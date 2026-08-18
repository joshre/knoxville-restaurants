// canonical map logic for both consumers; `cortex export-restaurants` include_str!s this file

export const KNOXVILLE_CENTER = [-83.9207, 35.9606];
export const DEFAULT_ZOOM = 11;
export const SOURCE_ID = 'restaurants';
export const CLUSTER_LAYER_ID = 'restaurant-clusters';
export const CLUSTER_COUNT_LAYER_ID = 'restaurant-cluster-count';
export const POINT_LAYER_ID = 'restaurant-points';
export const LABEL_LAYER_ID = 'restaurant-labels';

const PALETTE = {
  point: '#292524',
  selected: '#e87f52',
  cluster: '#c6613f',
  clusterText: '#ffffff',
  stroke: '#ffffff',
  label: '#1c1917',
  labelHalo: '#ffffff',
};

const DARK_PALETTE = {
  point: '#f0a27e',
  selected: '#e87f52',
  cluster: '#a14f34',
  clusterText: '#fafaf9',
  stroke: '#1c1917',
  label: '#fafaf9',
  labelHalo: '#0c0a09',
};

const BASEMAP_TILES = {
  light: 'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
  dark: 'https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}@2x.png',
};

export function rasterStyle(dark = false) {
  return {
    version: 8,
    sources: {
      carto: {
        type: 'raster',
        tiles: [dark ? BASEMAP_TILES.dark : BASEMAP_TILES.light],
        tileSize: 256,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      },
    },
    layers: [
      {
        id: 'carto',
        type: 'raster',
        source: 'carto',
        // keep voyager's color, just bias it warm toward the sienna/stone palette
        paint: {
          'raster-hue-rotate': -8,
          'raster-saturation': -0.05,
          'raster-opacity': 0.95,
        },
      },
    ],
  };
}

// setTiles keeps every restaurant layer intact; setStyle would tear them all down
export function setBasemap(map, dark) {
  const source = map.getSource('carto');
  if (!source || typeof source.setTiles !== 'function') return;
  source.setTiles([dark ? BASEMAP_TILES.dark : BASEMAP_TILES.light]);
}

export function hasUsableCoordinates(restaurant) {
  const lat = Number(restaurant?.latitude);
  const lon = Number(restaurant?.longitude);
  return (
    restaurant?.latitude !== null &&
    restaurant?.latitude !== undefined &&
    restaurant?.longitude !== null &&
    restaurant?.longitude !== undefined &&
    Number.isFinite(lat) &&
    Number.isFinite(lon)
  );
}

export function mappableRestaurants(restaurants) {
  return (restaurants || []).filter(hasUsableCoordinates);
}

const defaultIdOf = (restaurant, index) =>
  restaurant?.id !== undefined && restaurant?.id !== null ? String(restaurant.id) : String(index);

export function buildFeatureCollection(restaurants, idOf = defaultIdOf) {
  const features = [];
  (restaurants || []).forEach((restaurant, index) => {
    if (!hasUsableCoordinates(restaurant)) return;
    features.push({
      type: 'Feature',
      // setFeatureState needs a numeric id, so the caller's key rides in properties
      id: features.length,
      geometry: {
        type: 'Point',
        coordinates: [Number(restaurant.longitude), Number(restaurant.latitude)],
      },
      properties: {
        key: idOf(restaurant, index),
        name: restaurant.name,
        cuisine: restaurant.cuisine_type || '',
        price: restaurant.price_range || '',
        area: restaurant.area || '',
      },
    });
  });
  return { type: 'FeatureCollection', features };
}

function layerSpecs(dark) {
  const c = dark ? DARK_PALETTE : PALETTE;
  return [
    {
      id: CLUSTER_LAYER_ID,
      type: 'circle',
      source: SOURCE_ID,
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': c.cluster,
        'circle-opacity': 0.9,
        'circle-radius': ['step', ['get', 'point_count'], 14, 10, 18, 30, 24],
        'circle-stroke-width': 2,
        'circle-stroke-color': c.stroke,
      },
    },
    {
      id: CLUSTER_COUNT_LAYER_ID,
      type: 'symbol',
      source: SOURCE_ID,
      filter: ['has', 'point_count'],
      layout: {
        'text-field': ['get', 'point_count_abbreviated'],
        'text-size': 12,
        'text-allow-overlap': true,
      },
      paint: { 'text-color': c.clusterText },
    },
    {
      id: POINT_LAYER_ID,
      type: 'circle',
      source: SOURCE_ID,
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-radius': ['case', ['boolean', ['feature-state', 'selected'], false], 9, 6],
        'circle-color': [
          'case',
          ['boolean', ['feature-state', 'selected'], false],
          c.selected,
          c.point,
        ],
        'circle-stroke-width': 2,
        'circle-stroke-color': c.stroke,
      },
    },
    {
      id: LABEL_LAYER_ID,
      type: 'symbol',
      source: SOURCE_ID,
      filter: ['!', ['has', 'point_count']],
      minzoom: 12.5,
      layout: {
        'text-field': ['get', 'name'],
        'text-size': 12,
        'text-offset': [0, 1.15],
        'text-anchor': 'top',
        'text-allow-overlap': false,
      },
      paint: {
        'text-color': c.label,
        'text-halo-color': c.labelHalo,
        'text-halo-width': 1.25,
      },
    },
  ];
}

const wiredMaps = new WeakSet();

// idempotent so a style swap can re-run it
export function attachRestaurantLayers(map, { onSelect, dark = false } = {}) {
  if (!map.getSource(SOURCE_ID)) {
    map.addSource(SOURCE_ID, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
      cluster: true,
      clusterRadius: 44,
      clusterMaxZoom: 13,
    });
  }

  layerSpecs(dark).forEach((spec) => {
    if (!map.getLayer(spec.id)) map.addLayer(spec);
  });

  // layers are guarded above, but map.on would stack duplicate handlers on a re-run
  if (wiredMaps.has(map)) return;
  wiredMaps.add(map);

  const pointer = (on) => () => {
    map.getCanvas().style.cursor = on ? 'pointer' : '';
  };
  [POINT_LAYER_ID, CLUSTER_LAYER_ID].forEach((id) => {
    map.on('mouseenter', id, pointer(true));
    map.on('mouseleave', id, pointer(false));
  });

  map.on('click', CLUSTER_LAYER_ID, (event) => {
    const feature = event.features?.[0];
    if (!feature) return;
    const source = map.getSource(SOURCE_ID);
    // maplibre 5 returns a promise here, older builds take a callback
    Promise.resolve(source.getClusterExpansionZoom(feature.properties.cluster_id))
      .then((zoom) => {
        map.easeTo({ center: feature.geometry.coordinates, zoom, duration: 350 });
      })
      .catch(() => {});
  });

  if (onSelect) {
    map.on('click', POINT_LAYER_ID, (event) => {
      const key = event.features?.[0]?.properties?.key;
      if (key !== undefined && key !== null) onSelect(String(key));
    });
  }
}

export function applyTheme(map, dark) {
  layerSpecs(dark).forEach((spec) => {
    if (!map.getLayer(spec.id)) return;
    Object.entries(spec.paint || {}).forEach(([prop, value]) => {
      map.setPaintProperty(spec.id, prop, value);
    });
  });
}

export function syncRestaurantData(map, restaurants, idOf = defaultIdOf) {
  const source = map.getSource(SOURCE_ID);
  if (!source) return null;
  const collection = buildFeatureCollection(restaurants, idOf);
  source.setData(collection);
  return collection;
}

export function setSelected(map, collection, key) {
  if (!collection) return;
  collection.features.forEach((feature) => {
    map.setFeatureState(
      { source: SOURCE_ID, id: feature.id },
      { selected: key !== null && key !== undefined && feature.properties.key === String(key) },
    );
  });
}

export function boundsOf(maplibregl, restaurants) {
  const mapped = mappableRestaurants(restaurants);
  if (mapped.length === 0) return null;
  const bounds = new maplibregl.LngLatBounds();
  mapped.forEach((restaurant) => {
    bounds.extend([Number(restaurant.longitude), Number(restaurant.latitude)]);
  });
  return bounds;
}

export function fitToRestaurants(maplibregl, map, restaurants, options = {}) {
  const bounds = boundsOf(maplibregl, restaurants);
  if (!bounds) return false;
  map.fitBounds(bounds, {
    padding: { top: 48, right: 48, bottom: 48, left: 48 },
    maxZoom: 13.5,
    duration: options.duration ?? 450,
  });
  return true;
}

export function readViewport(map) {
  const b = map.getBounds();
  return {
    zoom: map.getZoom(),
    west: b.getWest(),
    south: b.getSouth(),
    east: b.getEast(),
    north: b.getNorth(),
  };
}

export function isInViewport(restaurant, viewport) {
  if (!(viewport && hasUsableCoordinates(restaurant))) return false;
  const lat = Number(restaurant.latitude);
  const lon = Number(restaurant.longitude);
  return (
    lon >= viewport.west && lon <= viewport.east && lat >= viewport.south && lat <= viewport.north
  );
}

export const VIEWPORT_FILTER_MIN_ZOOM = 12;

// re-fit only when the mapped set itself changes, not on every selection
export function mappedSignature(restaurants, idOf = defaultIdOf) {
  return mappableRestaurants(restaurants)
    .map((restaurant, index) => idOf(restaurant, index))
    .join('|');
}
