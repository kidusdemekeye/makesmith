"""Deterministic, assumption-forward engineering checks."""

import itertools
import math


def _number(value, field, minimum=0):
    if value is None:
        return None
    if isinstance(value, bool) or not isinstance(value, (float, int)) or not math.isfinite(value) or value < minimum:
        raise ValueError("Invalid numeric engineering value: " + field)
    return float(value)


def _array3(value, field):
    if not isinstance(value, list) or len(value) != 3:
        return None
    result = [_number(item, field) for item in value]
    return result if all(item is not None for item in result) else None


def _check(identifier, label, status, result, reason, assumptions):
    return {"id": identifier, "label": label, "status": status, "result": result, "reason": reason, "assumptions": assumptions}


def calculate_checks(design):
    if not isinstance(design, dict) or not isinstance(design.get("engineering", {}), dict):
        raise ValueError("A structured design with engineering data is required.")
    data = design.get("engineering", {})
    consumers = data.get("consumers", []) or []
    parts = data.get("parts", []) or []
    strength = data.get("strength", []) or []
    if not all(isinstance(values, list) for values in (consumers, parts, strength)):
        raise ValueError("Engineering lists must be arrays.")
    checks = []

    supply_power = _number(data.get("supply_power_w"), "supply_power_w")
    consumer_watts = []
    consumer_currents = []
    electrical_conflicts = []
    power_complete = bool(consumers)
    current_complete = bool(consumers)
    for consumer in consumers:
        if not isinstance(consumer, dict):
            raise ValueError("Each power consumer must be an object.")
        voltage = _number(consumer.get("voltage_v"), "consumer.voltage_v")
        current = _number(consumer.get("current_a"), "consumer.current_a")
        power = _number(consumer.get("power_w"), "consumer.power_w")
        if power is None and voltage is not None and current is not None:
            power = voltage * current
        elif power is not None and voltage is not None and current is not None:
            calculated_power = voltage * current
            if abs(power - calculated_power) > max(0.1, abs(calculated_power) * 0.1):
                electrical_conflicts.append(consumer.get("name", "Unnamed load"))
        if power is None:
            power_complete = False
        else:
            consumer_watts.append(power)
        if current is None and power is not None and voltage is not None and voltage > 0:
            current = power / voltage
        if current is None:
            current_complete = False
        else:
            consumer_currents.append(current)
    if electrical_conflicts:
        checks.append(_check("power_budget", "Power budget", "unknown", None, "Contradictory voltage, current, and power ratings were provided for: " + ", ".join(electrical_conflicts) + ".", ["The check uses a 10% consistency tolerance; resolve the conflicting datasheet values before calculating power budget."]))
    elif supply_power is not None and power_complete:
        total_power = sum(consumer_watts)
        checks.append(_check("power_budget", "Power budget", "pass" if total_power <= supply_power else "warning", {"total_load_w": round(total_power, 3), "supply_limit_w": supply_power, "headroom_w": round(supply_power - total_power, 3)}, "Sum of component power loads compared with the rated supply limit.", ["This compares stated continuous ratings; startup peaks and thermal derating are not modeled."]))
    else:
        checks.append(_check("power_budget", "Power budget", "unknown", None, "Need a supply power rating and voltage/current or power for each load.", ["No missing electrical ratings are guessed."]))

    battery_mah = _number(data.get("battery_capacity_mah"), "battery_capacity_mah")
    if electrical_conflicts:
        checks.append(_check("battery_life", "Battery life", "unknown", None, "Battery runtime cannot be estimated while voltage/current/power ratings conflict for: " + ", ".join(electrical_conflicts) + ".", ["Resolve the conflicting electrical ratings before using a runtime estimate."]))
    elif battery_mah and battery_mah > 0 and current_complete:
        current_ma = sum(consumer_currents) * 1000
        hours = battery_mah * 0.8 / current_ma if current_ma > 0 else None
        if hours is None:
            checks.append(_check("battery_life", "Battery life", "unknown", None, "Runtime needs a nonzero steady current draw.", ["No runtime is inferred for zero or missing load."]))
        else:
            checks.append(_check("battery_life", "Battery life", "pass", {"estimated_hours": round(hours, 4), "total_current_ma": round(current_ma, 2)}, "Estimated from battery capacity and total steady current.", ["Assumes 80% usable battery capacity and a constant load; real runtime varies with temperature, age, and duty cycle."]))
    else:
        checks.append(_check("battery_life", "Battery life", "unknown", None, "Need battery capacity and voltage/current or power for each load.", ["No battery capacity or runtime is guessed."]))

    mass_complete = bool(parts)
    total_mass = 0.0
    for part in parts:
        if not isinstance(part, dict):
            raise ValueError("Each mass part must be an object.")
        mass = _number(part.get("mass_g"), "part.mass_g")
        quantity = _number(part.get("quantity"), "part.quantity", minimum=0)
        if quantity is None or quantity < 1 or not quantity.is_integer():
            raise ValueError("Part quantity must be a positive whole number.")
        if mass is None:
            mass_complete = False
        else:
            total_mass += mass * quantity
    checks.append(_check("total_weight", "Total weight", "pass" if mass_complete else "unknown", {"total_g": round(total_mass, 2)} if mass_complete else None, "Sum of listed component masses multiplied by quantity." if mass_complete else "Need a mass for every listed component.", [] if mass_complete else ["Only components with stated mass can be included."]))

    enclosure = _array3(data.get("enclosure_mm"), "enclosure_mm")
    fit_complete = enclosure is not None and bool(parts)
    fit_failures = []
    for part in parts:
        dimensions = _array3(part.get("dimensions_mm"), "part.dimensions_mm") if isinstance(part, dict) else None
        if dimensions is None:
            fit_complete = False
            continue
        if enclosure is not None and not any(all(dimensions[index] <= arrangement[index] for index in range(3)) for arrangement in itertools.permutations(enclosure)):
            fit_failures.append(part.get("name", "Unnamed part"))
    if fit_complete:
        checks.append(_check("fit", "Part fit", "warning" if fit_failures else "pass", {"parts_that_do_not_fit": fit_failures, "enclosure_mm": enclosure}, "Compares axis-aligned part dimensions against the enclosure in all 90-degree orientations.", ["Does not model cable clearance, fasteners, tolerances, or curved surfaces."]))
    else:
        checks.append(_check("fit", "Part fit", "unknown", None, "Need enclosure dimensions and dimensions for every listed part.", ["No fit is inferred from text descriptions."]))

    strength_results = []
    strength_complete = bool(strength)
    for item in strength:
        if not isinstance(item, dict):
            raise ValueError("Each strength input must be an object.")
        load = _number(item.get("load_n"), "strength.load_n")
        area = _number(item.get("cross_section_mm2"), "strength.cross_section_mm2")
        allowable = _number(item.get("allowable_stress_mpa"), "strength.allowable_stress_mpa")
        if load is None or load <= 0 or area is None or area <= 0 or allowable is None or allowable <= 0:
            strength_complete = False
            continue
        strength_results.append({"name": item.get("name", "Unnamed part"), "factor_of_safety": round(allowable * area / load, 2)})
    if strength_complete:
        minimum_factor = min(value["factor_of_safety"] for value in strength_results)
        checks.append(_check("basic_strength", "Basic strength", "pass" if minimum_factor >= 2 else "warning", {"minimum_safety_factor": minimum_factor, "parts": strength_results}, "Compares stated allowable tensile stress with stated direct load over cross-sectional area.", ["This simple axial-stress estimate does not account for bending, fatigue, print orientation, defects, or dynamic impacts."]))
    else:
        checks.append(_check("basic_strength", "Basic strength", "unknown", None, "Need a positive load, cross-sectional area, and allowable material stress for every checked part.", ["Material strength is not assumed from the part name."]))

    return {"checks": checks}


class ChecksService:
    def calculate(self, design):
        return calculate_checks(design)
