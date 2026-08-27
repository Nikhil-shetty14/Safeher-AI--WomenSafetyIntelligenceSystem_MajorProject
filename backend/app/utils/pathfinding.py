import math
import heapq
from typing import List, Tuple, Dict
from app.utils.geo_mapping import calculate_distance

class Node:
    def __init__(self, lat: float, lng: float, grid_x: int, grid_y: int):
        self.lat = lat
        self.lng = lng
        self.grid_x = grid_x
        self.grid_y = grid_y
        
        self.g = 0.0 # Cost from start
        self.h = 0.0 # Heuristic distance to end
        self.f = 0.0 # Total cost
        self.parent = None
        self.danger_weight = 1.0

    def __lt__(self, other):
        return self.f < other.f

class GridAStar:
    def __init__(self, start_lat: float, start_lng: float, end_lat: float, end_lng: float, grid_resolution: int = 25):
        """
        grid_resolution: Number of cells along the longest axis.
        """
        self.start_lat = start_lat
        self.start_lng = start_lng
        self.end_lat = end_lat
        self.end_lng = end_lng
        self.grid_resolution = grid_resolution
        
        # Calculate bounding box with a 20% margin
        min_lat, max_lat = min(start_lat, end_lat), max(start_lat, end_lat)
        min_lng, max_lng = min(start_lng, end_lng), max(start_lng, end_lng)
        
        lat_diff = max(max_lat - min_lat, 0.001)
        lng_diff = max(max_lng - min_lng, 0.001)
        
        self.min_lat = min_lat - (lat_diff * 0.2)
        self.max_lat = max_lat + (lat_diff * 0.2)
        self.min_lng = min_lng - (lng_diff * 0.2)
        self.max_lng = max_lng + (lng_diff * 0.2)
        
        # Calculate step sizes
        self.lat_step = (self.max_lat - self.min_lat) / grid_resolution
        self.lng_step = (self.max_lng - self.min_lng) / grid_resolution
        
        self.grid_width = grid_resolution + 1
        self.grid_height = grid_resolution + 1
        
        self.grid = []
        for x in range(self.grid_width):
            col = []
            for y in range(self.grid_height):
                lat = self.min_lat + (x * self.lat_step)
                lng = self.min_lng + (y * self.lng_step)
                col.append(Node(lat, lng, x, y))
            self.grid.append(col)

    def _get_grid_indices(self, lat: float, lng: float) -> Tuple[int, int]:
        x = int(round((lat - self.min_lat) / self.lat_step))
        y = int(round((lng - self.min_lng) / self.lng_step))
        x = max(0, min(x, self.grid_width - 1))
        y = max(0, min(y, self.grid_height - 1))
        return x, y

    def apply_danger_zones(self, danger_zones: List[Dict]):
        """
        danger_zones: [{'latitude': float, 'longitude': float, 'radius_km': float, 'risk_score': float}]
        """
        for x in range(self.grid_width):
            for y in range(self.grid_height):
                node = self.grid[x][y]
                max_penalty = 0
                for zone in danger_zones:
                    z_lat = zone.get('latitude', 0)
                    z_lng = zone.get('longitude', 0)
                    r_km = zone.get('radius_km', 0.5)
                    score = zone.get('risk_score', 50)
                    
                    dist = calculate_distance(node.lat, node.lng, z_lat, z_lng)
                    if dist < r_km:
                        # Higher penalty the closer to the center, up to the risk_score
                        penalty = (1 - (dist / r_km)) * (score / 10.0)
                        if penalty > max_penalty:
                            max_penalty = penalty
                # Base weight is 1.0, add penalty
                node.danger_weight = 1.0 + max_penalty

    def _get_neighbors(self, node: Node) -> List[Node]:
        neighbors = []
        # 8-directional movement
        directions = [
            (-1, 0), (1, 0), (0, -1), (0, 1),
            (-1, -1), (-1, 1), (1, -1), (1, 1)
        ]
        for dx, dy in directions:
            nx, ny = node.grid_x + dx, node.grid_y + dy
            if 0 <= nx < self.grid_width and 0 <= ny < self.grid_height:
                neighbors.append(self.grid[nx][ny])
        return neighbors

    def find_path(self) -> List[Dict[str, float]]:
        start_x, start_y = self._get_grid_indices(self.start_lat, self.start_lng)
        end_x, end_y = self._get_grid_indices(self.end_lat, self.end_lng)
        
        start_node = self.grid[start_x][start_y]
        end_node = self.grid[end_x][end_y]
        
        open_list = []
        closed_set = set()
        
        heapq.heappush(open_list, start_node)
        
        while open_list:
            current_node = heapq.heappop(open_list)
            
            if current_node.grid_x == end_node.grid_x and current_node.grid_y == end_node.grid_y:
                # Path found
                path = []
                curr = current_node
                while curr is not None:
                    path.append({"latitude": curr.lat, "longitude": curr.lng})
                    curr = curr.parent
                return path[::-1] # Reverse to get start -> end
            
            closed_set.add((current_node.grid_x, current_node.grid_y))
            
            for neighbor in self._get_neighbors(current_node):
                if (neighbor.grid_x, neighbor.grid_y) in closed_set:
                    continue
                
                # Distance between current and neighbor
                dist = calculate_distance(current_node.lat, current_node.lng, neighbor.lat, neighbor.lng)
                
                # Apply danger weight to cost
                tentative_g = current_node.g + (dist * neighbor.danger_weight)
                
                in_open = False
                for open_node in open_list:
                    if open_node.grid_x == neighbor.grid_x and open_node.grid_y == neighbor.grid_y:
                        in_open = True
                        if tentative_g < neighbor.g:
                            neighbor.g = tentative_g
                            neighbor.f = neighbor.g + neighbor.h
                            neighbor.parent = current_node
                            # Re-heapify is slow, but we can just push it again (lazy update)
                            heapq.heappush(open_list, neighbor)
                        break
                
                if not in_open:
                    neighbor.g = tentative_g
                    neighbor.h = calculate_distance(neighbor.lat, neighbor.lng, end_node.lat, end_node.lng)
                    neighbor.f = neighbor.g + neighbor.h
                    neighbor.parent = current_node
                    heapq.heappush(open_list, neighbor)
                    
        # Fallback if no path found
        return [{"latitude": self.start_lat, "longitude": self.start_lng}, 
                {"latitude": self.end_lat, "longitude": self.end_lng}]

def calculate_safe_route(start_lat: float, start_lng: float, end_lat: float, end_lng: float, danger_zones: List[Dict]) -> List[Dict]:
    """
    Generate a safe route bypassing danger zones using A* algorithm.
    """
    pathfinder = GridAStar(start_lat, start_lng, end_lat, end_lng, grid_resolution=25)
    pathfinder.apply_danger_zones(danger_zones)
    return pathfinder.find_path()
