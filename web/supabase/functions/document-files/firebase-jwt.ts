import type * as Jose from 'npm:jose@6.2.13';
export function createFirebaseVerifier(jose:typeof Jose, projectId:string, keys?:CryptoKey|Jose.JWTVerifyGetKey) {
  const getKey = keys || jose.createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));
  return async (token:string) => {
    const {payload}=await jose.jwtVerify(token,getKey,{
      algorithms:['RS256'],issuer:`https://securetoken.google.com/${projectId}`,
      audience:projectId,requiredClaims:['exp','iat','sub'],clockTolerance:5
    });
    if(typeof payload.sub!=='string'||!payload.sub||payload.sub.length>128)throw new Error('Invalid subject');
    return payload.sub;
  };
}
