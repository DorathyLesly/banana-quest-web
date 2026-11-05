import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Banana Quest — A whole bunch of adventure", description: "A playful jungle maths adventure. Solve banana puzzles, build your streak and conquer three stages.", icons: {icon: "/favicon.svg"} };
export default function Layout({children}: {children: React.ReactNode}) {return <html lang="en"><body>{children}</body></html>}
