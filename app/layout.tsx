import type { Metadata } from "next";
import "./globals.css";
import { StoreProvider } from "@/components/store-provider";
export const metadata: Metadata = { title: "Jungle Digits — A whole bunch of adventure", description: "A playful jungle maths adventure. Solve banana puzzles, build your streak and conquer three stages.", icons: {icon: "/favicon.svg"} };
export default function Layout({children}: {children: React.ReactNode}) {return <html lang="en"><body><StoreProvider>{children}</StoreProvider></body></html>}
