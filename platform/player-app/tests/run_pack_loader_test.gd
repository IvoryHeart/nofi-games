extends SceneTree

var _failures: Array[String] = []


func _initialize() -> void:
    var catalog_file := FileAccess.open("res://catalog/catalog.generated.json", FileAccess.READ)
    if catalog_file == null:
        push_error("Development catalog is missing")
        quit(1)
        return

    var catalog: Variant = JSON.parse_string(catalog_file.get_as_text())
    if not catalog is Dictionary or catalog.get("entries", []).is_empty():
        push_error("Development catalog contains no contract fixture")
        quit(1)
        return

    var entry: Dictionary = catalog["entries"].filter(func(item: Dictionary) -> bool: return item.get("status") == "fixture")[0]
    _assert_equal(entry.get("discoverable", true), false, "fixture discoverability")
    _assert_equal(entry.get("status"), "fixture", "fixture status")
    var candidate_entry: Dictionary = catalog["entries"].filter(func(item: Dictionary) -> bool: return item.get("id") == "tide-ledger")[0]
    _assert_equal(candidate_entry.get("discoverable"), true, "Tide Ledger discoverability")
    _assert_equal(candidate_entry.get("status"), "candidate", "Tide Ledger status")
    _test_catalog_selection()

    var loader := NofiPackLoader.new()
    _expect_failure(
        loader,
        entry,
        {"localPackPath": "user://missing-contract-smoke.pck"},
        "Pack is unavailable locally",
        "missing pack",
    )
    _expect_failure(
        loader,
        entry,
        {"packSha256": "invalid"},
        "Catalog pack hash is invalid",
        "malformed hash",
    )
    _expect_failure(
        loader,
        entry,
        {"packSha256": "0".repeat(64)},
        "Pack integrity check failed",
        "hash mismatch",
    )
    _expect_failure(
        loader,
        entry,
        {"entryScene": "res://outside/main.tscn"},
        "Entry scene is outside the game-pack namespace",
        "scene namespace",
    )
    _expect_failure(
        loader,
        entry,
        {"entryScript": "res://outside/main.gd"},
        "Entry script is outside the game-pack namespace",
        "script namespace",
    )
    _test_rejected_mount(loader, entry)
    _test_resource_contract_failures(loader, entry)

    var result := loader.load_local_pack(_entry_with_pack_copy(entry, "valid"))
    if not result.get("ok", false):
        _failures.append("Fixture pack load failed: %s" % result.get("error", "unknown"))
    else:
        var game: NofiGamePack = result["instance"]
        root.add_child(game)
        var errors := NofiContractValidator.validate_instance(game)
        errors.append_array(NofiContractValidator.validate_deterministic_reset(game, 42))
        for error in errors:
            _failures.append(error)

    _test_candidate_pack(loader, candidate_entry)

    if not _failures.is_empty():
        for failure in _failures:
            push_error(failure)
        quit(1)
        return

    print("NOFI_SINGLE_APP_PACK_LOAD_OK")
    quit(0)


func _test_catalog_selection() -> void:
    var main_scene: PackedScene = load("res://main.tscn")
    var shell := main_scene.instantiate()
    var generated: Dictionary = shell.call("_read_catalog")
    _assert_equal(generated.get("entries", []).size(), 2, "generated catalog selected")
    var discoverable: Array = generated.get("entries", []).filter(
        func(item: Dictionary) -> bool: return item.get("id") == "tide-ledger"
    )
    _assert_equal(discoverable.size(), 1, "Tide Ledger catalog entry")
    _assert_equal(discoverable[0].get("discoverable"), true, "Tide Ledger discoverability")
    _assert_equal(discoverable[0].get("status"), "candidate", "Tide Ledger candidate status")

    var generated_path := ProjectSettings.globalize_path("res://catalog/catalog.generated.json")
    var backup_path := ProjectSettings.globalize_path("user://catalog.generated.test-backup.json")
    DirAccess.remove_absolute(backup_path)
    var move_error := DirAccess.rename_absolute(generated_path, backup_path)
    if move_error != OK:
        _failures.append("Could not move generated catalog for fallback test: %s" % move_error)
        shell.free()
        return
    var base: Dictionary = shell.call("_read_catalog")
    var restore_error := DirAccess.rename_absolute(backup_path, generated_path)
    if restore_error != OK:
        _failures.append("Could not restore generated catalog after fallback test: %s" % restore_error)
    _assert_equal(base.get("entries", []).size(), 0, "base catalog fallback")

    shell.call("_build_shell")
    shell.call("_render_catalog")
    _assert_equal(shell.find_children("*", "Button", true, false).size(), 1, "fixture hidden from shell")
    shell.free()


func _test_rejected_mount(loader: NofiPackLoader, entry: Dictionary) -> void:
    var invalid_path := "user://invalid-contract-smoke.pck"
    var file := FileAccess.open(invalid_path, FileAccess.WRITE)
    file.store_string("not a Godot pack")
    file.close()
    _expect_failure(
        loader,
        entry,
        {
            "localPackPath": invalid_path,
            "packSha256": FileAccess.get_sha256(invalid_path),
        },
        "Godot rejected the resource pack",
        "mount rejection",
    )
    DirAccess.remove_absolute(ProjectSettings.globalize_path(invalid_path))


func _test_candidate_pack(loader: NofiPackLoader, entry: Dictionary) -> void:
    var result := loader.load_local_pack(_entry_with_pack_copy(entry, "tide-ledger-valid"))
    if not result.get("ok", false):
        _failures.append("Tide Ledger pack load failed: %s" % result.get("error", "unknown"))
        return
    var game: NofiGamePack = result["instance"]
    root.add_child(game)
    var errors := NofiContractValidator.validate_instance(game)
    errors.append_array(NofiContractValidator.validate_deterministic_reset(game, 42))
    for error in errors:
        _failures.append("Tide Ledger: %s" % error)


func _test_resource_contract_failures(loader: NofiPackLoader, entry: Dictionary) -> void:
    _expect_failure(
        loader,
        _entry_with_pack_copy(entry, "scene-type"),
        {"entryScene": "res://game_packs/contract_smoke/main.gd"},
        "Entry scene did not resolve to PackedScene",
        "scene resource type",
    )
    _expect_failure(
        loader,
        _entry_with_pack_copy(entry, "script-type"),
        {"entryScript": "res://game_packs/contract_smoke/main.tscn"},
        "Entry script did not resolve to Script",
        "script resource type",
    )
    _expect_failure(
        loader,
        _entry_with_pack_copy(entry, "script-contract"),
        {"entryScript": "res://game_packs/contract_smoke/wrong_root.gd"},
        "Entry script does not extend NofiGamePack",
        "script contract",
    )


func _entry_with_pack_copy(entry: Dictionary, suffix: String) -> Dictionary:
    var copied := entry.duplicate(true)
    var source_path := ProjectSettings.globalize_path(str(entry["localPackPath"]))
    var destination := "user://contract-smoke-%s.pck" % suffix
    var destination_path := ProjectSettings.globalize_path(destination)
    DirAccess.remove_absolute(destination_path)
    var copy_error := DirAccess.copy_absolute(source_path, destination_path)
    if copy_error != OK:
        _failures.append("Could not copy fixture pack for %s: %s" % [suffix, copy_error])
    copied["localPackPath"] = destination
    return copied


func _expect_failure(
    loader: NofiPackLoader,
    base_entry: Dictionary,
    overrides: Dictionary,
    expected_error: String,
    label: String,
) -> void:
    var entry := base_entry.duplicate(true)
    entry.merge(overrides, true)
    var child_count := root.get_child_count()
    var result := loader.load_local_pack(entry)
    _assert_equal(result.get("ok", true), false, "%s result" % label)
    _assert_equal(result.get("error", ""), expected_error, "%s error" % label)
    _assert_equal(root.get_child_count(), child_count, "%s scene tree" % label)


func _assert_equal(actual: Variant, expected: Variant, label: String) -> void:
    if actual != expected:
        _failures.append("%s: expected %s, got %s" % [label, expected, actual])
