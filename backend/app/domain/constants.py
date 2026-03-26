RIR_SCHEMES: dict[int, list[int]] = {
    3: [2, 0, -1],
    4: [3, 1, 0, -1],
    5: [3, 2, 1, 0, -1],
    6: [3, 2, 1, 0, 0, -1],
    7: [3, 2, 2, 1, 1, 0, -1],
    8: [3, 3, 2, 2, 1, 1, 0, -1],
}

# Weight increment defaults by equipment type
WEIGHT_INCREMENTS = {
    "barbell": 2.5,
    "dumbbell": 2.0,
    "machine": 5.0,
    "cable": 2.5,
    "bodyweight": 0.0,
}
