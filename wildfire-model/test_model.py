import pandas as pd
from model import compute_fwi

data = {
    "acq_date": ["2026-08-23"],
    "Humidity_Fraction": [0.84],
    "Temperature_C": [28.99],
    "Wind_Speed_kmh": [20.376],
    "Rainfall_mm": [0.26]
}

df = pd.DataFrame(data)

result = compute_fwi(df)

print(result)