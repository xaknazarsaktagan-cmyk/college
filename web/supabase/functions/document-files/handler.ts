const BUCKET='college-documents', MAX_FILE=5*1024*1024, MAX_BODY=MAX_FILE+65536;
const MIME: Record<string,string>={'application/pdf':'pdf','image/jpeg':'jpg','image/png':'png'};
const SIGNATURES: Record<string,number[]>={'application/pdf':[37,80,68,70,45],'image/jpeg':[255,216,255],'image/png':[137,80,78,71,13,10,26,10]};
class HttpError extends Error { status:number; code:string; constructor(status:number,code:string){super(code);this.status=status;this.code=code;} }
function fail(status:number,code:string):never {throw new HttpError(status,code);}
const segment=(v:string)=>encodeURIComponent(v);
const objectPath=(path:string)=>path.split('/').map(segment).join('/');
type FirestoreDoc={fields?:Record<string,{stringValue?:string}>};
const value=(doc:FirestoreDoc,name:string)=>doc.fields?.[name]?.stringValue;
type Options={projectId:string;supabaseUrl?:string;serviceKey?:string;verifyToken:(token:string)=>Promise<string>;fetcher?:typeof fetch;allowedOrigins?:string[]};
export function createHandler({projectId,supabaseUrl,serviceKey,verifyToken,fetcher=fetch,allowedOrigins=[]}:Options) {
  const base=supabaseUrl?.replace(/\/$/,'');
  return async (request:Request):Promise<Response> => {
    const origin=request.headers.get('origin');
    const cors:Record<string,string>={'Vary':'Origin','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
    if(origin && !allowedOrigins.includes(origin))return Response.json({code:'ORIGIN_NOT_ALLOWED'},{status:403,headers:cors});
    if(origin)cors['Access-Control-Allow-Origin']=origin;
    cors['Access-Control-Allow-Headers']='authorization,content-type';
    cors['Access-Control-Allow-Methods']='GET,POST,DELETE,OPTIONS';
    cors['Access-Control-Expose-Headers']='Content-Type,Content-Disposition';
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
    try {
      if(!projectId||!base||!serviceKey)fail(503,'STORAGE_NOT_CONFIGURED');
      if(!['GET','POST','DELETE'].includes(request.method))fail(405,'METHOD_NOT_ALLOWED');
      const token=request.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];
      if(!token)fail(401,'LOGIN_REQUIRED');
      let uid:string;try{uid=await verifyToken(token);}catch{fail(401,'INVALID_SESSION');}
      if(typeof uid!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(uid))fail(401,'INVALID_SESSION');
      const url=new URL(request.url);
      let form:FormData|undefined,id:FormDataEntryValue|null=url.searchParams.get('documentId');
      if(request.method==='POST') {
        if(Number(request.headers.get('content-length'))>MAX_BODY)fail(413,'FILE_TOO_LARGE');
        const reader=request.body?.getReader();if(!reader)fail(400,'FILE_REQUIRED');
        const parts:Uint8Array[]=[];let length=0;
        while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>MAX_BODY){await reader.cancel();fail(413,'FILE_TOO_LARGE');}parts.push(value);}
        const bytes=new Uint8Array(length);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}
        try{form=await new Request(request.url,{method:'POST',headers:{'content-type':request.headers.get('content-type')||''},body:bytes}).formData();}catch{fail(400,'INVALID_FORM');}
        id=form.get('documentId');
      }
      if(typeof id!=='string'||!id||id.length>180||!/^[A-Za-z0-9_-]+$/.test(id))fail(400,'INVALID_DOCUMENT');
      const firestore=async (path:string):Promise<FirestoreDoc>=>{
        const response=await fetcher(`https://firestore.googleapis.com/v1/projects/${segment(projectId)}/databases/(default)/documents/${path}`,{headers:{Authorization:`Bearer ${token}`}});
        if(response.status===401)fail(401,'INVALID_SESSION');
        if(response.status===403||response.status===404)fail(403,'ACCESS_DENIED');
        if(!response.ok)fail(502,'PROFILE_UNAVAILABLE');
        return await response.json() as FirestoreDoc;
      };
      const [profile,doc]=await Promise.all([firestore(`users/${segment(uid)}`),firestore(`documents/${segment(id)}`)]);
      const owner=value(doc,'user_id'), role=value(profile,'role');
      if(!owner||!role||!['applicant','admin'].includes(role))fail(403,'ACCESS_DENIED');
      if(request.method==='GET' ? owner!==uid && role!=='admin' : owner!==uid || role!=='applicant')fail(403,'ACCESS_DENIED');
      const prefix=`documents/${owner}/${id}/`;
      const validPath=(path:unknown):path is string=>typeof path==='string'&&path.startsWith(prefix)&&/^[a-f0-9-]+\.(pdf|jpg|png)$/.test(path.slice(prefix.length));
      const storageHeaders={apikey:serviceKey,Authorization:`Bearer ${serviceKey}`};
      if(request.method==='POST') {
        const file=form?.get('file');if(!(file instanceof File)||!file.size)fail(400,'FILE_REQUIRED');
        if(file.size>MAX_FILE)fail(413,'FILE_TOO_LARGE');
        if(!MIME[file.type]||typeof file.name!=='string'||file.name.length>255)fail(400,'INVALID_FILE');
        const bytes=new Uint8Array(await file.arrayBuffer());
        if(!SIGNATURES[file.type].every((b,i)=>bytes[i]===b))fail(400,'INVALID_FILE');
        const path=prefix+crypto.randomUUID()+'.'+MIME[file.type];
        const response=await fetcher(`${base}/storage/v1/object/${BUCKET}/${objectPath(path)}`,{method:'POST',headers:{...storageHeaders,'Content-Type':file.type,'x-upsert':'false'},body:bytes});
        if(!response.ok)fail(response.status===413?413:503,response.status===413?'FILE_TOO_LARGE':'STORAGE_UNAVAILABLE');
        return Response.json({path},{headers:cors});
      }
      if(request.method==='DELETE') {
        const path=url.searchParams.get('path');if(!validPath(path))fail(403,'ACCESS_DENIED');
        const response=await fetcher(`${base}/storage/v1/object/${BUCKET}`,{method:'DELETE',headers:{...storageHeaders,'Content-Type':'application/json'},body:JSON.stringify({prefixes:[path]})});
        if(!response.ok)fail(503,'STORAGE_UNAVAILABLE');
        return Response.json({ok:true},{headers:cors});
      }
      const path=value(doc,'stored_name');
      if(value(doc,'storage_provider')!=='supabase'||!validPath(path))fail(404,'FILE_NOT_FOUND');
      const response=await fetcher(`${base}/storage/v1/object/authenticated/${BUCKET}/${objectPath(path)}`,{headers:storageHeaders});
      if(response.status===404)fail(404,'FILE_NOT_FOUND');
      if(!response.ok)fail(503,'STORAGE_UNAVAILABLE');
      const mime=({'pdf':'application/pdf','jpg':'image/jpeg','png':'image/png'} as Record<string,string>)[path.split('.').pop()!];
      const filename=value(doc,'file')||`document.${MIME[mime]}`;
      return new Response(response.body,{headers:{...cors,'Content-Type':mime,'Content-Disposition':`inline; filename="document.${MIME[mime]}"; filename*=UTF-8''${encodeURIComponent(filename).replace(/'/g,'%27')}`}});
    } catch(error) {
      return Response.json({code:error instanceof HttpError?error.code:'STORAGE_UNAVAILABLE'},{status:error instanceof HttpError?error.status:503,headers:cors});
    }
  };
}
