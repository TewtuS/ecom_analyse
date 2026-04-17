"""
DuckDuckGo Images Scraper - Selenium Version
Downloads first image for each product from DuckDuckGo
"""

import csv
import os
import time
import requests
from PIL import Image
from io import BytesIO
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.chrome.service import Service

OUTPUT_DIR = "duckduckgo_images_selenium_final"
CSV_FILE = "products.csv"

def setup_driver():
    """Setup Selenium Chrome driver"""
    chrome_options = Options()
    chrome_options.add_argument("--start-maximized")
    chrome_options.add_argument("--disable-blink-features=AutomationControlled")
    chrome_options.add_argument("user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36")
    
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=chrome_options)
    return driver

def sanitize_filename(name):
    """Sanitize product name for use as filename"""
    # Replace invalid characters and limit length
    import re
    name = re.sub(r'[^a-zA-Z0-9\s-]', '', name)
    name = re.sub(r'\s+', '_', name).lower()
    name = name[:60]  # Limit to 60 chars
    return name

def download_image(url, filename):
    """Download image from URL and save"""
    try:
        response = requests.get(url, timeout=10, headers={'User-Agent': 'Mozilla/5.0'})
        response.raise_for_status()
        
        # Open image and convert to RGB (remove alpha channel)
        img = Image.open(BytesIO(response.content))
        if img.mode in ('RGBA', 'LA', 'P'):
            img = img.convert('RGB')
        
        # Save
        img.save(filename, 'JPEG', quality=90)
        return True
    except Exception as e:
        print(f"❌ Download failed")
        return False

def scrape_duckduckgo_images_selenium():
    """Scrape DuckDuckGo Images for products using Selenium"""
    
    # Read products
    products = []
    with open(CSV_FILE, 'r') as f:
        reader = csv.DictReader(f)
        products = list(reader)
    
    print(f"\n{'='*80}")
    print(f"DUCKDUCKGO IMAGES SCRAPER - SELENIUM (FIXED)")
    print(f"{'='*80}")
    print(f"Found {len(products)} products\n")
    
    driver = setup_driver()
    successful = 0
    failed = 0
    total = len(products)
    
    try:
        for idx, product in enumerate(products, 1):  # Process ALL products
            product_name = product['name']
            safe_name = sanitize_filename(product_name)
            filename = f"{OUTPUT_DIR}/{safe_name}.jpg"
            
            # Skip if already downloaded
            if os.path.exists(filename):
                print(f"[{idx:3}/{total}] ⏭️  {product_name[:50]:<50} (exists)")
                continue
            
            print(f"[{idx:3}/{total}] 🔍 {product_name[:50]:<50}", end=" ", flush=True)
            
            try:
                # Navigate
                search_url = f"https://duckduckgo.com/?q={product_name}&iax=images&ia=images"
                driver.get(search_url)
                
                # Wait 9 seconds for page to fully render
                print("⏳", end="", flush=True)
                time.sleep(9)
                
                img_url = None
                
                # Strategy 1: Find all img tags inside the gallery
                images = driver.find_elements(By.TAG_NAME, "img")
                for img in images:
                    src = img.get_attribute("src")
                    if src and not src.startswith("data:") and ("http" in src or len(src) > 100):
                        img_url = src
                        break
                
                # Strategy 2: Look for data-src attribute
                if not img_url:
                    images = driver.find_elements(By.CSS_SELECTOR, "img[data-src]")
                    for img in images:
                        src = img.get_attribute("data-src")
                        if src and not src.startswith("data:") and len(src) > 100:
                            img_url = src
                            break
                
                # Strategy 3: Click first image tile and extract URL
                if not img_url:
                    try:
                        # Find image containers
                        tiles = driver.find_elements(By.CSS_SELECTOR, "div[role='link']")
                        if tiles:
                            driver.execute_script("arguments[0].click();", tiles[0])
                            time.sleep(3)
                            
                            # Extract image from expanded view
                            images = driver.find_elements(By.TAG_NAME, "img")
                            for img in images:
                                src = img.get_attribute("src")
                                if src and "http" in src and len(src) > 100:
                                    img_url = src
                                    break
                    except:
                        pass
                
                # Strategy 4: Try finding images in picture elements
                if not img_url:
                    pictures = driver.find_elements(By.TAG_NAME, "picture")
                    for pic in pictures:
                        imgs = pic.find_elements(By.TAG_NAME, "img")
                        if imgs:
                            src = imgs[0].get_attribute("src")
                            if src and not src.startswith("data:") and len(src) > 100:
                                img_url = src
                                break
                
                if not img_url:
                    print("❌ No URL found")
                    failed += 1
                    continue
                
                # Download
                if download_image(img_url, filename):
                    print("✅")
                    successful += 1
                else:
                    failed += 1
                    
            except Exception as e:
                print(f"❌ Error")
                failed += 1
            
            time.sleep(1)
    
    finally:
        driver.quit()
    
    print(f"\n{'='*80}")
    print(f"Results: ✅ {successful} successful, ❌ {failed} failed out of {total} products")
    print(f"Success Rate: {(successful/total*100):.1f}%")
    print(f"{'='*80}\n")

if __name__ == "__main__":
    scrape_duckduckgo_images_selenium()
