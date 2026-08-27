import requests
from typing import Dict, List
from app.core.config import settings
try:
    # pyrefly: ignore [missing-import]
    from polyline import decode as decode_polyline
except ImportError:  # fallback implementation
    def decode_polyline(encoded_str: str):
        """Decode a polyline encoded string into a list of (lat, lng) tuples.
        This is a minimal pure‑Python implementation of the Google polyline
        algorithm, sufficient for our route decoding needs.
        """
        result = []
        index = lat = lng = 0
        shifts = []
        while index < len(encoded_str):
            shift = result_shift = 0
            while True:
                b = ord(encoded_str[index]) - 63
                index += 1
                result_shift |= (b & 0x1f) << shift
                shift += 5
                if b < 0x20:
                    break
            dlat = ~(result_shift >> 1) if (result_shift & 1) else (result_shift >> 1)
            lat += dlat
            shift = result_shift = 0
            while True:
                b = ord(encoded_str[index]) - 63
                index += 1
                result_shift |= (b & 0x1f) << shift
                shift += 5
                if b < 0x20:
                    break
            dlng = ~(result_shift >> 1) if (result_shift & 1) else (result_shift >> 1)
            lng += dlng
            result.append((lat / 1e5, lng / 1e5))
        return result

class WalkService:
    @staticmethod
    def get_route(origin_lat: float, origin_lng: float, destination_lat: float, destination_lng: float) -> Dict:
        """Call Google Maps Directions API to retrieve a walking route.
        Returns a dict with 'polyline' (list of {'latitude', 'longitude'}) and 'route_id'."""
        api_key = settings.GOOGLE_MAPS_API_KEY
        if not api_key:
            raise ValueError('Google Maps API key not configured')
        url = 'https://maps.googleapis.com/maps/api/directions/json'
        params = {
            'origin': f"{origin_lat},{origin_lng}",
            'destination': f"{destination_lat},{destination_lng}",
            'mode': 'walking',
            'key': api_key,
            'alternatives': 'false',
        }
        resp = requests.get(url, params=params, timeout=10)
        data = resp.json()
        if data.get('status') != 'OK' or not data.get('routes'):
            raise RuntimeError(f"Google Directions API error: {data.get('status')}")
        route = data['routes'][0]
        points = decode_polyline(route['overview_polyline']['points'])
        polyline = [{'latitude': lat, 'longitude': lng} for lat, lng in points]
        return {'polyline': polyline, 'route_id': route.get('overview_polyline', {}).get('points', '')}
