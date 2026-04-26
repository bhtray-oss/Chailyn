"""
pattern_engine_client.py — 呼叫 pattern-engine Node.js 服務
"""
import httpx
from db.database import settings

BASE_URL = settings.pattern_engine_url


def _raise_if_error(resp: httpx.Response) -> dict:
    """Parse response and raise ValueError with the engine's own error message if not ok."""
    data = resp.json()
    if not data.get("ok", True):
        raise ValueError(data.get("error", f"pattern-engine error {resp.status_code}"))
    if resp.is_error:
        resp.raise_for_status()
    return data


async def draft(
    design: str,
    measurements: dict,
    options: dict = {},
    sa: int = 10,
    paperless: bool = False,
    units: str = "metric",
    render_mode: str = "svg",
    fill_missing: bool = True,
    gender: str = "cisFemale",
) -> dict:
    """
    POST /draft → { svg?, renderProps?, logs }
    """
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            f"{BASE_URL}/draft",
            json={
                "design": design,
                "measurements": measurements,
                "options": options,
                "sa": sa,
                "paperless": paperless,
                "units": units,
                "renderMode": render_mode,
                "fillMissing": fill_missing,
                "gender": gender,
            },
        )
        return _raise_if_error(resp)


async def sample(
    design: str,
    mode: str,
    measurements: dict = {},
    sample_option: str | None = None,
    sample_measurement: str | None = None,
    gender: str = "cisFemale",
) -> dict:
    """
    POST /sample → { svg, logs }
    """
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            f"{BASE_URL}/sample",
            json={
                "design": design,
                "mode": mode,
                "measurements": measurements,
                "sampleOption": sample_option,
                "sampleMeasurement": sample_measurement,
                "gender": gender,
            },
        )
        return _raise_if_error(resp)


async def estimate_measurements(measurements: dict, gender: str = "cisFemale") -> dict:
    """
    POST /measurements/estimate → { measurements }
    """
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            f"{BASE_URL}/measurements/estimate",
            json={"measurements": measurements, "gender": gender},
        )
        resp.raise_for_status()
        return resp.json().get("measurements", {})


async def dxf(
    design: str,
    measurements: dict,
    options: dict = {},
    sa: int = 10,
    paperless: bool = False,
    fill_missing: bool = True,
    gender: str = "cisFemale",
    title: str | None = None,
) -> bytes:
    """
    POST /dxf → DXF file bytes
    """
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            f"{BASE_URL}/dxf",
            json={
                "design": design,
                "measurements": measurements,
                "options": options,
                "sa": sa,
                "paperless": paperless,
                "fillMissing": fill_missing,
                "gender": gender,
                "title": title or design,
            },
        )
        if resp.is_error:
            data = resp.json()
            raise ValueError(data.get("error", f"DXF engine error {resp.status_code}"))
        return resp.content


async def list_designs() -> list[str]:
    async with httpx.AsyncClient(timeout=5.0) as client:
        resp = await client.get(f"{BASE_URL}/designs")
        resp.raise_for_status()
        return resp.json().get("designs", [])
