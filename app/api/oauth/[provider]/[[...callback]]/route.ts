import { authHandler } from "@/lib/auth";
export const dynamic="force-dynamic";
export async function GET(request:Request){try{return await authHandler(request)||new Response("Not found",{status:404})}catch{return Response.redirect(new URL("/?auth=failed",request.url),303)}}
