# Knoxville Restaurants

Static restaurant directory for Knoxville, TN.

**Last Updated**: 2025-10-21 18:53:50 UTC
**Total Restaurants**: 244

## Usage

This is a static site. Simply open `index.html` in your browser or deploy to GitHub Pages.

## Updating

To update the restaurant data:

```bash
cd /Users/josh/web/_projects/cortex
cargo run export-restaurants --output ~/web/knoxville-restaurants
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
- Dark mode support
- Mobile responsive
- No build tools or dependencies required
