import { CartProvider } from "./context/CartContext";

export const metadata = {
  title: "Book Haven Kenya",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}