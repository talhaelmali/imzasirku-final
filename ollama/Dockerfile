FROM ollama/ollama:latest

WORKDIR /app

COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

CMD ["/bin/sh", "/app/entrypoint.sh"]
