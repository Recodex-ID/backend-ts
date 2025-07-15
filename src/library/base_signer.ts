/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
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
            return verifyToken(aToken) && jwt.decode(aToken, {complete:false});       
        } catch (error) {
            return false;
        }
    }

    const refreshToken=(aToken)=>{
        const {aud, exp, iat, sub, ...uData}=decode(aToken);
        return uData && signer(uData);
    }

    return { verifyToken, signer, decode, refreshToken }
}
