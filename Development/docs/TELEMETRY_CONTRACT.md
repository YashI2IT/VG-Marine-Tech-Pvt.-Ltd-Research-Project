# Physical battery telemetry contract

TrustSense-BMS accepts **read-only** measurements from a BMS or sensor gateway. It never commands contactors, cooling, or charge hardware.

## Transports

Configure `TELEMETRY_TRANSPORT` as a comma list. HTTP ingest is always enabled.

| Transport | When to use | Required env |
|---|---|---|
| `http` (default) | Device gateway, ESP32, test harness | none |
| `mqtt` | IoT broker / BMS MQTT bridge | `MQTT_BROKER_URL`, optional user/password |
| `serial` | USB UART microcontroller | `TELEMETRY_SERIAL_PATH`, optional baud |

Optional packages: `mqtt` is a backend dependency. Serial requires `npm install serialport` if you enable that transport.

## HTTP ingest

`POST http://localhost:3001/api/trustsense/telemetry/ingest`

If `TELEMETRY_INGEST_TOKEN` is set, send header `X-Telemetry-Token`. Do not put this token in frontend code.

### JSON packet

```json
{
  "device_id": "pack-lab-01",
  "record_id": "optional-unique-id",
  "timestamp": "2026-10-22T09:30:00.000Z",
  "voltage_v": 3.710,
  "current_a": -1.250,
  "ah": -0.420,
  "chamber_temp_degC": 24.1,
  "power_w": -4.6375,
  "current_abs_a": 1.250,
  "battery_temp_degC": 31.2
}
```

Accepted timestamp forms: ISO-8601, Unix seconds, Unix milliseconds, or relative seconds (`time_s` < 1e9). Relative seconds are treated as sample time; freshness then uses gateway receive time.

### Units and sign convention

| Field | Unit | Notes |
|---|---|---|
| `voltage_v` | V | Pack or cell voltage as measured |
| `current_a` | A | **Preserved as sent.** Negative = discharge (Panasonic 18650PF convention) |
| `ah` | Ah | Accumulated ampere-hours from the BMS coulomb counter |
| `chamber_temp_degC` | °C | Ambient / chamber / pack-inlet temperature |
| `power_w` | W | Instantaneous electrical power |
| `current_abs_a` | A | `|current_a|` |
| `battery_temp_degC` | °C | Optional independent cell sensor. **Never an inference input** |

Aliases accepted: `voltage`, `current`, `ambient_temp_degC`, `accumulated_ah`.

## Derived fields (explicit methods only)

- Missing `power_w` → `V * I`
- Missing `current_abs_a` → `|I|`
- Missing `ah` is **rejected** unless `TELEMETRY_AH_SOURCE=integrate` and `TELEMETRY_AH_INITIAL` is set. Integration is `Ah += I * dt / 3600` using consecutive device timestamps.

No other defaults (including ambient temperature) are invented.

## MQTT

- Topic default: `trustsense/bms/+/telemetry`
- Payload: the same JSON object, UTF-8
- Broker URL example: `mqtt://127.0.0.1:1883`

## Serial / USB

- Line-delimited JSON at `TELEMETRY_SERIAL_BAUD` (default 115200)
- Example Windows path: `COM3`. Linux: `/dev/ttyUSB0`

## Pipeline behaviour

1. Contract validation (malformed, missing, stale, duplicate, out-of-order)
2. TrustValidator physics gate — `BLOCK` never enters the 60-step buffer
3. `SUSPICIOUS` is admitted with a warning
4. Inference only at exactly 60 consecutive valid steps
5. Gap larger than `TELEMETRY_MAX_GAP_S` (default 2 s) resets the window
6. Disconnect / stale timeout resets the window; reconnect starts a new consecutive sequence
7. Persistence is PostgreSQL; evidence is local files; ledger is the local adapter unless a live Fabric peer is separately verified

Dataset replay is a different dashboard mode and is labeled simulation. Live ingest is rejected while replay is running or paused.
