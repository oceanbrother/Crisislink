"""
lookup_tables.py

Maps every Food-101 class name (as output by the model) to:
  - display_name : human-friendly label shown in the UI
  - tags         : dietary tags auto-filled into the listing form
  - dino_prompt  : text prompt sent to Grounding DINO for counting.
                   None means the food is not individually countable
                   (soups, salads, curries, etc.)
"""

# Tags reference:
#   "vegan"           - no animal products at all
#   "vegetarian"      - no meat/fish, but may contain dairy or eggs
#   "non-vegetarian"  - contains meat, poultry, fish, or seafood

FOOD_LOOKUP: dict[str, dict] = {
    "apple_pie":              {"display_name": "Apple Pie",              "tags": ["vegetarian"],     "dino_prompt": None},
    "baby_back_ribs":         {"display_name": "Baby Back Ribs",         "tags": ["non-vegetarian"], "dino_prompt": "rib"},
    "baklava":                {"display_name": "Baklava",                "tags": ["vegetarian"],     "dino_prompt": "baklava piece"},
    "beef_carpaccio":         {"display_name": "Beef Carpaccio",         "tags": ["non-vegetarian"], "dino_prompt": None},
    "beef_tartare":           {"display_name": "Beef Tartare",           "tags": ["non-vegetarian"], "dino_prompt": None},
    "beet_salad":             {"display_name": "Beet Salad",             "tags": ["vegetarian"],     "dino_prompt": None},
    "beignets":               {"display_name": "Beignets",               "tags": ["vegetarian"],     "dino_prompt": "beignet"},
    "bibimbap":               {"display_name": "Bibimbap",               "tags": ["non-vegetarian"], "dino_prompt": None},
    "bread_pudding":          {"display_name": "Bread Pudding",          "tags": ["vegetarian"],     "dino_prompt": None},
    "breakfast_burrito":      {"display_name": "Breakfast Burrito",      "tags": ["non-vegetarian"], "dino_prompt": "burrito"},
    "bruschetta":             {"display_name": "Bruschetta",             "tags": ["vegan"],          "dino_prompt": "bruschetta piece"},
    "caesar_salad":           {"display_name": "Caesar Salad",           "tags": ["vegetarian"],     "dino_prompt": None},
    "cannoli":                {"display_name": "Cannoli",                "tags": ["vegetarian"],     "dino_prompt": "cannoli"},
    "caprese_salad":          {"display_name": "Caprese Salad",          "tags": ["vegetarian"],     "dino_prompt": None},
    "carrot_cake":            {"display_name": "Carrot Cake",            "tags": ["vegetarian"],     "dino_prompt": None},
    "ceviche":                {"display_name": "Ceviche",                "tags": ["non-vegetarian"], "dino_prompt": None},
    "cheesecake":             {"display_name": "Cheesecake",             "tags": ["vegetarian"],     "dino_prompt": None},
    "cheese_plate":           {"display_name": "Cheese Plate",           "tags": ["vegetarian"],     "dino_prompt": None},
    "chicken_curry":          {"display_name": "Chicken Curry",          "tags": ["non-vegetarian"], "dino_prompt": None},
    "chicken_quesadilla":     {"display_name": "Chicken Quesadilla",     "tags": ["non-vegetarian"], "dino_prompt": "quesadilla"},
    "chicken_wings":          {"display_name": "Chicken Wings",          "tags": ["non-vegetarian"], "dino_prompt": "chicken wing"},
    "chocolate_cake":         {"display_name": "Chocolate Cake",         "tags": ["vegetarian"],     "dino_prompt": None},
    "chocolate_mousse":       {"display_name": "Chocolate Mousse",       "tags": ["vegetarian"],     "dino_prompt": None},
    "churros":                {"display_name": "Churros",                "tags": ["vegetarian"],     "dino_prompt": "churro"},
    "clam_chowder":           {"display_name": "Clam Chowder",           "tags": ["non-vegetarian"], "dino_prompt": None},
    "club_sandwich":          {"display_name": "Club Sandwich",          "tags": ["non-vegetarian"], "dino_prompt": "sandwich"},
    "crab_cakes":             {"display_name": "Crab Cakes",             "tags": ["non-vegetarian"], "dino_prompt": "crab cake"},
    "creme_brulee":           {"display_name": "Crème Brûlée",           "tags": ["vegetarian"],     "dino_prompt": None},
    "croque_madame":          {"display_name": "Croque Madame",          "tags": ["non-vegetarian"], "dino_prompt": "sandwich"},
    "cup_cakes":              {"display_name": "Cupcakes",               "tags": ["vegetarian"],     "dino_prompt": "cupcake"},
    "deviled_eggs":           {"display_name": "Deviled Eggs",           "tags": ["vegetarian"],     "dino_prompt": "deviled egg"},
    "donuts":                 {"display_name": "Donuts",                 "tags": ["vegetarian"],     "dino_prompt": "donut"},
    "dumplings":              {"display_name": "Dumplings",              "tags": ["non-vegetarian"], "dino_prompt": "dumpling"},
    "edamame":                {"display_name": "Edamame",                "tags": ["vegan"],          "dino_prompt": None},
    "eggs_benedict":          {"display_name": "Eggs Benedict",          "tags": ["non-vegetarian"], "dino_prompt": None},
    "escargots":              {"display_name": "Escargots",              "tags": ["non-vegetarian"], "dino_prompt": "escargot"},
    "falafel":                {"display_name": "Falafel",                "tags": ["vegan"],          "dino_prompt": "falafel ball"},
    "filet_mignon":           {"display_name": "Filet Mignon",           "tags": ["non-vegetarian"], "dino_prompt": "steak"},
    "fish_and_chips":         {"display_name": "Fish and Chips",         "tags": ["non-vegetarian"], "dino_prompt": None},
    "foie_gras":              {"display_name": "Foie Gras",              "tags": ["non-vegetarian"], "dino_prompt": None},
    "french_fries":           {"display_name": "French Fries",           "tags": ["vegan"],          "dino_prompt": None},
    "french_onion_soup":      {"display_name": "French Onion Soup",      "tags": ["vegetarian"],     "dino_prompt": None},
    "french_toast":           {"display_name": "French Toast",           "tags": ["vegetarian"],     "dino_prompt": "french toast"},
    "fried_calamari":         {"display_name": "Fried Calamari",         "tags": ["non-vegetarian"], "dino_prompt": None},
    "fried_rice":             {"display_name": "Fried Rice",             "tags": ["non-vegetarian"], "dino_prompt": None},
    "frozen_yogurt":          {"display_name": "Frozen Yogurt",          "tags": ["vegetarian"],     "dino_prompt": None},
    "garlic_bread":           {"display_name": "Garlic Bread",           "tags": ["vegan"],          "dino_prompt": "garlic bread slice"},
    "gnocchi":                {"display_name": "Gnocchi",                "tags": ["vegetarian"],     "dino_prompt": None},
    "greek_salad":            {"display_name": "Greek Salad",            "tags": ["vegetarian"],     "dino_prompt": None},
    "grilled_cheese_sandwich":{"display_name": "Grilled Cheese Sandwich","tags": ["vegetarian"],     "dino_prompt": "sandwich"},
    "grilled_salmon":         {"display_name": "Grilled Salmon",         "tags": ["non-vegetarian"], "dino_prompt": "salmon fillet"},
    "guacamole":              {"display_name": "Guacamole",              "tags": ["vegan"],          "dino_prompt": None},
    "gyoza":                  {"display_name": "Gyoza",                  "tags": ["non-vegetarian"], "dino_prompt": "gyoza"},
    "hamburger":              {"display_name": "Hamburger",              "tags": ["non-vegetarian"], "dino_prompt": "burger"},
    "hot_and_sour_soup":      {"display_name": "Hot and Sour Soup",      "tags": ["non-vegetarian"], "dino_prompt": None},
    "hot_dog":                {"display_name": "Hot Dog",                "tags": ["non-vegetarian"], "dino_prompt": "hot dog"},
    "huevos_rancheros":       {"display_name": "Huevos Rancheros",       "tags": ["vegetarian"],     "dino_prompt": None},
    "hummus":                 {"display_name": "Hummus",                 "tags": ["vegan"],          "dino_prompt": None},
    "ice_cream":              {"display_name": "Ice Cream",              "tags": ["vegetarian"],     "dino_prompt": None},
    "lasagna":                {"display_name": "Lasagna",                "tags": ["non-vegetarian"], "dino_prompt": None},
    "lobster_bisque":         {"display_name": "Lobster Bisque",         "tags": ["non-vegetarian"], "dino_prompt": None},
    "lobster_roll_sandwich":  {"display_name": "Lobster Roll",           "tags": ["non-vegetarian"], "dino_prompt": "sandwich"},
    "macaroni_and_cheese":    {"display_name": "Mac and Cheese",         "tags": ["vegetarian"],     "dino_prompt": None},
    "macarons":               {"display_name": "Macarons",               "tags": ["vegetarian"],     "dino_prompt": "macaron"},
    "miso_soup":              {"display_name": "Miso Soup",              "tags": ["vegan"],          "dino_prompt": None},
    "mussels":                {"display_name": "Mussels",                "tags": ["non-vegetarian"], "dino_prompt": "mussel"},
    "nachos":                 {"display_name": "Nachos",                 "tags": ["vegetarian"],     "dino_prompt": None},
    "omelette":               {"display_name": "Omelette",               "tags": ["vegetarian"],     "dino_prompt": None},
    "onion_rings":            {"display_name": "Onion Rings",            "tags": ["vegetarian"],     "dino_prompt": "onion ring"},
    "oysters":                {"display_name": "Oysters",                "tags": ["non-vegetarian"], "dino_prompt": "oyster"},
    "pad_thai":               {"display_name": "Pad Thai",               "tags": ["non-vegetarian"], "dino_prompt": None},
    "paella":                 {"display_name": "Paella",                 "tags": ["non-vegetarian"], "dino_prompt": None},
    "pancakes":               {"display_name": "Pancakes",               "tags": ["vegetarian"],     "dino_prompt": "pancake"},
    "panna_cotta":            {"display_name": "Panna Cotta",            "tags": ["vegetarian"],     "dino_prompt": None},
    "peking_duck":            {"display_name": "Peking Duck",            "tags": ["non-vegetarian"], "dino_prompt": None},
    "pho":                    {"display_name": "Pho",                    "tags": ["non-vegetarian"], "dino_prompt": None},
    "pizza":                  {"display_name": "Pizza",                  "tags": ["vegetarian"],     "dino_prompt": None},
    "pork_chop":              {"display_name": "Pork Chop",              "tags": ["non-vegetarian"], "dino_prompt": "pork chop"},
    "poutine":                {"display_name": "Poutine",                "tags": ["non-vegetarian"], "dino_prompt": None},
    "prime_rib":              {"display_name": "Prime Rib",              "tags": ["non-vegetarian"], "dino_prompt": "prime rib"},
    "pulled_pork_sandwich":   {"display_name": "Pulled Pork Sandwich",   "tags": ["non-vegetarian"], "dino_prompt": "sandwich"},
    "ramen":                  {"display_name": "Ramen",                  "tags": ["non-vegetarian"], "dino_prompt": None},
    "ravioli":                {"display_name": "Ravioli",                "tags": ["vegetarian"],     "dino_prompt": "ravioli"},
    "red_velvet_cake":        {"display_name": "Red Velvet Cake",        "tags": ["vegetarian"],     "dino_prompt": None},
    "risotto":                {"display_name": "Risotto",                "tags": ["vegetarian"],     "dino_prompt": None},
    "samosa":                 {"display_name": "Samosa",                 "tags": ["vegetarian"],     "dino_prompt": "samosa"},
    "sashimi":                {"display_name": "Sashimi",                "tags": ["non-vegetarian"], "dino_prompt": "sashimi slice"},
    "scallops":               {"display_name": "Scallops",               "tags": ["non-vegetarian"], "dino_prompt": "scallop"},
    "seaweed_salad":          {"display_name": "Seaweed Salad",          "tags": ["vegan"],          "dino_prompt": None},
    "shrimp_and_grits":       {"display_name": "Shrimp and Grits",       "tags": ["non-vegetarian"], "dino_prompt": "shrimp"},
    "spaghetti_bolognese":    {"display_name": "Spaghetti Bolognese",    "tags": ["non-vegetarian"], "dino_prompt": None},
    "spaghetti_carbonara":    {"display_name": "Spaghetti Carbonara",    "tags": ["non-vegetarian"], "dino_prompt": None},
    "spring_rolls":           {"display_name": "Spring Rolls",           "tags": ["non-vegetarian"], "dino_prompt": "spring roll"},
    "steak":                  {"display_name": "Steak",                  "tags": ["non-vegetarian"], "dino_prompt": "steak"},
    "strawberry_shortcake":   {"display_name": "Strawberry Shortcake",   "tags": ["vegetarian"],     "dino_prompt": None},
    "sushi":                  {"display_name": "Sushi",                  "tags": ["non-vegetarian"], "dino_prompt": "sushi roll"},
    "tacos":                  {"display_name": "Tacos",                  "tags": ["non-vegetarian"], "dino_prompt": "taco"},
    "takoyaki":               {"display_name": "Takoyaki",               "tags": ["non-vegetarian"], "dino_prompt": "takoyaki ball"},
    "tiramisu":               {"display_name": "Tiramisu",               "tags": ["vegetarian"],     "dino_prompt": None},
    "tuna_tartare":           {"display_name": "Tuna Tartare",           "tags": ["non-vegetarian"], "dino_prompt": None},
    "waffles":                {"display_name": "Waffles",                "tags": ["vegetarian"],     "dino_prompt": "waffle"},
}


def get_info(raw_class: str) -> dict:
    """
    Look up metadata for a Food-101 class name.
    Returns a safe fallback dict if the class isnt found.
    """
    return FOOD_LOOKUP.get(raw_class, {
        "display_name": raw_class.replace("_", " ").title(), 
        "tags": [],
        "dino_prompt": None,
    })
