# Anti-Captcha Service Setup Guide

This guide explains how to set up and use the Anti-Captcha service with our Zillow FSBO scraper.

## What is Anti-Captcha?

Anti-Captcha is a CAPTCHA solving service that helps bypass CAPTCHA challenges on websites using a combination of AI and human solvers. For our Zillow scraper, it helps solve the PerimeterX "press and hold" CAPTCHAs and reCAPTCHA challenges.

## Cost

- Standard reCAPTCHA v2: ~$1.80 per 1,000 solves
- Image CAPTCHAs: ~$0.50 per 1,000 solves
- Minimum deposit: $10
- Average solving time: 10-15 seconds

## Setup Steps

1. **Create an Anti-Captcha Account**
   - Visit [Anti-Captcha.com](https://anti-captcha.com)
   - Sign up for a new account

2. **Add Funds**
   - Log in to your account
   - Navigate to "Add Funds" section
   - Choose your payment method
   - Add a minimum of $10 (recommended for testing)

3. **Get Your API Key**
   - Go to "Settings" in your Anti-Captcha dashboard
   - Find the "API Key" section
   - Copy your API key

4. **Set Up Environment Variables**
   - For local development:
     - Add `ANTICAPTCHA_API_KEY=your_api_key` to your `.env` file

   - For Render.com deployment:
     - Navigate to your service dashboard on Render.com
     - Go to "Environment" section
     - Add a new environment variable:
       - Key: `ANTICAPTCHA_API_KEY`
       - Value: Your API key from Anti-Captcha
     - Click "Save Changes" and redeploy your application

## Testing the Integration

Once your API key is set up, the scraper will automatically use Anti-Captcha when it encounters a CAPTCHA challenge. You can test it by:

1. Running a scrape with a ZIP code known to trigger CAPTCHAs:
   ```
   curl "http://localhost:5001/scrape?zip=90210"
   ```

2. Check the logs for messages like:
   - "Anti-CAPTCHA solver initialized: Successfully"
   - "Attempting to solve CAPTCHA using Anti-Captcha service..."
   - "CAPTCHA successfully solved by Anti-Captcha service!"

## Troubleshooting

- **Insufficient Funds**: If you see "Anti-Captcha balance insufficient" errors, add more funds to your account.
- **Invalid API Key**: Verify your API key is correctly set in the environment variables.
- **Slow Solving**: During peak times, solving can take longer. The system will wait up to 120 seconds before timing out.

## Monitoring Usage

You can monitor your Anti-Captcha usage and remaining balance in your Anti-Captcha dashboard. The system also logs your current balance when initializing the service.