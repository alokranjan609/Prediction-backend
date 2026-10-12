import math
import pandas as pd

# ============================================================
#     FWI CONFIGURATION (TUNED FOR KOLHAPUR REGION)
# ============================================================

RH_CORRECTION = 0.75      # FIRMS RH → noon RH correction
RH_FLOOR = 45             # Minimum realistic humidity for Kolhapur dry months
TEMP_SCALE = 0.92         # FIRMS temperature adjustment
MIN_WIND = 4.0            # Minimum wind speed for FWI (km/h)
RAIN_EFFECT_FACTOR = 1.15 # Tropical rainfall efficiency
TEMP_DRY_FACTOR = 1.05    # Extra drying due to tropical temperatures
HUMIDITY_DAMPING = 0.95   # Dampens drying under high humidity

# Tropical (India) day-length correction factors
DAY_LENGTH_DMC = [10.8,11.4,12.1,12.5,13.0,13.3,13.1,12.6,12.1,11.4,10.8,10.6]
DAY_LENGTH_DC  = [10.5,11.2,12.0,12.6,13.1,13.5,13.4,12.9,12.2,11.3,10.7,10.3]

# ============================================================
#     FWI SUB-FUNCTIONS (FFMC, DMC, DC, ISI, BUI, FWI)
# ============================================================

def calculate_ffmc(temp, rh, wind, rain, prev):
    mo = 147.2*(101-prev)/(59.5+prev)
    if rain > 0.5:
        rf = (rain - 0.5) * RAIN_EFFECT_FACTOR
        mo += 42.5*rf*math.exp(-100/(251-mo)) * (1 - math.exp(-6.93/rf))
        mo = min(mo, 250)
    ed = (0.942*(rh**0.679) + 11*math.exp((rh-100)/10) + 0.18*(21.1-temp)) * HUMIDITY_DAMPING
    if mo < ed:
        k = (0.424*(1-(rh/100)**1.7) + 0.0694*math.sqrt(wind)*(1-(rh/100)**8))
        k *= 0.581*math.exp(0.0365 * temp * TEMP_DRY_FACTOR)
        mo = ed - (ed - mo)*math.exp(-k)
    return max(0, min(101, 59.5*(250-mo)/(147.2+mo)))


def calculate_dmc(temp, rh, rain, prev, m):
    dmc = prev
    Lf = DAY_LENGTH_DMC[m-1]
    if rain > 1.5:
        re = (rain - 1.5) * RAIN_EFFECT_FACTOR
        mo = 20 + math.exp(5.6348 - dmc/43.43)
        mo += 1000*re/(48.77+re)
        dmc = 43.43*(5.6348 - math.log(mo - 20))
    dmc += 1.894*(temp+1.1)*(100-rh)*0.0001*Lf * TEMP_DRY_FACTOR
    return dmc


def calculate_dc(temp, rain, prev, m):
    dc = prev
    Lf = DAY_LENGTH_DC[m-1]
    if rain > 2.8:
        re = (rain - 2.8) * RAIN_EFFECT_FACTOR
        Q = 800*math.exp(-dc/400) + 3.937*re
        dc = -400*math.log(Q/800)
    V = 0.36*(temp+2.8) + Lf*0.005
    dc += V * TEMP_DRY_FACTOR
    return dc


def calculate_isi(ffmc, wind):
    mo = 147.2*(101-ffmc)/(59.5+ffmc)
    return (91.9*math.exp(-0.1386*mo)*(1+(mo**5.31)/4.93e7)) * math.exp(0.05039*wind)


def calculate_bui(dmc, dc):
    if dmc <= 0: return 0
    if dmc <= dc: return (0.8*dmc*dc)/(dmc + 0.4*dc)
    return (dmc - (1-0.8*dc/(dmc+dc))) * 0.92


def calculate_fwi(isi, bui):
    if bui <= 80:
        fD = 0.626*(bui**0.809) + 2
    else:
        fD = 1000 / (25 + 108.64*math.exp(-0.023*bui))
    B = 0.1*isi*fD
    if B <= 1: return B
    return math.exp(2.72*(0.43*math.log(B))**0.5)


def classify_fwi(fwi):
    if fwi < 5:
        return "Very Low"
    elif fwi < 10:
        return "Low"
    elif fwi < 20:
        return "Moderate"
    elif fwi < 30:
        return "High"
    else:
        return "Extreme"

# ============================================================
#     MAIN FUNCTION: APPLY FWI TO A DATAFRAME
# ============================================================

def compute_fwi(df):
    df = df.copy()

    # Convert date
    df["acq_date"] = pd.to_datetime(df["acq_date"])
    df["month"] = df["acq_date"].dt.month

    # Correct inputs
    df["RH"] = (df["Humidity_Fraction"]*100*RH_CORRECTION).clip(lower=RH_FLOOR)
    df["temp_adj"] = df["Temperature_C"] * TEMP_SCALE
    df["wind_adj"] = df["Wind_Speed_kmh"].clip(lower=MIN_WIND)

    # Storage
    ff_list = []
    dmc_list = []
    dc_list = []
    isi_list = []
    bui_list = []
    fwi_list = []

    # Initial conditions (Canadian defaults)
    prev_ffmc = 85
    prev_dmc = 12
    prev_dc = 140

    # Iterate chronologically
    df = df.sort_values("acq_date")

    for _, r in df.iterrows():
        ff = calculate_ffmc(r.temp_adj, r.RH, r.wind_adj, r.Rainfall_mm, prev_ffmc)
        dmc = calculate_dmc(r.temp_adj, r.RH, r.Rainfall_mm, prev_dmc, r.month)
        dc = calculate_dc(r.temp_adj, r.Rainfall_mm, prev_dc, r.month)
        isi = calculate_isi(ff, r.wind_adj)
        bui = calculate_bui(dmc, dc)
        fwi = calculate_fwi(isi, bui)

        ff_list.append(ff)
        dmc_list.append(dmc)
        dc_list.append(dc)
        isi_list.append(isi)
        bui_list.append(bui)
        fwi_list.append(fwi)

        prev_ffmc, prev_dmc, prev_dc = ff, dmc, dc

    df["ffmc"] = ff_list
    df["dmc"] = dmc_list
    df["dc"] = dc_list
    df["isi"] = isi_list
    df["bui"] = bui_list
    df["fwi"] = fwi_list

    return df


# ============================================================
#     POLYGON FWI RUNNER
# ============================================================

from grid import polygon_to_grid

def run_polygon_fwi(polygon_coords: list[list[float]], grid_spacing: float = 0.5, weather_override: dict | None = None):
    grid_res = polygon_to_grid(polygon_coords, grid_spacing)
    grid_pts = grid_res["grid_points"]

    # default_weather = {
    #     "temp": 32.0,
    #     "humidity": 0.35,
    #     "wind": 8.0,
    #     "rainfall": 0.0
    # }
    w = weather_override or {}
    now = pd.Timestamp.now()

    rows = []
    for pt in grid_pts:
        rows.append({
            "acq_date": now,
            "latitude": pt["lat"],
            "longitude": pt["lon"],
            "Temperature_C": float(w.get("temp",32)),
            "Humidity_Fraction": float(w.get("humidity",0.35)),
            "Wind_Speed_kmh": float(w.get("wind",8.0)),
            "Rainfall_mm": float(w.get("rainfall",0.0))
        })

    df = pd.DataFrame(rows)
    fwi_df = compute_fwi(df)

    results = []
    for _, row in fwi_df.iterrows():
        fwi_val = float(row["fwi"])
        results.append({
            "lat": float(row["latitude"]),
            "lon": float(row["longitude"]),
            "fwi": round(fwi_val, 2),
            "classification": classify_fwi(fwi_val),
            "sub_indices": {
                "ffmc": round(float(row["ffmc"]), 2),
                "dmc": round(float(row["dmc"]), 2),
                "dc": round(float(row["dc"]), 2),
                "isi": round(float(row["isi"]), 2),
                "bui": round(float(row["bui"]), 2)
            }
        })

    hottest = max(results, key=lambda r: r["fwi"])
    safest = min(results, key=lambda r: r["fwi"])
    mean_fwi = round(sum(r["fwi"] for r in results) / len(results), 2)
    high_risk_count = sum(1 for r in results if r["fwi"] >= 20.0)

    summary = {
        "total_points": len(results),
        "mean_fwi": mean_fwi,
        "overall_classification": classify_fwi(mean_fwi),
        "high_risk_count": high_risk_count,
        "hottest_point": hottest,
        "safest_point": safest
    }

    return {
        "success": True,
        "summary": summary,
        "grid_results": results
    }

