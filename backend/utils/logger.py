"""
DocMind AI - Logger
Structured logging with clear formatting for development and production
"""

import logging
import sys


def get_logger(name: str) -> logging.Logger:
    """
    Get a configured logger for the given module name.
    
    Args:
        name: Module name (use __name__)
        
    Returns:
        Configured Python logger
    """
    logger = logging.getLogger(name)

    if not logger.handlers:
        logger.setLevel(logging.INFO)

        handler = logging.StreamHandler(sys.stdout)
        handler.setLevel(logging.INFO)

        formatter = logging.Formatter(
            fmt="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)

    return logger
