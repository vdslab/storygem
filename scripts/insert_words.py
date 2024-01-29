import argparse
import numpy as np
import psycopg

insert_sql = '''INSERT INTO words (word, lang, vector) VALUES (%s, %s, %s);'''

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('input')
    parser.add_argument('lang')
    args = parser.parse_args()

    with psycopg.connect() as conn:
        with open(args.input) as f:
            next(f)
            for row in f:
                fields = row.rstrip().split(' ')
                word = fields[0]
                values = [float(v) for v in fields[1:]]
                vector_binary = np.array(values, dtype=np.float16).tobytes()
                conn.execute(insert_sql, (word, args.lang, vector_binary))

if __name__ == '__main__':
    main()
