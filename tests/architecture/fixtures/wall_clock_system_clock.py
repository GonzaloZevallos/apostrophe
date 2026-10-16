"""A negative control for `wall_clock_reads`: importing the app's real clock into a test."""

from app.clock import system_clock

reading = system_clock
