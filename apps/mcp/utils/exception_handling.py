class NotFoundError(Exception):
    pass

class UnauthorizedError(Exception):
    pass

class ServerError(Exception):
    pass

class BadRequestError(Exception):
    pass

class UnknownHTTPError(Exception):
    pass