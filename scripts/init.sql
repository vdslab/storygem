CREATE TABLE words (
  word TEXT,
  lang TEXT,
  vector BYTEA,
  PRIMARY KEY (word, lang)
);