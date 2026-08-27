from typing import Tuple, Optional
import math

# Karnataka 4 Revenue Divisions and their respective districts
KARNATAKA_DIVISIONS = {
    "Bangalore Division": [
        "Bengaluru Urban", "Bengaluru Rural", "Ramanagara", "Chikkaballapura",
        "Tumakuru", "Kolar", "Chitradurga", "Davanagere", "Shivamogga"
    ],
    "Mysuru Division": [
        "Mysuru", "Chamarajanagar", "Mandya", "Hassan",
        "Chikkamagaluru", "Kodagu", "Udupi", "Dakshina Kannada"
    ],
    "Belagavi Division": [
        "Belagavi", "Dharwad", "Gadag", "Haveri",
        "Vijayapura", "Bagalkot", "Uttara Kannada"
    ],
    "Kalaburagi Division": [
        "Kalaburagi", "Bidar", "Raichur", "Koppal",
        "Yadgir", "Ballari", "Vijayanagara"
    ]
}

# A simple bounding box/centroid based mock for demonstration
# In production, use reverse geocoding via Nominatim/Google Maps
# Format: "District": (latitude, longitude) roughly centered
DISTRICT_CENTROIDS = {
    "Bengaluru Urban": (12.9716, 77.5946),
    "Mysuru": (12.2958, 76.6394),
    "Belagavi": (15.8497, 74.4977),
    "Kalaburagi": (17.3297, 76.8343),
    "Mangaluru (Dakshina Kannada)": (12.9141, 74.8560), # Using Mangaluru for DK
    "Dakshina Kannada": (12.9141, 74.8560),
    "Udupi": (13.3409, 74.7421),
    "Shivamogga": (13.9299, 75.5681),
    "Hubballi (Dharwad)": (15.3647, 75.1240),
    "Dharwad": (15.4589, 75.0078),
    "Tumakuru": (13.3392, 77.1016),
    # Add more as needed. For unmapped, we calculate nearest centroid.
}

def get_division_for_district(district: str) -> str:
    """Find the division for a given district. Returns 'Unknown Division' if not found."""
    # Normalize input
    district_norm = district.lower().replace(" district", "").strip()
    
    for div, districts in KARNATAKA_DIVISIONS.items():
        for d in districts:
            if d.lower() in district_norm or district_norm in d.lower():
                return div
                
    return "Unknown Division"

def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great circle distance between two points on the earth (specified in decimal degrees)"""
    # Convert decimal degrees to radians
    lon1, lat1, lon2, lat2 = map(math.radians, [lon1, lat1, lon2, lat2])

    # Haversine formula
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a))
    r = 6371 # Radius of earth in kilometers
    return c * r

def map_location_to_district(latitude: float, longitude: float) -> Tuple[str, str]:
    """
    Map a GPS coordinate to the nearest Karnataka district and division.
    Uses nearest centroid calculation.
    Returns: (district_name, division_name)
    """
    if not latitude or not longitude:
        return "Unknown District", "Unknown Division"
        
    try:
        lat = float(latitude)
        lon = float(longitude)
    except (ValueError, TypeError):
        return "Unknown District", "Unknown Division"
        
    min_distance = float('inf')
    closest_district = "Bengaluru Urban" # Default fallback
    
    for district, (d_lat, d_lon) in DISTRICT_CENTROIDS.items():
        dist = calculate_distance(lat, lon, d_lat, d_lon)
        if dist < min_distance:
            min_distance = dist
            closest_district = district
            
    # Map back to standard names
    if closest_district == "Mangaluru (Dakshina Kannada)":
        closest_district = "Dakshina Kannada"
    elif closest_district == "Hubballi (Dharwad)":
        closest_district = "Dharwad"
        
    division = get_division_for_district(closest_district)
    
    return closest_district, division

def get_all_divisions():
    return list(KARNATAKA_DIVISIONS.keys())

def get_districts_in_division(division: str):
    return KARNATAKA_DIVISIONS.get(division, [])
