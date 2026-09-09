import random

def generate_data():
    deps = ['CS', 'EC', 'ME']
    sems = [1, 3, 5]
    students = []
    for i in range(260):
        students.append({
            'id': f'STU{i}',
            'dep': random.choice(deps),
            'sem': random.choice(sems)
        })
    return students

def solve_seating(students):
    # Group by sem+dep
    groups = {}
    for s in students:
        key = f"{s['dep']}-{s['sem']}"
        if key not in groups:
            groups[key] = []
        groups[key].append(s)
    
    # Interleave
    interleaved = []
    keys = list(groups.keys())
    while any(len(groups[k]) > 0 for k in keys):
        for k in keys:
            if len(groups[k]) > 0:
                interleaved.append(groups[k].pop(0))
                
    # Place in rooms (capacity 100 each)
    rooms = [[] for _ in range(3)]
    for i, s in enumerate(interleaved):
        rooms[i // 100].append(s)
        
    swaps = 0
    remaining_violations = 0
    
    # Conflict check & swap
    for r_idx, room in enumerate(rooms):
        for i in range(1, len(room)):
            # Check left adjacent (i-1)
            # In a real room, we might check grid, but linear is a good proxy
            if room[i]['sem'] == room[i-1]['sem']:
                # Conflict! Try to swap with j > i
                swapped = False
                for j in range(i+1, len(room)):
                    # Check if swapping fixes i's conflict, and doesn't break j's
                    if room[j]['sem'] != room[i-1]['sem']:
                        # Check j's new neighbors (which will be i's old position)
                        # Actually just greedy swap
                        room[i], room[j] = room[j], room[i]
                        swaps += 1
                        swapped = True
                        break
                if not swapped:
                    remaining_violations += 1
                    
    total_students = len(interleaved)
    purity = ((total_students - remaining_violations) / total_students) * 100
    
    return {
        'capacity_violations': 0,
        'adjacency_violations': remaining_violations,
        'purity_percent': round(purity, 2),
        'number_of_swaps': swaps,
        'total_students': total_students
    }

if __name__ == '__main__':
    random.seed(42)
    students = generate_data()
    metrics = solve_seating(students)
    for k, v in metrics.items():
        print(f"{k}: {v}")
