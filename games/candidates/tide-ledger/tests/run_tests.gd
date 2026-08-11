extends SceneTree

const GENERATOR = preload("res://game_packs/tide_ledger/level_generator.gd")

const EXPECTED_HASHES: Dictionary = {
    "42": {
        "shoal": ["e4d6540dc7f15e6d745e2e2c9eb4c5139932a992192de6a47437e9b155bcb341", "fb940e860cd422faa810ea8709044307df4bcaca91367d93e79b05cf42992adb"],
        "swell": ["e022ba6161c713422e34433f1e4e47a267e95d7455a3c7327500966667591f30", "e30481cc48e07cbe2ae814da745c515991fabc00531d154287102e32487da2fa"],
        "storm": ["0432e0396a98b26dd33ee5c9eb559878722d8a698f3d7bce7beb0e46669fd50f", "cf10252bbb8a11eb0700fdc381d29c78725fa1a26cf5f296cd794e4e2b0b91c9"],
    },
    "77": {
        "shoal": ["a660291685ea9e73f1481c4193e2180931843e2d43dac242329af2d756d48d7e", "7cd6c9a22a12afc5537bcddd8c8a8d509b54c868d21d6896886c03581db3c136"],
        "swell": ["af4888904a5d712005081cd7d38925c05299f2403aa880237c645a63b3bf2cb9", "86019c495350ec2d92ab12691dc4a38f979935c921f030d8cfa2e0e94c2ccd40"],
        "storm": ["3517d68a9a401e78599b8968d2c9d94d97e4111e96367a410ff46316b0f71e81", "7b1af5923c5be87db69ace6ba103ba4130237429582c80c82f0b2648bdf33fbe"],
    },
    "12345": {
        "shoal": ["0bc042eed7ad70d140462556ea156e697e05287992c490460025217f0a276ec4", "90f2eba4ad73b1ca466ecd948b13f0c8a1d7090b58ad0a491d2cefc0c485280c"],
        "swell": ["6ece76c2a2a032ecc2352019ab0458a3a2a0e197430d3698fbb423a9adb987af", "4117bd8a62755ec4ec3db4a30ec8cb251a110af01de9630d67570b1157b74550"],
        "storm": ["2197ae2164ab786a0d403bca6563be60033a96ee4ed2b63df86b3550c96c2e73", "c406aee62fbec40be9a199251078935ae95476e88fef4ed1bb37356df22c1470"],
    },
}

const EXPECTED_FALLBACK_HASHES: Dictionary = {
    "shoal": "35e8b505d70883d8d732f9ba6d0bc9f3acb3b1579313def9744c9ee707cac546",
    "swell": "9d6116ce943a1f8b18ed3b93b19ebd8ec26dc82525be8b3589ce002a5dd83f0f",
    "storm": "699dfcc34763a0bc556a0946d0b25027893cab9f76c1d62ab1fcd4ac1deb8c04",
}

var _failures: Array[String] = []


func _initialize() -> void:
    var generator = GENERATOR.new()
    _test_generator_corpus(generator)
    _test_fallback(generator)
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
                print("TIDE_CORPUS %d %s %d %s %s" % [root_seed, difficulty, level_index, spec.content_hash(), JSON.stringify(metrics)])


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


func _test_game_contract_and_replay() -> void:
    var packed: PackedScene = load("res://game_packs/tide_ledger/main.tscn")
    var instance := packed.instantiate()
    instance.set_script(load("res://game_packs/tide_ledger/main.gd"))
    var game := instance as NofiGamePack
    if game == null:
        _failures.append("Game entry script does not extend NofiGamePack")
        return
    root.add_child(game)
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
    game.reset_game(99)
    _assert_true(game.restore_replay(replay), "replay restored")
    var restored: Dictionary = game.get_observation()
    _assert_equal(restored.get("level_spec_hash"), completed.get("level_spec_hash"), "restored hash")
    _assert_equal(restored.get("markers_mask"), completed.get("markers_mask"), "restored markers")
    _assert_equal(restored.get("complete"), completed.get("complete"), "restored objective")
    _assert_true(bool(game.apply_action({"id": "next-level"}).get("accepted", false)), "next level accepted")
    var next_level: Dictionary = game.get_observation()
    _assert_equal(next_level.get("level_index"), 1, "endless level index")
    _assert_true(next_level.get("level_spec_hash") != completed.get("level_spec_hash"), "endless level hash changes")


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
