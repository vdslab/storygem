import argparse
import numpy as np
import psycopg
import fasttext.util

insert_sql = '''INSERT INTO words (word, lang, frequency, vector) VALUES (%s, %s, %s, %s);'''

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('lang')
    args = parser.parse_args()

    name = fasttext.util.download_model(args.lang, if_exists='ignore', dimension=50)
    ft = fasttext.load_model(name)
    # fasttext.util.reduce_model(ft, 50)
    words, freq = ft.get_words(include_freq=True, on_unicode_error='ignore')

    with psycopg.connect() as conn:
        for i, (word, count) in enumerate(zip(words, freq)):
            # XXX currently process top 100000 words
            if i > 100000:
                break
            if i % 1000 == 999:
                print(f'{i + 1}/{len(words)}')
            if word:
                vector = np.array(ft[word], dtype=np.float16).tobytes()
                conn.execute(insert_sql, (word, args.lang, int(count), vector))

if __name__ == '__main__':
    main()
