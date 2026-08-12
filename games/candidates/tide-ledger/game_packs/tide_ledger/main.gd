extends NofiGamePack

const GENERATOR = preload("res://game_packs/tide_ledger/level_generator.gd")
const VIEW = preload("res://game_packs/tide_ledger/view.gd")
const GENERATOR_VERSION: String = "0.3.0"
const TILE_STABLE: int = 1
const TILE_LOW: int = 2
const TILE_HIGH: int = 3

const DIFFICULTIES: Array[String] = ["shoal", "swell", "storm"]
const MOVE_ACTION_IDS: Array[String] = ["move-up", "move-right", "move-down", "move-left"]

var _generator = GENERATOR.new()
var _view
var _root_seed: int = 0
var _level_index: int = 0
var _difficulty: String = "shoal"
var _generator_version: String = GENERATOR_VERSION
var _level_seed: int = 0
var _level_spec
var _position: int = 0
var _tide_phase: int = 0
var _markers_mask: int = 0
var _actions_applied: int = 0
var _action_limit: int = 30
var _complete: bool = false
var _failed: bool = false
var _initialized: bool = false
var _current_actions: Array[String] = []
var _level_history: Array[Dictionary] = []


func _ready() -> void:
    _view = Node2D.new()
    _view.name = "TideLedgerView"
    _view.set_script(VIEW)
    add_child(_view)
    reset_game(1)


func _ensure_initialized() -> void:
    if not _initialized:
        reset_game(1)


func _unhandled_input(event: InputEvent) -> void:
    if event is InputEventKey and event.pressed and not event.echo:
        var key_event := event as InputEventKey
        var action := _key_to_action(key_event.keycode)
        if not action.is_empty():
            apply_action({"id": action})
            get_viewport().set_input_as_handled()
    elif event is InputEventScreenTouch and event.pressed:
        var touch := event as InputEventScreenTouch
        var action: String = ""
        if _view != null:
            action = str(_view.call("action_for_screen_point", touch.position))
        if not action.is_empty():
            apply_action({"id": action})
            get_viewport().set_input_as_handled()


func reset_game(seed_value: int) -> void:
    super.reset_game(seed_value)
    _initialized = true
    _generator_version = GENERATOR_VERSION
    _root_seed = seed_value
    _level_index = 0
    _difficulty = DIFFICULTIES[absi(seed_value) % DIFFICULTIES.size()]
    _level_history.clear()
    _load_level(_level_index, _difficulty, true)


func get_observation() -> Dictionary:
    _ensure_initialized()
    var level: Dictionary = {}
    if _level_spec != null:
        level = _level_spec.to_dict()
    level["player_position"] = _position
    return {
        "schema_version": 1,
        "game_id": "tide-ledger",
        "seed": _level_seed,
        "root_seed": _root_seed,
        "level_index": _level_index,
        "difficulty": _difficulty,
        "generator_version": _generator_version,
        "level_spec_hash": _level_spec.content_hash() if _level_spec != null else "",
        "tide_phase": _tide_phase,
        "markers_mask": _markers_mask,
        "marker_count": _collected_marker_count(),
        "actions_applied": _actions_applied,
        "action_limit": _action_limit,
        "complete": _complete,
        "failed": _failed,
        "level_available": _level_spec != null,
        "generation_failed": _level_spec == null and _failed,
        "level": level,
        "metrics": get_metrics(),
    }


func get_available_actions() -> Array[Dictionary]:
    _ensure_initialized()
    var actions: Array[Dictionary] = []
    if _level_spec == null:
        return actions
    if _complete:
        actions.append({"id": "restart", "kind": "control"})
        actions.append({"id": "next-level", "kind": "control"})
        return actions
    if _failed:
        actions.append({"id": "restart", "kind": "control"})
        return actions
    for action_id: String in MOVE_ACTION_IDS:
        var target := _target_for_action(action_id)
        if target >= 0 and _is_passable(target, _tide_phase):
            actions.append({"id": action_id, "kind": "movement"})
    actions.append({"id": "flip-tide", "kind": "tide"})
    actions.append({"id": "restart", "kind": "control"})
    return actions


func apply_action(action: Dictionary) -> Dictionary:
    _ensure_initialized()
    if _level_spec == null:
        return {"accepted": false, "reason": "level-unavailable"}
    var action_id := str(action.get("id", ""))
    if action_id.is_empty():
        return {"accepted": false, "reason": "missing-action-id"}
    if action_id == "restart":
        if not _load_level(_level_index, _difficulty, true):
            return {"accepted": false, "reason": "level-unavailable"}
        _record_action(action_id)
        return {"accepted": true, "action": action_id, "observation": get_observation()}
    if action_id == "next-level":
        if not _complete:
            return {"accepted": false, "reason": "level-not-complete"}
        _level_history.append(_current_level_record())
        _level_index += 1
        _difficulty = DIFFICULTIES[(_level_index + absi(_root_seed)) % DIFFICULTIES.size()]
        if not _load_level(_level_index, _difficulty, true):
            return {"accepted": false, "reason": "level-unavailable"}
        return {"accepted": true, "action": action_id}
    if action_id != "flip-tide" and not MOVE_ACTION_IDS.has(action_id):
        return {"accepted": false, "reason": "unknown-action"}
    if _complete or _failed:
        return {"accepted": false, "reason": "level-terminal"}

    if not _is_action_applicable(action_id):
        return {"accepted": false, "reason": "not-applicable"}

    if action_id == "flip-tide":
        _tide_phase = 1 - _tide_phase
    else:
        var target := _target_for_action(action_id)
        if target < 0 or not _is_passable(target, _tide_phase):
            return {"accepted": false, "reason": "blocked"}
        _position = target
        _collect_marker_if_present()

    _actions_applied += 1
    _record_action(action_id)
    if _position == int(_level_spec.get_value("goal", -1)) and _markers_mask == _all_markers_mask():
        _complete = true
        emit_gameplay_event("level-complete", {"level_index": _level_index, "level_spec_hash": _level_spec.content_hash()})
    elif _actions_applied >= _action_limit:
        _failed = true
        emit_gameplay_event("level-failed", {"level_index": _level_index, "level_spec_hash": _level_spec.content_hash()})
    _refresh_view()
    return {"accepted": true, "action": action_id, "observation": get_observation()}


func advance_simulation(ticks: int) -> void:
    if ticks < 0:
        return


func get_objectives() -> Array[Dictionary]:
    _ensure_initialized()
    if _level_spec == null:
        return []
    return [
        {"id": "stamp-markers", "complete": _markers_mask == _all_markers_mask()},
        {"id": "reach-lighthouse", "complete": _complete},
        {"id": "complete-level", "complete": _complete},
    ]


func get_metrics() -> Dictionary:
    _ensure_initialized()
    var measured: Dictionary = {}
    if _level_spec != null:
        measured = _level_spec.get_measured()
    return {
        "level_index": _level_index,
        "solution_length": int(measured.get("solution_length", 0)),
        "required_tide_flips": int(measured.get("required_tide_flips", 0)),
        "branching": int(measured.get("branching", 0)),
        "dead_ends": int(measured.get("dead_ends", 0)),
        "route_choices": int(measured.get("route_choices", 0)),
        "dead_end_excursion": int(measured.get("dead_end_excursion", 0)),
        "generator_attempts": _level_spec.generation_attempts() if _level_spec != null else 0,
        "used_fallback": _level_spec.used_fallback() if _level_spec != null else false,
        "actions_applied": _actions_applied,
        "action_limit": _action_limit,
        "action_budget_slack": int(_level_spec.get_value("action_budget_slack", 0)) if _level_spec != null else 0,
        "level_available": _level_spec != null,
    }


func save_replay() -> Dictionary:
    _ensure_initialized()
    if _level_spec == null:
        return {"schema_version": 1, "game_id": "tide-ledger", "error": "level-unavailable"}
    var levels := _level_history.duplicate(true)
    levels.append(_current_level_record())
    return {
        "schema_version": 1,
        "game_id": "tide-ledger",
        "seed": _level_seed,
        "root_seed": _root_seed,
        "level_index": _level_index,
        "difficulty": _difficulty,
        "generator_version": _generator_version,
        "level_spec_hash": _level_spec.content_hash(),
        "levels": levels,
    }


func restore_replay(replay: Dictionary) -> bool:
    _ensure_initialized()
    if str(replay.get("game_id", "")) != "tide-ledger":
        return false
    var levels: Array = replay.get("levels", [])
    if levels.is_empty():
        return false
    var replay_version := str(replay.get("generator_version", ""))
    if replay_version.is_empty() or replay_version != GENERATOR_VERSION:
        return false
    var before_restore := _capture_runtime_state()
    _root_seed = int(replay.get("root_seed", replay.get("seed", 0)))
    _generator_version = replay_version
    _level_history.clear()
    var restored := true
    for record_index_in_replay: int in range(levels.size()):
        var level_record: Variant = levels[record_index_in_replay]
        if not level_record is Dictionary:
            restored = false
            break
        var record: Dictionary = level_record
        var record_index := int(record.get("level_index", -1))
        var record_difficulty := str(record.get("difficulty", ""))
        var expected_hash := str(record.get("level_spec_hash", ""))
        if not DIFFICULTIES.has(record_difficulty) or int(record.get("root_seed", _root_seed)) != _root_seed:
            restored = false
            break
        if not _load_level(record_index, record_difficulty, true) or _level_spec == null:
            restored = false
            break
        if _level_spec.content_hash() != expected_hash or _level_seed != int(record.get("seed", _level_seed)) or _generator_version != str(record.get("generator_version", _generator_version)):
            restored = false
            break
        var actions: Array = record.get("actions", [])
        for recorded_action: Variant in actions:
            if not recorded_action is String:
                restored = false
                break
            var result := apply_action({"id": str(recorded_action)})
            if not bool(result.get("accepted", false)):
                restored = false
                break
        if not restored:
            break
        if not record.has("state") or not _replay_state_matches(record["state"]):
            restored = false
            break
        if record_index_in_replay < levels.size() - 1:
            _level_history.append(_current_level_record())
    if not restored:
        _restore_runtime_state(before_restore)
        return false
    if _level_spec == null:
        _restore_runtime_state(before_restore)
        return false
    var matches_replay: bool = (
        _level_index == int(replay.get("level_index", _level_index))
        and _level_seed == int(replay.get("seed", _level_seed))
        and _difficulty == str(replay.get("difficulty", _difficulty))
        and _level_spec.content_hash() == str(replay.get("level_spec_hash", _level_spec.content_hash()))
        and str(replay.get("generator_version", _generator_version)) == _generator_version
    )
    if not matches_replay:
        _restore_runtime_state(before_restore)
        return false
    return true


func _load_level(index: int, difficulty: String, clear_actions: bool) -> bool:
    _level_index = index
    _difficulty = difficulty if DIFFICULTIES.has(difficulty) else "shoal"
    _level_seed = _generator.derive_level_seed(_root_seed, _level_index, _difficulty, _generator_version)
    _level_spec = _generator.generate(_level_seed, _difficulty, _generator_version)
    if _level_spec == null:
        _position = -1
        _tide_phase = 0
        _markers_mask = 0
        _actions_applied = 0
        _action_limit = 0
        _complete = false
        _failed = true
        _current_actions.clear()
        _refresh_view()
        return false
    _position = int(_level_spec.get_value("start", 0))
    _tide_phase = int(_level_spec.get_value("initial_tide", 0))
    _markers_mask = 0
    _actions_applied = 0
    _action_limit = int(_level_spec.get_measured().get("solution_length", 8)) + int(_level_spec.get_value("action_budget_slack", 8))
    _complete = false
    _failed = false
    if clear_actions:
        _current_actions.clear()
    _collect_marker_if_present()
    _refresh_view()
    return true


func _target_for_action(action_id: String) -> int:
    var width := int(_level_spec.get_value("width", 0))
    var x := _position % width
    var y := int(_position / width)
    if action_id == "move-up":
        y -= 1
    elif action_id == "move-right":
        x += 1
    elif action_id == "move-down":
        y += 1
    elif action_id == "move-left":
        x -= 1
    var height := int(_level_spec.get_value("height", 0))
    if x < 0 or x >= width or y < 0 or y >= height:
        return -1
    return y * width + x


func _is_passable(position: int, tide: int) -> bool:
    if _level_spec == null or position < 0 or position >= _level_spec.get_tiles().size():
        return false
    var tile := int(_level_spec.get_tiles()[position])
    return tile == TILE_STABLE or (tile == TILE_LOW and tide == 0) or (tile == TILE_HIGH and tide == 1)


func _collect_marker_if_present() -> void:
    var markers: Array = _level_spec.get_markers()
    for marker_index: int in range(markers.size()):
        if int(markers[marker_index]) == _position:
            _markers_mask |= 1 << marker_index


func _all_markers_mask() -> int:
    return (1 << _level_spec.get_markers().size()) - 1


func _collected_marker_count() -> int:
    var count := 0
    if _level_spec == null:
        return count
    for marker_index: int in range(_level_spec.get_markers().size()):
        if (_markers_mask & (1 << marker_index)) != 0:
            count += 1
    return count


func _record_action(action_id: String) -> void:
    _current_actions.append(action_id)


func _current_level_record() -> Dictionary:
    return {
        "seed": _level_seed,
        "root_seed": _root_seed,
        "level_index": _level_index,
        "difficulty": _difficulty,
        "generator_version": _generator_version,
        "level_spec_hash": _level_spec.content_hash(),
        "actions": _current_actions.duplicate(),
        "state": _replay_state(),
    }


func _replay_state() -> Dictionary:
    return {
        "position": _position,
        "tide_phase": _tide_phase,
        "markers_mask": _markers_mask,
        "actions_applied": _actions_applied,
        "complete": _complete,
        "failed": _failed,
        "objectives": get_objectives(),
        "metrics": get_metrics(),
    }


func _replay_state_matches(expected: Variant) -> bool:
    if not expected is Dictionary:
        return false
    return _replay_state() == (expected as Dictionary)


func _is_action_applicable(action_id: String) -> bool:
    if action_id == "flip-tide":
        return not _complete and not _failed
    if MOVE_ACTION_IDS.has(action_id):
        var target := _target_for_action(action_id)
        return target >= 0 and _is_passable(target, _tide_phase)
    return false


func _capture_runtime_state() -> Dictionary:
    return {
        "initialized": _initialized,
        "root_seed": _root_seed,
        "level_index": _level_index,
        "difficulty": _difficulty,
        "generator_version": _generator_version,
        "level_seed": _level_seed,
        "level_spec": _level_spec,
        "position": _position,
        "tide_phase": _tide_phase,
        "markers_mask": _markers_mask,
        "actions_applied": _actions_applied,
        "action_limit": _action_limit,
        "complete": _complete,
        "failed": _failed,
        "current_actions": _current_actions.duplicate(),
        "level_history": _level_history.duplicate(true),
    }


func _restore_runtime_state(snapshot: Dictionary) -> void:
    _initialized = bool(snapshot.get("initialized", true))
    _root_seed = int(snapshot.get("root_seed", 0))
    _level_index = int(snapshot.get("level_index", 0))
    _difficulty = str(snapshot.get("difficulty", "shoal"))
    _generator_version = str(snapshot.get("generator_version", GENERATOR_VERSION))
    _level_seed = int(snapshot.get("level_seed", 0))
    _level_spec = snapshot.get("level_spec", null)
    _position = int(snapshot.get("position", -1))
    _tide_phase = int(snapshot.get("tide_phase", 0))
    _markers_mask = int(snapshot.get("markers_mask", 0))
    _actions_applied = int(snapshot.get("actions_applied", 0))
    _action_limit = int(snapshot.get("action_limit", 0))
    _complete = bool(snapshot.get("complete", false))
    _failed = bool(snapshot.get("failed", false))
    _current_actions.clear()
    for action: Variant in snapshot.get("current_actions", []):
        _current_actions.append(str(action))
    _level_history.clear()
    for record: Variant in snapshot.get("level_history", []):
        if record is Dictionary:
            _level_history.append((record as Dictionary).duplicate(true))
    _refresh_view()


func _key_to_action(keycode: Key) -> String:
    match keycode:
        KEY_UP, KEY_W:
            return "move-up"
        KEY_RIGHT, KEY_D:
            return "move-right"
        KEY_DOWN, KEY_S:
            return "move-down"
        KEY_LEFT, KEY_A:
            return "move-left"
        KEY_SPACE:
            return "flip-tide"
        KEY_R:
            return "restart"
        KEY_N:
            return "next-level"
    return ""


func _refresh_view() -> void:
    if _view != null:
        _view.set_state(get_observation())
