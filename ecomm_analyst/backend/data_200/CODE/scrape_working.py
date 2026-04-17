#!/usr/bin/env python3
import csv
import requests
import time
from pathlib import Path
from io import BytesIO
from PIL import Image
from bs4 import BeautifulSoup
import re

CSV_FILE = "beauty_products_enhanced.csv"
IMAGE_DIR = "product_images"
Path(IMAGE_DIR).mkdir(exist_ok=True)

def process_image(response_content, filepath):
    """Convert & save any image to JPEG"""
    img = Image.open(BytesIO(response_content))
    img.thumbnail((400, 400), Image.Resampling.LANCZOS)
    if img.mode in ('RGBA', 'LA', 'P'):
        bg = Image.new('RGB', img.size, (255, 255, 255))
        if img.mode == 'P':
            img = img.convert('RGBA')
        if img.mode == 'RGBA':
            bg.paste(img, mask=img.split()[-1])
        else:
            bg.paste(img)
        img = bg
    elif img.mode != 'RGB':
        img = img.convert('RGB')
    img.save(filepath, quality=85, format="JPEG")

def scrape_taobao(product_name):
    """Scrape Taobao image"""
    url = f"https://s.taobao.com/search?q={product_name.replace(' ', '+')}"
    r = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=10)
    soup = BeautifulSoup(r.content, 'html.parser')
    for img in soup.find_all('img'):
        src = img.get('src', '')
        if src and 'alicdn' in src and src.startswith('http'):
            return src
    patterns = re.findall(r'https://[^"]*alicdn[^"]*\.jpg', r.text)
    return patterns[0] if patterns else None

def scrape_shopee(product_name):
    """Scrape Shopee image"""
    url = f"https://shopee.sg/search?keyword={product_name.replace(' ', '%20')}"
    r = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=10)
    soup = BeautifulSoup(r.content, 'html.parser')
    patterns = re.findall(r'https://[^"]*(?:cf|mms)\.shopee[^"]*\.jpg', r.text)
    return patterns[0] if patterns else None

def scrape_jd(product_name):
    """Scrape JD image"""
    url = f"https://search.jd.com/Search?keyword={product_name.replace(' ', '+')}"
    r = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=10)
    soup = BeautifulSoup(r.content, 'html.parser')
    for img in soup.find_all('img'):
        src = img.get('src', '')
        if src and 'jd.com' in src and src.startswith('http'):
            return src
    return None

def main():
    print("\n" + "="*80)
    print("📍 MARKETPLACE IMAGE SCRAPER (Simplified)")
    print("="*80 + "\n")
    
    with open(CSV_FILE, 'r', encoding='utf-8') as f:
        products = list(csv.DictReader(f))
    
    print(f"Found {len(products)} products\n")
    
    by_mp = {}
    for p in products:
        mp = p.get("marketplace", "").lower()
        if mp not in by_mp:
            by_mp[mp] = []
        by_mp[mp].append(p)
    
    scrapers = {"taobao": scrape_taobao, "shopee": scrape_shopee, "jd.com": scrape_jd}
    
    for marketplace in ["taobao", "shopee", "jd.com"]:
        if marketplace not in by_mp:
            continue
        
        mp_prods = by_mp[marketplace]
        print(f"🛍️  {marketplace.upper()} ({len(mp_prods)} products)")
        print("-"*80)
        
        for idx, product in enumerate(mp_prods, 1):
            prod_idx = next(i for i, p in enumerate(products) if p == product) + 1
            filepath = Path(IMAGE_DIR) / f"product_{prod_idx:04d}.jpg"
            name = product["name"][:45]
            
            print(f"   [{idx:3}/{len(mp_prods):3}] {name:45}", end="", flush=True)
            
            try:
                image_url = scrapers[marketplace](product["name"])
                if not image_url:
                    raise Exception("No image found")
                
                r = requests.get(image_url, timeout=10, headers={"User-Agent": "Mozilla/5.0"})
                r.raise_for_status()
                
                process_image(r.content, filepath)
                product["image_url"] = image_url
                product["local_image_path"] = str(filepath)
                print(" ✅")
                
            except Exception as e:
                print(f"\n\n{'='*80}")
                print(f"❌ FAILED: {marketplace} - {product['name']}")
                print(f"Error: {e}")
                print("="*80 + "\n")
                return False
    
    # Save
    with open(CSV_FILE, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=products[0].keys())
        writer.writeheader()
        writer.writerows(products)
    
    print(f"\n{'='*80}")
    print(f"✅ All {len(products)} products processed!")
    print(f"{'='*80}\n")
    return True

if __name__ == "__main__":
    main()
