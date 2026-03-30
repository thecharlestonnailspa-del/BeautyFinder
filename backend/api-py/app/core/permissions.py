ROLE_PERMISSION_MAP = {
    "customer": ["browse:businesses", "book:appointments", "chat:businesses"],
    "owner": ["manage:business", "manage:bookings", "chat:customers"],
    "technician": ["manage:technician-profile", "manage:availability", "chat:clients"],
    "admin": ["manage:users", "manage:businesses", "view:platform"],
}
