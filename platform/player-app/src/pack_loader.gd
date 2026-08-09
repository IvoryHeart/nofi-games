class_name NofiPackLoader
extends RefCounted


func load_local_pack(entry: Dictionary) -> Dictionary:
    var pack_path := str(entry.get("localPackPath", ""))
    var expected_hash := str(entry.get("packSha256", ""))
    var entry_scene := str(entry.get("entryScene", ""))
    var entry_script := str(entry.get("entryScript", ""))

    if pack_path.is_empty() or not FileAccess.file_exists(pack_path):
        return {"ok": false, "error": "Pack is unavailable locally"}
    if expected_hash.length() != 64:
        return {"ok": false, "error": "Catalog pack hash is invalid"}
    if FileAccess.get_sha256(pack_path) != expected_hash:
        return {"ok": false, "error": "Pack integrity check failed"}
    if not entry_scene.begins_with("res://game_packs/"):
        return {"ok": false, "error": "Entry scene is outside the game-pack namespace"}
    if not entry_script.begins_with("res://game_packs/"):
        return {"ok": false, "error": "Entry script is outside the game-pack namespace"}
    if not ProjectSettings.load_resource_pack(pack_path, false):
        return {"ok": false, "error": "Godot rejected the resource pack"}

    var resource: Resource = load(entry_scene)
    if not resource is PackedScene:
        return {"ok": false, "error": "Entry scene did not resolve to PackedScene"}
    var script: Resource = load(entry_script)
    if not script is Script:
        return {"ok": false, "error": "Entry script did not resolve to Script"}

    var instance := (resource as PackedScene).instantiate()
    instance.set_script(script)
    if not instance is NofiGamePack:
        instance.free()
        return {"ok": false, "error": "Entry script does not extend NofiGamePack"}
    return {"ok": true, "instance": instance}
