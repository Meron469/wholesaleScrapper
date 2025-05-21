# Setting Up PacketStream Residential Proxies

This guide explains how to set up PacketStream residential proxies to improve scraping success rates by bypassing PerimeterX protection.

## Why Use Residential Proxies?

PerimeterX and similar protection services specifically target and block:
1. Data center IPs (like those from Replit, Render.com, AWS, etc.)
2. IPs with known scraping history
3. Cloud provider IPs

By using residential proxies, your requests appear to come from regular home internet connections, significantly reducing the chance of being blocked.

## PacketStream Setup

PacketStream is one of the most affordable residential proxy providers, with pricing starting at $1 per GB of data.

### Step 1: Sign Up for PacketStream

1. Go to [PacketStream.io](https://packetstream.io/) and create an account
2. **IMPORTANT:** Add funds to your account (minimum $1 required)
3. Navigate to the dashboard to get your credentials

### Step 2: Configure Environment Variables

1. In your `.env` file, update these variables:

```
USE_PROXY=true
PROXY_USERNAME=your-packetstream-username
PROXY_PASSWORD=your-packetstream-password
PROXY_HOST=proxy.packetstream.io
PROXY_PORT=31112
```

2. Replace `your-packetstream-username` and `your-packetstream-password` with your actual PacketStream credentials

### Step 3: Restart the Scraper

After updating your environment variables, restart the scraper server:

```bash
# In Replit, simply restart the ScrapeServer workflow
```

## Common Issues & Troubleshooting

### "ERR_PROXY_CONNECTION_FAILED" or "Proxy Authentication Required"

This usually means one of the following:

1. **Account Not Funded**: You need to add at least $1 to your PacketStream account
   - Log in to [packetstream.io](https://packetstream.io)
   - Click "Add Funds" and add a minimum of $1 (more is better)
   - Wait about 5 minutes for it to activate

2. **Incorrect Credentials**: Double-check your username and password
   - Make sure there are no extra spaces
   - Verify username is exactly as shown in your PacketStream dashboard
   - Try changing the proxy port to 31113, 31114, or 31115

3. **Connection Issue**: PacketStream servers might be having issues
   - Try again after a few minutes
   - Check if you can connect to other sites via the proxy

### Timeout Errors

If you're getting timeout errors when using the proxy:

1. PacketStream has a slightly slower connection than direct connections
   - Increase timeout values in the code to 90000 (90 seconds) or more
   - This is normal for residential proxies as they route through real home connections

2. Try different port variations (31112, 31113, 31114, etc.)
   - Each port connects to different residential IPs
   - Some IPs might be faster than others

## Usage Notes

- **IP Rotation**: The system automatically rotates proxy IPs between requests by using slightly different port numbers
- **Data Usage**: Scraping a single ZIP code typically uses 1-3 MB of data
- **Monitoring**: You can monitor your data usage in the PacketStream dashboard
- **Cost Control**: Set daily/weekly spending limits in your PacketStream dashboard

## Testing Your Proxy

Visit `/proxy-test` in your application to:
1. Check if your proxy setup is correctly configured
2. See if your PacketStream credentials are working
3. Test a scrape using the proxy

## Alternative Proxy Services

If you need more reliable proxies and have a larger budget, consider:

1. **Bright Data (Luminati)** - Most reliable but expensive ($500+/month)
2. **Smartproxy** - Good balance of price/performance ($75+/month)
3. **Oxylabs** - Enterprise-grade solution ($300+/month)

The code is already set up to work with these services - you just need to update the proxy host, port, username, and password in your `.env` file.