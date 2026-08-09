extends Control

const GENERATED_CATALOG_PATH := "res://catalog/catalog.generated.json"
const BASE_CATALOG_PATH := "res://catalog/catalog.base.json"

var _content: VBoxContainer


func _ready() -> void:
    _build_shell()
    _render_catalog()


func _build_shell() -> void:
    var background := ColorRect.new()
    background.color = Color("10131a")
    background.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
    add_child(background)

    var margin := MarginContainer.new()
    margin.add_theme_constant_override("margin_left", 48)
    margin.add_theme_constant_override("margin_top", 40)
    margin.add_theme_constant_override("margin_right", 48)
    margin.add_theme_constant_override("margin_bottom", 40)
    margin.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
    add_child(margin)

    _content = VBoxContainer.new()
    _content.add_theme_constant_override("separation", 16)
    margin.add_child(_content)

    var title := Label.new()
    title.text = "NOFI"
    title.add_theme_font_size_override("font_size", 44)
    _content.add_child(title)

    var subtitle := Label.new()
    subtitle.text = "One living game app. Research decides what belongs here."
    subtitle.add_theme_color_override("font_color", Color("a9b3c7"))
    subtitle.add_theme_font_size_override("font_size", 20)
    _content.add_child(subtitle)


func _render_catalog() -> void:
    var catalog := _read_catalog()
    var discoverable: Array = catalog.get("entries", []).filter(
        func(entry: Dictionary) -> bool: return entry.get("discoverable", false)
    )

    if discoverable.is_empty():
        var empty := Label.new()
        empty.text = "The research pipeline has not promoted a game yet."
        empty.add_theme_font_size_override("font_size", 24)
        empty.add_theme_color_override("font_color", Color("d7deed"))
        _content.add_child(empty)

        var detail := Label.new()
        detail.text = "Contract fixtures remain hidden. Qualified games will appear through the signed catalog."
        detail.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
        detail.add_theme_color_override("font_color", Color("7f8ba3"))
        _content.add_child(detail)
        return

    for entry: Dictionary in discoverable:
        var button := Button.new()
        button.text = str(entry.get("title", entry.get("id", "Untitled")))
        button.pressed.connect(_launch_catalog_entry.bind(entry))
        _content.add_child(button)


func _read_catalog() -> Dictionary:
    var catalog_path := (
        GENERATED_CATALOG_PATH if FileAccess.file_exists(GENERATED_CATALOG_PATH) else BASE_CATALOG_PATH
    )
    if not FileAccess.file_exists(catalog_path):
        push_error("Catalog is missing: %s" % catalog_path)
        return {"entries": []}
    var file := FileAccess.open(catalog_path, FileAccess.READ)
    var parsed: Variant = JSON.parse_string(file.get_as_text())
    if not parsed is Dictionary:
        push_error("Catalog is not a JSON object")
        return {"entries": []}
    return parsed


func _launch_catalog_entry(entry: Dictionary) -> void:
    var loader := NofiPackLoader.new()
    var result := loader.load_local_pack(entry)
    if not result.get("ok", false):
        push_error(str(result.get("error", "Unknown pack load failure")))
        return
    var instance: NofiGamePack = result["instance"]
    get_tree().root.add_child(instance)
    hide()
