import express from 'express';
import bodyParser from 'body-parser';
import pg from 'pg';
import axios from 'axios';
import methodOverride from "method-override";

const db = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});
db.connect();

const app = express();
const port = 3000;

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(methodOverride("_method"));

app.get('/', async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM books");
    const books = result.rows;

    res.render("index.ejs", { books: books }); // 👈 THIS is the key

  } catch (err) {
    console.log(err);
    res.send("Error loading books");
  }
});

app.get("/new", (req, res) => {
  res.render("new.ejs"); // your form page
});

app.post("/add", async (req, res) => {
  const { title, author, summary, rating } = req.body;

  try {
    // 1️⃣ Call Open Library API
    const response = await axios.get(
      `https://openlibrary.org/search.json?title=${encodeURIComponent(title)}`
    );

    const bookData = response.data.docs[0];

    let coverId = null;

    if (bookData && bookData.cover_i) {
      coverId = bookData.cover_i;
    }

    // 2️⃣ Insert into database, including cover_id
    await db.query(
      "INSERT INTO books (title, author, summary, rating, cover_id) VALUES ($1, $2, $3, $4, $5)",
      [title, author, summary, rating || 0, coverId]
    );

    res.redirect("/"); // go back to main page
  } catch (err) {
    console.error("Error adding book:", err);
    res.send(`Error adding book: ${err.message}`);
  }
});
// edit book page
app.get("/books/:id/edit", async (req, res) => {
  const bookId = req.params.id;
  try {
    const result = await db.query("SELECT * FROM books WHERE id = $1", [bookId]);
    const book = result.rows[0];

    if (!book) {
      return res.send("Book not found");
    }

    res.render("edit.ejs", { book });
  } catch (err) {
    console.error(err);
    res.send("Error loading book for edit");
  }
});
app.put("/books/:id", async (req, res) => {
  const bookId = req.params.id;
  const { title, author, summary, rating } = req.body;

  try {
    await db.query(
      "UPDATE books SET title=$1, author=$2, summary=$3, rating=$4 WHERE id=$5",
      [title, author, summary, rating, bookId]
    );

    res.redirect("/");
  } catch (err) {
    console.error(err);
    res.send("Error updating book");
  }
});
app.delete("/books/:id", async (req, res) => {
  const bookId = req.params.id;

  try {
    await db.query("DELETE FROM books WHERE id = $1", [bookId]);
    res.redirect("/");
  } catch (err) {
    console.error("Error deleting book:", err);
    res.send(`Error deleting book: ${err.message}`);
  }
});
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
