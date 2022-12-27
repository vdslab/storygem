FROM python:3.10-slim
ENV PYTHONUNBUFFERED True
ENV APP_HOME /app
ENV GENSIM_DATA_DIR /root/gensim-data
ENV NLTK_DATA /root/nltk_data
WORKDIR $APP_HOME
COPY . ./
RUN pip install --no-cache-dir -r requirements.txt
RUN python -m nltk.downloader punkt averaged_perceptron_tagger wordnet omw-1.4 stopwords
RUN python -m gensim.downloader --download word2vec-google-news-300
CMD exec gunicorn --bind :$PORT --workers 1 --threads 8 --timeout 0 main:app