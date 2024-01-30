FROM python:3.10-slim
ENV PYTHONUNBUFFERED True
ENV APP_HOME /app
ENV NLTK_DATA /root/nltk_data
WORKDIR $APP_HOME
RUN apt -y update && apt -y upgrade
RUN apt -y install postgresql-client
COPY . ./
RUN pip install --no-cache-dir -r requirements.txt
RUN python -m nltk.downloader punkt averaged_perceptron_tagger wordnet omw-1.4 stopwords
CMD exec gunicorn --bind :$PORT --workers 1 --threads 8 --timeout 0 main:app