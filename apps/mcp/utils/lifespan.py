import contextlib

def combine_lifespans(*lifespans):
    """
    Combine multiple lifespan context managers into one.
    This allows for managing multiple session managers in a single lifespan context.
    Args:
        *lifespans: A variable number of lifespan context managers to combine.
    Returns:
        A combined lifespan context manager that yields control to the application.
    """
    @contextlib.asynccontextmanager
    async def combined_lifespan(app):
        async with contextlib.AsyncExitStack() as stack:
            for lifespan in lifespans:
                await stack.enter_async_context(lifespan(app))
            yield

    return combined_lifespan