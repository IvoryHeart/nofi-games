extends NofiGamePack


func reset_game(seed_value: int) -> void:
    super.reset_game(seed_value)


func get_observation() -> Dictionary:
    return {"implemented": false}


func get_available_actions() -> Array[Dictionary]:
    return [{"id": "primary-action"}]


func apply_action(_action: Dictionary) -> Dictionary:
    return {"accepted": false, "reason": "game-not-implemented"}


func get_objectives() -> Array[Dictionary]:
    return [{"id": "implement-game", "complete": false}]


func save_replay() -> Dictionary:
    return {"schema_version": 1, "seed": _game_seed, "actions": []}


func restore_replay(_replay: Dictionary) -> bool:
    return false
