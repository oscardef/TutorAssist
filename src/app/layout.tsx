import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "TutorAssist - Math Tutoring Practice & Progress",
  description: "A platform for math tutoring practice and progress tracking",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-gray-50 font-sans antialiased">
        <div className="flex min-h-screen flex-col">
          <main className="flex-1">{children}</main>
          <footer className="border-t border-gray-200 bg-white py-6">
            <div className="mx-auto max-w-7xl px-4 text-center text-sm text-gray-500">
              Created by Oscar de Francesca
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
