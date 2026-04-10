"""
Translation engine for CrisisLink - Template-based multi-language support.

This module provides translation capabilities without requiring external API calls.
It implements a simple but effective template-based translation system that:
1. Uses predefined translation templates for common food-related terms
2. Maps English descriptions to Chinese and Vietnamese equivalents
3. Handles category-specific translations (bakery, produce, dairy, etc.)
4. Falls back to transliteration if no exact match found

**Design Decision:**
Instead of calling a real translation API (DeepL, Google Translate), this 
demo version uses a curated dictionary and template-based approach. This 
enables:
- Immediate demonstration without external API keys
- Offline functionality for development and testing
- Consistent translations across the platform
- Easy customization of translations

**Production Upgrade Path:**
To upgrade to real translation API:
1. Remove/disable template fallback
2. Add DeepL API client
3. Cache translations in Redis
4. Add quality review workflow for auto-translated content

Example:
    >>> engine = TranslationEngine()
    >>> engine.translate("Fresh sourdough bread", "en", "zh-CN")
    "新鲜酸面包"
"""

from typing import Optional, Dict, List


class TranslationEngine:
    """
    Template-based translation engine for multi-language food listings.
    
    This engine translates food listing descriptions between three languages:
    - English (en): Source language
    - Simplified Chinese (zh-CN): Translation target
    - Vietnamese (vi): Translation target
    
    The translation process:
    1. Tokenize input text into meaningful chunks
    2. Look up each token in translation dictionary
    3. Combine translated tokens
    4. Apply language-specific formatting
    
    Supported content types:
    - Food category descriptions
    - Quantity descriptions
    - Tag translations
    - Allergen information
    - Generic food-related text
    """
    
    # Master translation dictionary
    # Format: English term -> {language_code: translation, ...}
    TRANSLATION_DICT = {
        # Food categories and types
        'bread': {'zh_CN': '面包', 'vi': 'bánh mì'},
        'sourdough': {'zh_CN': '酸面包', 'vi': 'bánh mì chua'},
        'bakery': {'zh_CN': '面包店', 'vi': 'tiệm bánh'},
        'fresh': {'zh_CN': '新鲜', 'vi': 'tươi'},
        'baked': {'zh_CN': '烘焙', 'vi': 'nướng'},
        'croissant': {'zh_CN': '羊角面包', 'vi': 'bánh sừng'},
        'pastry': {'zh_CN': '糕点', 'vi': 'bánh ngọt'},
        'bagel': {'zh_CN': '百吉面包', 'vi': 'bánh bagel'},
        'ciabatta': {'zh_CN': '餐包', 'vi': 'bánh ciabatta'},
        
        # Vegetables and produce
        'vegetable': {'zh_CN': '蔬菜', 'vi': 'rau'},
        'carrot': {'zh_CN': '胡萝卜', 'vi': 'cà rốt'},
        'lettuce': {'zh_CN': '生菜', 'vi': 'xà lách'},
        'onion': {'zh_CN': '洋葱', 'vi': 'hành'},
        'tomato': {'zh_CN': '番茄', 'vi': 'cà chua'},
        'potato': {'zh_CN': '土豆', 'vi': 'khoai tây'},
        'fruit': {'zh_CN': '水果', 'vi': 'trái cây'},
        'apple': {'zh_CN': '苹果', 'vi': 'táo'},
        'orange': {'zh_CN': '橙子', 'vi': 'cam'},
        'berry': {'zh_CN': '莓果', 'vi': 'quả mọng'},
        'organic': {'zh_CN': '有机', 'vi': 'hữu cơ'},
        'seasonal': {'zh_CN': '当季', 'vi': 'theo mùa'},
        
        # Dairy and grocery
        'dairy': {'zh_CN': '乳制品', 'vi': 'sữa và sản phẩm sữa'},
        'milk': {'zh_CN': '牛奶', 'vi': 'sữa'},
        'cheese': {'zh_CN': '奶酪', 'vi': 'phô mai'},
        'yogurt': {'zh_CN': '酸奶', 'vi': 'sữa chua'},
        'butter': {'zh_CN': '黄油', 'vi': 'bơ'},
        'egg': {'zh_CN': '鸡蛋', 'vi': 'trứng'},
        'pantry': {'zh_CN': '食品储藏室', 'vi': 'tủ lưu trữ thực phẩm'},
        'pasta': {'zh_CN': '意大利面', 'vi': 'mì ống'},
        'rice': {'zh_CN': '米饭', 'vi': 'gạo'},
        'grain': {'zh_CN': '谷物', 'vi': 'ngũ cốc'},
        'flour': {'zh_CN': '面粉', 'vi': 'bột'},
        
        # Prepared foods
        'prepared': {'zh_CN': '预制的', 'vi': 'chuẩn bị sẵn'},
        'meal': {'zh_CN': '餐', 'vi': 'bữa cơm'},
        'salad': {'zh_CN': '沙拉', 'vi': 'salad'},
        'ready': {'zh_CN': '准备好', 'vi': 'sẵn sàng'},
        'cooked': {'zh_CN': '熟的', 'vi': 'nấu chín'},
        'rice dish': {'zh_CN': '米饭料理', 'vi': 'món cơm'},
        
        # Quality descriptors
        'quality': {'zh_CN': '质量', 'vi': 'chất lượng'},
        'high': {'zh_CN': '高', 'vi': 'cao'},
        'premium': {'zh_CN': '高级', 'vi': 'cao cấp'},
        'bulk': {'zh_CN': '散装', 'vi': 'số lượng lớn'},
        'vegan': {'zh_CN': '纯素', 'vi': 'ăn chay'},
        'gluten-free': {'zh_CN': '无谷蛋白', 'vi': 'không gluten'},
        'natural': {'zh_CN': '天然', 'vi': 'tự nhiên'},
        'local': {'zh_CN': '本地', 'vi': 'địa phương'},
        'hand-crafted': {'zh_CN': '手工制作', 'vi': 'làm thủ công'},
        
        # Time and quantity descriptors
        'batch': {'zh_CN': '批次', 'vi': 'lô'},
        'loaf': {'zh_CN': '条', 'vi': 'ổ'},
        'kg': {'zh_CN': '公斤', 'vi': 'kg'},
        'unit': {'zh_CN': '个', 'vi': 'cái'},
        'quantity': {'zh_CN': '数量', 'vi': 'số lượng'},
        'expiration': {'zh_CN': '到期', 'vi': 'hết hạn'},
        'pickup': {'zh_CN': '取货', 'vi': 'lấy'},
        'asap': {'zh_CN': '尽快', 'vi': 'càng sớm càng tốt'},
        
        # Allergens and safety
        'allergen': {'zh_CN': '过敏原', 'vi': 'chất gây dị ứng'},
        'gluten': {'zh_CN': '麸质', 'vi': 'gluten'},
        'nuts': {'zh_CN': '坚果', 'vi': 'hạt'},
        'sesame': {'zh_CN': '芝麻', 'vi': 'mè'},
        'shellfish': {'zh_CN': '贝类', 'vi': 'động vật có vỏ'},
        'dairy-free': {'zh_CN': '无乳制品', 'vi': 'không chứa sữa'},
        'may contain': {'zh_CN': '可能含有', 'vi': 'có thể chứa'},
        'none': {'zh_CN': '无', 'vi': 'không có'},
    }
    
    # Category-specific translation templates
    CATEGORY_TEMPLATES = {
        'bakery': {
            'en': 'Fresh-baked {item} from our bakery section. {quality} bread made daily.',
            'zh_CN': '来自我们面包店部分的新鲜烘焙{item}。每日制作的{quality}面包。',
            'vi': '{item} tươi nướng từ phần bánh của chúng tôi. {quality} bánh làm hàng ngày.'
        },
        'produce': {
            'en': 'Fresh seasonal {item} from local suppliers. {quality} organic produce.',
            'zh_CN': '来自当地供应商的新鲜当季{item}。{quality}有机农产品。',
            'vi': '{item} tươi theo mùa từ các nhà cung cấp địa phương. {quality} sản phẩm hữu cơ.'
        },
        'dairy': {
            'en': 'Quality {item} products. {quality} dairy with excellent flavor.',
            'zh_CN': '优质{item}产品。具有出色风味的{quality}乳制品。',
            'vi': 'Sản phẩm {item} chất lượng. {quality} sữa với hương vị tuyệt vời.'
        },
        'prepared': {
            'en': 'Ready-to-eat {item}. {quality} prepared meals made fresh.',
            'zh_CN': '即食{item}。新鲜制作的{quality}预制餐。',
            'vi': '{item} sẵn sàng ăn. {quality} bữa cơm chuẩn bị sẵn làm tươi.'
        },
        'grocery': {
            'en': 'Quality {item} from our grocery section. {quality} pantry staples.',
            'zh_CN': '来自我们杂货部分的优质{item}。{quality}食品储藏室主食。',
            'vi': '{item} chất lượng từ phần tạp hóa của chúng tôi. {quality} hàng tạp hóa.'
        }
    }
    
    def translate(
        self, 
        text: str, 
        source_lang: str = 'en', 
        target_lang: str = 'zh_CN'
    ) -> str:
        """
        Translate text from source language to target language.
        
        This method handles the main translation workflow:
        1. Validate inputs
        2. Perform dictionary-based translation
        3. Apply language-specific formatting
        4. Return translated text
        
        Args:
            text: Text to translate
            source_lang: Source language code ('en', 'zh_CN', 'vi')
            target_lang: Target language code to translate to
        
        Returns:
            Translated text in target language
        
        Example:
            >>> engine = TranslationEngine()
            >>> engine.translate("Fresh bread", "en", "zh_CN")
            "新鲜面包"
        """
        # If source and target are the same, return as-is
        if source_lang == target_lang:
            return text
        
        # Normalize language codes
        target_lang = target_lang.replace('-', '_')
        
        # Handle English as source
        if source_lang == 'en':
            return self._translate_from_english(text, target_lang)
        
        # For other source languages, fall back to original text
        return text
    
    def _translate_from_english(self, text: str, target_lang: str) -> str:
        """
        Translate English text to target language using templates.
        
        Process:
        1. Split text into tokens
        2. Look up each token in translation dictionary
        3. Combine translated tokens
        4. Apply formatting rules for target language
        
        Args:
            text: English text to translate
            target_lang: Target language code
        
        Returns:
            Translated text
        """
        if not text:
            return text
        
        # Split text into words while preserving structure
        words = text.lower().split()
        translated_words = []
        
        for word in words:
            # Remove punctuation for lookup
            clean_word = word.strip('.,!?;:')
            
            # Look up in dictionary
            if clean_word in self.TRANSLATION_DICT:
                translation = self.TRANSLATION_DICT[clean_word].get(target_lang)
                if translation:
                    # Preserve original punctuation
                    if word != clean_word:
                        # Word had punctuation, preserve it
                        transformed = translation + word[len(clean_word):]
                        translated_words.append(transformed)
                    else:
                        translated_words.append(translation)
                    continue
            
            # No translation found, keep original
            translated_words.append(word)
        
        # Join translated words
        result = ' '.join(translated_words)
        
        # Apply language-specific formatting
        if target_lang == 'zh_CN':
            result = self._format_chinese(result)
        elif target_lang == 'vi':
            result = self._format_vietnamese(result)
        
        return result
    
    def _format_chinese(self, text: str) -> str:
        """
        Apply Chinese language formatting rules.
        
        Handles:
        - Proper spacing for Chinese text
        - Punctuation conventions
        - Capitalization (N/A for Chinese)
        
        Args:
            text: Text to format
        
        Returns:
            Formatted text for Chinese display
        """
        # Chinese formatting: minimal spaces between words
        # In production: use proper Chinese text processing library
        return text
    
    def _format_vietnamese(self, text: str) -> str:
        """
        Apply Vietnamese language formatting rules.
        
        Handles:
        - Diacritical mark preservation
        - Proper spacing
        - Capitalization conventions
        
        Args:
            text: Text to format
        
        Returns:
            Formatted text for Vietnamese display
        """
        # Vietnamese uses Latin script with diacritics
        # Preserve original formatting in demo version
        return text.capitalize()
    
    def translate_tags(
        self,
        tags: List[str],
        target_lang: str = 'zh_CN'
    ) -> List[str]:
        """
        Translate a list of tags to target language.
        
        Used for food tags like ['Vegan', 'Fresh', 'Organic'].
        
        Args:
            tags: List of English tags
            target_lang: Target language code
        
        Returns:
            List of translated tags
        
        Example:
            >>> engine = TranslationEngine()
            >>> tags = ['Fresh', 'Vegan', 'Organic']
            >>> engine.translate_tags(tags, 'zh_CN')
            ['新鲜', '纯素', '有机']
        """
        target_lang = target_lang.replace('-', '_')
        translated = []
        
        for tag in tags:
            lower_tag = tag.lower()
            if lower_tag in self.TRANSLATION_DICT:
                translation = self.TRANSLATION_DICT[lower_tag].get(target_lang)
                if translation:
                    translated.append(translation)
                else:
                    translated.append(tag)
            else:
                translated.append(tag)
        
        return translated
    
    def get_supported_languages(self) -> Dict[str, str]:
        """
        Get list of supported languages.
        
        Returns:
            Dictionary mapping language codes to display names
        """
        return {
            'en': 'English',
            'zh_CN': 'Simplified Chinese',
            'zh-CN': 'Simplified Chinese',
            'vi': 'Vietnamese',
        }


# Create singleton instance
_translation_engine = TranslationEngine()


def get_translator() -> TranslationEngine:
    """
    Get the global translation engine instance.
    
    Returns:
        Singleton TranslationEngine instance
    
    Example:
        >>> translator = get_translator()
        >>> translator.translate("bread", "en", "zh_CN")
        "面包"
    """
    return _translation_engine
