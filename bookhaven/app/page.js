"use client";

import books from "./lib/books";
import { useCart } from "./context/CartContext";
export default function Home() {
  const { cart, addToCart } = useCart();

  return (
    <main style={{ padding: "40px", fontFamily: "Arial" }}>
      <h1>📚 Book Haven Kenya</h1>

      <p>Cart Items: {cart.length}</p>

      <h2>🔥 Featured Books</h2>

      {books.map((book) => (
        <div key={book.id} style={{ marginBottom: "10px" }}>
          <h3>{book.title}</h3>
          <p>KSh {book.price}</p>

          <button onClick={() => addToCart(book)}>
            Add to Cart
          </button>
        </div>
      ))}
    </main>
  );

}


