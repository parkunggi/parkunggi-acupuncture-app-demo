# Parkunggi Acupuncture App Demo

Interactive 3D acupuncture point search application with Three.js visualization.

## 🌟 Features

- **3D Visualization**: Interactive 3D human mannequin with highlighted acupuncture points
- **Smart Search**: Multi-criteria search (Japanese name, English name, point code, meridian)
- **Real-time Highlighting**: Click search results to highlight points on the 3D model
- **Responsive Design**: Works on desktop and mobile devices
- **Accessibility**: Screen reader support and keyboard navigation
- **GitHub Pages Ready**: Static deployment with optimized loading

## 🚀 Live Demo

Visit the live application: [https://parkunggi.github.io/parkunggi-acupuncture-app-demo/](https://parkunggi.github.io/parkunggi-acupuncture-app-demo/)

## 📋 Setup GitHub Pages

To enable GitHub Pages for this repository:

1. Go to your repository settings on GitHub
2. Scroll down to "Pages" section
3. Under "Source", select "Deploy from a branch"
4. Choose "main" branch and "/docs" folder
5. Click "Save"
6. Your site will be available at `https://<username>.github.io/parkunggi-acupuncture-app-demo/`

The site will automatically update when you push changes to the `main` branch.

## 🏗️ Current Architecture (MVP)

### File Structure
```
docs/
├── index.html          # Main SPA entry point
├── styles.css          # Modern CSS with responsive design
├── js/
│   ├── app.js          # Main application logic
│   └── scene.js        # Three.js 3D scene management
├── data/
│   └── acupoints.json  # Sample acupoint data with 3D coordinates
└── .nojekyll           # GitHub Pages optimization
```

### Technology Stack
- **Frontend**: Vanilla JavaScript ES6+ modules
- **3D Graphics**: Three.js (loaded via CDN)
- **Styling**: Modern CSS with CSS Variables
- **Data**: Static JSON files
- **Deployment**: GitHub Pages

### Sample Data
Currently includes 8 sample acupoints with approximate coordinates:
- 合谷 (Hegu, LI4) - Hand acupoint
- 足三里 (Zusanli, ST36) - Leg acupoint  
- 百会 (Baihui, GV20) - Head acupoint
- And more...

## 🎯 Usage

1. **Search**: Type acupoint names in Japanese/English, codes (LI4), or meridian names
2. **Navigate**: Use arrow keys to navigate search results
3. **Select**: Click results or press Enter to highlight points on 3D model
4. **View**: Examine detailed information in the info panel
5. **3D Controls**: 
   - Rotate: Left mouse drag
   - Zoom: Mouse wheel
   - Pan: Right mouse drag

## 🔧 Local Development

Since this is a static site with ES6 modules, you need to serve it via HTTP:

```bash
# Using Python (if available)
cd docs
python -m http.server 8000

# Using Node.js (if available)
npx serve docs

# Using any static file server
# Then visit http://localhost:8000
```

## 🚧 Future Roadmap

### High Priority Enhancements
- [ ] **Detailed 3D Model**: Replace primitive shapes with anatomically accurate GLTF human model
- [ ] **Complete Acupoint Database**: Add all standard TCM acupoints with WHO codes
- [ ] **Medical Accuracy**: Verify coordinates with TCM practitioners
- [ ] **Safety Information**: Add contraindications and safety guidelines

### Medium Priority Features  
- [ ] **Meridian Visualization**: Show meridian lines and relationships
- [ ] **Advanced Search**: Filter by meridian, condition, body region
- [ ] **Internationalization**: Support multiple languages (i18n)
- [ ] **Build Optimization**: Implement Vite/webpack for bundle optimization

### Long-term Goals
- [ ] **Mobile App**: React Native or Flutter version
- [ ] **API Integration**: Connect to external TCM databases  
- [ ] **User Accounts**: Save favorite points and personal notes
- [ ] **Educational Content**: Add tutorials and TCM theory
- [ ] **Testing Framework**: Implement automated testing (Vitest, Playwright)

## ⚠️ Medical Disclaimer

**Important**: This application is for educational and demonstration purposes only. 

- Acupoint positions are approximate and not medically verified
- Sample coordinates are for prototype functionality only
- Not intended for actual medical treatment or diagnosis
- Always consult qualified TCM practitioners for real treatments
- No medical accuracy is guaranteed in the current version

## 🤝 Contributing

This is a demo project, but contributions are welcome:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/new-feature`)
3. Commit changes (`git commit -am 'Add new feature'`)
4. Push to branch (`git push origin feature/new-feature`)
5. Open a Pull Request

## 📜 License

This project is available under the MIT License. See LICENSE file for details.

**Note**: Future versions may include 3D models and datasets with different licensing terms.

## 🏥 Acknowledgments

- Traditional Chinese Medicine practitioners for foundational knowledge
- Three.js community for excellent 3D visualization tools
- WHO International Standard Acupuncture Point Locations
- Contributors to open-source 3D human anatomy models

---

*Built with ❤️ for education and TCM learning*