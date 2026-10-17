"""Only the explicitly trusted proxy may supply patient source addresses."""

import pytest
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware


@pytest.mark.parametrize(
    "peer,forwarded,expected",
    [
        ("172.18.0.1", "198.51.100.25", "198.51.100.25"),
        ("172.18.0.22", "198.51.100.25", "172.18.0.22"),
        ("172.18.0.1", "203.0.113.77, 198.51.100.25", "198.51.100.25"),
    ],
)
async def test_exact_proxy_trust_and_forwarded_chain(peer, forwarded, expected):
    clients = []

    async def app(scope, receive, send):
        clients.append(scope["client"][0])

    middleware = ProxyHeadersMiddleware(app, trusted_hosts="172.18.0.1")
    await middleware(
        {
            "type": "http",
            "client": (peer, 4321),
            "scheme": "http",
            "headers": [(b"x-forwarded-for", forwarded.encode())],
        },
        None,
        None,
    )
    assert clients == [expected]
