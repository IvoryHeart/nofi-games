extends SceneTree

const GENERATOR = preload("res://game_packs/tide_ledger/level_generator.gd")
const LEVEL_SPEC = preload("res://game_packs/tide_ledger/level_spec.gd")
const VIEW = preload("res://game_packs/tide_ledger/view.gd")
const GENERATOR_VERSION: String = "0.3.0"

const EXPECTED_HASHES: Dictionary = {
    "42": {
        "shoal": ["38c4f1b38bf168a126e2002e54908bee59c8634b35c89bcb4ec05f3cc0892cd2", "46ded9e2f831ad54f761eec633671c63407e4040cdf0b499e6bb0d3ba999a49f"],
        "swell": ["45b31fc541879aa54939017c8c17038f0d299ca1a4f58b3c4768593c6bd457cf", "aef8b1f4294bb7e896dbb3b985e3230ff1ee70ffbf700c6476523ac90627eef8"],
        "storm": ["3cae5d5bfaeb98d9b3c5638c5bed220750d7cdef45dda08c078ac475f4c6456f", "a1a2266b23ba2a04c5056ee841d686ee452daa7d1bcb355203dcbecadd555324"],
    },
    "77": {
        "shoal": ["38b1cb1916b82fb4b4d4b2c92faa23ab8a8899acc2dce2192f6ad6192eb9b988", "e74ed98fb939abe47ed8023ce6ed4111130083e3fc5b7e765a25512143137cdd"],
        "swell": ["51bbfca4eb1375014cbb0d401255164d41994ad1d778d8585255376c128b093b", "214b7b5676ce58b4aa9dc5b3db3e1cd3811c7ea2f275dc59f5e56a3098b31637"],
        "storm": ["6902f4e467ba27c5e5fc06a137093525daff817401ba94868c2b48ed69dbe5f5", "7640a0325d2ce4d76a45192b691dff38932eb07e9d6bd3e36d515e912a7bba53"],
    },
    "12345": {
        "shoal": ["55c34ae6996cace9ec381e1c8bdbe1c1fc2b4276f8711ebde2f7ddc99e3c35d9", "c3f607403495d840f1d1056f8b8effb051248005c819b02d044782f73b18ecb2"],
        "swell": ["395a6c264f758050e4b3ee15f75d5a8e3073da8ce0fc0eba1583958a174a2d9c", "fef7dd21d27c6c1bb51c2734c6349046bc06bff806dfd38c1d7b8ebce8977e22"],
        "storm": ["245b14fec71567a15cb339cb7fd0bcadd132df58cedf2bec51b00c896552eb1d", "3eede1a2375f643d8b26ca4adb8c72a43d5c9961f93dbbef0519d31eb4c617b2"],
    },
}

const EXPECTED_FALLBACK_HASHES: Dictionary = {
    "shoal": "52bef8dc21cd97d58a38f8df8732aa3e9fc383010c27bd5f998f43edb1f15fe2",
    "swell": "68fb3687e9b6e0b1500632242c98e09925b09838075c3230dc5cb1c0f1654df0",
    "storm": "4254537ae54b44a15051366a9443aea37f143d2478b63ec3ad60c6ac9e0438d0",
}

class FailingGenerator:
    func derive_level_seed(_root_seed: int, _level_index: int, _difficulty: String, _generator_version: String) -> int:
        return 123

    func generate(_seed_value: int, _difficulty: String, _generator_version: String):
        return null

var _failures: Array[String] = []


func _initialize() -> void:
    var generator = GENERATOR.new()
    _test_immutable_level_spec(generator)
    _test_generator_corpus(generator)
    _test_fallback(generator)
    _test_fallback_fail_closed(generator)
    _test_pack_boundary_failure()
    _test_touch_controls()
    _test_blind_policy()
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
                _assert_in_range(int(metrics.get("route_choices", -1)), int(bounds["route_min"]), int(bounds["route_max"]), "route choices %s/%d" % [difficulty, level_index])
                _assert_in_range(int(metrics.get("dead_end_excursion", -1)), int(bounds["excursion_min"]), int(bounds["excursion_max"]), "dead-end excursion %s/%d" % [difficulty, level_index])
                _assert_true(int(metrics.get("off_corridor_markers", 0)) > 0, "required off-corridor marker %s/%d" % [difficulty, level_index])
                _assert_true(solution_within_budget(spec, proof.get("solution_actions", [])), "solver route within budget %s/%d" % [difficulty, level_index])
                _assert_replay_round_trip(replay_game, generator, root_seed, level_index, difficulty, spec, proof.get("solution_actions", []), "corpus %d/%s/%d" % [root_seed, difficulty, level_index])
                print("TIDE_CORPUS %d %s %d %s %s" % [root_seed, difficulty, level_index, spec.content_hash(), JSON.stringify(metrics)])
    replay_game.free()


func _test_fallback(generator) -> void:
    for difficulty: String in ["shoal", "swell", "storm"]:
        var spec = generator.generate(0, difficulty)
        if spec == null:
            _failures.append("fallback generated nil %s" % difficulty)
            continue
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
        _assert_in_range(int(metrics.get("route_choices", -1)), int(bounds["route_min"]), int(bounds["route_max"]), "fallback route choices %s" % difficulty)
        _assert_in_range(int(metrics.get("dead_end_excursion", -1)), int(bounds["excursion_min"]), int(bounds["excursion_max"]), "fallback dead-end excursion %s" % difficulty)
        _assert_true(solution_within_budget(spec, proof.get("solution_actions", [])), "fallback solver route within budget %s" % difficulty)
        _assert_equal(spec.content_hash(), EXPECTED_FALLBACK_HASHES[difficulty], "fallback pinned hash %s" % difficulty)
        _assert_equal(spec.content_hash(), generator.generate(0, difficulty).content_hash(), "fallback repeat hash %s" % difficulty)
        var baseline_payload: Dictionary = generator._build_payload(0, difficulty, GENERATOR_VERSION, generator.MAX_ATTEMPTS, true)
        var baseline = generator._finalize_fallback(LEVEL_SPEC.new(baseline_payload), difficulty)
        for seed: int in range(100):
            var payload: Dictionary = generator._build_payload(seed, difficulty, GENERATOR_VERSION, generator.MAX_ATTEMPTS, true)
            var finalized = generator._finalize_fallback(LEVEL_SPEC.new(payload), difficulty)
            _assert_true(finalized != null, "fallback construction seed %d %s" % [seed, difficulty])
            if finalized != null:
                _assert_equal(finalized.get_value("tiles"), baseline.get_value("tiles"), "fallback topology seed %d %s" % [seed, difficulty])
                _assert_equal(finalized.get_markers(), baseline.get_markers(), "fallback markers seed %d %s" % [seed, difficulty])


func _test_fallback_fail_closed(generator) -> void:
    var valid = generator.generate(0, "shoal")
    var invalid_payload: Dictionary = valid.to_dict()
    var width := int(invalid_payload["width"])
    var corridor_y := int(invalid_payload["corridor_y"])
    invalid_payload["markers"] = [corridor_y * width + 1, corridor_y * width + 2, corridor_y * width + 3]
    var invalid = LEVEL_SPEC.new(invalid_payload)
    _assert_true(generator._finalize_fallback(invalid, "shoal") == null, "invalid fallback fails closed")


func _test_pack_boundary_failure() -> void:
    var game: NofiGamePack = _new_game()
    game._generator = FailingGenerator.new()
    game.reset_game(42)
    var observation: Dictionary = game.get_observation()
    _assert_equal(observation.get("level_available"), false, "failed generation unavailable state")
    _assert_equal(observation.get("generation_failed"), true, "failed generation flag")
    _assert_equal(observation.get("level"), {"player_position": -1}, "failed generation hides level")
    _assert_true(game.get_available_actions().is_empty(), "failed generation has no actions")
    _assert_equal(game.save_replay().get("error"), "level-unavailable", "failed generation replay unavailable")
    game.free()


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


func _test_blind_policy() -> void:
    var game: NofiGamePack = _new_game()
    var directions: Array[String] = ["move-right", "move-down", "move-left", "move-up"]
    for root_seed: int in [42, 77, 12345]:
        game.reset_game(root_seed)
        var initial: Dictionary = game.get_observation()
        var action_limit := int(initial.get("action_limit", 0))
        for step: int in range(action_limit * 2):
            var action_id := "flip-tide" if step % 2 == 0 else directions[int(step / 2) % directions.size()]
            game.apply_action({"id": action_id})
            if bool(game.get_observation().get("complete", false)):
                break
        _assert_true(not bool(game.get_observation().get("complete", false)), "blind policy does not complete seed %d" % root_seed)
    game.free()


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
            "route_choices": int(measured.get("route_choices", 0)),
            "dead_end_excursion": int(measured.get("dead_end_excursion", 0)),
            "generator_attempts": spec.generation_attempts(),
            "used_fallback": spec.used_fallback(),
            "actions_applied": solution.size(),
            "action_limit": int(measured.get("solution_length", 0)) + int(spec.get_value("action_budget_slack", 0)),
            "action_budget_slack": int(spec.get_value("action_budget_slack", 0)),
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
    var baseline_observation: Dictionary = game.get_observation()
    var initial_actions := game.get_available_actions()
    for action: Dictionary in initial_actions:
        _assert_true(bool(game.apply_action(action).get("accepted", false)), "advertised action accepted %s" % action.get("id", ""))
        _assert_true(game.restore_replay(initial_replay), "restore equivalent action state %s" % action.get("id", ""))

    var corrupt_version: Dictionary = initial_replay.duplicate(true)
    corrupt_version["generator_version"] = "corrupt"
    _assert_equal(game.restore_replay(corrupt_version), false, "corrupt version rejected")
    _assert_equal(game.get_observation(), baseline_observation, "corrupt version preserves observation")
    _assert_equal(game.save_replay(), initial_replay, "corrupt version preserves replay")
    var corrupt_hash: Dictionary = initial_replay.duplicate(true)
    corrupt_hash["level_spec_hash"] = "corrupt"
    (corrupt_hash["levels"] as Array)[0]["level_spec_hash"] = "corrupt"
    _assert_equal(game.restore_replay(corrupt_hash), false, "corrupt hash rejected")
    _assert_equal(game.get_observation(), baseline_observation, "corrupt hash preserves observation")
    _assert_equal(game.save_replay(), initial_replay, "corrupt hash preserves replay")
    game.reset_game(42)
    _assert_equal(game.get_observation(), baseline_observation, "reset restores current generator version")

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


func solution_within_budget(spec, solution: Array) -> bool:
    return solution.size() <= int(spec.get_measured().get("solution_length", 0)) + int(spec.get_value("action_budget_slack", 0))
