extends Node2D

var _state: Dictionary = {}


func set_state(state: Dictionary) -> void:
    _state = state.duplicate(true)
    queue_redraw()


func action_for_screen_point(point: Vector2) -> String:
    var level: Dictionary = _state.get("level", {})
    var width := int(level.get("width", 0))
    var height := int(level.get("height", 0))
    if width <= 0 or height <= 0:
        return ""
    var controls := _control_rects()
    if controls["flip"].has_point(point) and not bool(_state.get("complete", false)) and not bool(_state.get("failed", false)):
        return "flip-tide"
    if controls["restart"].has_point(point):
        return "restart"
    if controls["next"].has_point(point) and bool(_state.get("complete", false)):
        return "next-level"
    var cell_size := _cell_size(width, height)
    var origin := _board_origin(width, height, cell_size)
    var local := (point - origin) / cell_size
    var x := int(floor(local.x))
    var y := int(floor(local.y))
    if x < 0 or x >= width or y < 0 or y >= height:
        return ""
    var position := y * width + x
    var player_position := int(level.get("player_position", -1))
    if position == player_position - width:
        return "move-up"
    if position == player_position + 1:
        return "move-right"
    if position == player_position + width:
        return "move-down"
    if position == player_position - 1:
        return "move-left"
    return ""


func _draw() -> void:
    draw_rect(Rect2(Vector2.ZERO, Vector2(1280, 720)), Color("0d1720"))
    var font := ThemeDB.fallback_font
    draw_string(font, Vector2(64, 58), "TIDE LEDGER", HORIZONTAL_ALIGNMENT_LEFT, -1, 34, Color("e8f0e7"))
    draw_string(
        font,
        Vector2(66, 88),
        "A shoreline changes with every tide. Stamp the markers, then reach the lighthouse.",
        HORIZONTAL_ALIGNMENT_LEFT,
        -1,
        17,
        Color("9eb4b2"),
    )

    var level: Dictionary = _state.get("level", {})
    var width := int(level.get("width", 0))
    var height := int(level.get("height", 0))
    if width <= 0 or height <= 0:
        return
    var cell_size := _cell_size(width, height)
    var origin := _board_origin(width, height, cell_size)
    var tiles: Array = level.get("tiles", [])
    var tide := int(_state.get("tide_phase", 0))
    var markers: Array = level.get("markers", [])
    var collected_mask := int(_state.get("markers_mask", 0))
    var goal := int(level.get("goal", -1))
    var player_position := int(level.get("player_position", -1))

    for position: int in range(tiles.size()):
        var x := position % width
        var y := int(position / width)
        var rect := Rect2(origin + Vector2(x, y) * cell_size, Vector2.ONE * (cell_size - 4.0))
        var tile := int(tiles[position])
        var color := Color("16242b")
        if tile == 1:
            color = Color("c4b88b")
        elif tile == 2:
            color = Color("73a7b5") if tide == 0 else Color("25434e")
        elif tile == 3:
            color = Color("d7bd74") if tide == 1 else Color("4b3e2c")
        draw_rect(rect, color, true)
        draw_rect(rect, Color("20343a"), false, 2.0)

    for marker_index: int in range(markers.size()):
        var marker_position := int(markers[marker_index])
        var marker_x := marker_position % width
        var marker_y := int(marker_position / width)
        var marker_center := origin + Vector2(marker_x + 0.5, marker_y + 0.5) * cell_size
        var stamped := (collected_mask & (1 << marker_index)) != 0
        draw_circle(marker_center, cell_size * 0.2, Color("e8f0e7") if stamped else Color("d46b5f"))
        draw_circle(marker_center, cell_size * 0.11, Color("57847e") if stamped else Color("512d2c"))

    if goal >= 0:
        var goal_x := goal % width
        var goal_y := int(goal / width)
        var goal_rect := Rect2(origin + Vector2(goal_x, goal_y) * cell_size + Vector2(7, 7), Vector2.ONE * (cell_size - 18))
        draw_rect(goal_rect, Color("f0d59a"), false, 4.0)
        draw_string(font, goal_rect.position + Vector2(12, 28), "L", HORIZONTAL_ALIGNMENT_LEFT, -1, 22, Color("f0d59a"))

    if player_position >= 0:
        var player_x := player_position % width
        var player_y := int(player_position / width)
        var player_center := origin + Vector2(player_x + 0.5, player_y + 0.5) * cell_size
        draw_circle(player_center, cell_size * 0.28, Color("f5f1dd"))
        draw_circle(player_center, cell_size * 0.19, Color("2c6872"))

    var difficulty := str(_state.get("difficulty", "shoal")).capitalize()
    var tide_label := "LOW TIDE" if tide == 0 else "HIGH TIDE"
    draw_string(font, Vector2(64, 590), "Level %d  ·  %s  ·  %s" % [int(_state.get("level_index", 0)) + 1, difficulty, tide_label], HORIZONTAL_ALIGNMENT_LEFT, -1, 22, Color("e8f0e7"))
    draw_string(font, Vector2(64, 624), "Arrows / WASD: move     Space: flip tide     R: restart     Tap a neighboring tile or visible control", HORIZONTAL_ALIGNMENT_LEFT, -1, 17, Color("9eb4b2"))
    var status := "Markers: %d / %d" % [int(_state.get("marker_count", 0)), markers.size()]
    if bool(_state.get("complete", false)):
        status = "Ledger stamped. Press N or tap Next Level."
    elif bool(_state.get("failed", false)):
        status = "The tide carried the route away. Press R to try again."
    draw_string(font, Vector2(760, 590), status, HORIZONTAL_ALIGNMENT_LEFT, 450, 18, Color("f0d59a"))

    var controls := _control_rects()
    _draw_button(font, controls["flip"], "FLIP TIDE", not bool(_state.get("complete", false)) and not bool(_state.get("failed", false)))
    _draw_button(font, controls["restart"], "RESTART", true)
    _draw_button(font, controls["next"], "NEXT LEVEL", bool(_state.get("complete", false)))


func _control_rects() -> Dictionary:
    return {
        "flip": Rect2(760, 650, 145, 48),
        "restart": Rect2(920, 650, 145, 48),
        "next": Rect2(1080, 650, 145, 48),
    }


func _draw_button(font: Font, rect: Rect2, label: String, enabled: bool) -> void:
    var fill := Color("2e6970") if enabled else Color("1d2c31")
    var text_color := Color("f5f1dd") if enabled else Color("617276")
    draw_rect(rect, fill, true)
    draw_rect(rect, Color("8fb9ad") if enabled else Color("304147"), false, 2.0)
    draw_string(font, rect.position + Vector2(14, 31), label, HORIZONTAL_ALIGNMENT_LEFT, -1, 16, text_color)


func _cell_size(width: int, height: int) -> float:
    return minf(48.0, minf(920.0 / float(width), 420.0 / float(height)))


func _board_origin(width: int, height: int, cell_size: float) -> Vector2:
    return Vector2(64, 126) + Vector2(0, (420.0 - float(height) * cell_size) * 0.5)
