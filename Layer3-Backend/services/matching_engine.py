"""
Smart Matching Engine for CrisisLink.

This module implements the intelligent matching algorithm that pairs food listings
with organizational needs. The matching engine uses a multi-factor scoring system:

**Matching Factors (weights):**
1. Category Match (30%) - Does the food category match organization needs?
2. Distance (40%) - How close is the food source to the organization?
3. Tag Relevance (20%) - Do listed tags match searched keywords?
4. Freshness (10%) - How recently was the listing posted?

**Match Score Range:** 0-100 (higher is better)

**Design Philosophy:**
- Distance is the primary factor (food supply is location-based)
- Category match ensures organizational relevance
- Tags allow flexible filtering beyond categories
- Freshness ensures timely food redistribution
- All factors normalized to 0-100 scale

Example Match Score Calculation:
    Category match: 90 (exact category match) * 0.30 = 27
    Distance: 85 (within 2km) * 0.40 = 34
    Tag match: 70 (2 of 3 tags matched) * 0.20 = 14
    Freshness: 95 (posted 30 min ago) * 0.10 = 9.5
    TOTAL: 84.5 (good match)
"""

from typing import List, Optional, Tuple
from datetime import datetime, timedelta
from models.listing import Listing


class MatchingEngine:
    """
    Rule-based matching engine for food listings and organizational needs.
    
    This engine calculates relevance scores between food listings and
    organization requirements using a multi-factor scoring system.
    
    The matching algorithm considers:
    - Food category preferences
    - Geographic proximity (postcode-based)
    - Keyword matching from tags
    - Listing freshness (how recently posted)
    
    All factors are weighted and combined to produce a final match score
    on a 0-100 scale.
    """
    
    # Weighting factors for each match criterion
    WEIGHTS = {
        'category': 0.30,   # 30% weight on category match
        'distance': 0.40,   # 40% weight on proximity
        'tags': 0.20,       # 20% weight on tag relevance
        'freshness': 0.10   # 10% weight on recency
    }
    
    # Distance thresholds and corresponding scores (in kilometers)
    # Used to convert actual distance to a normalized score
    DISTANCE_SCORING = {
        0.5: 100,    # Within 500m: perfect score
        1.0: 90,     # Within 1km: excellent
        2.0: 80,     # Within 2km: very good
        5.0: 60,     # Within 5km: good
        10.0: 40,    # Within 10km: acceptable
        float('inf'): 20  # Beyond 10km: poor
    }
    
    # Food category definitions for matching
    FOOD_CATEGORIES = {
        'bakery': ['bakery', 'bread', 'pastry', 'bagel', 'croissant'],
        'produce': ['produce', 'vegetable', 'fruit', 'organic', 'seasonal'],
        'dairy': ['dairy', 'milk', 'cheese', 'yogurt', 'butter', 'egg'],
        'prepared': ['prepared', 'meal', 'salad', 'cooked', 'ready'],
        'grocery': ['grocery', 'pantry', 'pasta', 'rice', 'grain', 'flour'],
    }
    
    def calculate_match_score(
        self,
        listing: Listing,
        org_postcode: str,
        org_needs: List[str],
        search_keywords: Optional[List[str]] = None
    ) -> int:
        """
        Calculate match score between a listing and organization needs.
        
        This is the main method that orchestrates the matching calculation.
        It evaluates all factors and returns a final 0-100 score.
        
        **Process:**
        1. Calculate category match score
        2. Calculate distance score (postcode-based)
        3. Calculate tag relevance score
        4. Calculate freshness score
        5. Combine all factors using weights
        
        Args:
            listing: The food listing to evaluate
            org_postcode: Organization's 4-digit postcode
            org_needs: List of food categories organization needs
            search_keywords: Optional keywords from organization's search
        
        Returns:
            Match score (0-100, higher = better match)
        
        Example:
            >>> engine = MatchingEngine()
            >>> score = engine.calculate_match_score(
            ...     listing=my_listing,
            ...     org_postcode='3000',
            ...     org_needs=['bakery', 'dairy'],
            ...     search_keywords=['fresh', 'organic']
            ... )
            >>> print(f"Match score: {score}")
            Match score: 85
        """
        # Calculate individual factor scores
        category_score = self._score_category_match(listing, org_needs)
        distance_score = self._score_distance(listing, org_postcode)
        tags_score = self._score_tag_relevance(listing, search_keywords or org_needs)
        freshness_score = self._score_freshness(listing)
        
        # Combine weighted scores
        total_score = (
            category_score * self.WEIGHTS['category'] +
            distance_score * self.WEIGHTS['distance'] +
            tags_score * self.WEIGHTS['tags'] +
            freshness_score * self.WEIGHTS['freshness']
        )
        
        # Ensure result is between 0 and 100
        return max(0, min(100, int(total_score)))
    
    def _score_category_match(self, listing: Listing, org_needs: List[str]) -> int:
        """
        Score how well the listing category matches organization needs.
        
        Scoring Logic:
        - Exact match: 100 points
        - Related category: 70 points
        - No match: 30 points (baseline, some food is better than none)
        
        Args:
            listing: Food listing to evaluate
            org_needs: List of food categories the organization needs
        
        Returns:
            Category match score (0-100)
        """
        listing_category = listing.food.category.lower()
        
        # Check for exact category match
        if listing_category in org_needs:
            return 100
        
        # Check for related categories (e.g., bakery/produce nearby in list)
        for need in org_needs:
            # Get keywords for the needed category
            if need in self.FOOD_CATEGORIES:
                keywords = self.FOOD_CATEGORIES[need]
                if listing_category in keywords:
                    return 100
        
        # Some food is better than nothing for food banks
        # Return baseline score so listing still appears in results
        return 30
    
    def _score_distance(self, listing: Listing, org_postcode: str) -> int:
        """
        Score based on geographic distance between donor and organization.
        
        Distance calculation:
        - Uses postcode difference as proxy (exact GPS unavailable in demo)
        - Closer = higher score
        - Threshold: >10km significantly reduces score
        
        Scoring:
        - <500m: 100 (excellent, immediate pickup possible)
        - <1km: 90 (very good, walking distance)
        - <2km: 80 (good, short drive)
        - <5km: 60 (acceptable, neighborhood)
        - <10km: 40 (longer drive, less ideal)
        - >10km: 20 (remote, significant logistical effort)
        
        Args:
            listing: Food listing with location
            org_postcode: Organization's 4-digit postcode
        
        Returns:
            Distance score (0-100)
        """
        # Use listing's pre-calculated distance if available
        if listing.matching_metrics.distance_km is not None:
            distance = listing.matching_metrics.distance_km
        else:
            # Fallback: estimate distance from postcode difference
            # In production: use actual GPS coordinates
            try:
                postcode_diff = abs(int(listing.location.postcode) - int(org_postcode))
                # Rough estimate: each postcode digit ~ 0.5-1km
                distance = postcode_diff * 0.5
            except (ValueError, TypeError):
                distance = 10  # Default penalty for invalid postcodes
        
        # Look up score based on distance ranges
        for threshold, score in sorted(self.DISTANCE_SCORING.items()):
            if distance <= threshold:
                return score
        
        return 20  # Very far, poor score
    
    def _score_tag_relevance(self, listing: Listing, search_keywords: List[str]) -> int:
        """
        Score based on tag matching with search keywords.
        
        Scoring Logic:
        - Match percentage: (Matched tags / Total tags) * 100
        - Minimum: 20 points (some relevance even without matches)
        - Maximum: 100 points
        
        Example:
        - Organization searches for ['fresh', 'organic']
        - Listing has tags ['Fresh baked', 'Organic', 'Vegan']
        - Matches: 2 out of 3 = 66% match
        - Score: max(20, 66) = 66
        
        Args:
            listing: Food listing with tags
            search_keywords: Keywords from organization's search
        
        Returns:
            Tag relevance score (20-100, never below 20)
        """
        if not search_keywords or not listing.food.tags:
            # No tags to match on, return baseline
            return 50  # Neutral score
        
        # Normalize keywords and listing tags for comparison
        keywords_lower = [kw.lower() for kw in search_keywords]
        tags_lower = [tag.lower() for tag in listing.food.tags]
        
        # Count matches
        matches = 0
        for keyword in keywords_lower:
            for tag in tags_lower:
                if keyword in tag or tag in keyword:
                    matches += 1
                    break  # Count each keyword only once
        
        # Calculate match percentage
        if len(search_keywords) > 0:
            match_percentage = (matches / len(search_keywords)) * 100
        else:
            match_percentage = 50
        
        # Apply minimum baseline (some content is better than none)
        return max(20, int(match_percentage))
    
    def _score_freshness(self, listing: Listing) -> int:
        """
        Score based on how recently the listing was posted.
        
        Scoring:
        - Posted in last 30 min: 100 (very fresh)
        - Posted 30 min - 2hr: 80 (fresh)
        - Posted 2-4 hr: 60 (reasonably fresh)
        - Posted 4-8 hr: 40 (getting old)
        - Posted >8 hr: 20 (old, should expire soon)
        
        Rationale:
        - Food best when distributed quickly
        - Time-sensitive for quality and food safety
        - Encourages quick response from organizations
        
        Args:
            listing: Food listing with posted_at timestamp
        
        Returns:
            Freshness score (20-100)
        """
        age = datetime.utcnow() - listing.posted_at
        
        # Convert to minutes
        age_minutes = age.total_seconds() / 60
        
        # Apply freshness scoring based on age
        if age_minutes < 30:
            return 100
        elif age_minutes < 120:  # 2 hours
            return 80
        elif age_minutes < 240:  # 4 hours
            return 60
        elif age_minutes < 480:  # 8 hours
            return 40
        else:
            return 20
    
    def rank_listings(
        self,
        listings: List[Listing],
        org_postcode: str,
        org_needs: List[str],
        search_keywords: Optional[List[str]] = None
    ) -> List[Tuple[Listing, int]]:
        """
        Rank multiple listings by match score.
        
        This method scores all listings and returns them sorted by score
        (highest first).
        
        Args:
            listings: List of listings to rank
            org_postcode: Organization's postcode
            org_needs: Organization's food category needs
            search_keywords: Optional search keywords
        
        Returns:
            List of (listing, score) tuples sorted by score descending
        
        Example:
            >>> engine = MatchingEngine()
            >>> ranked = engine.rank_listings(
            ...     all_listings,
            ...     org_postcode='3000',
            ...     org_needs=['bakery', 'dairy']
            ... )
            >>> for listing, score in ranked[:5]:
            ...     print(f"{listing.source_name}: {score}/100")
        """
        scored_listings = []
        
        for listing in listings:
            score = self.calculate_match_score(
                listing,
                org_postcode,
                org_needs,
                search_keywords
            )
            scored_listings.append((listing, score))
        
        # Sort by score descending
        scored_listings.sort(key=lambda x: x[1], reverse=True)
        
        return scored_listings
    
    def get_matching_stats(self) -> dict:
        """
        Get statistics about the matching algorithm.
        
        Returns information about weighting factors and thresholds.
        
        Returns:
            Dictionary with matching algorithm statistics
        """
        return {
            'algorithm': 'Rule-based multi-factor matching',
            'version': '1.0-demo',
            'weights': self.WEIGHTS,
            'distance_thresholds': self.DISTANCE_SCORING,
            'categories': list(self.FOOD_CATEGORIES.keys()),
            'max_score': 100,
            'min_score': 0,
        }


# Create singleton instance
_matching_engine = MatchingEngine()


def get_matching_engine() -> MatchingEngine:
    """
    Get the global matching engine instance.
    
    Returns:
        Singleton MatchingEngine instance
    
    Example:
        >>> engine = get_matching_engine()
        >>> score = engine.calculate_match_score(listing, '3000', ['bakery'])
    """
    return _matching_engine
