
const mongoose = require('mongoose');

const maxDistanceKm = 50;
const radiusInRadians = maxDistanceKm / 6378.1;

const jaipur = { lat: 26.9124, lng: 75.7873 };
const delhi = { lat: 28.6139, lng: 77.2090 };

function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6378.1; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

const dist = getDistance(jaipur.lat, jaipur.lng, delhi.lat, delhi.lng);
console.log(`Distance Jaipur-Delhi: ${dist.toFixed(2)} km`);

const withinRadius = dist <= maxDistanceKm;
console.log(`Within 50km: ${withinRadius}`);

// Check if $centerSphere logic matches
// The formula for distance in radians is distance / EarthRadius
const distInRadians = dist / 6378.1;
console.log(`Distance in radians: ${distInRadians}`);
console.log(`Radius in radians: ${radiusInRadians}`);
console.log(`Is distInRadians <= radiusInRadians: ${distInRadians <= radiusInRadians}`);
