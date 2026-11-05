"""Passenger WSGI Entrypoint untuk cPanel / CloudLinux Shared Hosting.

Menghubungkan aplikasi FastAPI (ASGI) ke server web Apache/cPanel via Phusion Passenger
menggunakan adapter a2wsgi (ASGI-to-WSGI).
"""

import os
import sys

# 1. Pastikan direktori aplikasi saat ini berada dalam sys.path
jalur_saat_ini = os.path.dirname(os.path.abspath(__file__))
if jalur_saat_ini not in sys.path:
    sys.path.insert(0, jalur_saat_ini)

# 2. Impor aplikasi minimal FastAPI
from aplikasi_minimal import app

# 3. Bungkus aplikasi ASGI dengan ASGIMiddleware dari a2wsgi agar kompatibel WSGI
try:
    from a2wsgi import ASGIMiddleware

    application = ASGIMiddleware(app)
except ImportError:
    # Pesan diagnostik ramah jika a2wsgi belum terpasang di virtualenv cPanel
    def application(environ, start_response):
        status = "500 Internal Server Error"
        output = (
            b"Paket 'a2wsgi' belum terpasang di virtualenv Python cPanel.\n"
            b"Jalankan: pip install a2wsgi\n"
        )
        response_headers = [
            ("Content-type", "text/plain; charset=utf-8"),
            ("Content-Length", str(len(output))),
        ]
        start_response(status, response_headers)
        return [output]
