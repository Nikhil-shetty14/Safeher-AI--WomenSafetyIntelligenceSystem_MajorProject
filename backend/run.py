import os
import tempfile
os.environ.setdefault("MPLCONFIGDIR", os.path.join(tempfile.gettempdir(), "safeher_mpl"))
os.makedirs(os.environ["MPLCONFIGDIR"], exist_ok=True)

import uvicorn
from app.main import socket_app

if __name__ == "__main__":
    uvicorn.run(
        "run:socket_app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
    )
