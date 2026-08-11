extends SceneTree

const GENERATOR = preload("res://game_packs/tide_ledger/level_generator.gd")
const LEVEL_SPEC = preload("res://game_packs/tide_ledger/level_spec.gd")
const VIEW = preload("res://game_packs/tide_ledger/view.gd")
const GENERATOR_VERSION: String = "0.2.0"

const EXPECTED_HASHES: Dictionary = {
    "42": {
        "shoal": ["65287edb036e3a0356b728a0128f0f93138146a63f91daf1872a3622e8ba92e4", "711277b4e45241df5f6b2a3956e09317cf1d7a05442565c838740d4aa69e0f1c"],
        "swell": ["01687644edac08f772c778f26bce5252f287419370d3ae3841daae0f018bd279", "864111578af4d7b781cf946ab71272f37b41d6bd7bb0d3108afd44e50c68b6a6"],
        "storm": ["383709677985af9c7500b226c2fb7e538562da0be938ae94998c811ad0ee760f", "7601b4dfffcc0230fed45b76b4ebe1fa5965cadddb466e2a4ad0d6ed9f6b9f03"],
    },
    "77": {
        "shoal": ["e0b9fb1ebfa1583c6ff78fd186df3c1c15b63cb3af75a4c6b489eb1f27091083", "01776bf2cbd14f4a4c69c34ddc7c57f8a649860abcc912a6efaf5de63eb8ff16"],
        "swell": ["5fe00342e3fa5aeb17fbec1ba4d32714d84f5194fa8d867fc83889e0999ffbef", "c54e4f115c487987ff968120dca6d401f95b80bda346f3810f07567407668849"],
        "storm": ["999ce64001c57a16204fba46bf28101a6038d6a914ce3cbf7c8b2a7011cafeac", "77b373cbbf272208cf01fdc9b07fd86fe7c19253d1cc856f222c8351cf656581"],
    },
    "12345": {
        "shoal": ["248c1619547ac69e1e941ecf0ea47edca6500c3fe12a23563808b7618bb7926a", "a30ab7369bb386b66c5dfe1449495be58d1b1e8762be492be5cf575455b6c330"],
        "swell": ["5b3d10be1a85425fdd59ad4d47a8af19261bbc8a63c1dbec7f3132f9fd263974", "ba068a9de1a34b72f41289354f4abb27ff64a347f15d5494c213b02bf8ba2b41"],
        "storm": ["69d62718e57c7a0c0c39d14a22384a518da6e81fc4fd7f1a2804cb3e51591cda", "f104766c95a610f77cac2ed30fc08b4df56e735ab3e138e7a9a4293ec505213d"],
    },
}

const EXPECTED_FALLBACK_HASHES: Dictionary = {
    "shoal": "48d605ae54ee48b3d09933ea068d26c5660a4bc3073283350ec48b7e0d1744ed",
    "swell": "ff7f47b02f8f1d222405055fa0060da25f325d7478dd58ec5b6c4e0089b902ff",
    "storm": "7dbd8100087b5d5e6b3e92fdb8d64226f8650c147df4ed468740280be920d688",
}

var _failures: Array[String] = []


func _initialize() -> void:
    var generator = GENERATOR.new()
    _test_immutable_level_spec(generator)
    _test_generator_corpus(generator)
    _test_fallback(generator)
    _test_fallback_fail_closed(generator)
    _test_touch_controls()
    _test_game_contract_and_replay()
    if _failures.is_empty():
        print("NOFI_TIDE_LEDGER_TESTS_OK")
        quit(0)
        return
    for failure: String in _failures:
        push_error(failure)
    quit(1)


func _test_generator_corpus(generator) -> void:
    var roots: Array[int] = [42, 77, 12345]
    var difficulties: Array[String] = ["shoal", "swell", "storm"]
    var replay_game = _new_game()
    for root_seed: int in roots:
        for difficulty: String in difficulties:
            for level_index: int in range(2):
                var level_seed: int = int(generator.derive_level_seed(root_seed, level_index, difficulty))
                var spec = generator.generate(level_seed, difficulty)
                var repeat = generator.generate(level_seed, difficulty)
                var proof = generator.solve(spec)
                var metrics: Dictionary = proof.get("metrics", {})
                var bounds = generator.band_bounds(difficulty)
                _assert_true(bool(proof.get("solvable", false)), "corpus solvable %s/%d" % [difficulty, level_index])
                _assert_equal(spec.content_hash(), repeat.content_hash(), "corpus repeat hash %s/%d" % [difficulty, level_index])
                _assert_equal(spec.content_hash(), EXPECTED_HASHES[str(root_seed)][difficulty][level_index], "corpus pinned hash %s/%d" % [difficulty, level_index])
                _assert_in_range(int(metrics.get("solution_length", -1)), int(bounds["solution_min"]), int(bounds["solution_max"]), "solution length %s/%d" % [difficulty, level_index])
                _assert_in_range(int(metrics.get("required_tide_flips", -1)), int(bounds["flips_min"]), int(bounds["flips_max"]), "tide flips %s/%d" % [difficulty, level_index])
                _assert_in_range(int(metrics.get("branching", -1)), int(bounds["branch_min"]), int(bounds["branch_max"]), "branching %s/%d" % [difficulty, level_index])
                _assert_in_range(int(metrics.get("dead_ends", -1)), int(bounds["dead_min"]), int(bounds["dead_max"]), "dead ends %s/%d" % [difficulty, level_index])
                _assert_true(int(metrics.get("off_corridor_markers", 0)) > 0, "required off-corridor marker %s/%d" % [difficulty, level_index])
                _assert_replay_round_trip(replay_game, generator, root_seed, level_index, difficulty, spec, proof.get("solution_actions", []), "corpus %d/%s/%d" % [root_seed, difficulty, level_index])
                print("TIDE_CORPUS %d %s %d %s %s" % [root_seed, difficulty, level_index, spec.content_hash(), JSON.stringify(metrics)])
    replay_game.free()


func _test_fallback(generator) -> void:
    for difficulty: String in ["shoal", "swell", "storm"]:
        var spec = generator.generate(0, difficulty)
        var proof = generator.solve(spec)
        var bounds = generator.band_bounds(difficulty)
        var metrics: Dictionary = proof.get("metrics", {})
        _assert_true(spec.used_fallback(), "fallback selected %s" % difficulty)
        _assert_equal(spec.generation_attempts(), 32, "fallback attempt bound %s" % difficulty)
        _assert_true(bool(proof.get("solvable", false)), "fallback solvable %s" % difficulty)
        _assert_in_range(int(metrics.get("solution_length", -1)), int(bounds["solution_min"]), int(bounds["solution_max"]), "fallback solution length %s" % difficulty)
        _assert_in_range(int(metrics.get("required_tide_flips", -1)), int(bounds["flips_min"]), int(bounds["flips_max"]), "fallback tide flips %s" % difficulty)
        _assert_in_range(int(metrics.get("branching", -1)), int(bounds["branch_min"]), int(bounds["branch_max"]), "fallback branching %s" % difficulty)
        _assert_in_range(int(metrics.get("dead_ends", -1)), int(bounds["dead_min"]), int(bounds["dead_max"]), "fallback dead ends %s" % difficulty)
        _assert_equal(spec.content_hash(), EXPECTED_FALLBACK_HASHES[difficulty], "fallback pinned hash %s" % difficulty)
        _assert_equal(spec.content_hash(), generator.generate(0, difficulty).content_hash(), "fallback repeat hash %s" % difficulty)


func _test_fallback_fail_closed(generator) -> void:
    var valid = generator.generate(0, "shoal")
    var invalid_payload: Dictionary = valid.to_dict()
    var width := int(invalid_payload["width"])
    var corridor_y := int(invalid_payload["corridor_y"])
    invalid_payload["markers"] = [corridor_y * width + 1, corridor_y * width + 2, corridor_y * width + 3]
    var invalid = LEVEL_SPEC.new(invalid_payload)
    _assert_true(generator._finalize_fallback(invalid, "shoal") == null, "invalid fallback fails closed")


func _test_immutable_level_spec(generator) -> void:
    var spec = generator.generate(generator.derive_level_seed(42, 0, "shoal"), "shoal", GENERATOR_VERSION)
    var before: Dictionary = spec.to_dict()
    var before_hash: String = spec.content_hash()

    var serialized: Dictionary = spec.to_dict()
    (serialized["tiles"] as Array)[0] = 999
    var value_tiles: Array = spec.get_value("tiles")
    value_tiles[0] = 998
    var value_measured: Dictionary = spec.get_value("measured")
    value_measured["solution_length"] = 999
    var tiles: Array = spec.get_tiles()
    tiles[0] = 997
    var markers: Array = spec.get_markers()
    markers[0] = -1
    var measured: Dictionary = spec.get_measured()
    measured["dead_ends"] = 999

    _assert_equal(spec.to_dict(), before, "immutable LevelSpec payload")
    _assert_equal(spec.content_hash(), before_hash, "immutable LevelSpec hash")


func _test_touch_controls() -> void:
    var view := Node2D.new()
    view.set_script(VIEW)
    view.set_state(
        {
            "complete": false,
            "failed": false,
            "level": {"width": 9, "height": 5, "player_position": 22},
        }
    )
    _assert_equal(view.action_for_screen_point(Vector2(820, 675)), "flip-tide", "touch flip control")
    _assert_equal(view.action_for_screen_point(Vector2(980, 675)), "restart", "touch restart control")
    _assert_equal(view.action_for_screen_point(Vector2(1140, 675)), "", "touch next disabled")
    view.set_state(
        {
            "complete": true,
            "failed": false,
            "level": {"width": 9, "height": 5, "player_position": 22},
        }
    )
    _assert_equal(view.action_for_screen_point(Vector2(820, 675)), "", "touch flip disabled after completion")
    _assert_equal(view.action_for_screen_point(Vector2(1140, 675)), "next-level", "touch next control")
    view.free()


func _new_game() -> NofiGamePack:
    var packed: PackedScene = load("res://game_packs/tide_ledger/main.tscn")
    var instance := packed.instantiate()
    instance.set_script(load("res://game_packs/tide_ledger/main.gd"))
    var game := instance as NofiGamePack
    root.add_child(game)
    return game


func _assert_replay_round_trip(game, generator, root_seed: int, level_index: int, difficulty: String, spec, solution: Array, label: String) -> void:
    var level_seed := int(generator.derive_level_seed(root_seed, level_index, difficulty, GENERATOR_VERSION))
    var state := _replay_state_for_solution(spec, level_index, solution)
    var record := {
        "seed": level_seed,
        "root_seed": root_seed,
        "level_index": level_index,
        "difficulty": difficulty,
        "generator_version": GENERATOR_VERSION,
        "level_spec_hash": spec.content_hash(),
        "actions": solution.duplicate(),
        "state": state,
    }
    var replay := {
        "schema_version": 1,
        "game_id": "tide-ledger",
        "seed": level_seed,
        "root_seed": root_seed,
        "level_index": level_index,
        "difficulty": difficulty,
        "generator_version": GENERATOR_VERSION,
        "level_spec_hash": spec.content_hash(),
        "levels": [record],
    }
    _assert_true(game.restore_replay(replay), "%s restore" % label)
    var restored_observation: Dictionary = game.get_observation()
    var restored_objectives: Array[Dictionary] = game.get_objectives()
    var restored_metrics: Dictionary = game.get_metrics()
    var saved: Dictionary = game.save_replay()
    _assert_equal(saved, replay, "%s save after restore" % label)
    game.reset_game(999)
    _assert_true(game.restore_replay(saved), "%s second restore" % label)
    _assert_equal(game.get_observation(), restored_observation, "%s observation round trip" % label)
    _assert_equal(game.get_objectives(), restored_objectives, "%s objectives round trip" % label)
    _assert_equal(game.get_metrics(), restored_metrics, "%s metrics round trip" % label)


func _replay_state_for_solution(spec, level_index: int, solution: Array) -> Dictionary:
    var measured: Dictionary = spec.get_measured()
    var flip_count := 0
    for action: Variant in solution:
        if str(action) == "flip-tide":
            flip_count += 1
    return {
        "position": int(spec.get_value("goal", -1)),
        "tide_phase": flip_count % 2,
        "markers_mask": (1 << spec.get_markers().size()) - 1,
        "actions_applied": solution.size(),
        "complete": true,
        "failed": false,
        "objectives": [
            {"id": "stamp-markers", "complete": true},
            {"id": "reach-lighthouse", "complete": true},
            {"id": "complete-level", "complete": true},
        ],
        "metrics": {
            "level_index": level_index,
            "solution_length": int(measured.get("solution_length", 0)),
            "required_tide_flips": int(measured.get("required_tide_flips", 0)),
            "branching": int(measured.get("branching", 0)),
            "dead_ends": int(measured.get("dead_ends", 0)),
            "generator_attempts": spec.generation_attempts(),
            "used_fallback": spec.used_fallback(),
            "actions_applied": solution.size(),
            "level_available": true,
        },
    }


func _test_game_contract_and_replay() -> void:
    var game: NofiGamePack = _new_game()
    if game == null:
        _failures.append("Game entry script does not extend NofiGamePack")
        return
    _append_errors(NofiContractValidator.validate_instance(game))
    _append_errors(NofiContractValidator.validate_deterministic_reset(game, 42))

    game.reset_game(42)
    var initial: Dictionary = game.get_observation()
    var generator = GENERATOR.new()
    var expected_spec = generator.generate(int(initial["seed"]), str(initial["difficulty"]), str(initial["generator_version"]))
    _assert_equal(initial["level_spec_hash"], expected_spec.content_hash(), "game level hash reconstruction")
    _assert_true(initial.has("root_seed"), "structured root seed")
    _assert_true(initial.has("generator_version"), "structured generator version")
    _assert_true(initial.has("metrics"), "structured metrics")

    var initial_replay := game.save_replay()
    var initial_actions := game.get_available_actions()
    for action: Dictionary in initial_actions:
        _assert_true(bool(game.apply_action(action).get("accepted", false)), "advertised action accepted %s" % action.get("id", ""))
        _assert_true(game.restore_replay(initial_replay), "restore equivalent action state %s" % action.get("id", ""))

    var proof = generator.solve(expected_spec)
    var solution: Array = proof.get("solution_actions", [])
    for action_id: String in solution:
        var result := game.apply_action({"id": action_id})
        _assert_true(bool(result.get("accepted", false)), "solution action accepted %s" % action_id)
    var completed: Dictionary = game.get_observation()
    _assert_true(bool(completed.get("complete", false)), "objective complete")
    _assert_equal(game.get_objectives()[1].get("complete"), true, "lighthouse objective")
    _assert_equal(game.apply_action({"id": "not-a-real-action"}).get("accepted"), false, "invalid action")

    var replay: Dictionary = game.save_replay()
    _assert_equal(replay.get("level_spec_hash"), completed.get("level_spec_hash"), "replay hash")
    _assert_true(replay.has("root_seed"), "replay root seed")
    _assert_true(replay.has("generator_version"), "replay generator version")
    var terminal_actions := game.get_available_actions()
    _assert_true(_has_action(terminal_actions, "restart"), "terminal restart available")
    _assert_true(_has_action(terminal_actions, "next-level"), "terminal next level available")
    _assert_true(not _has_action(terminal_actions, "flip-tide"), "terminal flip unavailable")
    _assert_true(not _has_action(terminal_actions, "move-right"), "terminal movement unavailable")
    for action: Dictionary in terminal_actions:
        _assert_true(bool(game.apply_action(action).get("accepted", false)), "terminal advertised action accepted %s" % action.get("id", ""))
        _assert_true(game.restore_replay(replay), "restore terminal equivalent action %s" % action.get("id", ""))
    game.reset_game(99)
    _assert_true(game.restore_replay(replay), "replay restored")
    var restored: Dictionary = game.get_observation()
    _assert_equal(restored.get("level_spec_hash"), completed.get("level_spec_hash"), "restored hash")
    _assert_equal(restored.get("markers_mask"), completed.get("markers_mask"), "restored markers")
    _assert_equal(restored.get("complete"), completed.get("complete"), "restored objective")
    _assert_equal(game.save_replay(), replay, "replay save after restore")
    _assert_true(bool(game.apply_action({"id": "next-level"}).get("accepted", false)), "next level accepted")
    var next_level: Dictionary = game.get_observation()
    _assert_equal(next_level.get("level_index"), 1, "endless level index")
    _assert_true(next_level.get("level_spec_hash") != completed.get("level_spec_hash"), "endless level hash changes")
    var next_spec = generator.generate(int(next_level["seed"]), str(next_level["difficulty"]), GENERATOR_VERSION)
    var next_proof = generator.solve(next_spec)
    for action_id: String in next_proof.get("solution_actions", []):
        _assert_true(bool(game.apply_action({"id": action_id}).get("accepted", false)), "multi-level solution action")
    var multi_level_replay := game.save_replay()
    var multi_level_observation := game.get_observation()
    var multi_level_objectives := game.get_objectives()
    var multi_level_metrics := game.get_metrics()
    game.reset_game(123)
    _assert_true(game.restore_replay(multi_level_replay), "multi-level replay restored")
    _assert_equal(game.save_replay(), multi_level_replay, "multi-level replay saved")
    _assert_equal(game.get_observation(), multi_level_observation, "multi-level observation restored")
    _assert_equal(game.get_objectives(), multi_level_objectives, "multi-level objectives restored")
    _assert_equal(game.get_metrics(), multi_level_metrics, "multi-level metrics restored")
    game.free()


func _has_action(actions: Array[Dictionary], action_id: String) -> bool:
    for action: Dictionary in actions:
        if str(action.get("id", "")) == action_id:
            return true
    return false


func _append_errors(errors: PackedStringArray) -> void:
    for error: String in errors:
        _failures.append(error)


func _assert_true(value: bool, label: String) -> void:
    if not value:
        _failures.append("%s: expected true" % label)


func _assert_equal(actual: Variant, expected: Variant, label: String) -> void:
    if actual != expected:
        _failures.append("%s: expected %s, got %s" % [label, expected, actual])


func _assert_in_range(actual: int, minimum: int, maximum: int, label: String) -> void:
    if actual < minimum or actual > maximum:
        _failures.append("%s: expected %d..%d, got %d" % [label, minimum, maximum, actual])
