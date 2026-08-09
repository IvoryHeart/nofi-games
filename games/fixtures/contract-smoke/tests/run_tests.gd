extends SceneTree

var _failures: Array[String] = []


func _initialize() -> void:
    var packed: PackedScene = load("res://game_packs/contract_smoke/main.tscn")
    var instance := packed.instantiate()
    instance.set_script(load("res://game_packs/contract_smoke/main.gd"))
    var game := instance as NofiGamePack
    if game == null:
        push_error("Fixture entry script does not extend NofiGamePack")
        quit(1)
        return
    root.add_child(game)

    _append_errors(NofiContractValidator.validate_instance(game))
    _append_errors(NofiContractValidator.validate_deterministic_reset(game, 42))

    game.reset_game(42)
    var initial := game.get_observation()
    _assert_equal(initial.get("value"), 0, "reset value")
    _assert_equal(game.get_available_actions().size(), 2, "action count")

    for _step in range(3):
        var result := game.apply_action({"id": "increment"})
        _assert_equal(result.get("accepted"), true, "increment accepted")

    _assert_equal(game.get_observation().get("complete"), true, "objective reached")
    var replay := game.save_replay()
    game.reset_game(99)
    _assert_equal(game.restore_replay(replay), true, "replay restored")
    _assert_equal(game.get_observation().get("complete"), true, "replay outcome")
    _assert_equal(game.apply_action({"id": "invalid"}).get("accepted"), false, "invalid action")

    if _failures.is_empty():
        print("NOFI_FIXTURE_TESTS_OK")
        quit(0)
    else:
        for failure in _failures:
            push_error(failure)
        quit(1)


func _append_errors(errors: PackedStringArray) -> void:
    for error in errors:
        _failures.append(error)


func _assert_equal(actual: Variant, expected: Variant, label: String) -> void:
    if actual != expected:
        _failures.append("%s: expected %s, got %s" % [label, expected, actual])
