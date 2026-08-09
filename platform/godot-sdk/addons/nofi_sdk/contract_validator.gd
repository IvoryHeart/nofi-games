class_name NofiContractValidator
extends RefCounted

const REQUIRED_METHODS: PackedStringArray = [
    "reset_game",
    "get_observation",
    "get_available_actions",
    "apply_action",
    "advance_simulation",
    "get_objectives",
    "get_metrics",
    "save_replay",
    "restore_replay",
]


static func validate_instance(instance: Node) -> PackedStringArray:
    var errors := PackedStringArray()
    if not instance is NofiGamePack:
        errors.append("Root must extend NofiGamePack")
        return errors

    for method_name in REQUIRED_METHODS:
        if not instance.has_method(method_name):
            errors.append("Missing method: %s" % method_name)

    var observation: Variant = instance.get_observation()
    if not observation is Dictionary:
        errors.append("get_observation() must return Dictionary")

    var actions: Variant = instance.get_available_actions()
    if not actions is Array:
        errors.append("get_available_actions() must return Array[Dictionary]")
    else:
        for action: Variant in actions:
            if not action is Dictionary or not action.has("id"):
                errors.append("Every available action must be a Dictionary with id")

    var objectives: Variant = instance.get_objectives()
    if not objectives is Array:
        errors.append("get_objectives() must return Array[Dictionary]")

    return errors

static func validate_deterministic_reset(instance: NofiGamePack, seed_value: int) -> PackedStringArray:
    var errors := PackedStringArray()
    instance.reset_game(seed_value)
    var first: Dictionary = instance.get_observation().duplicate(true)
    instance.reset_game(seed_value)
    var second: Dictionary = instance.get_observation().duplicate(true)
    if first != second:
        errors.append("Reset with an identical seed produced different observations")
    return errors
