from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Any, List
from dotenv import load_dotenv
from groq import Groq
import os, json

# ----- Env + clients -----
load_dotenv()
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = os.getenv("GROQ_MODEL", "mixtral-8x7b-32768")

if not GROQ_API_KEY:
    raise RuntimeError("GROQ_API_KEY not set. Put it in backend/.env")

client = Groq(api_key=GROQ_API_KEY)

# load in the dataset provided
DATA_PATH = os.path.join(os.path.dirname(__file__), "hosts_dataset.json")
if not os.path.exists(DATA_PATH):
    raise RuntimeError(f"Missing dataset file at {DATA_PATH}")

with open(DATA_PATH, "r", encoding="utf-8") as f:
    data = json.load(f)

# build a quick IP to host map for O(1) lookup
HOSTS: Dict[str, Dict[str, Any]] = {h["ip"]: h for h in data.get("hosts", [])}

# create the api models
class SummarizeRequest(BaseModel):
    ip: str

class SummarizeResponse(BaseModel):
    ip: str
    summary: str

class HostInfo(BaseModel):
    ip: str
    location: str
    risk_level: str

class HostsResponse(BaseModel):
    hosts: List[HostInfo]

# create a strong prompt for good analyst level generation
def build_prompt(host: Dict[str, Any]) -> str:
    """
    Keep the instructions tight. Force concise, factual output.
    """
    return (
        "You are acting as a senior cybersecurity analyst. Write a short, professional incident-style summary in 4–5 coherent sentences.\n\n"
        "Rules:\n"
        "- Always use full sentences and flowing prose. Do not use bullet points, asterisks, or lists.\n"
        "- Begin with the IP and geographic location.\n"
        "- State exposed services with port, product, and version in one sentence.\n"
        "- Describe vulnerabilities with CVE IDs, severity, CVSS score if present, and likely impact. Prioritize critical and high vulnerabilities first.\n"
        "- Mention any threat or malware labels exactly as provided in the dataset.\n"
        "- Handle risk consistently:\n"
        "   * If dataset risk matches your assessment, write exactly: 'Risk level: <level> (matches dataset).'\n"
        "   * If you assess higher risk than dataset, write: 'Dataset risk: <X>. Analyst adjustment: <Y> due to <reason>.'\n"
        "   * Never downgrade below dataset risk.\n"
        "- End with 1–2 remediation recommendations written as sentences, focusing on immediate defensive actions (e.g., patching, restricting access, monitoring).\n"
        "- Keep tone professional, concise, and clear. No formatting symbols, no headings.\n"
        "- Combine related information into sentences where possible to ensure smooth flow.\n\n"
        f"Host JSON:\n{json.dumps(host, indent=2)}"
    )



# make the call to groq and get the response
def summarize_with_groq(prompt: str) -> str:
    """
    Calls Groq chat completions with a small temperature for deterministic summaries.
    """
    resp = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[
            {"role": "system", "content": "You are a precise, no-fluff security analyst."},
            {"role": "user", "content": prompt},
        ],
        temperature=0.2,
        max_tokens=400,
    )
    return resp.choices[0].message.content.strip()

app = FastAPI(title="Censys Summarizer (Groq)")

# CORS so  Next.js frontend can call this
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000", 
        "http://127.0.0.1:3000",
        "http://localhost:5173", 
        "http://127.0.0.1:5173",

    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# gets the list of available hosts from the dataset
@app.get("/hosts", response_model=HostsResponse)
def get_hosts():
    """
    Get list of available hosts from the dataset
    """
    hosts = []
    for ip, host_data in HOSTS.items():
        # Extract location info
        location = "Unknown"
        if "location" in host_data:
            loc = host_data["location"]
            if "city" in loc and "country" in loc:
                location = f"{loc['city']}, {loc['country']}"
            elif "country" in loc:
                location = loc["country"]
        
        # extract risk level
        risk_level = "unknown"
        if "threat_intelligence" in host_data and "risk_level" in host_data["threat_intelligence"]:
            risk_level = host_data["threat_intelligence"]["risk_level"]
        
        hosts.append(HostInfo(
            ip=ip,
            location=location,
            risk_level=risk_level
        ))
    
    return HostsResponse(hosts=hosts)


# summarize the host
@app.post("/summarize", response_model=SummarizeResponse)
def summarize(req: SummarizeRequest):
    ip = req.ip.strip()
    host = HOSTS.get(ip)
    if not host:
        raise HTTPException(status_code=404, detail=f"Host not found for IP: {ip}")

    prompt = build_prompt(host)
    try:
        summary = summarize_with_groq(prompt)
    except Exception as e:
        # If Groq fails, return a clear error
        raise HTTPException(status_code=502, detail=f"LLM error: {e}")

    return SummarizeResponse(ip=ip, summary=summary)