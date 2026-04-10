/**
 * Food Image Generator
 * 为不同食物类型生成 SVG 插图或获取网络图片
 */

/**
 * 获取食物图片 URL
 * @param {string} foodType - 食物名称
 * @param {string} category - 食物类别 (bakery, produce, dairy, prepared, grocery)
 * @returns {string} 图片 URL
 */
export const getFoodImageUrl = (foodType, category) => {
  // 方案 1: 使用 Unsplash 随机食物图片
  const unsplashCategories = {
    bakery: 'bread%20fresh%20baking',
    produce: 'fresh%20vegetables%20organic',
    dairy: 'milk%20cheese%20dairy',
    prepared: 'prepared%20food%20meal',
    grocery: 'canned%20food%20groceries'
  }
  
  const searchTerm = unsplashCategories[category] || 'food'
  return `https://source.unsplash.com/400x300/?${searchTerm}`
}

/**
 *
 * @param {string} category - 食物类别
 * @returns {string} SVG 字符串
 */
export const generateFoodSVG = (category) => {
  const svgTemplates = {
    bakery: `
      <svg width="400" height="300" viewBox="0 0 400 300">
        <rect width="400" height="300" fill="#fff8f3"/>
        <!-- Bread loaves -->
        <ellipse cx="100" cy="180" rx="40" ry="50" fill="#d4a574"/>
        <ellipse cx="200" cy="160" rx="45" ry="55" fill="#c5956f"/>
        <ellipse cx="300" cy="175" rx="42" ry="48" fill="#d4a574"/>
        <!-- Scoring lines -->
        <line x1="100" y1="140" x2="100" y2="220" stroke="#8b6f47" stroke-width="2"/>
        <line x1="200" y1="120" x2="200" y2="215" stroke="#8b6f47" stroke-width="2"/>
        <line x1="300" y1="135" x2="300" y2="215" stroke="#8b6f47" stroke-width="2"/>
        <!-- Steam wisps -->
        <path d="M 100 130 Q 95 120 100 110" stroke="#e8d4c4" stroke-width="2" fill="none"/>
        <path d="M 200 110 Q 195 100 200 90" stroke="#e8d4c4" stroke-width="2" fill="none"/>
        <text x="200" y="280" font-size="20" text-anchor="middle" fill="#8b6f47">🥖 Fresh Baked Bread</text>
      </svg>
    `,
    produce: `
      <svg width="400" height="300" viewBox="0 0 400 300">
        <rect width="400" height="300" fill="#f0f5e8"/>
        <!-- Carrots -->
        <line x1="80" y1="100" x2="80" y2="160" stroke="#d2691e" stroke-width="8"/>
        <polygon points="80,100 70,90 90,90" fill="#228b22"/>
        <!-- Lettuce -->
        <circle cx="180" cy="140" r="35" fill="#7cb342"/>
        <circle cx="165" cy="130" r="30" fill="#8bc34a"/>
        <circle cx="195" cy="130" r="30" fill="#8bc34a"/>
        <!-- Tomatoes -->
        <circle cx="300" cy="120" r="28" fill="#e74c3c"/>
        <circle cx="330" cy="140" r="25" fill="#e74c3c"/>
        <polygon points="300,95 310,90 305,100" fill="#228b22"/>
        <!-- Basket -->
        <rect x="100" y="200" width="200" height="60" fill="#daa520"/>
        <text x="200" y="280" font-size="20" text-anchor="middle" fill="#228b22">🥕 Fresh Vegetables</text>
      </svg>
    `,
    dairy: `
      <svg width="400" height="300" viewBox="0 0 400 300">
        <rect width="400" height="300" fill="#f5f5f0"/>
        <!-- Milk bottle -->
        <rect x="80" y="100" width="50" height="100" fill="#ffffff" stroke="#999" stroke-width="2"/>
        <rect x="95" y="80" width="20" height="25" fill="#999"/>
        <!-- Cheese -->
        <rect x="180" y="130" width="60" height="50" fill="#ffd700" stroke="#d4af37" stroke-width="2"/>
        <circle cx="200" cy="145" r="5" fill="#f0e68c"/>
        <circle cx="215" cy="155" r="4" fill="#f0e68c"/>
        <!-- Yogurt cup -->
        <path d="M 300 140 L 320 140 Q 330 140 330 160 L 300 160 Q 290 160 290 145 Z" fill="#f0f0f0" stroke="#999" stroke-width="2"/>
        <text x="310" y="155" font-size="24" text-anchor="middle">Y</text>
        <text x="200" y="280" font-size="20" text-anchor="middle" fill="#8b7500">🥛 Dairy Products</text>
      </svg>
    `,
    prepared: `
      <svg width="400" height="300" viewBox="0 0 400 300">
        <rect width="400" height="300" fill="#fef5e7"/>
        <!-- Pizza -->
        <circle cx="150" cy="130" r="50" fill="#d4a574"/>
        <path d="M 150 80 L 200 130 L 150 180 Z" fill="#e74c3c"/>
        <circle cx="140" cy="120" r="4" fill="#228b22"/>
        <circle cx="160" cy="140" r="3" fill="#ff8c00"/>
        <!-- Pasta bowl -->
        <ellipse cx="270" cy="150" rx="45" ry="35" fill="#f5f5f5" stroke="#999" stroke-width="2"/>
        <path d="M 225 150 Q 225 130 270 120 Q 315 130 315 150" fill="#ffd700"/>
        <text x="200" y="280" font-size="20" text-anchor="middle" fill="#c0504d">🍕 Prepared Meals</text>
      </svg>
    `,
    grocery: `
      <svg width="400" height="300" viewBox="0 0 400 300">
        <rect width="400" height="300" fill="#fffaf0"/>
        <!-- Canned goods -->
        <rect x="60" y="100" width="40" height="80" fill="#ff0000" stroke="#8b0000" stroke-width="1"/>
        <rect x="65" y="105" width="30" height="15" fill="#ffd700"/>
        <rect x="120" y="90" width="40" height="90" fill="#ffa500" stroke="#d2691e" stroke-width="1"/>
        <rect x="125" y="95" width="30" height="15" fill="#ffd700"/>
        <rect x="180" y="110" width="40" height="70" fill="#008000" stroke="#004000" stroke-width="1"/>
        <rect x="185" y="115" width="30" height="15" fill="#ffd700"/>
        <rect x="240" y="120" width="40" height="60" fill="#4169e1" stroke="#00008b" stroke-width="1"/>
        <rect x="245" y="125" width="30" height="15" fill="#ffd700"/>
        <!-- Basket -->
        <path d="M 50 185 L 300 185 L 280 240 L 70 240 Z" fill="#daa520" stroke="#8b7500" stroke-width="2"/>
        <text x="200" y="280" font-size="20" text-anchor="middle" fill="#8b4513">🥫 Grocery Items</text>
      </svg>
    `
  }

  return svgTemplates[category] || svgTemplates.grocery
}

/**
 * React 组件：显示食物图片
 */
export const FoodImage = ({ category, foodType, size = 'medium' }) => {
  const sizeMap = {
    small: '150px',
    medium: '250px',
    large: '400px'
  }

  // 方案：使用 SVG（离线）
  const svgContent = generateFoodSVG(category)
  
  
  return (
    <div 
      dangerouslySetInnerHTML={{ __html: svgContent }}
      style={{ 
        width: sizeMap[size], 
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
      }}
    />
  )
}

export default {
  getFoodImageUrl,
  generateFoodSVG,
  FoodImage
}
