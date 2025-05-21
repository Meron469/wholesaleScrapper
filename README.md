# Zillow FSBO Scraper

A Node.js application that scrapes Zillow For Sale By Owner (FSBO) listings based on ZIP code input and outputs the results as JSON, designed for deployment on Render.com.

## Project Components

1. **Scraper Service** - A Node.js server that uses Puppeteer with advanced CAPTCHA bypass techniques to scrape Zillow FSBO listings
2. **Webhook Service** - An API server that calls the scraper, sanitizes responses to guarantee clean JSON data, and stores results in Firebase (optional)

## Key Features

- **Advanced CAPTCHA Bypass** - Implements sophisticated techniques including human-like interactions, natural mouse movements, and pressure simulation
- **Guaranteed JSON Responses** - Multi-layer sanitization ensures only clean JSON is returned, never HTML content
- **Multiple URL Strategies** - Tries different URL formats (standard, mobile, Google-referrer) to find the most reliable approach
- **Bypass Testing Tools** - Dedicated endpoint to test and compare effectiveness of different CAPTCHA bypass strategies

## Important Note About Zillow Scraping

**Zillow actively blocks scraping from many hosting providers, including Replit.**

For this application to work properly, the scraper component must be deployed to Render.com, which has proven more successful at accessing Zillow's website.

## Local Development

To run this application locally in Replit:

1. Start the local scraper: `node scraper.js` (this will start on port 5000)
2. Start the webhook server: `node webhook.js` (this will start on port 5001)

However, note that scraping attempts from Replit will likely be blocked by Zillow.

## Deployment to Render.com

This repository includes a `render.yaml` file for easy deployment to Render.com:

1. Create an account at [Render.com](https://render.com)
2. From your Render dashboard, click "New" and select "Blueprint"
3. Connect your repository (from GitHub, GitLab, etc.)
4. Render will automatically detect the `render.yaml` file and create your service

### After Deployment

Once deployed to Render.com, update your local webhook server's configuration:

1. In your Replit, set the `SCRAPER_URL` environment variable to your Render.com service URL
   (e.g., `https://your-service-name.onrender.com`)

## Firebase Integration (Optional)

For storing and retrieving scraped data, follow the instructions in `FIREBASE_SETUP.md`.

## Using the API

### To trigger a scrape:

```
POST /webhook/zillow
Content-Type: application/json

{
  "zipCode": "90210"
}
```

### To view scrape history:

```
GET /api/history
```

### To view specific scrape results:

```
GET /api/listings/:id
```

## Scheduled Scraping

The webhook server includes a scheduled task that runs daily at 3:00 AM to scrape listings for predefined ZIP codes. Edit the `zipCodesToMonitor` array in `webhook.js` to customize which ZIP codes to monitor.

## Important Disclaimer

This tool is for educational purposes only. Be aware that scraping websites may violate terms of service. Always check and respect robots.txt and the terms of service of any website you interact with.