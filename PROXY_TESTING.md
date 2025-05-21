# Testing The PacketStream Proxy Integration

This document explains how to verify that your PacketStream proxy integration is working correctly.

## Quick Test Method

The quickest way to test if the proxy is working is to make a test scrape request:

1. Visit `/test-scrape?zipCode=90210` in your browser
2. Check the ScrapeServer logs in the Replit console
3. Look for the following messages:
   ```
   ✅ Using PacketStream residential proxy: proxy.packetstream.io:31112
   ✅ Proxy username: meron469
   ✅ IP rotation enabled for better scraping success
   ```

4. If you see these messages, your proxy configuration is correctly loaded

## Visual CAPTCHA Test Method

For a more detailed test that shows if the proxy is actually helping bypass PerimeterX:

1. Visit `/analyze-captcha?zip=90210` in your browser
2. This will open the CAPTCHA Analysis Tool which provides visual feedback
3. Check if the "After Solve" section shows a successful page transition
4. Compare the IP address shown in the analysis (if any) with your normal IP

## Comparing Results

To see the difference the proxy makes:

1. First, set `USE_PROXY=false` in your `.env` file and restart ScrapeServer
2. Run a test scrape and save the results
3. Then set `USE_PROXY=true` in your `.env` file and restart ScrapeServer
4. Run another test scrape and compare the results

## Troubleshooting

If you're experiencing issues:

1. **Authentication errors**: Double-check your PacketStream username and password
2. **IP ban messages**: Make sure you've added funds to your PacketStream account
3. **No proxy logs**: Verify that your .env file has `USE_PROXY=true` set correctly
4. **Connection errors**: Try using a different port number (31112, 31113, 31114, etc.)

## Technical Details

The proxy operates at the browser level by:

1. Setting up an authenticated proxy connection for all Puppeteer requests
2. Rotating IPs between sessions by varying the port number slightly
3. Using residential IPs that are less likely to be flagged by Zillow's protection
4. Passing your PacketStream credentials with each request

Your PacketStream usage is available in your PacketStream dashboard, where you can monitor data consumption and costs.