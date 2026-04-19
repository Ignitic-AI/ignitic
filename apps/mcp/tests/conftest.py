from collections.abc import Sequence


def middleware_class_names(middlewares: Sequence[object]) -> set[str]:
    return {middleware.__class__.__name__ for middleware in middlewares}
