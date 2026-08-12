extends RefCounted

const GENERATOR_VERSION: String = "0.3.0"
const MAX_ATTEMPTS: int = 32
const FALLBACK_SEED: int = 0

const BANDS: Dictionary = {
    "shoal": {
        "width_min": 9,
        "width_max": 11,
        "height": 5,
        "flips_min": 1,
        "flips_max": 2,
        "solution_min": 11,
        "solution_max": 18,
        "branch_min": 1,
        "branch_max": 4,
        "dead_min": 0,
        "dead_max": 12,
        "route_min": 2,
        "route_max": 8,
        "excursion_min": 0,
        "excursion_max": 20,
        "loop_count": 1,
        "budget_slack": 8,
    },
    "swell": {
        "width_min": 14,
        "width_max": 17,
        "height": 7,
        "flips_min": 2,
        "flips_max": 4,
        "solution_min": 17,
        "solution_max": 30,
        "branch_min": 1,
        "branch_max": 6,
        "dead_min": 0,
        "dead_max": 24,
        "route_min": 4,
        "route_max": 12,
        "excursion_min": 0,
        "excursion_max": 32,
        "loop_count": 2,
        "budget_slack": 10,
    },
    "storm": {
        "width_min": 21,
        "width_max": 25,
        "height": 9,
        "flips_min": 4,
        "flips_max": 7,
        "solution_min": 27,
        "solution_max": 42,
        "branch_min": 1,
        "branch_max": 8,
        "dead_min": 0,
        "dead_max": 40,
        "route_min": 6,
        "route_max": 24,
        "excursion_min": 0,
        "excursion_max": 48,
        "loop_count": 3,
        "budget_slack": 14,
    },
}

const TILE_BLOCKED: int = 0
const TILE_STABLE: int = 1
const TILE_LOW: int = 2
const TILE_HIGH: int = 3

const MOVE_ACTIONS: Array[Dictionary] = [
    {"id": "move-up", "dx": 0, "dy": -1},
    {"id": "move-right", "dx": 1, "dy": 0},
    {"id": "move-down", "dx": 0, "dy": 1},
    {"id": "move-left", "dx": -1, "dy": 0},
]

const LevelSpec = preload("res://game_packs/tide_ledger/level_spec.gd")


func generate(seed_value: int, difficulty: String, generator_version: String = GENERATOR_VERSION):
    var band := _band(difficulty)
    var normalized_version := generator_version if not generator_version.is_empty() else GENERATOR_VERSION
    for attempt: int in range(1, MAX_ATTEMPTS + 1):
        var candidate_payload := _build_payload(seed_value, difficulty, normalized_version, attempt, false)
        var candidate = LevelSpec.new(candidate_payload)
        var proof := solve(candidate)
        if bool(proof.get("solvable", false)) and _within_band(proof.get("metrics", {}), band):
            candidate_payload["measured"] = proof["metrics"]
            candidate_payload["generation_attempts"] = attempt
            candidate_payload["used_fallback"] = false
            return LevelSpec.new(candidate_payload)

    var fallback_payload := _build_payload(seed_value, difficulty, normalized_version, MAX_ATTEMPTS, true)
    var fallback_candidate = LevelSpec.new(fallback_payload)
    var finalized_fallback = _finalize_fallback(fallback_candidate, difficulty)
    if finalized_fallback == null:
        push_error("Tide Ledger fallback failed its deterministic solver or difficulty bounds")
        return null
    return finalized_fallback


func _finalize_fallback(candidate, difficulty: String):
    var band := _band(difficulty)
    var proof := solve(candidate)
    if not bool(proof.get("solvable", false)) or not _within_band(proof.get("metrics", {}), band):
        return null
    var payload: Dictionary = candidate.to_dict()
    payload["measured"] = proof["metrics"]
    payload["generation_attempts"] = MAX_ATTEMPTS
    payload["used_fallback"] = true
    return LevelSpec.new(payload)


func solve(spec) -> Dictionary:
    var data: Dictionary = spec.to_dict()
    var width := int(data.get("width", 0))
    var height := int(data.get("height", 0))
    var tiles: Array = data.get("tiles", [])
    var markers: Array = data.get("markers", [])
    var start := int(data.get("start", -1))
    var goal := int(data.get("goal", -1))
    var initial_tide := int(data.get("initial_tide", 0))
    var corridor_y := int(data.get("corridor_y", height / 2))
    var cell_count := width * height
    if width <= 0 or height <= 0 or tiles.size() != cell_count or start < 0 or goal < 0:
        return {"solvable": false, "metrics": {}}

    var marker_mask := 0
    for marker_index: int in range(markers.size()):
        if int(markers[marker_index]) == start:
            marker_mask |= 1 << marker_index
    var complete_mask := (1 << markers.size()) - 1
    var start_key := _state_key(start, initial_tide, marker_mask, cell_count)
    var queue: Array[int] = [start_key]
    var distances: Dictionary = {start_key: 0}
    var flips: Dictionary = {start_key: 0}
    var parents: Dictionary = {}
    var parent_actions: Dictionary = {}
    var goal_key := -1
    var front := 0

    while front < queue.size():
        var state_key: int = queue[front]
        front += 1
        var state := _decode_state(state_key, cell_count)
        var position: int = state["position"]
        var tide: int = state["tide"]
        var collected: int = state["mask"]
        if position == goal and collected == complete_mask:
            goal_key = state_key
            break

        var next_states: Array[Dictionary] = []
        next_states.append(
            {
                "key": _state_key(position, 1 - tide, collected, cell_count),
                "action": "flip-tide",
                "flip": 1,
            }
        )
        for move: Dictionary in _legal_moves(data, position, tide):
            var next_position: int = int(move["position"])
            var next_mask := collected
            for marker_index: int in range(markers.size()):
                if int(markers[marker_index]) == next_position:
                    next_mask |= 1 << marker_index
            next_states.append(
                {
                    "key": _state_key(next_position, tide, next_mask, cell_count),
                    "action": str(move["action"]),
                    "flip": 0,
                }
            )
        for next_state: Dictionary in next_states:
            var next_key: int = int(next_state["key"])
            if distances.has(next_key):
                continue
            distances[next_key] = int(distances[state_key]) + 1
            flips[next_key] = int(flips[state_key]) + int(next_state["flip"])
            parents[next_key] = state_key
            parent_actions[next_key] = next_state["action"]
            queue.append(next_key)

    if goal_key < 0:
        return {"solvable": false, "metrics": {}, "visited_states": distances.size()}

    var solution_actions: Array[String] = []
    var cursor := goal_key
    while cursor != start_key:
        solution_actions.append(str(parent_actions[cursor]))
        cursor = int(parents[cursor])
    solution_actions.reverse()

    var topology_seen: Dictionary = {}
    var dead_end_cells: Dictionary = {}
    var route_choice_points: Dictionary = {}
    var maximum_branching := 0
    var maximum_dead_end_excursion := 0
    for state_key_variant: Variant in distances.keys():
        var state := _decode_state(int(state_key_variant), cell_count)
        var position: int = state["position"]
        var tide: int = state["tide"]
        var topology_key := position * 2 + tide
        if topology_seen.has(topology_key):
            continue
        topology_seen[topology_key] = true
        var movement_count := _legal_moves(data, position, tide).size()
        maximum_branching = maxi(maximum_branching, movement_count)
        if movement_count >= 3 and position != start and position != goal:
            route_choice_points[position] = true
        if movement_count == 1 and position != start and position != goal:
            dead_end_cells[topology_key] = true
            maximum_dead_end_excursion = maxi(maximum_dead_end_excursion, int(distances[state_key_variant]))

    var off_corridor_marker_count := 0
    for marker: Variant in markers:
        if int(marker) / width != corridor_y:
            off_corridor_marker_count += 1
    if off_corridor_marker_count <= 0:
        return {"solvable": false, "metrics": {}, "visited_states": distances.size()}

    var metrics := {
        "solution_length": int(distances[goal_key]),
        "required_tide_flips": int(flips[goal_key]),
        "branching": maximum_branching,
        "dead_ends": dead_end_cells.size(),
        "route_choices": route_choice_points.size(),
        "dead_end_excursion": maximum_dead_end_excursion,
        "off_corridor_markers": off_corridor_marker_count,
    }
    return {
        "solvable": true,
        "metrics": metrics,
        "solution_actions": solution_actions,
        "visited_states": distances.size(),
        "proof_hash": spec.content_hash(),
    }


func derive_level_seed(root_seed: int, level_index: int, difficulty: String, generator_version: String = GENERATOR_VERSION) -> int:
    var mixed := _mix(root_seed)
    mixed = _mix(mixed ^ (level_index * 7919))
    mixed = _mix(mixed ^ _stable_string_hash(difficulty))
    mixed = _mix(mixed ^ _stable_string_hash(generator_version))
    return mixed


func band_bounds(difficulty: String) -> Dictionary:
    return _band(difficulty).duplicate(true)


func _build_payload(
    seed_value: int,
    difficulty: String,
    generator_version: String,
    attempt: int,
    fallback: bool,
) -> Dictionary:
    var band := _band(difficulty)
    var rng_state := _mix(seed_value ^ (attempt * 104729) ^ _stable_string_hash(generator_version))
    var random_value := _random_range(rng_state, int(band["width_min"]), int(band["width_max"]))
    rng_state = int(random_value[0])
    var width := int(random_value[1])
    random_value = _random_range(rng_state, int(band["flips_min"]), int(band["flips_max"]))
    rng_state = int(random_value[0])
    var flips := int(random_value[1])
    random_value = _random_range(rng_state, int(band["branch_min"]), int(band["branch_max"]))
    rng_state = int(random_value[0])
    var loop_count := int(band["loop_count"])
    if fallback:
        width = int((int(band["width_min"]) + int(band["width_max"])) / 2)
        flips = int(band["flips_min"])
        loop_count = int(band["loop_count"])
    elif seed_value == FALLBACK_SEED:
        width = 5
        flips = 0
        loop_count = 0

    var height := int(band["height"])
    var main_y := int(height / 2)
    var tiles: Array[int] = []
    tiles.resize(width * height)
    tiles.fill(TILE_BLOCKED)
    var boundaries: Array[int] = []
    for boundary_index: int in range(flips):
        var base := int(float((boundary_index + 1) * (width - 1)) / float(flips + 1))
        var boundary_offset := 0
        if not fallback:
            random_value = _random_range(rng_state, -1, 1)
            rng_state = int(random_value[0])
            boundary_offset = int(random_value[1])
        var boundary := clampi(base + boundary_offset, 1, width - 2)
        while boundaries.has(boundary):
            boundary = clampi(boundary + 1, 1, width - 2)
        boundaries.append(boundary)
    boundaries.sort()

    var tide := 0
    for x: int in range(width):
        if boundaries.has(x):
            tide = 1 - tide
        var tile := TILE_STABLE if x == 0 else (TILE_LOW if tide == 0 else TILE_HIGH)
        tiles[_index(x, main_y, width)] = tile

    var branch_cells: Array[int] = []
    for loop_index: int in range(loop_count):
        var segment_width := maxi(3, int((width - 4) / maxi(1, loop_count)))
        var start_base := 2 + loop_index * segment_width
        var attachment := clampi(start_base, 2, width - 4)
        var route_end := mini(width - 3, attachment + segment_width - 1)
        var lane_y := main_y - 1 if loop_index % 2 == 0 else main_y + 1
        var route_tide := 1 if loop_index % 2 == 0 else 0
        if fallback:
            attachment = clampi(2 + loop_index * segment_width, 2, width - 4)
            route_end = mini(width - 3, attachment + segment_width - 1)
        else:
            var start_max := mini(width - 4, attachment + maxi(0, segment_width - 3))
            random_value = _random_range(rng_state, attachment, start_max)
            rng_state = int(random_value[0])
            attachment = int(random_value[1])
            random_value = _random_range(rng_state, attachment + 2, mini(width - 3, attachment + segment_width))
            rng_state = int(random_value[0])
            route_end = int(random_value[1])
            random_value = _random_range(rng_state, 0, 1)
            rng_state = int(random_value[0])
            lane_y = main_y - 1 if int(random_value[1]) == 0 else main_y + 1
            random_value = _random_range(rng_state, 0, 1)
            rng_state = int(random_value[0])
            route_tide = int(random_value[1])
        tiles[_index(attachment, main_y, width)] = TILE_STABLE
        tiles[_index(route_end, main_y, width)] = TILE_STABLE
        for route_x: int in range(attachment, route_end + 1):
            var route_position := _index(route_x, lane_y, width)
            tiles[route_position] = TILE_STABLE if route_x == attachment or route_x == route_end else (TILE_LOW if route_tide == 0 else TILE_HIGH)
            if route_x > attachment and route_x < route_end:
                branch_cells.append(route_position)

    var marker_xs: Array[int] = [
        clampi(int(width / 3), 1, width - 2),
        clampi(int(width * 2 / 3), 1, width - 2),
    ]
    for marker_index: int in range(marker_xs.size()):
        while marker_xs.count(marker_xs[marker_index]) > 1:
            marker_xs[marker_index] += 1
            if marker_xs[marker_index] >= width - 1:
                marker_xs[marker_index] = 1

    var required_branch_marker := branch_cells[0] if not branch_cells.is_empty() else -1
    return {
        "schema_version": 1,
        "seed": seed_value,
        "difficulty": difficulty,
        "generator_version": generator_version,
        "width": width,
        "height": height,
        "corridor_y": main_y,
        "tiles": tiles,
        "start": _index(0, main_y, width),
        "markers": [
            _index(marker_xs[0], main_y, width),
            required_branch_marker,
            _index(marker_xs[1], main_y, width),
        ],
        "goal": _index(width - 1, main_y, width),
        "initial_tide": 0,
        "action_budget_slack": int(band["budget_slack"]),
        "measured": {},
        "generation_attempts": attempt,
        "used_fallback": fallback,
    }


func _legal_moves(data: Dictionary, position: int, tide: int) -> Array[Dictionary]:
    var width := int(data["width"])
    var height := int(data["height"])
    var x := position % width
    var y := int(position / width)
    var moves: Array[Dictionary] = []
    for move: Dictionary in MOVE_ACTIONS:
        var next_x := x + int(move["dx"])
        var next_y := y + int(move["dy"])
        if next_x < 0 or next_x >= width or next_y < 0 or next_y >= height:
            continue
        var next_position := _index(next_x, next_y, width)
        if _passable(int(data["tiles"][next_position]), tide):
            moves.append({"action": move["id"], "position": next_position})
    return moves


func _passable(tile: int, tide: int) -> bool:
    return tile == TILE_STABLE or (tile == TILE_LOW and tide == 0) or (tile == TILE_HIGH and tide == 1)


func _within_band(metrics: Dictionary, band: Dictionary) -> bool:
    return (
        int(metrics.get("solution_length", -1)) >= int(band["solution_min"])
        and int(metrics.get("solution_length", -1)) <= int(band["solution_max"])
        and int(metrics.get("required_tide_flips", -1)) >= int(band["flips_min"])
        and int(metrics.get("required_tide_flips", -1)) <= int(band["flips_max"])
        and int(metrics.get("branching", -1)) >= int(band["branch_min"])
        and int(metrics.get("branching", -1)) <= int(band["branch_max"])
        and int(metrics.get("dead_ends", -1)) >= int(band["dead_min"])
        and int(metrics.get("dead_ends", -1)) <= int(band["dead_max"])
        and int(metrics.get("route_choices", -1)) >= int(band["route_min"])
        and int(metrics.get("route_choices", -1)) <= int(band["route_max"])
        and int(metrics.get("dead_end_excursion", -1)) >= int(band["excursion_min"])
        and int(metrics.get("dead_end_excursion", -1)) <= int(band["excursion_max"])
    )


func _band(difficulty: String) -> Dictionary:
    if BANDS.has(difficulty):
        return BANDS[difficulty]
    return BANDS["shoal"]


func _state_key(position: int, tide: int, mask: int, cell_count: int) -> int:
    return ((mask * 2 + tide) * cell_count) + position


func _decode_state(state_key: int, cell_count: int) -> Dictionary:
    var position := state_key % cell_count
    var phase_state := int(state_key / cell_count)
    return {"position": position, "tide": phase_state % 2, "mask": int(phase_state / 2)}


func _index(x: int, y: int, width: int) -> int:
    return y * width + x


func _mix(value: int) -> int:
    var mixed := value ^ 0x45D9F3B
    mixed = (mixed * 0x45D9F3B) & 0x7FFFFFFF
    mixed = mixed ^ (mixed >> 16)
    mixed = (mixed * 0x45D9F3B) & 0x7FFFFFFF
    return mixed ^ (mixed >> 16)


func _stable_string_hash(value: String) -> int:
    var result := 7
    for byte: int in value.to_utf8_buffer():
        result = (result * 31 + byte) & 0x7FFFFFFF
    return result


func _random_range(state: int, minimum: int, maximum: int) -> Array:
    var next_state := _next_random(state)
    var span := maxi(1, maximum - minimum + 1)
    return [next_state, minimum + (next_state % span)]


func _next_random(state: int) -> int:
    return (state * 1103515245 + 12345) & 0x7FFFFFFF
