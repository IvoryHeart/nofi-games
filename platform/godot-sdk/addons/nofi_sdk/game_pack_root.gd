class_name NofiGamePack
extends Node

signal telemetry_emitted(event: Dictionary)

const CONTRACT_VERSION: String = "0.1.0"

var _game_seed: int = 0
var _random: RandomNumberGenerator = RandomNumberGenerator.new()


func contract_version() -> String:
    return CONTRACT_VERSION


func reset_game(seed_value: int) -> void:
    _game_seed = seed_value
    _random.seed = seed_value


func get_observation() -> Dictionary:
    push_error("Game pack must override get_observation()")
    return {}


func get_available_actions() -> Array[Dictionary]:
    push_error("Game pack must override get_available_actions()")
    return []


func apply_action(_action: Dictionary) -> Dictionary:
    push_error("Game pack must override apply_action()")
    return {"accepted": false, "reason": "not-implemented"}


func advance_simulation(_ticks: int) -> void:
    pass


func get_objectives() -> Array[Dictionary]:
    push_error("Game pack must override get_objectives()")
    return []


func get_metrics() -> Dictionary:
    return {}


func save_replay() -> Dictionary:
    push_error("Game pack must override save_replay()")
    return {}


func restore_replay(_replay: Dictionary) -> bool:
    push_error("Game pack must override restore_replay()")
    return false


func emit_gameplay_event(name: String, properties: Dictionary = {}) -> void:
    telemetry_emitted.emit(
        {
            "schema_version": 1,
            "name": name,
            "properties": properties.duplicate(true),
            "game_seed": _game_seed,
        }
    )
