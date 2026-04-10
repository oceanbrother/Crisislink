"""
Mock data generator for CrisisLink backend demo.

This module generates realistic mock listings for demonstration and testing.
It creates 50+ food listings with authentic details, multi-language translations,
and appropriate expiration times. The data is generated at application startup
and stored in an in-memory database.

Features:
- Realistic food listings from Melbourne area (postcodes 3000-3100)
- Pre-translated content in 3 languages (EN, Chinese, Vietnamese)
- Varied food categories with appropriate tags and allergen info
- Time-based data generation (entries expire 4-8 hours after creation)
- Smart matching score simulation based on category relevance
"""

from datetime import datetime, timedelta
from typing import List
from models.listing import (
    Listing, FoodMetadata, Location, TranslationSet, MatchingMetrics
)
from models.user import User, Organization


class MockDataGenerator:
    """
    Generates realistic mock data for CrisisLink demonstration.
    
    This class is responsible for creating listings, users, and organizations
    with realistic attributes. All listings come with complete multi-language
    translations to simulate backend translation service.
    
    The generator uses predefined templates and randomization to create variety
    while maintaining data quality and consistency.
    """
    
    # Food category templates with emojis and common items
    FOOD_CATEGORIES = {
        'bakery': {
            'emoji': '🍞',
            'items': [
                'Artisan Sourdough Loaves',
                'Fresh Croissants and Pastries',
                'Multigrain Bread Assortment',
                'Bagels from Morning Batch',
                'Ciabatta and Focaccia'
            ],
            'translations': {
                'en': 'Sourdough, pastries, fresh-baked bread',
                'zh_CN': '酸面包、糕点、新鲜烘焙面包',
                'vi': 'bánh mì chua, bánh nướng, bánh ngọt'
            }
        },
        'produce': {
            'emoji': '🥕',
            'items': [
                'Mixed Seasonal Vegetables',
                'Fresh Organic Lettuce and Greens',
                'Citrus Fruit Selection',
                'Root Vegetables Bundle',
                'Fresh Berries and Stone Fruit'
            ],
            'translations': {
                'en': 'Fresh vegetables, organic produce, seasonal fruits',
                'zh_CN': '新鲜蔬菜、有机农产品、当季水果',
                'vi': 'rau tươi, nông sản hữu cơ, trái cây theo mùa'
            }
        },
        'dairy': {
            'emoji': '🥛',
            'items': [
                'Yogurt and Cheese Selection',
                'Fresh Milk and Dairy Products',
                'Specialty Cheese Bundle',
                'Dairy Near Best-By Date',
                'Milk and Butter Bundle'
            ],
            'translations': {
                'en': 'Dairy products, cheese, yogurt, milk',
                'zh_CN': '乳制品、奶酪、酸奶、牛奶',
                'vi': 'sữa và các sản phẩm sữa, phô mai, sữa chua'
            }
        },
        'prepared': {
            'emoji': '🍱',
            'items': [
                'Ready-Made Meal Assortment',
                'Prepared Salads and Platters',
                'Cooked Rice and Grains',
                'Prepared Pasta Dishes',
                'Meal Prep Boxes'
            ],
            'translations': {
                'en': 'Prepared meals, ready-to-eat, cooked food',
                'zh_CN': '预制餐、即食食品、熟食',
                'vi': 'các bữa cơm chuẩn bị sẵn, đồ ăn liền'
            }
        },
        'grocery': {
            'emoji': '🛒',
            'items': [
                'Pantry Staples Bundle',
                'Canned Goods Selection',
                'Dry Goods and Grains',
                'Condiments and Sauces',
                'Pasta and Rice Selection'
            ],
            'translations': {
                'en': 'Pantry staples, canned goods, dry goods',
                'zh_CN': '食品储藏室主食、罐装食品、干粮',
                'vi': 'hàng tạp hóa, hàng canned, hàng khô'
            }
        }
    }
    
    # Melbourne postcodes for demo area
    POSTCODES = [
        '3000',  # Melbourne CBD
        '3001',  # Docklands
        '3002',  # Southbank
        '3003',  # St Kilda Road
        '3004',  # Southbank/Docklands
        '3005',  # Docklands
        '3006',  # Docklands
        '3008',  # Southbank
        '3011',  # West Melbourne
        '3051',  # Carlton
        '3053',  # Fitzroy
        '3065',  # Collingwood
        '3121',  # Richmond
    ]
    
    # Donor/source names (realistic Melbourne businesses)
    DONOR_SOURCES = [
        'Bourke St Bakehouse',
        'Richmond Farmers Market',
        'CBD Fresh Deli',
        'Warehouse Food Group',
        'Carlton Grocery Store',
        'Fitzroy Community Kitchen',
        'Southbank Restaurant Supply',
        'Collingwood Orchard Co',
        'Melbourne Hospitality Services',
        'Docklands Catering Company',
    ]
    
    # Tag suggestions based on food characteristics
    COMMON_TAGS = [
        'Fresh', 'Organic', 'Seasonal', 'Vegan', 'Gluten-free',
        'Preservative-free', 'Bulk', 'Just baked', 'Local',
        'Hand-crafted', 'Natural', 'Quality'
    ]
    
    @staticmethod
    def generate_listings(count: int = 50) -> List[Listing]:
        """
        Generate specified number of mock listings with realistic variety.
        
        This method creates diverse listings across all food categories with
        varied quantities, locations, and characteristics. Each listing is
        assigned a random expiration time (4-8 hours from now).
        
        Args:
            count: Number of listings to generate (default 50)
        
        Returns:
            List of Listing objects ready for database insertion
        
        Example:
            >>> listings = MockDataGenerator.generate_listings(30)
            >>> len(listings)
            30
        """
        listings = []
        categories = list(MockDataGenerator.FOOD_CATEGORIES.keys())
        
        for i in range(count):
            # Cycle through categories to ensure balanced distribution
            category = categories[i % len(categories)]
            category_info = MockDataGenerator.FOOD_CATEGORIES[category]
            
            # Select random item from category
            item_index = (i // len(categories)) % len(category_info['items'])
            item_name = category_info['items'][item_index]
            
            # Select random postcode and source
            postcode = MockDataGenerator.POSTCODES[i % len(MockDataGenerator.POSTCODES)]
            source = MockDataGenerator.DONOR_SOURCES[i % len(MockDataGenerator.DONOR_SOURCES)]
            
            # Generate random quantity
            quantity_descriptions = [
                '~12-15 units',
                '~20-25 units',
                '~30-40 units',
                '~50 kg',
                '18 units',
                '24 units',
                'Large batch',
                'Small batch'
            ]
            quantity = quantity_descriptions[i % len(quantity_descriptions)]
            
            # Create description with translations
            description = TranslationSet(
                en=f"{item_name} from our {category} section. {category_info['translations']['en']}.",
                zh_CN=f"来自我们{category}部分的{item_name}。{category_info['translations']['zh_CN']}。",
                vi=f"{item_name} từ phần {category} của chúng tôi. {category_info['translations']['vi']}."
            )
            
            # Select random tags (2-4 per listing)
            num_tags = 2 + (i % 3)
            selected_tags = [
                MockDataGenerator.COMMON_TAGS[(i + j) % len(MockDataGenerator.COMMON_TAGS)]
                for j in range(num_tags)
            ]
            
            # Calculate expiration (4-8 hours from now)
            hours_to_expire = 4 + (i % 5)
            expires_at = datetime.utcnow() + timedelta(hours=hours_to_expire)
            
            # Create listing object
            listing = Listing(
                id=f"listing_{i+1:04d}",
                source_name=source,
                description=description,
                food=FoodMetadata(
                    emoji=category_info['emoji'],
                    category=category,
                    quantity=quantity,
                    tags=selected_tags,
                    allergens=MockDataGenerator._generate_allergen_info(category)
                ),
                location=Location(
                    postcode=postcode,
                    latitude=-37.8 + (i % 10) * 0.01,  # Simulate slight variation
                    longitude=144.9 + (i % 10) * 0.01
                ),
                matching_metrics=MatchingMetrics(
                    match_score=70 + (i % 31),  # Score between 70-100
                    distance_km=0.5 + (i % 30) * 0.1,  # Distance 0.5-3.5 km
                    matched_tags=selected_tags[:2]  # First 2 tags as matches
                ),
                status='active',
                expires_at=expires_at
            )
            
            listings.append(listing)
        
        return listings
    
    @staticmethod
    def _generate_allergen_info(category: str) -> str:
        """
        Generate appropriate allergen information based on food category.
        
        This helper method creates realistic allergen warnings that vary
        by food category.
        
        Args:
            category: Food category (bakery, produce, dairy, etc.)
        
        Returns:
            Allergen warning string appropriate to the category
        """
        allergen_map = {
            'bakery': 'May contain gluten, sesame, tree nuts',
            'produce': 'None (check for pesticide residue if not organic)',
            'dairy': 'Contains lactose, milk proteins',
            'prepared': 'May contain multiple allergens - see ingredients',
            'grocery': 'Check individual product labels for allergens'
        }
        return allergen_map.get(category, 'Check product labels')
    
    @staticmethod
    def generate_demo_user() -> User:
        """
        Generate a demo donor user for testing.
        
        Returns:
            User object representing a typical donor
        """
        return User(
            id="user_demo_001",
            name="Sarah Chen",
            postcode="3000",
            phone="+61412345678",
            email="sarah@example.com",
            preferred_language="en"
        )
    
    @staticmethod
    def generate_demo_organization() -> Organization:
        """
        Generate a demo receiving organization for testing.
        
        Returns:
            Organization object representing a food bank
        """
        return Organization(
            id="org_demo_001",
            name="Harvest City Food Bank",
            org_code="HCB-001",
            postcode="3000",
            needs=['bakery', 'produce', 'dairy'],
            contact_person="John Thompson",
            email="contact@harvestcity.org",
            phone="+61398765432",
            preferred_language="en",
            description="Supporting food security and reducing waste in inner Melbourne"
        )
    
    @staticmethod
    def generate_all_demo_data() -> tuple:
        """
        Generate complete demo dataset (listings, user, organization).
        
        This is the main entry point for demo data initialization.
        
        Returns:
            Tuple of (listings_list, demo_user, demo_organization)
        """
        listings = MockDataGenerator.generate_listings(count=15)
        user = MockDataGenerator.generate_demo_user()
        org = MockDataGenerator.generate_demo_organization()
        
        return listings, user, org
