#!/usr/bin/env python3

import subprocess
import sys
import os

def run_command(cmd, description):
    print(f"Installing {description}...")
    try:
        subprocess.run(cmd, shell=True, check=True, capture_output=True, text=True)
        print(f"{description} installed successfully")
        return True
    except subprocess.CalledProcessError as e:
        print(f"Failed to install {description}: {e.stderr}")
        return False

def main():
    print("Setting up font-detection environment")
    
    if not run_command("pip install -r requirements.txt", "Python dependencies"):
        return False
    
    if not run_command("playwright install chromium", "Chromium browser"):
        return False
    
    os.makedirs("data", exist_ok=True)
    print("Data directory created")
    print("Setup complete")

if __name__ == "__main__":
    main()
