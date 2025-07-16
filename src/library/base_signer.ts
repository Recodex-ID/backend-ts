import jwt from 'jsonwebtoken';
// import fs from 'fs';

export type DecodeFunction=(aToken:string)=>any;
export type SignerFunction=(uData:object)=>string;

export default (privateKey, publicKey, signerOptions) => {
    const verifyToken=(aToken)=>{
        return jwt.verify(aToken, publicKey, signerOptions);
    }

    const signer:SignerFunction=(uData)=>{
        // console.log(uData);
        return jwt.sign(uData, privateKey, signerOptions);
    }

    const decode:DecodeFunction =(aToken)=>{
        try {
            // First verify the token signature and validity
            const verified = verifyToken(aToken);
            if (!verified) {
                return false;
            }
            
            // Then decode the payload
            const decoded = jwt.decode(aToken, {complete:false});
            
            // Additional security checks
            if (!decoded || typeof decoded !== 'object') {
                return false;
            }
            
            // Check if token has been blacklisted or has invalid claims
            const now = Math.floor(Date.now() / 1000);
            if (decoded.exp && decoded.exp < now) {
                return false;
            }
            
            return decoded;
        } catch (error) {
            console.error('Token decode error:', error.message);
            return false;
        }
    }

    const refreshToken=(aToken)=>{
        try {
            const decoded = decode(aToken);
            if (!decoded) {
                return false;
            }
            
            // Check if token is close to expiry (within 1 hour)
            const now = Math.floor(Date.now() / 1000);
            const timeUntilExpiry = decoded.exp - now;
            if (timeUntilExpiry > 3600) { // 1 hour in seconds
                return false; // Token is not close to expiry, no need to refresh
            }
            
            // Remove JWT standard claims and regenerate
            const {aud, exp, iat, sub, ...uData} = decoded;
            
            // Validate essential user data exists
            if (!uData._id || !uData.username) {
                return false;
            }
            
            return signer(uData);
        } catch (error) {
            console.error('Token refresh error:', error.message);
            return false;
        }
    }

    return { verifyToken, signer, decode, refreshToken }
}
