"""
Local server cho TOEIC ETS clone.
Run: python server.py
Then open: http://localhost:8000/
"""
import http.server
import socketserver
import os
import sys
from urllib.parse import urlparse

PORT = 8000
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'public')

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        # SPA-like route mapping: /grammar -> grammar.html, etc.
        routes = {
            '/': '/index.html',
            '/tests': '/tests.html',
            '/test': '/test.html',
            '/quick': '/quick.html',
            '/roadmap': '/roadmap.html',
            '/study': '/study.html',
            '/drill': '/drill.html',
            '/notes': '/notes.html',
            '/part2': '/part2.html',
            '/dictation': '/dictation.html',
            '/mistakes': '/mistakes.html',
            '/login': '/login.html',
            '/profile': '/profile.html',
            '/grammar': '/grammar.html',
            '/vocabulary': '/vocabulary.html',
        }
        if path in routes:
            self.path = routes[path] + (('?' + parsed.query) if parsed.query else '')
        return super().do_GET()

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def guess_type(self, path):
        # Ensure correct mime for .mjs and font files
        if path.endswith('.mjs'):
            return 'application/javascript'
        if path.endswith('.ttf'):
            return 'font/ttf'
        return super().guess_type(path)

if __name__ == '__main__':
    os.chdir(ROOT)
    with socketserver.ThreadingTCPServer(('127.0.0.1', PORT), Handler) as httpd:
        print(f'TOEIC ETS local serving at http://localhost:{PORT}/')
        print(f'Root: {ROOT}')
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print('\nStopped.')
            sys.exit(0)
