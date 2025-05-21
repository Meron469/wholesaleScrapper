
import sys
import json
from trafilatura import fetch_url, extract
import re
from datetime import datetime

def scrape_zillow(url):
    try:
        html = fetch_url(url)
        if not html:
            return {
                "zipCode": "90210",
                "count": 0,
                "listings": [],
                "error": "Failed to fetch page",
                "sampleUrl": url
            }
            
        # Extract the text from the HTML
        text = extract(html)
        
        # Extract real property data from the HTML using simple parsing
        result = {
            "zipCode": "90210",
            "count": 0,
            "listings": [],
            "timestamp": datetime.now().isoformat(),
            "sampleUrl": url
        }
        
        # Check if we hit a CAPTCHA
        if "captcha" in html.lower() or "robot" in html.lower():
            result["error"] = "CAPTCHA detected"
            result["message"] = "Zillow is blocking this IP address from scraping. Consider using their official API or a proxy service."
            return result
            
        # Try to extract real listing data
        import re
        
        # Look for address patterns in the text
        addresses = re.findall(r'(d+s+[ws]+(?:Ave|Avenue|St|Street|Rd|Road|Blvd|Boulevard|Dr|Drive|Ln|Lane|Cir|Circle|Ct|Court|Way|Pl|Place|Ter|Terrace)[,.]s+[A-Za-zs]+,s+[A-Z]{2}s+d{5})', text)
        
        # Look for price patterns
        prices = re.findall(r'$d{1,3}(?:,d{3})+(?:.d{2})?|$d+(?:,d{3})*(?:.d{2})?', text)
        
        # Create listings with whatever data we could extract
        listings = []
        
        # If we found addresses, create listings
        if addresses:
            for i, address in enumerate(addresses[:5]):  # Limit to 5 listings max
                price = prices[i] if i < len(prices) else "Contact for price"
                listing = {
                    "address": address.strip(),
                    "price": price,
                    "beds": "N/A",
                    "baths": "N/A",
                    "link": f"{url}#{i+1}"
                }
                listings.append(listing)
        
        # If we couldn't extract listings, create a single result with a message
        if not listings:
            # See if we can at least extract some meaningful text about FSBO
            fsbo_mentions = re.findall(r'(?:For Sale By Owner|FSBO).{5,100}?(?:home|property|house)', text)
            
            if fsbo_mentions:
                listing = {
                    "address": f"Property in {90210}",
                    "price": "See listing details",
                    "beds": "N/A",
                    "baths": "N/A",
                    "description": fsbo_mentions[0].strip(),
                    "link": url
                }
                listings.append(listing)
            else:
                # Create a single informed result
                listing = {
                    "address": f"ZIP code 90210 area",
                    "price": "See Zillow for current prices",
                    "beds": "N/A",
                    "baths": "N/A", 
                    "link": url
                }
                listings.append(listing)
        
        result["listings"] = listings
        result["count"] = len(listings)
        result["message"] = "Data extracted via fallback method - limited details available"
        
        return result
    except Exception as e:
        return {
            "zipCode": "90210",
            "count": 0,
            "listings": [],
            "error": "Scraping error",
            "message": str(e),
            "sampleUrl": url
        }

# Scrape and print result as JSON
result = scrape_zillow("https://www.zillow.com/homes/for_sale/fsbo/90210_rb/")
print(json.dumps(result))
    