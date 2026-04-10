"""
Backend services module for CrisisLink.

This package contains business logic services including:
- Mock data generation for demonstration
- Translation engine for multi-language support
- Matching engine for smart food-organization pairing
- Database services for CRUD operations
"""

from .mock_data import MockDataGenerator
from .translation_engine import TranslationEngine, get_translator
from .matching_engine import MatchingEngine, get_matching_engine

__all__ = [
    'MockDataGenerator',
    'TranslationEngine',
    'get_translator',
    'MatchingEngine',
    'get_matching_engine',
]
