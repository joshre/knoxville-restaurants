# Knoxville Restaurants

Static restaurant directory for Knoxville, TN.

**Last Updated**: 2026-08-18 19:06:22 UTC
**Total Restaurants**: 279

## Usage

This is a static site. Simply open `index.html` in your browser or deploy to GitHub Pages.

## Updating

Every file here is generated. Edit `src/templates/restaurants.html` and
`cortex-web/src/lib/restaurant-map.js` in Cortex, never this directory.

```bash
cd /Users/josh/web/_projects/cortex
cortex export-restaurants --output ~/web/knoxville-restaurants
```

Then commit and push:

```bash
cd ~/web/knoxville-restaurants
git add .
git commit -m "Update restaurant data $(date +%Y-%m-%d)"
git push
```

## Features

- Search restaurants by name, cuisine, or description
- Filter by cuisine type, price range, and neighborhood
- Interactive map with clustering
- Dark mode support
- Mobile responsive
