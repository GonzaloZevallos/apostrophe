from babel.support import Translations

from app.shared import copy
from app.shared.copy import CopyCatalog


def words() -> tuple[object, object, object]:
    return (copy, CopyCatalog, Translations)
