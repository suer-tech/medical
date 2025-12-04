"""Cookie handling utilities"""
from typing import Dict, Optional
from fastapi import Request

LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1"}


def is_ip_address(host: str) -> bool:
    """Check if host is an IP address"""
    # Basic IPv4 check and IPv6 presence detection
    if len(host.split(".")) == 4 and all(part.isdigit() for part in host.split(".")):
        return True
    return ":" in host


def is_secure_request(request: Request) -> bool:
    """Check if request is secure (HTTPS)"""
    if request.url.scheme == "https":
        return True
    
    forwarded_proto = request.headers.get("x-forwarded-proto")
    if not forwarded_proto:
        return False
    
    proto_list = forwarded_proto.split(",")
    return any(proto.strip().lower() == "https" for proto in proto_list)


def get_session_cookie_options(request: Request) -> Dict[str, any]:
    """Get session cookie options based on request"""
    host = request.headers.get("host", "").split(":")[0]
    is_local = host in LOCAL_HOSTS or host == "::1" or is_ip_address(host)
    
    # For localhost and IP addresses, use lax samesite without secure
    # Важно: не указываем domain для localhost/IP, чтобы cookie работал
    # SameSite=Lax работает для HTTP запросов с IP адресами
    if is_local or is_ip_address(host):
        return {
            "httponly": True,
            "path": "/",
            "samesite": "lax",
            "secure": False,
            # Не указываем domain для localhost/IP - это позволит cookie работать
        }
    else:
        # For domain names, use none with secure (for cross-site requests)
        return {
            "httponly": True,
            "path": "/",
            "samesite": "none",
            "secure": is_secure_request(request),
        }

