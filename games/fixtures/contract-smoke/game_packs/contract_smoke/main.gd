extends NofiGamePack

const TARGET := 3

var _value: int = 0
var _actions: Array[String] = []


func reset_game(seed_value: int) -> void:
    super.reset_game(seed_value)
    _value = 0
    _actions.clear()


func get_observation() -> Dictionary:
    return {
        "value": _value,
        "target": TARGET,
        "complete": _value == TARGET,
        "steps": _actions.size(),
    }


func get_available_actions() -> Array[Dictionary]:
    return [{"id": "increment"}, {"id": "decrement"}]


func apply_action(action: Dictionary) -> Dictionary:
    var action_id := str(action.get("id", ""))
    match action_id:
        "increment":
            _value += 1
        "decrement":
            _value -= 1
        _:
            return {"accepted": false, "reason": "unknown-action"}
    _actions.append(action_id)
    emit_gameplay_event("fixture-action", {"action": action_id, "value": _value})
    return {"accepted": true, "observation": get_observation()}


func advance_simulation(ticks: int) -> void:
    if ticks < 0:
        push_error("Simulation ticks cannot be negative")


func get_objectives() -> Array[Dictionary]:
    return [{"id": "reach-target", "complete": _value == TARGET, "target": TARGET}]


func get_metrics() -> Dictionary:
    return {"steps": _actions.size(), "distance_to_target": abs(TARGET - _value)}


func save_replay() -> Dictionary:
    return {"schema_version": 1, "seed": _game_seed, "actions": _actions.duplicate()}


func restore_replay(replay: Dictionary) -> bool:
    if replay.get("schema_version") != 1 or not replay.get("actions", []) is Array:
        return false
    reset_game(int(replay.get("seed", 0)))
    for action_id: Variant in replay.get("actions", []):
        var result := apply_action({"id": str(action_id)})
        if not result.get("accepted", false):
            return false
    return true
