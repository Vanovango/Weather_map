def validate_request(data: dict) -> None:
    required_fields = ["lat", "lon", "parameters"]

    for field in required_fields:
        if field not in data:
            raise ValueError(f"Missing field: {field}")

    if not isinstance(data["parameters"], list) or not data["parameters"]:
        raise ValueError("Parameters must be a non-empty list")
