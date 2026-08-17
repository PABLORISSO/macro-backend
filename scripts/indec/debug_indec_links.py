import requests
from bs4 import BeautifulSoup

url = "https://www.indec.gob.ar/ftp/cuadros/economia/"
print("Fetching", url)
response = requests.get(url, timeout=60)
print("Status", response.status_code)
print("--- text head ---")
print(response.text[:1000])
print("--- end text head ---")

soup = BeautifulSoup(response.text, "html.parser")
anchors = soup.find_all("a", href=True)
print("Anchors count:", len(anchors))
for a in anchors[:40]:
    print(repr(a['href']))
