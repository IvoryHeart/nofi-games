extends RefCounted

var _payload: Dictionary
var _content_hash: String


func _init(payload: Dictionary) -> void:
    _payload = payload.duplicate(true)
    _content_hash = _hash_payload(_content_payload())


func to_dict() -> Dictionary:
    return _payload.duplicate(true)


func content_hash() -> String:
    return _content_hash


func get_value(key: String, fallback: Variant = null) -> Variant:
    return _copy_value(_payload.get(key, fallback))


func get_tiles() -> Array:
    return (_payload.get("tiles", []) as Array).duplicate(true)


func get_markers() -> Array:
    return (_payload.get("markers", []) as Array).duplicate(true)


func get_measured() -> Dictionary:
    return (_payload.get("measured", {}) as Dictionary).duplicate(true)


func generation_attempts() -> int:
    return int(_payload.get("generation_attempts", 0))


func used_fallback() -> bool:
    return bool(_payload.get("used_fallback", false))


func _copy_value(value: Variant) -> Variant:
    if value is Array or value is Dictionary:
        return value.duplicate(true)
    return value


func _content_payload() -> Dictionary:
    var content := _payload.duplicate(true)
    content.erase("generation_attempts")
    content.erase("used_fallback")
    return content


func _hash_payload(payload: Dictionary) -> String:
    var hashing := HashingContext.new()
    hashing.start(HashingContext.HASH_SHA256)
    hashing.update(_canonical_json(payload).to_utf8_buffer())
    return hashing.finish().hex_encode()


func _canonical_json(value: Variant) -> String:
    if value is Dictionary:
        var keys: Array = value.keys()
        keys.sort()
        var members: Array[String] = []
        for key: Variant in keys:
            members.append(JSON.stringify(str(key)) + ":" + _canonical_json(value[key]))
        return "{" + ",".join(members) + "}"
    if value is Array:
        var items: Array[String] = []
        for item: Variant in value:
            items.append(_canonical_json(item))
        return "[" + ",".join(items) + "]"
    if value is String:
        return JSON.stringify(value)
    if value is bool:
        return "true" if value else "false"
    if value == null:
        return "null"
    return str(value)
