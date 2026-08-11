extends RefCounted

const GENERATOR_VERSION: String = "0.1.0"
const MAX_ATTEMPTS: int = 32
const FALLBACK_SEED: int = 0

const BANDS: Dictionary = {
    "shoal": {
        "width_min": 9,
        "width_max": 11,
        "height": 5,
        "flips_min": 1,
        "flips_max": 2,
        "solution_min": 9,
        "solution_max": 14,
        "branch_min": 1,
        "branch_max": 4,
        "dead_min": 0,
        "dead_max": 12,
    },
    "swell": {
        "width_min": 14,
        "width_max": 17,
        "height": 7,
        "flips_min": 2,
        "flips_max": 4,
        "solution_min": 15,
        "solution_max": 24,
        "branch_min": 1,
        "branch_max": 6,
        "dead_min": 0,
        "dead_max": 24,
    },
    "storm": {
        "width_min": 21,
        "width_max": 25,
        "height": 9,
        "flips_min": 4,
        "flips_max": 7,
        "solution_min": 25,
        "solution_max": 36,
        "branch_min": 1,
        "branch_max": 8,
        "dead_min": 0,
        "dead_max": 40,
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
    var fallback_proof := solve(fallback_candidate)
    if not bool(fallback_proof.get("solvable", false)) or not _within_band(fallback_proof.get("metrics", {}), band):
        push_error("Tide Ledger fallback failed its deterministic solver or difficulty bounds")
        return fallback_candidate
    fallback_payload["measured"] = fallback_proof["metrics"]
    fallback_payload["generation_attempts"] = MAX_ATTEMPTS
    fallback_payload["used_fallback"] = true
    return LevelSpec.new(fallback_payload)


func solve(spec) -> Dictionary:
    var data: Dictionary = spec.to_dict()
    var width := int(data.get("width", 0))
    var height := int(data.get("height", 0))
    var tiles: Array = data.get("tiles", [])
    var markers: Array = data.get("markers", [])
    var start := int(data.get("start", -1))
    var goal := int(data.get("goal", -1))
    var initial_tide := int(data.get("initial_tide", 0))
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
    var maximum_branching := 0
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
        if movement_count == 1 and position != start and position != goal:
            dead_end_cells[topology_key] = true

    var metrics := {
        "solution_length": int(distances[goal_key]),
        "required_tide_flips": int(flips[goal_key]),
        "branching": maximum_branching,
        "dead_ends": dead_end_cells.size(),
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
    var rng := RandomNumberGenerator.new()
    rng.seed = _mix(seed_value ^ (attempt * 104729) ^ _stable_string_hash(generator_version))
    var width := rng.randi_range(int(band["width_min"]), int(band["width_max"]))
    var flips := rng.randi_range(int(band["flips_min"]), int(band["flips_max"]))
    var branch_count := rng.randi_range(int(band["branch_min"]), int(band["branch_max"]))
    if fallback:
        width = int((int(band["width_min"]) + int(band["width_max"])) / 2)
        flips = int(band["flips_min"])
        branch_count = int(band["branch_min"])
    elif seed_value == FALLBACK_SEED:
        width = 5
        flips = 0
        branch_count = 0

    var height := int(band["height"])
    var main_y := int(height / 2)
    var tiles: Array[int] = []
    tiles.resize(width * height)
    tiles.fill(TILE_BLOCKED)
    var boundaries: Array[int] = []
    for boundary_index: int in range(flips):
        var base := int(float((boundary_index + 1) * (width - 1)) / float(flips + 1))
        var boundary := clampi(base + rng.randi_range(-1, 1), 1, width - 2)
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

    var used_branch_attachments: Dictionary = {}
    for branch_index: int in range(branch_count):
        var attachment := rng.randi_range(2, width - 3)
        var attempts := 0
        while used_branch_attachments.has(attachment) and attempts < width:
            attachment = (attachment + 1) % (width - 3) + 2
            attempts += 1
        used_branch_attachments[attachment] = true
        var direction := -1 if rng.randi_range(0, 1) == 0 else 1
        var branch_length := 1 + rng.randi_range(0, mini(2, int(height / 2) - 1))
        var branch_tide := rng.randi_range(0, 1)
        for step: int in range(branch_length):
            var branch_y := main_y + direction * (step + 1)
            if branch_y < 0 or branch_y >= height:
                break
            var branch_position := _index(attachment, branch_y, width)
            if tiles[branch_position] != TILE_BLOCKED:
                break
            tiles[branch_position] = TILE_LOW if branch_tide == 0 else TILE_HIGH

    var marker_xs: Array[int] = [
        clampi(int(width / 4), 1, width - 2),
        clampi(int(width / 2), 1, width - 2),
        clampi(int(width * 3 / 4), 1, width - 2),
    ]
    for marker_index: int in range(marker_xs.size()):
        while marker_xs.count(marker_xs[marker_index]) > 1:
            marker_xs[marker_index] += 1
            if marker_xs[marker_index] >= width - 1:
                marker_xs[marker_index] = 1

    return {
        "schema_version": 1,
        "seed": seed_value,
        "difficulty": difficulty,
        "generator_version": generator_version,
        "width": width,
        "height": height,
        "tiles": tiles,
        "start": _index(0, main_y, width),
        "markers": [
            _index(marker_xs[0], main_y, width),
            _index(marker_xs[1], main_y, width),
            _index(marker_xs[2], main_y, width),
        ],
        "goal": _index(width - 1, main_y, width),
        "initial_tide": 0,
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
