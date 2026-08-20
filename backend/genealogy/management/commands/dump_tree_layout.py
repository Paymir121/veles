"""Print the current tree grid as readable text.

Usage (from repo root):
    py dump_tree_layout.py
    py dump_tree_layout.py --q Логинов
"""
from __future__ import annotations

import sys

from django.core.management.base import BaseCommand

from genealogy.services import serialize_tree
from genealogy.tree_layout_dump import format_tree_layout


class Command(BaseCommand):
    help = (
        "Dump Person x/y grid cells from serialize_tree in a form an agent "
        "can read: rows, families, and packing checks."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--q",
            default="",
            help="Show people whose name contains this substring, plus parents/spouses/children.",
        )

    def handle(self, *args, **options):
        if hasattr(sys.stdout, "reconfigure"):
            sys.stdout.reconfigure(encoding="utf-8")
        payload = serialize_tree(None)
        self.stdout.write(format_tree_layout(payload["nodes"], query=options["q"]))
