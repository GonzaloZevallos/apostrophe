"""A negative control for `wall_clock_reads`: the same reads through import aliases, so
renaming an import hides nothing."""

import datetime as d
import time as t
from datetime import date as day
from datetime import datetime as dt
from time import time_ns as ns

moment = dt.utcnow()
today = day.today()
stamp = d.datetime.today()
epoch = t.time()
nanos = ns()
