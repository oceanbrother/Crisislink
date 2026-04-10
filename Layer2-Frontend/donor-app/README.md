# Donor App - Amber Theme

> Mobile-optimized application for surplus food providers (bakeries, restaurants, organizations) to quickly list available food for donation.

## 📱 Key Features

- **60-Second Food Posting**: Quickly capture and list surplus food
- **AI Image Recognition**: Automatic food identification from photos
- **Multi-Language Support**: English, Chinese (Simplified), Vietnamese
- **Real-Time Listings**: See all available donations updated every 5 seconds
- **Responsive Design**: Mobile-first, works on all devices

## 🎨 Design

The Donor App uses the **Amber** color scheme with warm, welcoming tones to encourage food donation.

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ installed
- Backend API running on `http://localhost:9000` (see [Backend Setup](../Layer3-Backend/README.md))

### Installation

```bash
# Navigate to donor-app directory
cd Layer2-Frontend/donor-app

# Install dependencies
npm install
```

### Running Locally

```bash
# Start development server with hot reload
npm run dev

# Server will start at http://localhost:3001
# Open browser: http://localhost:3001
```

The app automatically reloads when you save changes.

### Build for Production

```bash
# Create optimized production build
npm run build

# Preview production build locally
npm run preview
```

## 📁 Project Structure

```
donor-app/
├── src/
│   ├── pages/                # Page components
│   │   ├── DonationForm.jsx          # Main donation form with image recognition
│   │   ├── LiveListingBoard.jsx      # View all available food donations
│   │   └── HomePage.jsx              # Landing page
│   │
│   ├── components/           # Reusable components
│   │   ├── LanguageSwitcher.jsx      # Language selection
│   │   └── ...
│   │
│   ├── api.js               # Axios HTTP client (configured for backend)
│   ├── locales/             # i18n translation files
│   │   ├── en.json          # English translations
│   │   ├── zh_CN.json       # Simplified Chinese
│   │   └── vi.json          # Vietnamese
│   │
│   ├── styles/              # CSS/SCSS styles
│   ├── App.jsx              # Main app component with routing
│   └── main.jsx             # React entry point
│
├── package.json             # Dependencies and scripts
├── package-lock.json        # Locked dependency versions
├── vite.config.js          # Vite configuration
├── .env.local              # Local environment variables
└── index.html              # HTML template
```

## 🛠️ Development

### Key Dependencies

- **React 18.2**: UI framework
- **Vite 5**: Development server and build tool
- **Axios**: HTTP client
- **React Router DOM**: Client-side routing
- **i18next**: Multi-language support
- **React i18next**: React integration for i18next

### Useful Commands

```bash
# Development
npm run dev           # Start dev server with hot reload
npm run build         # Build for production
npm run preview       # Preview production build
npm run lint          # Run ESLint

# Troubleshooting
npm install           # Reinstall all dependencies
npx npm-check-updates # Check for available updates
```

## 📋 Features

### DonationForm Component (`src/pages/DonationForm.jsx`)

**Purpose:** Allow donors to quickly submit food for donation

**How to use:**
1. Click "Donate Food" button
2. Take a photo or upload image of food
3. System automatically recognizes food type using color analysis
4. Fill in additional details (quantity, location, allergens)
5. Submit to backend

**Supported Food Types:**
- Bakery items (🍞)
- Produce (🥕)
- Dairy (🥛)
- Prepared meals (🍱)
- Grocery items (🛒)

### LiveListingBoard Component (`src/pages/LiveListingBoard.jsx`)

**Purpose:** Display all available food donations in real-time

**How it works:**
- Fetches listings from backend API every 5 seconds
- Shows food type, quantity, donor, distance, match score
- Allows filtering by category and searching
- Supports multiple languages

**Display Details:**
- ✅ Food emoji and title
- ✅ Donor name and organization
- ✅ Quantity and distance
- ✅ Match score (AI-calculated relevance)
- ✅ Tags and allergen info
- ✅ Modal view with full details

## 🌍 Internationalization (i18n)

The app supports 3 languages:
- **English** (en)
- **Simplified Chinese** (zh-CN)
- **Vietnamese** (vi)

Add translations in `src/locales/`:
```json
{
  "donation": {
    "title": "Donate Food",
    "button": "Donate"
  }
}
```

## 🔗 API Integration

The app communicates with the backend at `http://localhost:9000`:

**Base URL:** `http://localhost:9000/api/v1`

**Endpoints used:**
- `GET /listings` - Fetch all food donations
- `POST /listings` - Create new food donation

See [API Documentation](../Layer3-Backend/README.md#api-documentation) for details.

## 📱 Browser Support

- Chrome/Chromium 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## ⚠️ Troubleshooting

**Listings not showing:**
- Ensure backend is running: `http://localhost:9000/docs`
- Check browser console (F12) for API errors
- Refresh the page

**Image upload not working:**
- Clear browser cache
- Check file size (max 5MB recommended)
- Ensure camera permission is granted

**Backend API not connecting:**
- Verify backend URL in `src/api.js`
- Check that CORS is enabled on backend
- Ensure both servers are running on correct ports

**Language not switching:**
- Clear localStorage: `localStorage.clear()`
- Refresh page and try again

## 🤝 Contributing

When adding new features:
1. Add component to `src/components/` or `src/pages/`
2. Add translations to `src/locales/`
3. Update `src/App.jsx` if adding new routes
4. Test on mobile view (F12 → Toggle device toolbar)

## 📄 License

Part of the CrisisLink project. See main LICENSE file.

---

**Status**: Beta - Ready for Testing
**Last Updated**: April 2026
