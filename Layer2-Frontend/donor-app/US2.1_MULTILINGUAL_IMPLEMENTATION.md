# US 2.1 多语言功能实现文档

## 功能概述
完成了 US 2.1 多语言接口部分的前端实现，支持中文、英文、越南语三种语言。

## 已实现功能

### 1. i18n 多语言框架 ✅
- 安装依赖：`react-i18next`, `i18next`, `i18next-browser-languagedetector`
- 配置文件：`src/i18n.js`
- 翻译文件位置：`src/locales/`
  - `en.json` - 英文翻译
  - `zh-CN.json` - 中文简体翻译
  - `vi.json` - 越南语翻译

### 2. 语言选择器 ✅
组件：`src/components/LanguageSwitcher.jsx`
样式：`src/styles/LanguageSwitcher.css`

**特性**：
- 下拉菜单语言选择
- 国旗图标显示
- 语言偏好自动保存到 localStorage
- 支持 URL 参数 `?lang=zh-CN`
- 响应式设计

### 3. 翻译工具函数 ✅
文件：`src/utils/translationUtils.js`

**主要函数**：
- `getTranslatedListing()` - 获取特定语言的 listing 翻译
- `getTranslatedListings()` - 批量翻译 listing 数组
- `getSupportedLanguages()` - 获取支持的语言列表
- `isSupportedLanguage()` - 检查语言是否支持
- `getPreferredLanguage()` - 获取用户偏好语言
- `setPreferredLanguage()` - 保存用户语言偏好

### 4. 页面多语言集成 ✅

#### HomePage
- ✅ 完全翻译
- ✅ 添加 LanguageSwitcher 到 header
- ✅ 支持所有 UI 文本翻译

#### PostcodeInputPage  
- ✅ 完全翻译
- ✅ 添加 LanguageSwitcher
- ✅ 错误消息本地化

#### 其他页面
- ⏳ PostFeedPage - 需要集成翻译
- ⏳ DonationFormPage - 需要集成翻译
- ⏳ LiveListingBoard - 需要集成翻译
- ⏳ OrgCodeInputPage - 需要集成翻译

## 数据格式约定

后端返回的 listing 数据应支持多语言格式：

```json
{
  "id": "uuid",
  "title": "Artisan Sourdough Loaves",
  "source": "Bourke St Bakehouse",
  "quantity": "18 loaves",
  "distance": "0.4 km",
  "matchScore": 94,
  "translations": {
    "en": {
      "description": "High-quality sourdough loaves from this morning's batch.",
      "tags": ["Vegan", "Fresh baked"],
      "allergens": "May contain gluten, sesame"
    },
    "zh-CN": {
      "description": "今天早上烘焙的高质量酸面包。",
      "tags": ["纯素", "新鲜烘焙"],
      "allergens": "可能含有麸质、芝麻"
    },
    "vi": {
      "description": "Bánh mì nho chất lượng cao từ lô nướng sáng nay.",
      "tags": ["Vegan", "Tươi nướng"],
      "allergens": "Có thể chứa gluten, vừng"
    }
  }
}
```

## 使用方法

### 在组件中使用翻译

```jsx
import { useTranslation } from 'react-i18next'

const MyComponent = () => {
  const { t, i18n } = useTranslation()
  
  return (
    <div>
      <h1>{t('home.title')}</h1>
      <p>Current language: {i18n.language}</p>
    </div>
  )
}
```

### 使用翻译工具处理 Listing 数据

```jsx
import { getTranslatedListing } from '../utils/translationUtils'
import { useTranslation } from 'react-i18next'

const ListingCard = ({ listing }) => {
  const { i18n } = useTranslation()
  
  // 获取当前语言的翻译
  const translatedListing = getTranslatedListing(listing, i18n.language)
  
  return (
    <div>
      <h3>{translatedListing.title}</h3>
      <p>{translatedListing.description}</p>
      <p>Tags: {translatedListing.tags.join(', ')}</p>
    </div>
  )
}
```

### 添加 LanguageSwitcher 到页面

```jsx
import LanguageSwitcher from '../components/LanguageSwitcher'

const MyPage = () => {
  return (
    <header>
      <div className="header-top">
        <div className="logo">CrisisLink</div>
        <LanguageSwitcher />
      </div>
    </header>
  )
}
```

## 语言偏好持久化

语言偏好通过以下方式存储：

1. **LocalStorage**: `localStorage.getItem('preferred-language')`
2. **URL 参数**: `?lang=zh-CN`
3. **浏览器语言检测**: 自动检测浏览器语言

优先级：URL 参数 > LocalStorage > 浏览器语言 > 英语（默认）

## 后续任务

### 立即需要完成
- [ ] 集成 LiveListingBoard 多语言（关键）
- [ ] 集成 PostFeedPage 多语言
- [ ] 集成 DonationFormPage 多语言
- [ ] 集成 OrgCodeInputPage 多语言

### 后端配合需求
- [ ] 返回多语言 listing 数据结构
- [ ] 支持通过 API 参数指定语言
- [ ] 翻译 API 集成（DeepL/Google Translate）

### 未来优化
- [ ] 添加更多语言支持
- [ ] 实时翻译 API 集成（可选）
- [ ] 用户语言偏好数据库存储（登录后）
- [ ] 翻译缓存优化

## 测试清单

- [ ] 语言切换器显示所有语言并能正确切换
- [ ] localStorage 正确保存语言偏好
- [ ] URL 参数 `?lang=xx` 能正确设置语言
- [ ] HomePage 所有文本已翻译
- [ ] PostcodeInputPage 所有文本已翻译
- [ ] 页面刷新后语言偏好保持
- [ ] 移动端语言切换器UI正确

## 技术栈
- React 18
- i18next 23+
- react-i18next 14+
- Vite 5.4

## 文件清单
```
src/
├── i18n.js                          # i18n 配置
├── main.jsx                         # 导入 i18n
├── components/
│   └── LanguageSwitcher.jsx         # 语言选择器组件
├── styles/
│   └── LanguageSwitcher.css         # 语言选择器样式
├── locales/
│   ├── en.json                      # 英文翻译
│   ├── zh-CN.json                   # 中文翻译
│   └── vi.json                      # 越南语翻译
├── utils/
│   └── translationUtils.js          # 翻译工具函数
└── pages/
    ├── HomePage.jsx                 # 更新：添加翻译
    └── PostcodeInputPage.jsx        # 更新：添加翻译
```
