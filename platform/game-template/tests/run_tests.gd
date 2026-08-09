extends SceneTree


func _initialize() -> void:
    var packed: PackedScene = load("res://game_packs/__GAME_ID_UNDERSCORE__/main.tscn")
    var instance := packed.instantiate()
    instance.set_script(load("res://game_packs/__GAME_ID_UNDERSCORE__/main.gd"))
    var game := instance as NofiGamePack
    if game == null:
        push_error("Game entry script does not extend NofiGamePack")
        quit(1)
        return
    root.add_child(game)
    var errors := NofiContractValidator.validate_instance(game)
    errors.append_array(NofiContractValidator.validate_deterministic_reset(game, 42))
    if errors.is_empty():
        print("NOFI_GAME_CONTRACT_OK")
        quit(0)
    for error in errors:
        push_error(error)
    quit(1)
