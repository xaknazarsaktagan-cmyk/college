import * as jose from 'npm:jose@6.2.13';
import {createHandler} from './handler.ts';
import {createFirebaseVerifier} from './firebase-jwt.ts';
const projectId=Deno.env.get('FIREBASE_PROJECT_ID')||'xako-cours';
Deno.serve(createHandler({
  projectId,
  supabaseUrl:Deno.env.get('SUPABASE_URL'),
  serviceKey:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
  verifyToken:createFirebaseVerifier(jose,projectId),
  allowedOrigins:(Deno.env.get('ALLOWED_ORIGINS')||'https://college-frontend-kohl.vercel.app,http://localhost:8081,http://127.0.0.1:8081').split(',').map(v=>v.trim()).filter(Boolean)
}));
