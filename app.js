const API_BASE = "https://microclimates.solofounders.com";
const FALLBACK_CENTER = [37.7749, -122.4194];
const NEIGHBORHOOD_CENTROIDS = {
  financial_district: [37.7946, -122.3999],
  chinatown: [37.7941, -122.4078],
  union_square: [37.7879, -122.4074],
  tenderloin: [37.7834, -122.4167],
  civic_center: [37.7795, -122.4185],
  embarcadero: [37.7962, -122.3965],
  rincon_hill: [37.7864, -122.3908],
  south_beach: [37.7815, -122.3901],
  north_beach: [37.8061, -122.4103],
  telegraph_hill: [37.8024, -122.4058],
  russian_hill: [37.8019, -122.4192],
  nob_hill: [37.7933, -122.4167],
  marina: [37.8038, -122.4368],
  pacific_heights: [37.7927, -122.4382],
  japantown: [37.7856, -122.4291],
  presidio: [37.7989, -122.4662],
  sea_cliff: [37.7878, -122.4886],
  lands_end: [37.7802, -122.5131],
  inner_richmond: [37.7793, -122.4687],
  outer_richmond: [37.7796, -122.4957],
  inner_sunset: [37.7627, -122.4662],
  outer_sunset: [37.7546, -122.4941],
  parkside: [37.7375, -122.4874],
  haight: [37.7699, -122.4481],
  lower_haight: [37.7725, -122.4338],
  hayes_valley: [37.7764, -122.4242],
  cole_valley: [37.7651, -122.4498],
  castro: [37.7609, -122.4350],
  noe_valley: [37.7503, -122.4334],
  mission: [37.7599, -122.4148],
  soma: [37.7786, -122.4059],
  mission_bay: [37.7706, -122.3910],
  twin_peaks: [37.7544, -122.4477],
  diamond_heights: [37.7389, -122.4392],
  glen_park: [37.7346, -122.4324],
  forest_hill: [37.7487, -122.4586],
  west_portal: [37.7408, -122.4655],
  st_francis_wood: [37.7340, -122.4694],
  bernal_heights: [37.7429, -122.4143],
  potrero_hill: [37.7596, -122.3991],
  dogpatch: [37.7590, -122.3897],
  bayview: [37.7292, -122.3928],
  hunters_point: [37.7299, -122.3725],
  excelsior: [37.7244, -122.4330],
  visitacion_valley: [37.7142, -122.4052],
  crocker_amazon: [37.7098, -122.4362],
  ingleside: [37.7220, -122.4553],
  oceanview: [37.7144, -122.4568],
  merced_heights: [37.7175, -122.4671],
  lakeside: [37.7321, -122.4840],
  stonestown: [37.7280, -122.4769],
};

const ui = {
  name: document.getElementById("selected-name"),
  temp: document.getElementById("selected-temp"),
  tempUnit: document.getElementById("temp-unit"),
  condition: document.getElementById("selected-condition"),
  coords: document.getElementById("selected-coords"),
  updated: document.getElementById("selected-updated"),
  packingList: document.getElementById("packing-list"),
  refreshBtn: document.getElementById("refresh-btn"),
};

const map = L.map("map", {
  zoomControl: true,
  minZoom: 11,
  maxZoom: 17,
}).setView(FALLBACK_CENTER, 12);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);

const markersLayer = L.layerGroup().addTo(map);
let neighborhoods = [];
let markerByNeighborhood = new Map();
let weatherIndex = new Map();

function formatTemp(temp) {
  return Number.isFinite(temp) ? `${Math.round(temp)}°F` : "--";
}

function parseTemperature(value) {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const match = value.match(/-?\d+(\.\d+)?/);
    if (match) return Number(match[0]);
  }
  return NaN;
}

function normalizeName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function slugifyNeighborhood(name) {
  return String(name || "")
    .toLowerCase()
    .trim()
    .replace(/district|neighborhood/g, "")
    .replace(/[^a-z0-9\s_-]/g, "")
    .replace(/\s+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function neighborhoodCandidates(name) {
  const raw = String(name || "").trim();
  if (!raw) return [];

  const base = slugifyNeighborhood(raw);
  const compact = normalizeName(raw);
  const noSuffix = raw
    .toLowerCase()
    .replace(/\b(district|neighborhood)\b/g, "")
    .trim();
  const firstWord = noSuffix.split(/\s+/).filter(Boolean)[0] || "";

  return [...new Set([
    raw,
    raw.toLowerCase(),
    base,
    base.replace(/_/g, "-"),
    noSuffix,
    noSuffix.replace(/\s+/g, "_"),
    firstWord,
    compact,
  ])].filter(Boolean);
}

function unwrapPayload(raw) {
  if (!raw || typeof raw !== "object") return raw;

  if (raw.data && typeof raw.data === "object") return raw.data;
  if (raw.result && typeof raw.result === "object") return raw.result;
  if (raw.microclimate && typeof raw.microclimate === "object") return raw.microclimate;
  if (raw.weather && typeof raw.weather === "object") return raw.weather;
  return raw;
}

function normalizeNeighborhood(raw) {
  const payload = unwrapPayload(raw);
  if (!payload || typeof payload !== "object") {
    return {
      name: "Unknown",
      lat: NaN,
      lng: NaN,
      temperature: NaN,
      condition: "",
    };
  }

  const lat = Number(payload.lat ?? payload.latitude ?? payload.locationLat ?? payload.y);
  const lng = Number(payload.lng ?? payload.lon ?? payload.longitude ?? payload.locationLng ?? payload.x);
  const temp = parseTemperature(
    payload.temperature ??
      payload.temp ??
      payload.tempF ??
      payload.temp_f ??
      payload.temp_fahrenheit ??
      payload.currentTemp ??
      payload.current_temperature ??
      payload.apparentTemperature ??
      payload.feelsLike ??
      payload.feels_like ??
      payload.temp_f ??
      payload.weather?.temperature ??
      payload.weather?.temp
  );

  return {
    key: payload.key || payload.neighborhood_key || payload.slug || "",
    name: payload.neighborhood || payload.name || payload.location || payload.area || "Unknown",
    lat,
    lng,
    temperature: temp,
    condition:
      payload.condition ||
      payload.conditions ||
      payload.description ||
      payload.summary ||
      (typeof payload.weather === "string" ? payload.weather : "") ||
      "",
  };
}

function distanceSq(aLat, aLng, bLat, bLng) {
  return (aLat - bLat) ** 2 + (aLng - bLng) ** 2;
}

function findNearestNeighborhood(lat, lng) {
  if (!neighborhoods.length) return null;
  let nearest = neighborhoods[0];
  let minDist = distanceSq(lat, lng, nearest.lat, nearest.lng);

  for (const n of neighborhoods) {
    const d = distanceSq(lat, lng, n.lat, n.lng);
    if (d < minDist) {
      nearest = n;
      minDist = d;
    }
  }

  return nearest;
}

function packSuggestions(tempF, condition) {
  if (!Number.isFinite(tempF)) {
    return ["Temperature unavailable. Bring a light jacket just in case."];
  }

  const c = (condition || "").toLowerCase();
  const isWindy = c.includes("wind");
  const isRainy = c.includes("rain") || c.includes("drizzle");

  const items = [];

  if (tempF < 40) {
    items.push("Stay inside, wear your pj's, why go out?");
  } else if (tempF >= 40 && tempF <= 50) {
    items.push("Bundle up, wear a warm coat, if you're a true san franciscan, you'll have your canada goose :)");
  } else if (tempF >= 51 && tempF <= 60) {
    items.push("Layers layers layers, you need a jacket, warm sweater, and t-shirt!");
  } else if (tempF >= 61 && tempF <= 65) {
    items.push("Almost warm, bring out the sunnies! You'll want jeans, t-shirt, sweater, or light jacket. You probably won't sweat going up those hills.");
  } else if (tempF >= 66 && tempF <= 69) {
    items.push("Make sure to have a short sleeve tee or tank on under your sweater or jacket. You'll start sweating going up those hills.");
  } else if (tempF >= 70 && tempF <= 72) {
    items.push("What a gorgeous day! Honestly, what can't you wear in this weather?");
  } else if (tempF >= 73 && tempF <= 74) {
    items.push("What are we? east bay? starting to get a lil toasty around here");
  } else if (tempF > 75) {
    items.push("It's hot, what's happening? Pull out the tank and shorts for this unseasonably warm day.");
  } else if (tempF > 74) {
    items.push("It's hot, what's happening? Pull out the tank and shorts for this unseasonably warm day.");
  } else {
    items.push("Bring a light layer.");
  }

  if (isWindy) {
    items.push("Don't forget your hairtie! Maybe a hoodie too.");
  }

  if (isRainy) {
    items.push("Raincoat or the true SF staple, a patagonia jacket.");
  }

  return [...new Set(items)];
}

function renderNeighborhoodCard(data) {
  ui.name.textContent = data.name;
  const hasTemp = Number.isFinite(data.temperature);
  ui.temp.textContent = hasTemp ? Math.round(data.temperature) : "--";
  ui.tempUnit.textContent = hasTemp ? "°F" : "";
  ui.condition.textContent = data.condition || "";
  ui.coords.textContent = Number.isFinite(data.lat) && Number.isFinite(data.lng)
    ? `${data.lat.toFixed(4)}, ${data.lng.toFixed(4)}`
    : "--";
  ui.updated.textContent = new Date().toLocaleString();

  const suggestions = packSuggestions(data.temperature, data.condition);
  ui.packingList.innerHTML = suggestions.map((item) => `<li>${item}</li>`).join("");
}

function selectNeighborhood(neighborhood) {
  renderNeighborhoodCard(neighborhood);

  const marker = markerByNeighborhood.get(neighborhood.name);
  if (marker) {
    marker.openPopup();
  }
}

async function fetchLocationMicroclimate(lat, lng) {
  const url = `${API_BASE}/location?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Location API error: ${response.status}`);
  }

  const raw = await response.json();
  const normalized = normalizeNeighborhood(raw);
  if (!Number.isFinite(normalized.lat)) normalized.lat = lat;
  if (!Number.isFinite(normalized.lng)) normalized.lng = lng;
  return normalized;
}

async function fetchNeighborhoods() {
  const response = await fetch(`${API_BASE}/neighborhoods`);
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const withCentroid = (item, fallbackKey = "") => {
    const keyCandidate =
      item?.key ||
      item?.neighborhood_key ||
      item?.slug ||
      fallbackKey ||
      slugifyNeighborhood(item?.name || item?.neighborhood || "");
    const centroid = NEIGHBORHOOD_CENTROIDS[keyCandidate];
    return {
      ...item,
      key: keyCandidate || item?.key || "",
      lat: Number.isFinite(Number(item?.lat)) ? Number(item.lat) : (centroid ? centroid[0] : item?.lat),
      lng: Number.isFinite(Number(item?.lng))
        ? Number(item.lng)
        : (centroid ? centroid[1] : (item?.lng ?? item?.lon ?? item?.longitude)),
    };
  };

  const json = await response.json();
  let rawItems = [];
  if (Array.isArray(json)) {
    rawItems = json.map((item) => withCentroid(item));
  } else if (Array.isArray(json.neighborhoods)) {
    rawItems = json.neighborhoods.map((item) => withCentroid(item));
  } else if (json && typeof json === "object") {
    rawItems = Object.entries(json).map(([name, value]) =>
      withCentroid(
        {
          name: value?.name || name,
          neighborhood: value?.neighborhood || name,
          ...(typeof value === "object" ? value : { temperature: value }),
        },
        name
      )
    );
  }

  const parsed = rawItems.map(normalizeNeighborhood);

  neighborhoods = parsed.filter((n) =>
    n.name && Number.isFinite(n.lat) && Number.isFinite(n.lng)
  );

  return neighborhoods;
}

function indexWeatherItems(items) {
  weatherIndex = new Map();
  for (const item of items) {
    const normalized = normalizeNeighborhood(item);
    if (!Number.isFinite(normalized.temperature)) continue;
    const keys = neighborhoodCandidates(normalized.name);
    for (const key of keys) {
      weatherIndex.set(normalizeName(key), normalized);
    }
  }
}

async function fetchAllWeather() {
  const candidates = ["/sf-weather", "/weather"];
  for (const path of candidates) {
    try {
      const response = await fetch(`${API_BASE}${path}`);
      if (!response.ok) continue;
      const raw = await response.json();
      let items = [];
      if (Array.isArray(raw)) {
        items = raw;
      } else if (raw && typeof raw === "object" && Array.isArray(raw.data)) {
        items = raw.data;
      } else if (raw && typeof raw === "object" && Array.isArray(raw.weather)) {
        items = raw.weather;
      }
      if (items.length) {
        indexWeatherItems(items);
        return;
      }
    } catch (error) {
      // Continue to fallback endpoint.
    }
  }
}

async function fetchWeatherForNeighborhood(name) {
  if (!name) return null;
  const candidates = neighborhoodCandidates(name);
  const paths = [];
  for (const c of candidates) {
    paths.push(`/sf-weather/${encodeURIComponent(c)}`);
  }
  for (const c of candidates) {
    paths.push(`/weather/${encodeURIComponent(c)}`);
  }

  let lastError = null;
  for (const path of paths) {
    try {
      const response = await fetch(`${API_BASE}${path}`);
      if (!response.ok) continue;
      const raw = await response.json();
      const normalized = normalizeNeighborhood({ ...unwrapPayload(raw), name });
      if (Number.isFinite(normalized.temperature)) {
        if (!normalized.name || normalized.name === "Unknown") normalized.name = name;
        return normalized;
      }
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) throw lastError;
  throw new Error("No temperature available from neighborhood weather endpoints");
}

async function withFreshWeather(base) {
  if (!base) return base;
  const weatherId = base.key || base.name;
  if (!weatherId) return base;
  try {
    const weather = await fetchWeatherForNeighborhood(weatherId);
    return {
      ...base,
      ...weather,
      temperature: Number.isFinite(weather.temperature) ? weather.temperature : base.temperature,
      condition:
        weather.condition
          ? weather.condition
          : base.condition,
    };
  } catch (error) {
    const fallback = weatherIndex.get(normalizeName(base.name));
    if (fallback && Number.isFinite(fallback.temperature)) {
      return {
        ...base,
        ...fallback,
        name: base.name,
        temperature: fallback.temperature,
        condition:
          fallback.condition
            ? fallback.condition
            : base.condition,
      };
    }
    return base;
  }
}

function drawMarkers(items) {
  markersLayer.clearLayers();
  markerByNeighborhood = new Map();

  items.forEach((n) => {
    const marker = L.circleMarker([n.lat, n.lng], {
      radius: 7,
      weight: 1,
      color: "#0b3c49",
      fillColor: "#1d8a95",
      fillOpacity: 0.9,
    });

    const popupText = n.condition
      ? `<strong>${n.name}</strong><br>${formatTemp(n.temperature)}<br>${n.condition}`
      : `<strong>${n.name}</strong><br>${formatTemp(n.temperature)}`;

    marker
      .bindPopup(popupText)
      .on("click", async () => {
        const withWeather = await withFreshWeather(n);
        selectNeighborhood(withWeather);
      });

    marker.addTo(markersLayer);
    markerByNeighborhood.set(n.name, marker);
  });
}

function fitMap(items) {
  if (!items.length) return;

  const bounds = L.latLngBounds(items.map((n) => [n.lat, n.lng]));
  map.fitBounds(bounds, { padding: [24, 24] });
}

async function refresh() {
  ui.refreshBtn.disabled = true;
  ui.refreshBtn.textContent = "Refreshing...";

  try {
    const items = await fetchNeighborhoods();
    await fetchAllWeather();
    drawMarkers(items);
    fitMap(items);

    if (items.length) {
      const withWeather = await withFreshWeather(items[0]);
      selectNeighborhood(withWeather);
    }
  } catch (error) {
    ui.name.textContent = "Unable to load data";
    ui.condition.textContent = `${error.message}. Please try again.`;
  } finally {
    ui.refreshBtn.disabled = false;
    ui.refreshBtn.textContent = "Refresh live temperatures";
  }
}

map.on("click", async (event) => {
  const { lat, lng } = event.latlng;
  if (!neighborhoods.length) {
    ui.name.textContent = "No neighborhood match";
    ui.temp.textContent = "--";
    ui.tempUnit.textContent = "";
    ui.condition.textContent = "Neighborhood list not loaded.";
    ui.coords.textContent = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    ui.updated.textContent = new Date().toLocaleString();
    ui.packingList.innerHTML = "<li>Bring a light layer as a safe default in SF.</li>";
    return;
  }

  const nearest = findNearestNeighborhood(lat, lng);
  if (!nearest) return;

  const withWeather = await withFreshWeather(nearest);
  selectNeighborhood(withWeather);
});

ui.refreshBtn.addEventListener("click", refresh);
refresh();
