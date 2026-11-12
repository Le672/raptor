bind = 'unix:/run/yukino-lab-apps/app.sock'
workers = 1
worker_class = 'gthread'
threads = 4
timeout = 65
graceful_timeout = 20
umask = 0o111
accesslog = None
errorlog = '-'
# systemd manages this service; no separate Gunicorn control socket is needed.
control_socket_disable = True
limit_request_line = 4096
limit_request_field_size = 4096
limit_request_fields = 40

def post_worker_init(worker):
    from app import start_scheduler
    start_scheduler(worker.wsgi)
