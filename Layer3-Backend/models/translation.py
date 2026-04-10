"""
Translation data models for multi-language support.

This module defines the TranslationSet model which encapsulates content
translated into multiple languages. It's used as a base for all translatable
content in the CrisisLink system (listings, descriptions, etc.).
"""

from typing import Dict, Optional
from pydantic import BaseModel, Field


class TranslationSet(BaseModel):
    """
    Encapsulates content translated into multiple languages.
    
    Attributes:
        en: English translation (always required as fallback)
        zh_CN: Simplified Chinese translation (optional)
        vi: Vietnamese translation (optional)
    
    Example:
        >>> translations = TranslationSet(
        ...     en="Fresh sourdough bread",
        ...     zh_CN="新鲜酸面包",
        ...     vi="Bánh mì chua tươi"
        ... )
    """
    en: str = Field(..., min_length=1, description="English content (required)")
    zh_CN: Optional[str] = Field(None, description="Simplified Chinese content")
    vi: Optional[str] = Field(None, description="Vietnamese content")
    
    class Config:
        json_schema_extra = {
            "example": {
                "en": "High-quality sourdough loaves",
                "zh_CN": "高品质酸面包",
                "vi": "Ổ bánh mì chua chất lượng cao"
            }
        }
    
    def get(self, language_code: str, fallback: str = None) -> str:
        """
        Retrieve translation for a specific language with fallback to English.
        
        Args:
            language_code: ISO 639-1 language code (e.g., 'en', 'zh-CN', 'vi')
            fallback: Optional fallback value if no translation found
        
        Returns:
            Translation string for requested language, or English if not found,
            or fallback value if provided and no English found
        
        Example:
            >>> t = TranslationSet(en="Bread", zh_CN="面包")
            >>> t.get('zh_CN')  # Returns "面包"
            >>> t.get('es')     # Returns "Bread" (fallback to English)
        """
        # Normalize language code (handle both 'zh-CN' and 'zh_CN')
        lang = language_code.replace('-', '_')
        
        # Try exact match first
        if lang == 'zh_CN' and self.zh_CN:
            return self.zh_CN
        if lang == 'vi' and self.vi:
            return self.vi
        
        # Fallback to English
        if self.en:
            return self.en
        
        # Last resort: return provided fallback
        return fallback or "Content unavailable"
    
    def to_dict(self, include_all: bool = False) -> Dict[str, str]:
        """
        Convert translations to dictionary format.
        
        Args:
            include_all: If False, only include languages with non-None values
        
        Returns:
            Dictionary mapping language codes to translated content
        """
        result = {'en': self.en}
        
        if self.zh_CN or include_all:
            result['zh_CN'] = self.zh_CN or self.en
        if self.vi or include_all:
            result['vi'] = self.vi or self.en
        
        return result
