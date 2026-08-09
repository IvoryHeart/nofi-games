extends SceneTree


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

    var entry: Dictionary = catalog["entries"][0]
    if entry.get("discoverable", true) or entry.get("status") != "fixture":
        push_error("Contract fixture must remain hidden")
        quit(1)
        return

    var result := NofiPackLoader.new().load_local_pack(entry)
    if not result.get("ok", false):
        push_error("Fixture pack load failed: %s" % result.get("error", "unknown"))
        quit(1)
        return

    var game: NofiGamePack = result["instance"]
    root.add_child(game)
    var errors := NofiContractValidator.validate_instance(game)
    errors.append_array(NofiContractValidator.validate_deterministic_reset(game, 42))
    if not errors.is_empty():
        for error in errors:
            push_error(error)
        quit(1)
        return

    print("NOFI_SINGLE_APP_PACK_LOAD_OK")
    quit(0)
