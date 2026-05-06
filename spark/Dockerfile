FROM apache/spark:3.5.1-python3

USER root
RUN pip install requests --break-system-packages 2>/dev/null || pip install requests

WORKDIR /app
COPY streaming_app.py .

CMD ["/opt/spark/bin/spark-submit", "--master", "local[*]", "streaming_app.py"]