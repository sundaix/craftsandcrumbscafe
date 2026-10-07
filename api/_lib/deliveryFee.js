const DEFAULT_PRICING = {
  baseFee: 40,
  baseKm: 2,
  perKm: 10,
  roundTo: 5,
  maxKm: 10,
  roadFactor: 1.3,        // straight-line -> road distance guess, used ONLY if the routing service is down
  shopLat: 14.6760,       // placeholder pin (Quezon City) until the shop's real pin is saved in Admin -> Settings
  shopLng: 121.0437
};

function num(v, fallback, min){
  const n = Number(v);
  return Number.isFinite(n) && n >= (min === undefined ? 0 : min) ? n : fallback;
}

function normalizePricing(raw){
  const r = raw || {};
  return {
    baseFee: num(r.baseFee, DEFAULT_PRICING.baseFee),
    baseKm: num(r.baseKm, DEFAULT_PRICING.baseKm),
    perKm: num(r.perKm, DEFAULT_PRICING.perKm),
    roundTo: num(r.roundTo, DEFAULT_PRICING.roundTo, 1),
    maxKm: num(r.maxKm, DEFAULT_PRICING.maxKm, 0.1),
    roadFactor: num(r.roadFactor, DEFAULT_PRICING.roadFactor, 1),
    shopLat: Number.isFinite(Number(r.shopLat)) && r.shopLat !== null && r.shopLat !== '' ? Number(r.shopLat) : DEFAULT_PRICING.shopLat,
    shopLng: Number.isFinite(Number(r.shopLng)) && r.shopLng !== null && r.shopLng !== '' ? Number(r.shopLng) : DEFAULT_PRICING.shopLng
  };
}

async function loadPricing(db){
  try{
    const snap = await db.collection('settings').doc('general').get();
    return normalizePricing(snap.exists ? snap.data().deliveryPricing : null);
  } catch(err){
    console.error('Could not read delivery pricing settings, using defaults.', err);
    return normalizePricing(null);
  }
}

function haversineKm(lat1, lng1, lat2, lng2){
  const R = 6371;
  const toRad = (d) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/* Driving distance from the shop to the customer's pin using the free
   public OSRM server (no key). If it's slow or down, falls back to the
   straight-line distance times a road factor — flagged via `source` so
   the caller knows it's an estimate. */
async function routeDistance(pricing, lat, lng){
  const url = `https://router.project-osrm.org/route/v1/driving/${pricing.shopLng},${pricing.shopLat};${lng},${lat}?overview=false`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try{
    const res = await fetch(url, { signal: ctrl.signal });
    const data = await res.json();
    if(res.ok && data.code === 'Ok' && data.routes && data.routes[0]){
      return {
        distanceKm: Math.round(data.routes[0].distance / 10) / 100,
        durationMin: Math.max(1, Math.round(data.routes[0].duration / 60)),
        source: 'osrm'
      };
    }
  } catch(err){
    console.warn('OSRM routing failed, falling back to a straight-line estimate.', err.message);
  } finally {
    clearTimeout(timer);
  }
  const km = haversineKm(pricing.shopLat, pricing.shopLng, lat, lng) * pricing.roadFactor;
  return {
    distanceKm: Math.round(km * 100) / 100,
    durationMin: Math.max(1, Math.round(km / 25 * 60)), // ~25 km/h city average
    source: 'estimate'
  };
}

function computeFee(distanceKm, p){
  const extra = Math.max(0, distanceKm - p.baseKm);
  const raw = p.baseFee + extra * p.perKm;
  // small epsilon so e.g. 55.0000001 doesn't jump a whole step
  return Math.ceil((raw - 1e-9) / p.roundTo) * p.roundTo;
}

module.exports = { DEFAULT_PRICING, normalizePricing, loadPricing, routeDistance, computeFee, haversineKm };
